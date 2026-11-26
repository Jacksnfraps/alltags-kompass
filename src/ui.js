// Small DOM helpers and shared components. No framework.
import {kindNames,cleanTitle,summarize} from './domain/sort.js';
import {localDay} from './domain/state.js';
import {parseWhen,stripWhen} from './domain/when.js';

// Display title: short and free of date phrases. A title the user set by hand (title_custom) wins;
// the original text is never touched (it lives in the capture).
export function displayTitle(entry,state=null){
  const t=String(entry?.title||'');if(!t||entry.title_custom)return t;
  if(entry.category==='shopping'||entry.category==='list')return entry.items?.length?entry.items.join(', '):t;
  if(entry.kind==='event'||(entry.due_at&&entry.kind!=='idea'&&entry.kind!=='todo'))return cleanTitle(stripWhen(t));
  if(entry.kind==='idea'||entry.kind==='todo'){
    // Summarise from the original section (older titles may be cut off with "…"), not from the title.
    const src=entry.details&&entry.details.length>=t.replace(/\s…$/u,'').length?entry.details:t.replace(/\s…$/u,'');
    const pt=entry.project_id&&state?.project?.[entry.project_id]?.title||'';
    return summarize(entry.due_at?stripWhen(src):src,{projectTitle:pt});
  }
  return cleanTitle(t);
}

// Patch for a manual kind change. Switching to "Termin" derives the date from the entry's own
// text relative to when it was written ("Heute 19 Uhr" written yesterday stays yesterday).
export function kindPatch(entry,kind,extra={}){
  const patch={kind,needs_review:false,category:kind===entry.kind?entry.category:'general',...extra};
  if(kind==='event'&&!entry.due_at){
    const w=parseWhen(entry.details||entry.title||'',new Date(entry.created_at||Date.now()));
    if(w.due_at)Object.assign(patch,{due_at:w.due_at,all_day:!w.has_time,recurrence:w.recurrence||null,category:w.recurrence?'rhythm':'appointment'});
    else patch.category='appointment';
  }
  return patch;
}

const PROPS=new Set(['value','checked','selected','disabled','open','hidden','multiple']);
export function h(tag,props={},...kids){
  const n=document.createElement(tag);
  for(const [k,v] of Object.entries(props||{})){
    if(v==null||v===false)continue;
    if(k==='class')n.className=v;
    else if(k==='dataset')Object.assign(n.dataset,v);
    else if(k.startsWith('on')&&typeof v==='function')n.addEventListener(k.slice(2),v);
    else if(PROPS.has(k))n[k]=v;
    else n.setAttribute(k,v===true?'':v);
  }
  for(const c of kids.flat(Infinity)){if(c==null||c===false)continue;n.append(c instanceof Node?c:String(c));}
  return n;
}
export const pad=n=>String(n).padStart(2,'0');
const WD=['So','Mo','Di','Mi','Do','Fr','Sa'];
export function dayLabel(date,now=new Date()){
  const d=localDay(date),t=localDay(now);
  const tomorrow=new Date(now);tomorrow.setDate(now.getDate()+1);
  if(d===t)return 'Heute';if(d===localDay(tomorrow))return 'Morgen';
  return `${WD[date.getDay()]} ${pad(date.getDate())}.${pad(date.getMonth()+1)}.`;
}
export const timeLabel=date=>`${pad(date.getHours())}:${pad(date.getMinutes())}`;
export function whenLabel(entry){
  if(!entry.due_at)return '';const d=new Date(entry.due_at);if(!Number.isFinite(d.getTime()))return '';
  return entry.all_day?dayLabel(d):`${dayLabel(d)} ${timeLabel(d)}`;
}
export function toInputDate(date){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;}
export function addDays(days,from=new Date()){const d=new Date(from.getFullYear(),from.getMonth(),from.getDate()+days,8,0);return d.toISOString();}

export const RECURRENCE={'':'einmalig',daily:'täglich',weekly:'wöchentlich',biweekly:'alle 2 Wochen',fourweekly:'alle 4 Wochen',monthly:'monatlich'};
export const VIEW_OF={idea:'ideas',todo:'todos',event:'events',medication:'meds'};
export const KIND_ICON={idea:'◇',todo:'✓',event:'▦',medication:'⊕'};

