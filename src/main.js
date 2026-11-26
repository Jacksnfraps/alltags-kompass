import {LocalStore} from './data/store.js';
import {Cloud} from './data/cloud.js';
import {Synchronizer} from './data/sync.js';
import {saveAndSort} from './data/capture-flow.js';
import {AiKeyStore,maskKey,cleanKey} from './data/ai-key.js';
import {createGemini} from './data/gemini.js';
import {operation,entryDefaults,localDay,stockStatus} from './domain/state.js';
import {localSort,sortingOperations,validateSuggestions,stableId} from './domain/sort.js';
import {validateShiftRows,shiftToEntry,filterRowsByName} from './domain/shifts.js';
import {parseICS,icsToTrash,reconcileTrash,feedUrl} from './domain/ics.js';
import {uuid} from './domain/id.js';
import {h,compressImage,isSnoozed} from './ui.js';
import {renderInbox} from './views/inbox.js';
import {renderIdeas} from './views/ideas.js';
import {renderTodos} from './views/todos.js';
import {renderEvents} from './views/events.js';
import {renderMeds} from './views/meds.js';
import {createEditGuard} from './editing.js';

const VERSION='0.6.1';
const $=id=>document.getElementById(id);
const status=text=>{$('save-status').textContent=text;};
const VIEWS={inbox:['Überblick',renderInbox],ideas:['Ideen & Projekte',renderIdeas],todos:['To-dos & Listen',renderTodos],events:['Termine & Rhythmen',renderEvents],meds:['Tabletten-Zähler',renderMeds]};
const UI_KEYS=['view','ideasMode','todoFilter','todoPane','eventPane','agendaDays','personFilter','shiftPerson','listId'];
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{/* per-device convenience only */}};
let config={},cloud,store,sync,state,ready=false,renderVersion=0,aiConsent=false,aiKeys=null,aiClient=null;
// Own key (account settings / this device): Gemini is called directly from the browser, also on
// static hosting. Same contract, limits and validation as the server path. Budget per device.
const AI_MEMORY={load:()=>read('kompass.ai.budget',{}),save:value=>write('kompass.ai.budget',value)};
function userAi(){
  const key=aiKeys?.key;if(!key)return null;
  if(aiClient?.key!==key)aiClient={key,api:createGemini({geminiKey:key,freeOnly:true,model:'gemini-2.5-flash-lite',dailyLimit:100},(...args)=>fetch(...args),()=>Date.now(),AI_MEMORY)};
  return aiClient.api;
}
function aiBadge(){$('ai-state').textContent=ctx.aiAllowed()?'KI an':'';}
async function loadAiKey(){aiKeys=new AiKeyStore(cloud);await aiKeys.load();aiBadge();}
const editGuard=createEditGuard(()=>document.getElementById('view-content'));
const ui={view:'inbox',...read('kompass.ui',{})};if(!VIEWS[ui.view])ui.view='inbox';
const settings={partner:'Vanessa',kids:'',...read('kompass.settings',{})};
const peopleOptions=()=>({partner:settings.partner,kids:settings.kids.split(',').map(s=>s.trim()).filter(Boolean)});

// ---------- persistence helpers ----------
async function commit(ops,blobs=[]){
  const target=store;await target.commit(ops,blobs);if(target!==store)return;
  await refresh();await queueStatus();sync?.run();
}
// Serialised action queue: rapid taps are applied in order instead of being dropped.
let chain=Promise.resolve();
function action(fn){const next=chain.then(fn).catch(error=>{status(error.message||String(error));console.error(error);});chain=next;return next;}
const run=fn=>action(fn);
function captureOps(text,source='manual'){
  const id=uuid();return {id,op:operation('capture',id,{original_text:text,sorting_status:'reviewed',sort_source:source})};
}
const blobUrls=new Map();
async function blobUrl(id){
  if(blobUrls.has(id))return blobUrls.get(id);
  let row=await store.blob(id);
  if(!row&&cloud?.session&&navigator.onLine){try{const blob=await cloud.downloadBlob(id);row={id,blob};await store.receiveBlob(row);}catch{return null;}}
  if(!row?.blob)return null;
  const url=URL.createObjectURL(row.blob);blobUrls.set(id,url);return url;
}
const blobBase64=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});

