import {h,entryRow,segmented,snoozeSelect,snoozedSection,photoPicker,thumbs,empty,isSnoozed,metaTags,entryDetails,actionMenu,displayTitle} from '../ui.js';

const CONSTRUCTION=/umbau|wanddurchbruch|türzarge|zarge|tür\b|fenster|renovier|durchbruch/i;
const FACT_KEYS=['Breite','Höhe','Tiefe','Länge','Stärke','Material','Farbe','Budget','Menge'];

export function projectFacts(project,steps){
  const rows=[];const seen=new Set();
  for(const [k,v] of Object.entries(project.facts||{}))if(v){rows.push({key:k,value:v,own:true});seen.add(`${k}:${v}`);}
  for(const s of steps)for(const [k,v] of Object.entries(s.facts||{}))if(!seen.has(`${k}:${v}`)&&!rows.some(r=>r.value===v)){rows.push({key:/^Angabe/.test(k)?'':k,value:v});seen.add(`${k}:${v}`);}
  const keys=new Set(rows.map(r=>r.key));
  const construction=CONSTRUCTION.test(project.title)||steps.some(s=>CONSTRUCTION.test(s.details||s.title));
  const missing=construction?['Breite','Höhe'].filter(k=>!keys.has(k)):[];
  const checks=[...new Set(steps.filter(s=>s.status!=='done').flatMap(s=>s.missing_fields||[]))].filter(c=>!/Breite, Höhe/.test(c));
  return {rows,missing,checks};
}
export function orderSteps(steps){return [...steps].sort((a,b)=>(a.position??50)-(b.position??50)||a.created_at.localeCompare(b.created_at));}

function factsBox(project,steps,ctx){
  const {rows,missing,checks}=projectFacts(project,steps);
  const key=h('input',{class:'inp sm',list:'fact-keys',placeholder:'z. B. Breite','aria-label':'Angabe'});
  const value=h('input',{class:'inp sm',placeholder:'z. B. 90 cm','aria-label':'Wert'});
  const add=h('form',{class:'fact-form',onsubmit:e=>{e.preventDefault();if(!key.value.trim()||!value.value.trim())return;ctx.patchProject(project.id,{facts:{...(project.facts||{}),[key.value.trim()]:value.value.trim()}});}},key,value,h('button',{class:'btn sm'},'＋'));
  return h('div',{class:'facts'},
    h('div',{class:'facts-head'},h('span',{class:'lbl'},'Maße & Eckdaten'),missing.length?h('span',{class:'warn-text'},`⚠ fehlt: ${missing.join(', ')}`):null),
    rows.length?h('div',{class:'fact-chips'},rows.map(r=>h('span',{class:'fact'},r.key?h('b',{},r.key+' '):null,r.value,r.own?h('button',{type:'button',class:'x','aria-label':`${r.key} entfernen`,onclick:()=>{const f={...(project.facts||{})};delete f[r.key];ctx.patchProject(project.id,{facts:f});}},'×'):null))):h('span',{class:'muted sm'},'Noch keine Angaben.'),
    checks.length?h('p',{class:'check-note'},'Noch prüfen: ',checks.join(' · ')):null,
    h('details',{class:'inline-add'},h('summary',{},'Angabe ergänzen'),add));
}

function move(ordered,index,dir,ctx){
  const target=index+dir;if(target<0||target>=ordered.length)return;
  const list=[...ordered];[list[index],list[target]]=[list[target],list[index]];
  ctx.patchMany(list.map((e,i)=>[e.id,{position:(i+1)*10}]).filter(([id,d])=>ordered.find(e=>e.id===id).position!==d.position));
}