export function people(settings){
  return {me:{label:'Ich',short:'I'},vanessa:{label:settings.partner||'Partnerin',short:(settings.partner||'P')[0].toUpperCase()},kids:{label:'Kinder',short:'K'},family:{label:'Familie',short:'F'}};
}
export function personBadge(person,settings){const p=people(settings)[person]||people(settings).me;return h('span',{class:`pbadge p-${person||'me'}`,title:p.label,'aria-label':p.label},p.short);}

export const isSnoozed=(item,now=Date.now())=>!!item.revisit_at&&new Date(item.revisit_at).getTime()>now;
export const isBack=(item,now=Date.now())=>!!item.revisit_at&&new Date(item.revisit_at).getTime()<=now&&item.status!=='done';

export function snoozeSelect(onPick,label='Später'){
  const s=h('select',{class:'mini-select','aria-label':'Wiedervorlage wählen',onchange:()=>{const v=s.value;s.value='';if(v)onPick(v==='clear'?null:addDays(Number(v)));}},
    h('option',{value:''},`⏾ ${label}`),h('option',{value:'1'},'Morgen'),h('option',{value:'3'},'In 3 Tagen'),h('option',{value:'7'},'In 1 Woche'),h('option',{value:'30'},'In 1 Monat'));
  return s;
}

// One menu per entry ("⋯"): optional view-specific actions on top (edit form, skip, …), then
// Wiedervorlage, the full original, reassignment, rename and hide. Replaces the former ✎ + … pairs.
export function entryDetails(entry,ctx,{top=[],snooze=true,label='Bearbeiten & Original'}={}){
  const {state}=ctx;
  const kind=h('select',{'aria-label':'Bereich'},Object.entries(kindNames).map(([k,l])=>h('option',{value:k,selected:entry.kind===k},l)));
  const project=h('select',{'aria-label':'Strang'},h('option',{value:''},'Kein Strang'),Object.values(state.project).filter(p=>!p.archived||p.id===entry.project_id).map(p=>h('option',{value:p.id,selected:entry.project_id===p.id},p.title)),h('option',{value:'new'},'＋ Neuer Strang …'));
  const original=state.capture[entry.capture_id]?.original_text;
  const done=entry.status==='done';
  return actionMenu(label,[
    ...[].concat(top).filter(Boolean),
    snooze&&!done?h('label',{class:'menu-line'},h('span',{class:'lbl'},'Wiedervorlage'),snoozeSelect(v=>ctx.patch(entry.id,{revisit_at:v}),'Später zeigen')):null,
    h('div',{class:'orig'},h('span',{class:'lbl'},'Original'),h('pre',{},original??'Original noch nicht synchronisiert.')),
    h('div',{class:'row-form'},kind,project,h('button',{type:'button',class:'btn sm',onclick:()=>{
      if(project.value==='new'){const t=prompt('Name des neuen Strangs:');if(t&&t.trim())ctx.createProject(t.trim(),[entry.id]);return;}
      ctx.patch(entry.id,kindPatch(entry,kind.value,{project_id:project.value||null}));}},'Übernehmen')),
    h('div',{class:'row-form'},
      h('button',{type:'button',class:'btn sm ghost',onclick:()=>{const v=prompt('Titel ändern (Original bleibt erhalten):',displayTitle(entry,state));if(v&&v.trim())ctx.patch(entry.id,{title:v.trim(),title_custom:true});}},'Titel ändern'),
      h('button',{type:'button',class:'btn sm ghost',onclick:()=>{if(confirm('Eintrag ausblenden? Der Originaltext bleibt im Eingang erhalten.'))ctx.patch(entry.id,{status:'hidden'});}},'Ausblenden'))]);
}

// Generic "⋯" menu. On phones it opens as a bottom sheet (CSS) with its own close button.
export function actionMenu(label,items){
  return h('details',{class:'more'},h('summary',{class:'act','aria-label':label,title:label},'⋯'),
    h('div',{class:'more-body',role:'group','aria-label':label},
      h('div',{class:'sheet-head'},h('span',{class:'lbl'},label),h('button',{type:'button',class:'act','aria-label':'Schließen',onclick:e=>{e.currentTarget.closest('details').open=false;}},'✕')),
      ...items.filter(Boolean)));
}