const ctx={
  get state(){return state;},ui,settings,get config(){return config;},
  // Own key present -> AI sorting is on automatically. Otherwise: server key + consent per session.
  aiAllowed:()=>!!(aiKeys?.key||(config.aiEnabled&&aiConsent)),
  // Optional sub-pane: start-page tiles jump straight to "Einkauf", "Listen", "Müll" … (one tap instead of two).
  navigate(view,pane){ui.view=view;if(pane&&view==='todos')ui.todoPane=pane;if(pane&&view==='events')ui.eventPane=pane;saveUi();render();window.scrollTo({top:0});},
  saveSettings(patch){Object.assign(settings,patch);write('kompass.settings',settings);},
  createList:title=>run(async()=>{
    const existing=Object.values(state.list||{}).find(l=>l.title.toLocaleLowerCase('de')===title.toLocaleLowerCase('de'));
    const id=existing?.id||uuid();const ops=existing?(existing.archived?[operation('list',id,{archived:false},'patch')]:[]):[operation('list',id,{title})];
    ui.listId=id;ui.todoPane='lists';saveUi();if(ops.length)await commit(ops);else render();
    status(`Liste „${title}“ ${existing?'geöffnet':'angelegt'}.`);
  }),
  patchList:(id,data)=>run(()=>commit([operation('list',id,data,'patch')])),
  removeAttachment:att=>run(async()=>{await commit([operation('attachment',att.id,{removed:true,removed_at:new Date().toISOString()},'patch')]);status('Foto entfernt. Bereits eingetragene Dienste bleiben erhalten.');}),
  syncTrashFeed:(raw,{silent=false}={})=>run(async()=>{
    let url;try{url=feedUrl(raw);}catch(error){settings.trashFeed={...(settings.trashFeed||{}),error:error.message};write('kompass.settings',settings);render();throw error;}
    settings.trashFeed={...(settings.trashFeed||{}),url,tried:new Date().toISOString()};write('kompass.settings',settings);
    if(!silent)status('Abfuhrkalender wird abgeglichen …');
    try{
      const info=await applyTrashCalendar(await fetchFeed(url),new URL(url).hostname);
      settings.trashFeed={url,last:new Date().toISOString(),tried:settings.trashFeed.tried,info,error:null};status(`Abfuhrkalender abgeglichen: ${info}.`);
    }catch(error){settings.trashFeed={...settings.trashFeed,error:error.message};if(!silent)status(error.message);}
    write('kompass.settings',settings);render();
  }),
  importTrashFile:file=>run(async()=>{
    let info;try{info=await applyTrashCalendar(await file.text(),file.name||'Datei');}catch(error){settings.trashFeed={...(settings.trashFeed||{}),error:error.message};write('kompass.settings',settings);render();throw error;}
    settings.trashFeed={...(settings.trashFeed||{}),error:null,last:new Date().toISOString(),info:`Datei: ${info}`};write('kompass.settings',settings);render();
    status(`Abfuhrkalender importiert: ${info}.`);
  }),
  forgetTrashFeed(){settings.trashFeed=null;write('kompass.settings',settings);render();status('Kalender-Link entfernt. Eingetragene Termine bleiben.');},
  rerender(opts={}){saveUi();render(opts);},
  patch:(id,data)=>run(()=>commit([operation('entry',id,data,'patch')])),
  patchMany:list=>run(()=>list.length&&commit(list.map(([id,data])=>operation('entry',id,data,'patch')))),
  patchProject:(id,data)=>run(()=>commit([operation('project',id,data,'patch')])),
  patchStock:(id,data)=>run(()=>commit([operation('stock',id,data,'patch')])),
  createProject:(title,assign=[])=>run(async()=>{
    const existing=Object.values(state.project).find(p=>p.title.toLocaleLowerCase('de')===title.toLocaleLowerCase('de'));
    const id=existing?.id||uuid();const ops=existing?[]:[operation('project',id,{title})];
    if(existing?.archived)ops.push(operation('project',id,{archived:false},'patch'));
    for(const e of assign)ops.push(operation('entry',e,{project_id:id,kind:'idea',needs_review:false},'patch'));
    await commit(ops);status(`Strang „${title}“ ${existing?'verwendet':'angelegt'}.`);
  }),
  // Manual quick entry: the typed text is stored as an immutable original capture first.
  quickAdd:(kind,text,data={})=>run(async()=>{
    const {id,op}=captureOps(text);const entryId=uuid();
    await commit([op,operation('entry',entryId,{...entryDefaults(kind),title:data.title||text,details:text,capture_id:id,source_start:0,source_end:text.length,sort_source:'manual',...data})]);
    status('Eingetragen · Original im Eingang erhalten.');
  }),
  sortAll:captures=>run(async()=>{let n=0;for(const c of captures){try{await sortCapture(c);n++;}catch{/* stays pending */}}await refresh();sync?.run();status(n===captures.length?'Original erhalten · sortiert.':`${n} von ${captures.length} sortiert – Rest bleibt gesichert im Eingang.`);}),
  attachPhoto:(parentType,parentId,file)=>run(async()=>{
    status('Foto wird verkleinert …');const blob=await compressImage(file);const id=uuid();
    await commit([operation('attachment',id,{parent_type:parentType,parent_id:parentId,blob_id:id,name:file.name||'Foto',mime:blob.type||'image/jpeg',size:blob.size})],[{id,blob}]);
    status('Foto lokal gespeichert'+(cloud?.session?' · wird synchronisiert.':'.'));
  }),
  blobUrl,
  showImage(url,name){const d=$('image-dialog');d.querySelector('img').src=url;d.querySelector('img').alt=name||'Foto';d.showModal();},
  createStock:data=>run(async()=>{await commit([operation('stock',uuid(),{...data})]);status('Bestand angelegt.');}),
  adjustStock:(stock_id,amount,direction,note)=>run(async()=>{
    const ops=[operation('adjustment',uuid(),{stock_id,amount,direction,note,day:localDay()})];
    if(direction==='in')ops.push(operation('stock',stock_id,{rx_requested_at:null},'patch'));
    await commit(ops);status(direction==='in'?`+${amount} Stück eingetragen.`:`Bestand um ${amount} korrigiert.`);
  }),
  takeDose:stock=>run(async()=>{
    const day=localDay();if(stockStatus(stock,state).takenToday)return;
    // Deterministic id per stock/day: two devices tapping offline produce one dose.
    const id=stableId(`dose:${stock.id}:${day}:${Object.values(state.dose).filter(d=>d.stock_id===stock.id&&d.day===day).length}`);
    const op=operation('dose',id,{stock_id:stock.id,day,amount:Number(stock.daily)||1});op.id=id;await commit([op]);
    const st=stockStatus(stock,state);status(st.low?`Abgehakt. Noch ${st.balance} Stück – Rezept anfordern.`:`Abgehakt. Noch ${st.balance} Stück.`);
  }),
  undoDose:id=>run(()=>commit([operation('dose',id,{active:false},'patch')])),
  addShifts:(rows,person,text)=>run(async()=>{
    if(!rows.length)return;
    const original=text.trim()||rows.map(r=>`${r.date.split('-').reverse().join('.')} ${r.start}${r.end?'-'+r.end:''} ${r.label}`).join('\n');
    const {id,op}=captureOps(original);const ops=[op];
    for(const r of rows)ops.push(operation('entry',uuid(),{...entryDefaults('event'),...shiftToEntry(r),person,capture_id:id,details:original,sort_source:'manual'}));
    ui.eventPane='agenda';await commit(ops);status(`${rows.length} Dienste eingetragen – in der Agenda mit Kürzel sichtbar.`);
  }),
  readShiftPhoto:att=>run(async()=>{
    if(!ctx.aiAllowed()){ui.shiftDraft={rows:[],source:'text'};render();status(config.aiEnabled?'KI-Auslesen ist nur nach Zustimmung in den Einstellungen aktiv. Alternativ Dienste als Text/Zeile eintragen.':'Ohne Gemini-Key kein automatisches Auslesen. Dienste bitte als Text einfügen oder Zeile ergänzen – das Foto bleibt gespeichert.');return;}
    if(!navigator.onLine)throw new Error('Offline: Foto bleibt gespeichert, Auslesen später erneut versuchen.');
    status('Dienstplan wird ausgelesen …');
    const row=await store.blob(att.blob_id);if(!row)throw new Error('Foto nicht auf diesem Gerät.');
    const name=settings.shiftName??'';
    const image=await blobBase64(row.blob),mime=row.blob.type||'image/jpeg',year=new Date().getFullYear();
    let result;
    if(userAi())result=await userAi().readShiftPlan(image,mime,year,name);
    else{const response=await fetch('./api/shiftplan',{method:'POST',headers:{'Content-Type':'application/json','X-Kompass-Token':config.sortToken},body:JSON.stringify({image,mime,year,name}),signal:AbortSignal.timeout(30000)});
      result=response.ok?await response.json():{source:'local',rows:[]};}
    let rows=[];try{rows=filterRowsByName(validateShiftRows(result.rows||[]),name);}catch{rows=[];}
    ui.shiftDraft={rows,source:result.source==='gemini'?'gemini':'text',info:name?`Foto auf „${name}“ gefiltert – bitte jede Zeile prüfen.`:''};render();
    status(rows.length?'Bitte erkannte Dienste prüfen und bestätigen.':'Nicht automatisch lesbar. Bitte als Text oder Zeile eintragen.');
  })
};
// ---------- waste calendar (.ics) ----------
// Local server: CORS-free proxy (/api/ics). Static hosting: direct fetch, which works only if the
// provider allows it – otherwise the .ics file can be imported by hand.
async function fetchFeed(url){
  if(!config.hosted&&config.sortToken){
    let response;
    try{response=await fetch('./api/ics',{method:'POST',headers:{'Content-Type':'application/json','X-Kompass-Token':config.sortToken},body:JSON.stringify({url}),signal:AbortSignal.timeout(20000)});}
    catch{throw new Error('Kalender nicht erreichbar (offline?). Termine bleiben unverändert; später erneut abgleichen.');}
    if(response.ok)return response.text();
    if(response.status!==404){const body=await response.json().catch(()=>({}));throw new Error(`${body.error||'Kalenderabruf fehlgeschlagen'} – Termine bleiben unverändert. Alternativ die .ics-Datei importieren.`);}
  }
  let response;
  try{response=await fetch(url,{signal:AbortSignal.timeout(20000)});}
  catch{throw new Error('Der Kalender lässt sich hier nicht direkt abrufen (Sperre des Anbieters). Bitte die .ics-Datei herunterladen und über „.ics-Datei importieren“ einlesen.');}
  if(!response.ok)throw new Error(`Kalender antwortet mit ${response.status} – Termine bleiben unverändert.`);
  return response.text();
}
async function applyTrashCalendar(text,label){
  const {rows,unsupported}=icsToTrash(parseICS(text),{from:new Date(),stableId});
  const {create,update,vanished,skipped}=reconcileTrash(rows,state);
  const ops=[];
  if(create.length){
    const lines=create.slice(0,80).map(r=>`${r.due_at.slice(0,10).split('-').reverse().join('.')} ${r.title}${r.recurrence?' ('+r.recurrence+')':''}`);
    const {id,op}=captureOps([`Abfuhrkalender (${label}): ${create.length} neue Termine`,...lines].join('\n'),'ics');ops.push(op);
    for(const {id:eid,summary,...data} of create){const o=operation('entry',eid,{...entryDefaults('event'),...data,capture_id:id,details:summary||data.title,sort_source:'ics',needs_review:false});o.id=eid;ops.push(o);}
  }
  for(const [eid,data] of [...update,...vanished])ops.push(operation('entry',eid,data,'patch'));
  if(ops.length)await commit(ops);
  return [`${create.length} neu`,update.length?`${update.length} geändert`:'',vanished.length?`${vanished.length} entfallen`:'',skipped?`${skipped} schon von Hand eingetragen`:'',unsupported?`${unsupported} mit Sonderrhythmus nur als Einzeltermin`:''].filter(Boolean).join(', ');
}
function autoTrashSync(){
  const f=settings.trashFeed;if(!f?.url||!navigator.onLine||!ready)return;
  if(Date.now()-new Date(f.tried||f.last||0).getTime()>20*3600e3)ctx.syncTrashFeed(f.url,{silent:true});
}
function saveUi(){write('kompass.ui',Object.fromEntries(UI_KEYS.map(k=>[k,ui[k]])));}