function strand(project,ctx,mode){
  const {state}=ctx;
  const steps=orderSteps(Object.values(state.entry).filter(e=>e.project_id===project.id&&e.status!=='hidden'));
  const open=steps.filter(s=>s.status!=='done'&&!isSnoozed(s));const done=steps.filter(s=>s.status==='done');
  const photos=Object.values(state.attachment).filter(a=>a.parent_type==='project'&&a.parent_id===project.id&&!a.removed);
  const pct=steps.length?Math.round(done.length/steps.length*100):0;
  const addStep=h('form',{class:'add-step',onsubmit:e=>{e.preventDefault();const v=input.value.trim();if(!v)return;ctx.quickAdd('idea',v,{project_id:project.id,position:Math.max(0,...steps.map(s=>s.position||0))+10});}},
    h('input',{class:'inp sm',placeholder:'Nächsten Schritt ergänzen …','aria-label':`Schritt zu ${project.title}`}),h('button',{class:'btn sm'},'＋'));
  const input=addStep.querySelector('input');
  const head=h('div',{class:'strand-head'},
    h('h3',{},project.title),h('span',{class:'count'},`${done.length}/${steps.length}`),
    h('div',{class:'row-actions'},actionMenu('Strang-Optionen',[
      photoPicker(f=>ctx.attachPhoto('project',project.id,f),'📷 Foto anhängen'),
      h('label',{class:'menu-line'},h('span',{class:'lbl'},'Wiedervorlage'),snoozeSelect(v=>ctx.patchProject(project.id,{revisit_at:v}),'Später zeigen')),
      h('div',{class:'row-form'},
        h('button',{type:'button',class:'btn sm ghost',onclick:()=>{const v=prompt('Strang umbenennen:',project.title);if(v&&v.trim())ctx.patchProject(project.id,{title:v.trim()});}},'Umbenennen'),
        h('button',{type:'button',class:'btn sm ghost',onclick:()=>{if(confirm('Strang abschließen? Einträge und Originale bleiben erhalten.'))ctx.patchProject(project.id,{archived:true});}},'Abschließen'))])));
  const bar=h('div',{class:'progress','aria-label':`${pct} % erledigt`},h('span',{style:`width:${pct}%`}));
  const card=h('article',{class:'strand card'},head,bar);
  if(mode==='next'){
    const [next,after]=open;
    card.append(...[next?h('div',{class:'next-step'},
      h('span',{class:'lbl'},'Nächster Handgriff'),h('div',{class:'next-title',title:next.title},displayTitle(next,state)),metaTags(next),
      h('div',{class:'row-actions'},h('button',{type:'button',class:'btn',onclick:()=>ctx.patch(next.id,{status:'done',done_at:new Date().toISOString()})},'✓ Erledigt'),entryDetails(next,ctx)),
      after?h('p',{class:'muted sm'},'Danach: ',displayTitle(after,state)):null):empty(steps.length?'Alle Schritte erledigt. 🎉':'Noch keine Schritte.'),
      factsBox(project,steps,ctx)].filter(Boolean));
  }else{
    card.append(...[factsBox(project,steps,ctx),thumbs(photos,ctx),
      h('div',{class:'steps'},open.map(s=>{const i=open.indexOf(s);return entryRow(s,ctx,{showKind:s.kind!=='idea',actions:[
        h('button',{type:'button',class:'icon-btn',disabled:i===0,'aria-label':'Nach oben',onclick:()=>move(open,i,-1,ctx)},'↑'),
        h('button',{type:'button',class:'icon-btn',disabled:i===open.length-1,'aria-label':'Nach unten',onclick:()=>move(open,i,1,ctx)},'↓')]});})),
      done.length?h('details',{class:'done-list'},h('summary',{},`Erledigt (${done.length})`),done.map(s=>entryRow(s,ctx))):null,
      snoozedSection(steps.filter(s=>isSnoozed(s)&&s.status!=='done'),ctx)].filter(Boolean));
  }
  card.append(addStep);
  return card;
}

export function renderIdeas(root,ctx){
  const {state,ui}=ctx;const mode=ui.ideasMode||'big';
  const projects=Object.values(state.project).filter(p=>!p.archived);
  const active=projects.filter(p=>!isSnoozed(p));
  const loose=Object.values(state.entry).filter(e=>e.kind==='idea'&&!e.project_id&&e.status!=='hidden');
  const looseOpen=loose.filter(e=>e.status!=='done'&&!isSnoozed(e));
  const newStrand=()=>{const v=prompt('Name des neuen Strangs (z. B. „Umbau Wohnzimmer“):');if(v&&v.trim())ctx.createProject(v.trim());};
  root.append(h('div',{class:'toolbar'},
    segmented([['big','Großes Bild'],['next','Nächster Handgriff']],mode,k=>{ui.ideasMode=k;ctx.rerender();}),
    h('button',{type:'button',class:'btn sm ghost',onclick:newStrand},'＋ Strang')));
  const grid=h('div',{class:'strands'},active.length?active.sort((a,b)=>a.title.localeCompare(b.title,'de')).map(p=>strand(p,ctx,mode)):empty('Noch keine Stränge. Zusammengehörige Gedanken (z. B. Wanddurchbruch, Türzarge, Spachteln) werden automatisch gebündelt.'));
  const looseBox=h('section',{class:'panel'},h('div',{class:'panel-head'},h('h2',{},'Einzelne Ideen'),h('span',{class:'count'},String(looseOpen.length))),
    looseOpen.length?looseOpen.map(e=>entryRow(e,ctx)):empty('Keine losen Ideen.'),
    snoozedSection(loose.filter(e=>isSnoozed(e)&&e.status!=='done'),ctx),
    loose.some(e=>e.status==='done')?h('details',{class:'done-list'},h('summary',{},`Erledigt (${loose.filter(e=>e.status==='done').length})`),loose.filter(e=>e.status==='done').map(e=>entryRow(e,ctx))):null);
  const snoozedProjects=snoozedSection(projects.filter(p=>isSnoozed(p)),ctx,p=>`◇ ${p.title}`,(p,data)=>ctx.patchProject(p.id,data));
  const archived=Object.values(state.project).filter(p=>p.archived);
  root.append(h('div',{class:'cols ideas-cols'},grid,h('div',{class:'side-col'},looseBox,snoozedProjects,
    archived.length?h('details',{class:'snoozed'},h('summary',{},`Abgeschlossene Stränge (${archived.length})`),archived.map(p=>h('div',{class:'row slim'},h('div',{class:'row-main'},h('div',{class:'row-title'},p.title)),h('button',{type:'button',class:'btn sm ghost',onclick:()=>ctx.patchProject(p.id,{archived:false})},'Wieder öffnen')))):null)),
    h('datalist',{id:'fact-keys'},FACT_KEYS.map(k=>h('option',{value:k}))));
}