export function metaTags(entry,{showKind=false}={}){
  return h('span',{class:'meta'},
    showKind&&h('span',{class:'chip'},KIND_ICON[entry.kind],' ',kindNames[entry.kind]),
    h('span',{class:'chip'},`${entry.minutes} Min.`),
    h('span',{class:`chip ${entry.energy==='high'?'focus':'calm'}`},entry.energy==='high'?'Fokus':'Wenig Energie'),
    entry.due_at&&h('span',{class:'chip'},'⏱ ',whenLabel(entry)),
    isBack(entry)&&h('span',{class:'chip back'},'↺ wieder da'),
    entry.needs_review&&h('span',{class:'chip warn'},'prüfen'));
}

// Generic checkable row used for to-dos, idea steps and related entries.
export function entryRow(entry,ctx,{extra=null,showKind=false,actions=null,menuTop=[]}={}){
  const done=entry.status==='done';
  return h('div',{class:`row${done?' done':''}`},
    h('input',{type:'checkbox',class:'check',checked:done,'aria-label':done?'Wieder öffnen':'Erledigt',onchange:e=>ctx.patch(entry.id,e.target.checked?{status:'done',done_at:new Date().toISOString(),revisit_at:null}:{status:'open',done_at:null})}),
    h('div',{class:'row-main'},h('div',{class:'row-title',title:entry.title},displayTitle(entry,ctx.state)),extra,metaTags(entry,{showKind})),
    h('div',{class:'row-actions'},actions,entryDetails(entry,ctx,{top:menuTop})));
}

export function snoozedSection(items,ctx,labelOf=e=>e.title,patchOf=(e,data)=>ctx.patch(e.id,data)){
  if(!items.length)return null;
  return h('details',{class:'snoozed'},h('summary',{},`⏾ Wiedervorlage (${items.length})`),
    items.sort((a,b)=>a.revisit_at.localeCompare(b.revisit_at)).map(e=>h('div',{class:'row slim'},
      h('div',{class:'row-main'},h('div',{class:'row-title'},labelOf(e)),h('span',{class:'meta'},h('span',{class:'chip'},'kommt ',dayLabel(new Date(e.revisit_at))))),
      h('button',{type:'button',class:'btn sm ghost',onclick:()=>patchOf(e,{revisit_at:null})},'Jetzt zurückholen'))));
}

export function segmented(options,active,onPick,cls='seg'){
  return h('div',{class:cls,role:'tablist'},options.map(([key,label])=>h('button',{type:'button',role:'tab','aria-selected':String(key===active),class:key===active?'on':'',onclick:()=>onPick(key)},label)));
}

export function empty(text){return h('p',{class:'empty'},text);}

// Downscale photos locally before storing (keeps sync payload < 3 MB, strips EXIF).
export async function compressImage(file,max=1600,quality=.8){
  const bitmap=await createImageBitmap(file).catch(()=>null);
  if(!bitmap){if(file.size>3e6)throw new Error('Bild zu groß oder Format nicht lesbar.');return file;}
  const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Bild konnte nicht verarbeitet werden.')),'image/jpeg',quality));
}
export function photoPicker(onFile,label='📷 Foto'){
  const input=h('input',{type:'file',accept:'image/*',class:'sr-only',onchange:async()=>{const f=input.files[0];input.value='';if(f)onFile(f);}});
  return h('label',{class:'btn sm ghost file'},label,input);
}
export function thumbs(attachments,ctx,{onRemove=null}={}){
  if(!attachments.length)return null;
  return h('div',{class:'thumbs'},attachments.map(a=>{
    const img=h('img',{alt:a.name||'Foto',loading:'lazy'});
    ctx.blobUrl(a.blob_id).then(url=>{if(url)img.src=url;else img.alt='Foto noch nicht auf diesem Gerät';});
    const link=h('a',{class:'thumb',href:'#',onclick:async e=>{e.preventDefault();const url=await ctx.blobUrl(a.blob_id);if(url)ctx.showImage(url,a.name);}},img);
    if(!onRemove)return link;
    return h('span',{class:'thumb-wrap'},link,h('button',{type:'button',class:'thumb-del','aria-label':`Foto entfernen (${new Date(a.created_at).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'})})`,title:'Foto entfernen',onclick:()=>onRemove(a)},'✕'));
  }));
}