// ---------- sorting ----------
async function sortCapture(capture,target=store){
  const snapshot=await target.state();
  if(Object.values(snapshot.entry).some(e=>e.capture_id===capture.id)||snapshot.capture[capture.id]?.linked_lists?.length)return 'local';
  // Existing lists and strands are the context for both paths (AI and local fallback).
  const lists=Object.values(snapshot.list||{}).filter(l=>!l.archived);
  const projects=Object.values(snapshot.project).filter(p=>!p.archived);
  let parts=localSort(capture.original_text,Object.values(snapshot.project),{people:peopleOptions(),lists}),source='local';
  if(ctx.aiAllowed()&&navigator.onLine){
    try{
      const context={lists:lists.map(l=>l.title),projects:projects.map(p=>p.title)};
      const own=userAi();
      if(own){
        // Direct call with the own key: same segments (incl. people) and full list objects for validation.
        const result=await own.sort(capture.original_text,context,{parts,lists});
        if(result.source==='gemini'){parts=result.parts;source='gemini';}
      }else{
      const response=await fetch('./api/parse',{method:'POST',headers:{'Content-Type':'application/json','X-Kompass-Token':config.sortToken},body:JSON.stringify({text:capture.original_text,lists:lists.map(l=>l.title),projects:projects.map(p=>p.title)}),signal:AbortSignal.timeout(15000)});
      if(response.ok){const result=await response.json();if(result.source==='gemini'){
        // Re-validated here against the local segments: the server answer is never trusted blindly.
        parts=validateSuggestions(result.parts.map((p,index)=>({...p,index,action:p.action||'none',list_name:p.list_name??p.list??''})),parts,{lists,text:capture.original_text});source='gemini';}}
      }
    }catch{/* Original is already committed; local metadata remains usable. */}
  }
  await target.commit(sortingOperations(capture,parts,snapshot,source));
  return source;
}

// ---------- rendering ----------
function navBadges(){
  const entries=Object.values(state.entry).filter(e=>e.status!=='hidden'&&e.status!=='done');
  const today=localDay();
  const counts={
    inbox:entries.filter(e=>e.needs_review).length||'',
    ideas:Object.values(state.project).filter(p=>!p.archived&&!isSnoozed(p)).length||'',
    todos:entries.filter(e=>e.kind==='todo'&&!isSnoozed(e)).length||'',
    events:entries.filter(e=>e.kind==='event'&&e.due_at&&e.due_at.slice(0,10)===today).length||'',
    meds:Object.values(state.stock).some(s=>!s.archived&&stockStatus(s,state).low)?'!':''
  };
  document.querySelectorAll('[data-view]').forEach(b=>{
    const v=b.dataset.view;b.classList.toggle('active',v===ui.view);b.setAttribute('aria-current',v===ui.view?'page':'false');
    const badge=b.querySelector('b');if(badge){badge.textContent=counts[v];badge.className=v==='meds'&&counts[v]?'alert':v==='inbox'&&counts[v]?'alert':'';}
  });
}
function render({keepFocus}={}){
  if(!state)return;
  const [title,fn]=VIEWS[ui.view];$('view-title').textContent=title;document.title=`${title} · Kompass`;
  navBadges();
  const content=$('view-content');const scroll=window.scrollY;
  const focused=keepFocus&&document.activeElement;const caret=focused?.selectionStart;
  const next=document.createElement('div');next.id='view-content';next.className=`view view-${ui.view}`;
  try{fn(next,ctx);}catch(error){console.error(error);next.append(h('p',{class:'empty'},`Ansicht konnte nicht aufgebaut werden: ${error.message}. Daten sind unverändert.`));}
  // Keep labelled <details> (e.g. "Erledigt (3)") open across re-renders after small patches.
  const key=d=>{const t=d.querySelector(':scope>summary')?.textContent.replace(/\(\d+\)/g,'').trim();return t&&t.length>2?t:null;};
  const open=new Set([...content.querySelectorAll('details[open]')].map(key).filter(Boolean));
  // The form being typed in survives (focus, keyboard, typed text); everything around it is rebuilt.
  editGuard.take();editGuard.swap(content,next);
  for(const d of content.querySelectorAll('details'))if(open.has(key(d)))d.open=true;
  window.scrollTo({top:scroll});
  if(keepFocus){const el=content.querySelector(`.${keepFocus}`);if(el&&el!==document.activeElement){el.focus();if(caret!=null)el.setSelectionRange(caret,caret);}}
}
// Background updates (sync, realtime, app back in front, clock) never interrupt typing:
// unchanged data -> no re-render at all; while typing -> render once typing is done.
let lastSignature='';
function backgroundRender(){if(!editGuard.defer())render();}
async function refresh({background=false}={}){
  const target=store;const version=++renderVersion;const nextState=await target.state();if(target!==store||version!==renderVersion)return;
  const signature=JSON.stringify(nextState);const changed=signature!==lastSignature;lastSignature=signature;state=nextState;
  if(!background)render();else if(changed||editGuard.pending)backgroundRender();
}
function connection(text,kind=''){const c=$('connection');c.textContent=text;c.dataset.kind=kind;}
async function queueStatus(){
  if(!store)return;const target=store;const count=(await target.operations()).filter(x=>x.pending).length;
  if(target!==store)return;
  if(target.scope==='guest')connection(navigator.onLine?'Lokal':'Offline · lokal','local');
  else connection(count?`${navigator.onLine?'':'Offline · '}${count} warten`:'Synchron',count?'pending':'ok');
}

// ---------- settings dialog ----------
function drawSettings(){
  const body=$('settings-body');body.replaceChildren();
  const acc=h('section',{class:'set-block'},h('h3',{},cloud?.session?`Konto: ${cloud.session.user.email}`:'Konto & Synchronisierung'));
  if(!cloud.configured)acc.append(h('p',{class:'muted sm'},'Lokaler Betrieb ist aktiv. Für Gerätesynchronisierung und Zugriff von unterwegs (mobile Daten/5G): Supabase-Free-Projekt verbinden und die App kostenlos hosten – Schritt für Schritt in EINRICHTUNG.md, Abschnitt „Von unterwegs nutzen“.'));
  else if(cloud.session){
    acc.append(h('p',{class:'muted sm'},'Änderungen werden zuerst lokal gesichert und bei Verbindung automatisch mit diesem Konto abgeglichen. Gastdaten bleiben getrennt.'),
      h('div',{class:'form-line'},
        h('button',{type:'button',class:'btn sm',onclick:()=>run(async()=>{await sync?.run();})},'Jetzt synchronisieren'),
        h('button',{type:'button',class:'btn sm ghost',onclick:()=>run(async()=>{
          if(!confirm('Alle lokalen Gastgedanken und Bilder in dieses Konto übernehmen und synchronisieren? Die Gastkopie bleibt erhalten.'))return;
          const guest=new LocalStore();await guest.migrateLegacy();
          const existing=new Set((await store.operations()).map(x=>x.id));
          const rows=(await guest.operations()).filter(x=>!existing.has(x.id)).map(({scope,seq,pending,owner_id,...row})=>row);
          const existingBlobs=new Set((await store.blobs()).map(x=>x.id));
          const blobs=(await guest.blobs()).filter(x=>!existingBlobs.has(x.id)).map(({scope,pending,...b})=>b);
          await commit(rows,blobs);status(`Gastkopie übernommen (${rows.length} Änderungen).`);
        })},'Gastdaten übernehmen'),
        h('button',{type:'button',class:'btn sm ghost',onclick:()=>run(async()=>{
          await sync?.stop();await cloud.refreshing;let logoutError;aiKeys?.forgetDevice();
          try{await cloud.logout();}catch(error){logoutError=error;}
          cloud=new Cloud(config);await switchStore();drawSettings();
          status(logoutError?'Lokal abgemeldet. Server-Abmeldung war offline nicht erreichbar.':'Abgemeldet. Nicht synchronisierte Kontodaten bleiben auf diesem Gerät.');
        })},'Abmelden')));
  }else{
    const email=h('input',{class:'inp',type:'email',name:'email',required:true,autocomplete:'username','aria-label':'E-Mail'});
    const password=h('input',{class:'inp',type:'password',name:'password',required:true,autocomplete:'current-password','aria-label':'Passwort'});
    const feedback=h('p',{class:'muted sm',role:'status'});
    const form=h('form',{class:'account-form',onsubmit:event=>{event.preventDefault();const signup=event.submitter?.value==='signup';
      run(async()=>{try{const next=new Cloud(config);const ok=await next.login(email.value,password.value,signup);
        if(!ok){feedback.textContent='Bestätigungs-E-Mail öffnen, danach hier anmelden.';return;}
        cloud=next;await switchStore();drawSettings();status('Angemeldet. Gastdaten bleiben separat.');
      }catch(error){feedback.textContent=error.message;}});}},
      h('label',{},'E-Mail',email),h('label',{},'Passwort',password),
      h('div',{class:'form-line'},h('button',{class:'btn sm',value:'login'},'Anmelden'),h('button',{class:'btn sm ghost',value:'signup'},'Registrieren')),feedback);
    acc.append(form);
  }
  const ai=drawAiBlock();
  const partner=h('input',{class:'inp',value:settings.partner,'aria-label':'Name Partnerin'});
  const kids=h('input',{class:'inp',value:settings.kids,placeholder:'z. B. Mia, Ben','aria-label':'Namen der Kinder'});
  const ppl=h('section',{class:'set-block'},h('h3',{},'Personen für Termine'),
    h('form',{class:'account-form',onsubmit:e=>{e.preventDefault();settings.partner=partner.value.trim()||'Partnerin';settings.kids=kids.value;write('kompass.settings',settings);render();status('Personen gespeichert (nur auf diesem Gerät).');}},
      h('label',{},'Partnerin',partner),h('label',{},'Kinder (Komma-getrennt, als einzelne Kalenderfilter)',kids),h('button',{class:'btn sm'},'Speichern')));
  const importInput=h('input',{type:'file',accept:'application/json,.json',class:'sr-only',onchange:()=>{const f=importInput.files[0];importInput.value='';if(f)run(()=>importBackup(f));}});
  const data=h('section',{class:'set-block'},h('h3',{},'Daten'),
    h('p',{class:'muted sm'},`Speicher: ${store?.scope==='guest'?'Gastmodus auf diesem Gerät':'Kontospeicher'} · ${Object.keys(state?.capture||{}).length} Originale · v${VERSION}`),
    h('div',{class:'form-line'},h('button',{type:'button',class:'btn sm',onclick:()=>run(exportBackup)},'Sicherung exportieren'),h('label',{class:'btn sm ghost file'},'Sicherung importieren',importInput)),
    h('p',{class:'muted sm'},'Import ergänzt nur fehlende Einträge; vorhandene Daten werden nie überschrieben.'));
  body.append(acc,ai,ppl,data);
}
// "KI-Sortierung (optional)": own Gemini key. Signed in -> account settings (Supabase, all devices);
// guest -> only this browser. With a key AI sorting is on automatically, without it sorting stays local.
function drawAiBlock(){
  const keys=aiKeys||new AiKeyStore(cloud);
  const signedIn=!!cloud?.session;
  const feedback=h('p',{class:'muted sm',role:'status'});
  const redraw=text=>{drawSettings();aiBadge();const f=$('settings-body').querySelector('.ai-feedback');if(f&&text)f.textContent=text;};
  feedback.classList.add('ai-feedback');
  const state=keys.key
    ?`Aktiv · Key ${maskKey(keys.key)} ${keys.where==='account'?'im Konto gespeichert – nach dem Anmelden auf allen Geräten (z. B. iPhone) automatisch da.':'nur auf diesem Gerät gespeichert (Gastmodus).'}`
    :config.aiEnabled?'Kein eigener Key. Der lokale Server hat einen Key – Nutzung nach Zustimmung unten.':'Aus · es wird lokal sortiert. Mit eigenem Gemini-Key wird die KI-Sortierung automatisch aktiv.';
  const input=h('input',{class:'inp ai-key',type:'password',name:'gemini-key',autocomplete:'off',autocapitalize:'off',spellcheck:'false',placeholder:keys.key?'Neuen Key eingeben, um ihn zu ersetzen':'AIza…','aria-label':'Gemini-API-Key'});
  const saveButton=h('button',{type:'submit',class:'btn sm'},'Key speichern');
  input.placeholder=keys.key?'Neuen vollständigen Key eingeben':'Vollständigen API-Key einfügen';
  input.addEventListener('input',()=>{feedback.textContent='';});
  const form=h('form',{class:'account-form',onsubmit:event=>{event.preventDefault();
    if(saveButton.disabled)return;
    // Capture now, not later in the unrelated operation queue. Show progress immediately.
    const raw=input.value;const accountCloud=cloud;
    saveButton.disabled=true;input.disabled=true;
    const notify=text=>{feedback.textContent=text;status(text);};
    void (async()=>{try{
      feedback.textContent='Key wird geprüft …';
      // Validate the candidate BEFORE replacing the account key. A typo must not erase a working key.
      let candidate;try{candidate=cleanKey(raw);}catch(error){notify(error.message);return;}
      const check=navigator.onLine?await createGemini({geminiKey:candidate,freeOnly:true,model:'gemini-2.5-flash-lite'}).verify():{ok:false,reason:'offline'};
      if(check.invalid){notify(check.reason+' Der bisherige Key bleibt unverändert.');return;}
      if(cloud!==accountCloud||keys.signedIn!==signedIn){notify('Konto wurde gewechselt. Bitte im gewünschten Konto erneut speichern.');return;}
      notify(signedIn?'Key wird im Konto gespeichert …':'Key wird auf diesem Gerät gespeichert …');
      try{await keys.save(candidate);}catch(error){notify(error.message);return;}
      aiKeys=keys;
      redraw(`Gespeichert${keys.where==='account'?' im Konto':' auf diesem Gerät'} · KI-Sortierung ist aktiv${check.ok?'':` (Prüfung nicht möglich: ${check.reason})`}.`);
      status('KI-Sortierung aktiv (Gemini Free Tier).');
    }catch{notify('Key konnte nicht gespeichert werden. Bitte Verbindung prüfen und erneut versuchen.');}
    finally{saveButton.disabled=false;input.disabled=false;}})();}},
    h('label',{},'Eigener Gemini-API-Key',input),
    h('div',{class:'form-line'},saveButton,
      keys.key?h('button',{type:'button',class:'btn sm ghost',onclick:()=>run(async()=>{
        if(!confirm(signedIn?'Key aus dem Konto entfernen? Danach wird auf allen Geräten lokal sortiert.':'Key von diesem Gerät entfernen?'))return;
        try{await keys.remove();}catch(error){feedback.textContent=error.message;return;}
        redraw('Key entfernt · es wird wieder lokal sortiert.');status('KI-Sortierung aus – lokale Sortierung aktiv.');
      })},'Key entfernen'):null),
    feedback);
  const block=h('section',{class:'set-block'},h('h3',{},'KI-Sortierung (optional)'),h('p',{class:'sm'},state),form);
  if(keys.error)block.append(h('p',{class:'check-note'},keys.error));
  if(signedIn&&!keys.key&&keys.guestKey)block.append(h('div',{class:'form-line'},
    h('span',{class:'muted sm'},'Auf diesem Gerät liegt noch ein Key aus dem Gastmodus.'),
    h('button',{type:'button',class:'btn sm ghost',onclick:()=>run(async()=>{try{await keys.adoptGuestKey();aiKeys=keys;redraw('Key ins Konto übernommen · KI-Sortierung aktiv.');}catch(error){feedback.textContent=error.message;}})},'Ins Konto übernehmen')));
  block.append(h('p',{class:'muted sm'},
    'Key kostenlos in Google AI Studio erstellen (aistudio.google.com → „Get API key“), in einem Projekt ',h('b',{},'ohne'),' Abrechnung/Kreditkarte – dann bleibt es bei 0 €. ',
    'Mit Key werden Texte und auf Wunsch Dienstplan-Fotos direkt an Gemini (Free Tier) gesendet; Google kann diese Inhalte zur Produktverbesserung nutzen. ',
    'Höchstens 100 Aufrufe pro Tag und Gerät, nach Fehlern 15 Minuten Pause – dann wird automatisch lokal sortiert.',
    signedIn?'':cloud?.configured?' Tipp: Erst anmelden, dann speichern – so ist der Key auch auf dem iPhone da.':''));
  if(config.aiEnabled&&!keys.key)block.append(h('label',{class:'check-line'},h('input',{type:'checkbox',checked:aiConsent,onchange:e=>{aiConsent=e.target.checked;aiBadge();}}),
    ' Für diese Sitzung den Server-Key nutzen und Texte/Dienstplan-Fotos an Gemini senden.'));
  return block;
}
async function exportBackup(){
  const operations=await store.operations();const files=[];
  for(const row of await store.blobs())files.push({id:row.id,data:await blobBase64(row.blob),type:row.blob.type});
  const blob=new Blob([JSON.stringify({version:2,exported_at:new Date().toISOString(),operations,files},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`kompass-sicherung-${localDay()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status('Sicherung erstellt.');
}
async function importBackup(file){
  let data;try{data=JSON.parse(await file.text());}catch{throw new Error('Datei ist keine gültige Kompass-Sicherung.');}
  if(!Array.isArray(data.operations))throw new Error('Datei enthält keine Operationen.');
  const valid=data.operations.filter(o=>o&&typeof o.id==='string'&&typeof o.entity==='string'&&typeof o.entity_id==='string'&&['create','patch'].includes(o.action)&&o.data&&typeof o.data==='object'&&typeof o.created_at==='string');
  const existing=new Set((await store.operations()).map(x=>x.id));
  const rows=valid.filter(o=>!existing.has(o.id)).map(({scope,seq,pending,owner_id,...row})=>row);
  const blobsHave=new Set((await store.blobs()).map(b=>b.id));
  const blobs=[];for(const f of data.files||[]){if(!f?.id||blobsHave.has(f.id)||typeof f.data!=='string')continue;
    const raw=f.data.includes(',')?f.data.split(',')[1]:f.data;const type=f.type||f.data.match(/^data:([^;]+)/)?.[1]||'image/jpeg';
    const bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));blobs.push({id:f.id,blob:new Blob([bytes],{type})});}
  if(!confirm(`${rows.length} neue Änderungen und ${blobs.length} Fotos importieren?`))return;
  await commit(rows,blobs);status(`Import abgeschlossen: ${rows.length} Änderungen, ${blobs.length} Fotos.`);drawSettings();
}

// ---------- account switching ----------
async function switchStore(){
  ready=false;await sync?.stop();sync=null;
  for(const url of blobUrls.values())URL.revokeObjectURL(url);blobUrls.clear();
  store=new LocalStore(cloud.session?`${cloud.url}:${cloud.session.user.id}`:'guest');
  await store.migrateLegacy();
  $('dump').value=localStorage.getItem(`kompass.draft:${store.scope}`)||'';grow();
  await refresh();ready=true;await queueStatus();
  $('account-hint').textContent=cloud.session?cloud.session.user.email:'Gastmodus';
  // Key of this account (Supabase) or of guest mode (this device). Never blocks the start.
  await loadAiKey().catch(()=>{});
  if(cloud.session){const target=store;sync=new Synchronizer(target,cloud,async()=>{if(store===target)await refresh({background:true});},text=>{if(store===target)connection(text,'sync');});sync.start();}
}

// ---------- capture ----------
function grow(){const t=$('dump');t.style.height='auto';t.style.height=Math.min(t.scrollHeight+2,window.innerHeight*.45)+'px';}
$('dump').addEventListener('input',()=>{grow();if(!store)return;try{localStorage.setItem(`kompass.draft:${store.scope}`,$('dump').value);}catch{status('Entwurf bleibt im Eingabefeld. Bitte mit „Sichern“ speichern.');}});
$('dump').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();$('capture-form').requestSubmit();}});
$('capture-form').addEventListener('submit',event=>{
  event.preventDefault();if(!ready)return;
  action(async()=>{
    const text=$('dump').value;if(!text.trim())return;
    const button=$('capture-form').querySelector('button');button.disabled=true;
    try{
      const result=await saveAndSort(store,text,sortCapture,async()=>{
        // Clear only after the IndexedDB transaction has committed successfully.
        $('dump').value='';grow();try{localStorage.removeItem(`kompass.draft:${store.scope}`);}catch{/* Original already durable. */}
        status('Original gesichert · wird sortiert …');
      });
      await refresh();
      const linked=Object.values(state.entry).filter(e=>e.capture_id===result.capture.id);
      const review=linked.filter(e=>e.needs_review).length;
      // Name the list(s) so it is visible where the thought went ("→ Tasche Alfsee", "Liste „Tasche Aasee“ angelegt").
      const lists=(state.capture[result.capture.id]?.linked_lists||[]).map(id=>state.list?.[id]?.title).filter(Boolean);
      const exceptions=linked.filter(e=>e.category==='exception'&&e.status==='done').length;
      const where=exceptions?` · ${exceptions} Rhythmus-Ausnahme berücksichtigt`:lists.length?` · ${linked.length?'→ ':'Liste '}${lists.map(t=>`„${t}“`).join(', ')}${linked.length?'':' bereit'}`:'';
      status(result.sorted?`✓ Gesichert · ${linked.length?`${linked.length} ${linked.length===1?'Eintrag':'Einträge'} `:''}${result.source==='gemini'?'mit Gemini':'lokal'} einsortiert${where}${review?` · ${review} kurz klären`:''}.`:'Original vollständig gesichert. Sortierung noch offen – im Eingang „sortieren“ tippen.');
      await queueStatus();sync?.run();
    }finally{button.disabled=false;}
  });
});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>ctx.navigate(b.dataset.view)));
$('open-settings').addEventListener('click',()=>{drawSettings();$('settings').showModal();});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
window.addEventListener('offline',()=>connection('Offline · lokal gesichert','local'));
window.addEventListener('online',()=>{if(sync)sync.run();else queueStatus().catch(error=>status(error.message));if(cloud?.session)aiKeys?.load().then(aiBadge).catch(()=>{});});
let keyChecked=Date.now();
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready){refresh({background:true}).catch(error=>status(error.message));autoTrashSync();
  // A key saved on another device arrives here when the app comes back to the front (at most every 10 min).
  if(cloud?.session&&Date.now()-keyChecked>10*60e3){keyChecked=Date.now();aiKeys?.load().then(aiBadge).catch(()=>{});}}});
// iPhone keyboard: the capture bar sits above the bottom tabs. While the on-screen keyboard is open,
// visualViewport shrinks; we lift the bar exactly above the keyboard (--kb) and hide the tabs.
// Focus in any other field hides the bar so it never covers what is being typed.
function syncKeyboard(){
  const vv=window.visualViewport;if(!vv)return;
  const kb=Math.max(0,Math.round(window.innerHeight-vv.height-vv.offsetTop));
  document.documentElement.style.setProperty('--kb',`${kb}px`);
  document.body.classList.toggle('kb-open',kb>80);
}
window.visualViewport?.addEventListener('resize',syncKeyboard);
window.visualViewport?.addEventListener('scroll',syncKeyboard);
$('dump').addEventListener('focus',()=>{document.body.classList.add('dump-focus');setTimeout(syncKeyboard,350);});
$('dump').addEventListener('blur',()=>{document.body.classList.remove('dump-focus');setTimeout(syncKeyboard,350);});
// Only one "⋯" menu at a time.
document.addEventListener('toggle',e=>{const d=e.target;if(d instanceof HTMLDetailsElement&&d.open&&d.classList.contains('more'))document.querySelectorAll('details.more[open]').forEach(o=>{if(o!==d&&!o.contains(d))o.open=false;});},true);
// Day change while open (meds "heute", agenda): re-render every few minutes.
setInterval(()=>{if(ready&&!document.hidden)backgroundRender();},5*60*1000);
// Typing finished (focus left the view's fields) -> apply a deferred background update.
document.addEventListener('input',e=>editGuard.markInput(e),true);
document.addEventListener('change',e=>editGuard.markInput(e),true);
document.addEventListener('submit',e=>editGuard.afterSubmit(e));
document.addEventListener('focusout',()=>setTimeout(()=>{if(ready&&editGuard.pending&&!editGuard.editing())render();},300));

async function boot(){
  config=read('kompass.config',{});
  // Local server: /api/config. Static hosting (GitHub/Cloudflare Pages …): config.json from "npm run build:static".
  if(navigator.onLine){try{let response=await fetch('./api/config',{signal:AbortSignal.timeout(5000)});
    if(!response.ok)response=await fetch('./config.json',{cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(response.ok){config=await response.json();write('kompass.config',config);}}catch{/* Offline startup uses the cached public configuration. */}}
  cloud=new Cloud(config);await switchStore();
  if(config.requireLogin&&cloud.configured&&!cloud.session){drawSettings();$('settings').showModal();status('Bitte anmelden – dann sind deine Daten auf allen Geräten da. Ohne Anmeldung bleibt alles nur auf diesem Gerät.');}
  autoTrashSync();
  if('serviceWorker' in navigator&&window.isSecureContext){
    const registration=await navigator.serviceWorker.register('./sw.js');
    if(navigator.serviceWorker.controller)registration.addEventListener('updatefound',()=>status('Neue App-Version geladen.'));
  }
}
boot().catch(error=>status(`Start nicht abgeschlossen: ${error.message}. Vorhandene Daten wurden nicht gelöscht.`));
