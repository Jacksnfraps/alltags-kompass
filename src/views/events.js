import {eventPerson,monthCells,exceptionPatch} from '../domain/calendar.js';
import {h,segmented,empty,dayLabel,timeLabel,personBadge,people,RECURRENCE,entryDetails,displayTitle,toInputDate,pad,photoPicker,thumbs} from '../ui.js';
import {occurrences,nextOccurrence,localDay} from '../domain/state.js';
import {parseShiftPlan,shiftToEntry,shiftCode} from '../domain/shifts.js';
import {monthPlan,nextPerBin} from '../domain/ics.js';
import {parseWhen} from '../domain/when.js';

const CAT={appointment:'Termin',rhythm:'Rhythmus',trash:'Müllabfuhr',shift:'Dienst'};
const CAT_ICON={appointment:'',rhythm:'↻ ',trash:'🗑 ',shift:'⚑ '};
export const BINS=['Restmüll','Biotonne','Gelber Sack / Gelbe Tonne','Altpapier','Glas','Sperrmüll'];
const startOfToday=()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());};

export function agenda(events,days=14,from=startOfToday()){
  const to=new Date(from);to.setDate(to.getDate()+days);
  return events.flatMap(e=>occurrences(e,from,to).map(date=>({entry:e,date}))).sort((a,b)=>a.date-b.date||(a.entry.all_day?-1:1));
}

function eventForm(ctx,entry=null,preset={}){
  const s=ctx.settings;const d=entry?.due_at?new Date(entry.due_at):null;
  const f={
    title:h('input',{class:'inp sm',required:true,placeholder:'Was?','aria-label':'Titel',value:entry?displayTitle(entry,ctx.state):''}),
    date:h('input',{class:'inp sm',type:'date','aria-label':'Datum',required:true,value:d?toInputDate(d):preset.date||toInputDate(new Date())}),
    time:h('input',{class:'inp sm',type:'time','aria-label':'Uhrzeit',value:d&&!entry.all_day?`${pad(d.getHours())}:${pad(d.getMinutes())}`:''}),
    person:h('select',{class:'mini-select','aria-label':'Für wen'},Object.entries(people(s)).map(([k,p])=>h('option',{value:k,selected:(entry?eventPerson(entry,s):preset.person||'me')===k},p.label))),
    rec:h('select',{class:'mini-select','aria-label':'Wiederholung'},Object.entries(RECURRENCE).map(([k,l])=>h('option',{value:k,selected:(entry?.recurrence||preset.recurrence||'')===k},l))),
    cat:h('select',{class:'mini-select','aria-label':'Art'},Object.entries(CAT).map(([k,l])=>h('option',{value:k,selected:(entry?.category||preset.category||'appointment')===k},l)))
  };
  return h('form',{class:'event-form',onsubmit:ev=>{
    ev.preventDefault();const title=f.title.value.trim();if(!title||!f.date.value)return;
    const data={title,due_at:`${f.date.value}T${f.time.value||'00:00'}`,all_day:!f.time.value,person:f.cat.value==='trash'?'trash':f.person.value,recurrence:f.rec.value||null,category:f.cat.value==='appointment'&&f.rec.value?'rhythm':f.cat.value,needs_review:false};
    if(entry)ctx.patch(entry.id,data);
    else ctx.quickAdd('event',`${title} – ${f.date.value.split('-').reverse().join('.')}${f.time.value?' '+f.time.value:''}${f.rec.value?' ('+RECURRENCE[f.rec.value]+')':''}`,data);
  }},f.title,h('div',{class:'form-line'},f.date,f.time),h('div',{class:'form-line'},f.person,f.rec,f.cat),h('button',{class:'btn sm'},entry?'Speichern':'＋ Eintragen'));
}

// "Heute, 19:00" / "Mi 26.11., ganztägig" – one readable line per event.
export function whenText(date,allDay){return `${dayLabel(date)}, ${allDay?'ganztägig':timeLabel(date)}`;}

function eventRow(item,ctx,{showDate=false,flat=false}={}){
  const {entry:e,date}=item;
  const recurring=!!e.recurrence;
  return h('div',{class:`row ev p-line-${e.person||'me'}${flat?' flat':''}${flat&&localDay(date)===localDay()?' is-today':''}`},
    flat?null:h('span',{class:'ev-time'},e.all_day?'ganzt.':timeLabel(date),e.end_time?h('small',{},'–',e.end_time):null),
    e.category==='shift'?h('span',{class:'shift-code',title:`Dienst: ${e.title}`},shiftCode(e,ctx.settings.shiftCodes)):null,
    personBadge(eventPerson(e,ctx.settings),ctx.settings),
    // Flat agenda: date + time sit above the title so the title keeps the full width on an iPhone.
    h('div',{class:'row-main'},flat?h('span',{class:'ev-when'},whenText(date,e.all_day),e.end_time?` – ${e.end_time}`:''):null,h('div',{class:'row-title'},CAT_ICON[e.category]||(recurring?'↻ ':''),displayTitle(e,ctx.state),showDate?h('span',{class:'muted sm'},' · ',dayLabel(date)):null)),
    h('div',{class:'row-actions'},eventMenu(e,ctx,date)));
}

// Single menu for an event: skip this time (rhythms), edit form, remove/end, then original & reassignment.
function eventMenu(e,ctx,date,{removeLabel}={}){
  const recurring=!!e.recurrence;
  return entryDetails(e,ctx,{snooze:false,label:'Termin bearbeiten',top:[
    recurring&&date?h('button',{type:'button',class:'btn sm ghost',onclick:()=>ctx.patch(e.id,{skip_days:[...(e.skip_days||[]),localDay(date)]})},'⤼ Dieses Mal auslassen (',dayLabel(date),')'):null,
    eventForm(ctx,e),
    recurring?exceptionControls(e,ctx):null,
    h('button',{type:'button',class:'btn sm ghost',onclick:()=>{if(confirm(recurring?'Rhythmus beenden? Vergangene Termine und Original bleiben erhalten.':'Termin entfernen? Das Original bleibt im Eingang.'))ctx.patch(e.id,recurring?{until:new Date().toISOString()}:{status:'done'});}},removeLabel||(recurring?'Rhythmus beenden':'Termin entfernen'))]});
}

function agendaPane(events,ctx){
  const {ui,settings}=ctx;const days=ui.agendaDays||14;const filter=ui.personFilter||[];
  const visible=events.filter(e=>e.category!=='exception'&&(!filter.length||filter.includes(eventPerson(e,settings))));
  const items=agenda(visible.filter(e=>e.due_at),days);
  const undated=visible.filter(e=>!e.due_at);
  const legend=h('div',{class:'legend',role:'group','aria-label':'Personen filtern'},Object.entries(people(settings)).filter(([k])=>!['kids','family'].includes(k)||events.some(e=>eventPerson(e,settings)===k)||filter.includes(k)).map(([k,p])=>h('button',{type:'button',class:`fchip${filter.includes(k)?' on':''}`,'aria-pressed':String(filter.includes(k)),onclick:()=>{ui.personFilter=filter.includes(k)?filter.filter(x=>x!==k):[...filter,k];ctx.rerender();}},personBadge(k,settings),' ',p.label)),
    h('select',{class:'mini-select','aria-label':'Zeitraum',onchange:e=>{ui.agendaDays=Number(e.target.value);ctx.rerender();}},[7,14,31].map(n=>h('option',{value:String(n),selected:n===days},`${n} Tage`))));
  return h('section',{class:`panel pane agenda${(ui.eventPane||'agenda')==='agenda'?' on':''}`},
    h('div',{class:'panel-head'},h('h2',{},'Agenda'),h('span',{class:'count'},String(items.filter(it=>it.entry.category!=='trash').length))),legend,
    // Strictly chronological: date + time on every row, no hour grid, no day buckets.
    items.length?h('div',{class:'agenda-list'},agendaDays(items,ctx)):empty(`Keine Termine in den nächsten ${days} Tagen.`),
    undated.length?h('div',{class:'undated'},h('span',{class:'lbl'},`Noch ohne Datum (${undated.length})`),undated.map(e=>{
      // Older entries may lack a date although the text has one: prefill it (relative to when it was written).
      const guess=parseWhen(e.details||e.title||'',new Date(e.created_at||Date.now()));const g=guess.due_at?new Date(guess.due_at):null;
      const date=h('input',{class:'inp sm',type:'date','aria-label':'Datum',value:g?toInputDate(g):''}),time=h('input',{class:'inp sm',type:'time','aria-label':'Uhrzeit',value:g&&guess.has_time?`${pad(g.getHours())}:${pad(g.getMinutes())}`:''});
      return h('div',{class:'undated-row'},
        h('div',{class:'undated-head'},personBadge(e.person,settings),h('div',{class:'row-title'},displayTitle(e,ctx.state)),entryDetails(e,ctx,{snooze:false,label:'Termin bearbeiten'})),
        g?h('span',{class:'muted sm'},'Erkannt: ',whenText(g,!guess.has_time),' – bitte bestätigen'):null,
        h('form',{class:'form-line',onsubmit:ev=>{ev.preventDefault();if(date.value)ctx.patch(e.id,{due_at:`${date.value}T${time.value||'00:00'}`,all_day:!time.value,needs_review:false,...(guess.recurrence&&!e.recurrence?{recurrence:guess.recurrence}:{})});}},date,time,h('button',{class:'btn sm'},g?'Übernehmen':'Setzen')));
    })):null,
    pendingExceptions(events,ctx),
    manageEvents(events,ctx),
    h('details',{class:'inline-add'},h('summary',{},'＋ Termin eintragen'),eventForm(ctx)));
}

// Colour dot per bin type so the plan reads at a glance.
export function binClass(title){const t=String(title||'').toLocaleLowerCase('de');return /gelb|wertstoff/.test(t)?'b-gelb':/bio/.test(t)?'b-bio':/papier/.test(t)?'b-papier':/rest/.test(t)?'b-rest':/glas/.test(t)?'b-glas':'b-other';}
const binDot=title=>h('span',{class:`bin-dot ${binClass(title)}`,'aria-hidden':'true'});

function trashPane(events,ctx){
  const {ui,settings}=ctx;
  const list=events.filter(e=>e.category==='trash'&&e.due_at);
  const today=startOfToday();const tomorrow=new Date(today);tomorrow.setDate(today.getDate()+1);
  // One row per bin with its next pickup (a feed delivers many single dates per bin).
  const rows=nextPerBin(list,today);
  const type=h('select',{class:'mini-select','aria-label':'Tonne'},BINS.map(b=>h('option',{value:b},b)));
  const date=h('input',{class:'inp sm',type:'date',required:true,'aria-label':'Nächste Abholung'});
  const rec=h('select',{class:'mini-select','aria-label':'Rhythmus'},['weekly','biweekly','fourweekly','monthly',''].map(k=>h('option',{value:k,selected:k==='biweekly'},RECURRENCE[k])));
  const add=h('form',{class:'event-form',onsubmit:e=>{e.preventDefault();if(!date.value)return;ctx.quickAdd('event',`Müllabfuhr ${type.value} – ab ${date.value.split('-').reverse().join('.')} (${RECURRENCE[rec.value]})`,{title:type.value,due_at:`${date.value}T00:00`,all_day:true,recurrence:rec.value||null,category:'trash',person:'trash'});}},h('div',{class:'form-line'},type,date,rec),h('button',{class:'btn sm'},'＋ Abfuhr eintragen'));
  const feed=settings.trashFeed||{};
  const url=h('input',{class:'inp sm',type:'url',inputmode:'url',autocomplete:'off',placeholder:'https://….ics oder webcal://…',value:feed.url||'','aria-label':'Kalender-/Feed-Adresse (.ics / iCal)'});
  const file=h('input',{type:'file',accept:'.ics,text/calendar',class:'sr-only',onchange:()=>{const f=file.files[0];file.value='';if(f)ctx.importTrashFile(f);}});
  const feedBox=h('details',{class:'inline-add feed',open:!!feed.error},h('summary',{},'📅 Abfuhrkalender (.ics / iCal) verbinden'),
    h('p',{class:'muted sm'},'Link des Entsorgers (iCal/.ics/webcal) eintragen. Abgleich beim Öffnen höchstens einmal täglich oder auf Knopfdruck – vorhandene Termine werden nicht doppelt angelegt.'),
    h('form',{class:'form-line feed-line',onsubmit:e=>{e.preventDefault();ctx.syncTrashFeed(url.value);}},url,h('button',{class:'btn sm'},feed.url?'Jetzt abgleichen':'Verbinden')),
    h('div',{class:'form-line'},h('label',{class:'btn sm ghost file'},'.ics-Datei importieren',file),feed.url?h('button',{type:'button',class:'btn sm ghost',onclick:()=>ctx.forgetTrashFeed()},'Link entfernen'):null),
    feed.last?h('p',{class:'muted sm'},'Zuletzt abgeglichen: ',new Date(feed.last).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'}),feed.info?` · ${feed.info}`:''):null,
    feed.error?h('p',{class:'warn-text sm',role:'alert'},feed.error):null);
  const offset=ui.trashMonth||0;const base=new Date(today.getFullYear(),today.getMonth()+offset,1);
  const plan=monthPlan(list,base.getFullYear(),base.getMonth());
  const monthBox=h('div',{class:'month-plan'},h('h3',{},'Monats-Abfuhrplan'),
    h('div',{class:'month-nav'},
      h('button',{type:'button',class:'act','aria-label':'Vorheriger Monat',onclick:()=>{ui.trashMonth=offset-1;ctx.rerender();}},'‹'),
      h('strong',{'aria-live':'polite'},base.toLocaleDateString('de-DE',{month:'long',year:'numeric'})),
      h('button',{type:'button',class:'act','aria-label':'Nächster Monat',onclick:()=>{ui.trashMonth=offset+1;ctx.rerender();}},'›')),
    h('div',{class:'month-grid'},['Mo','Di','Mi','Do','Fr','Sa','So'].map(d=>h('span',{class:'weekday'},d)),
      monthCells(base.getFullYear(),base.getMonth()).map(cell=>{const pickups=plan.filter(p=>localDay(p.date)===cell.key);return h('button',{type:'button',class:`month-day${cell.inMonth?'':' outside'}${cell.key===localDay(today)?' today':''}`,disabled:!pickups.length,'aria-label':`${cell.date.toLocaleDateString('de-DE')}: ${pickups.map(p=>p.bin).join(', ')||'keine Abholung'}`,title:pickups.map(p=>p.bin).join(', '),onclick:()=>{ui.trashDay=cell.key;ctx.rerender();}},h('span',{},String(cell.date.getDate())),h('span',{class:'day-dots'},pickups.map(p=>binDot(p.bin))));})),
    h('div',{class:'bin-legend'},[...new Set(plan.map(p=>p.bin))].map(bin=>h('span',{},binDot(bin),bin))),
    ui.trashDay?h('p',{class:'muted sm'},plan.filter(p=>localDay(p.date)===ui.trashDay).map(p=>`${dayLabel(p.date)}: ${p.bin}`).join(' · ')):null);
  return h('section',{class:`panel pane${ui.eventPane==='trash'?' on':''}`},
    h('div',{class:'panel-head'},h('h2',{},'Müllabfuhr'),h('span',{class:'count'},String(rows.length))),
    rows.length?rows.map(({entry:e,date:next})=>{const soon=localDay(next)===localDay(tomorrow)||localDay(next)===localDay(today);
      return h('div',{class:`row slim${soon?' highlight':''}`},binDot(e.title),
        h('div',{class:'row-main'},h('div',{class:'row-title'},e.title),h('span',{class:'meta'},h('span',{class:`chip${soon?' warn':''}`},dayLabel(next)),h('span',{class:'chip'},e.source==='ics'?(e.recurrence?RECURRENCE[e.recurrence]+' · Kalender':'aus Kalender'):RECURRENCE[e.recurrence||'']),soon&&localDay(next)!==localDay(today)?h('span',{class:'chip'},'heute Abend rausstellen'):null)),
        h('div',{class:'row-actions'},eventMenu(e,ctx,next,{removeLabel:'Nicht mehr anzeigen'})));
    }):empty('Abfuhrtermine einmal eintragen oder den Kalender des Entsorgers verbinden – der Rhythmus läuft dann von selbst.'),
    monthBox,feedBox,
    h('details',{class:'inline-add',open:!rows.length&&!feed.url},h('summary',{},'＋ Tonne von Hand eintragen'),add));
}

function shiftPane(events,ctx){
  const {state,ui,settings}=ctx;
  const photos=Object.values(state.attachment).filter(a=>a.parent_type==='shiftplan'&&!a.removed).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const upcoming=agenda(events.filter(e=>e.category==='shift'),35);
  const draft=ui.shiftDraft||null;
  const shiftName=settings.shiftName??'';
  const person=h('select',{class:'mini-select','aria-label':'Wessen Dienstplan'},Object.entries(people(settings)).filter(([k])=>k==='me'||k==='vanessa').map(([k,p])=>h('option',{value:k,selected:(ui.shiftPerson||'me')===k},p.label)));
  person.addEventListener('change',()=>{ui.shiftPerson=person.value;});
  const nameInput=h('input',{class:'inp sm',value:shiftName,placeholder:'leer = alle Zeilen','aria-label':'Name/Kürzel im Dienstplan',onchange:e=>ctx.saveSettings({shiftName:e.target.value.trim()})});
  const paste=h('textarea',{class:'inp',rows:3,value:draft?.source==='text'&&draft.text||'',placeholder:'Dienste als Text einfügen – je Zeile z. B.\n02.12. 06:00-14:00 Früh J. Twele\noder ein Wochenraster (Kopfzeile mit Datum, je Mitarbeiter eine Zeile).','aria-label':'Dienstplan als Text'});
  const recognise=name=>{const r=parseShiftPlan(paste.value,new Date(),{name});
    ui.shiftDraft={rows:r.rows,source:'text',text:paste.value,filtered:!!r.name,info:r.name?`Nur „${r.name}“: ${r.matched} von ${r.total} Zeilen${r.mode==='grid'?' im Wochenraster':''}`:`${r.total} Zeile${r.total===1?'':'n'} erkannt${name&&r.total?` – „${name}“ kam nicht vor, daher alle`:''}`};ctx.rerender();};
  const confirmBox=draft?h('div',{class:'confirm'},
    h('div',{class:'panel-head'},h('span',{class:'lbl'},`Bitte prüfen (${draft.rows.length}) · ${draft.source==='gemini'?'aus Foto gelesen':'aus Text erkannt'}`)),
    draft.info?h('p',{class:'muted sm'},draft.info):null,
    draft.rows.length?h('form',{onsubmit:ev=>{ev.preventDefault();
      const chosen=[...ev.target.querySelectorAll('.shift-row:not(.shift-head)')].filter(r=>r.querySelector('[name=use]').checked).map(r=>({date:r.querySelector('[name=date]').value,start:r.querySelector('[name=start]').value,end:r.querySelector('[name=end]').value,label:r.querySelector('[name=label]').value.trim()||'Dienst'})).filter(r=>r.date);
      ui.shiftDraft=null;ctx.addShifts(chosen,person.value,draft.text||'');}},
      h('div',{class:'shift-row shift-head','aria-hidden':'true'},h('span',{},'✓'),h('span',{},'Datum'),h('span',{},'Von'),h('span',{},'Bis'),h('span',{},'Bezeichnung')),
      draft.rows.map(r=>h('div',{class:'shift-row'},h('input',{type:'checkbox',name:'use',checked:true,class:'check','aria-label':'Übernehmen'}),h('input',{class:'inp sm',type:'date',name:'date',value:r.date,'aria-label':'Datum'}),h('input',{class:'inp sm',type:'time',name:'start',value:r.start,'aria-label':'Von'}),h('input',{class:'inp sm',type:'time',name:'end',value:r.end,'aria-label':'Bis'}),h('input',{class:'inp sm',name:'label',value:r.label,'aria-label':'Bezeichnung'}))),
      h('div',{class:'form-line'},h('button',{class:'btn sm'},'Bestätigen & eintragen'),
        draft.filtered&&draft.text?h('button',{type:'button',class:'btn sm ghost',onclick:()=>recognise('')},'Alle Zeilen zeigen'):null,
        h('button',{type:'button',class:'btn sm ghost',onclick:()=>{ui.shiftDraft=null;ctx.rerender();}},'Verwerfen'))):h('p',{class:'muted sm'},shiftName?`Keine Dienste für „${shiftName}“ erkannt. Schreibweise im Namensfeld prüfen oder Zeile manuell ergänzen.`:'Keine Dienste erkannt. Bitte als Text eingeben oder Zeile manuell ergänzen.')):null;
  return h('section',{class:`panel pane${ui.eventPane==='shifts'?' on':''}`},
    h('div',{class:'panel-head'},h('h2',{},'Dienstplan'),h('span',{class:'count'},String(upcoming.length)),person),
    h('label',{class:'menu-line name-filter'},h('span',{class:'lbl'},'Nur Zeilen für'),nameInput),
    h('div',{class:'form-line'},photoPicker(f=>ctx.attachPhoto('shiftplan','shiftplan',f),'📷 Dienstplan-Foto'),
      photos.length?h('button',{type:'button',class:'btn sm',onclick:()=>ctx.readShiftPhoto(photos[0])},ctx.aiAllowed()?'Neuestes Foto auslesen (Gemini)':'Foto auslesen …'):null),
    thumbs(photos.slice(0,8),ctx,{onRemove:a=>{if(confirm('Dieses Dienstplan-Foto entfernen? Bereits eingetragene Dienste bleiben erhalten.'))ctx.removeAttachment(a);}}),
    h('details',{class:'inline-add',open:!!photos.length&&!ctx.aiAllowed()&&!draft},h('summary',{},'Text einfügen / manuell'),paste,h('div',{class:'form-line'},
      h('button',{type:'button',class:'btn sm',onclick:()=>recognise(shiftName)},'Erkennen'),
      h('button',{type:'button',class:'btn sm ghost',onclick:()=>{ui.shiftDraft={...(draft||{source:'text'}),rows:[...(draft?.rows||[]),{date:toInputDate(new Date()),start:'',end:'',label:'Dienst'}]};ctx.rerender();}},'＋ Zeile'))),
    confirmBox,
    h('p',{class:'muted sm'},`${upcoming.length} Dienste in den nächsten 5 Wochen – in der Agenda sichtbar.`),
    shiftMapping(events,ctx));
}


function agendaDays(items,ctx){
  const days=new Map();for(const item of items){const key=localDay(item.date);if(!days.has(key))days.set(key,[]);days.get(key).push(item);}
  return [...days].map(([key,list])=>h('div',{class:'agenda-day'},
    h('div',{class:'agenda-day-head'},h('strong',{},dayLabel(list[0].date)),
      list.filter(it=>it.entry.category==='trash').map(({entry:e})=>h('button',{type:'button',class:`bin-icon ${binClass(e.title)}`,title:e.title,'aria-label':`${e.title} · ${key} · Abfuhrplan öffnen`,onclick:()=>{ctx.ui.eventPane='trash';ctx.rerender();}},h('span',{class:'bin-shape','aria-hidden':'true'})))),
    list.filter(it=>it.entry.category!=='trash').map(it=>eventRow(it,ctx,{flat:true}))));
}

function exceptionControls(e,ctx){
  const start=h('input',{class:'inp sm',type:'date',required:true,'aria-label':'Ausnahme ab'});
  const end=h('input',{class:'inp sm',type:'date','aria-label':'Ausnahme bis (optional)'});
  end.addEventListener('input',()=>end.setCustomValidity(''));
  start.addEventListener('input',()=>end.setCustomValidity(''));
  return h('details',{class:'inline-add'},h('summary',{},'Ausnahmen / Ferien'),
    h('form',{class:'event-form',onsubmit:ev=>{ev.preventDefault();end.setCustomValidity('');if(end.value&&end.value<start.value){end.setCustomValidity('Ende muss nach dem Beginn liegen.');end.reportValidity();return;}ctx.patch(e.id,exceptionPatch(e,{start:start.value,end:end.value||start.value}));}},
      h('label',{},'Von',start),h('label',{},'Bis (leer = ein Tag)',end),h('button',{class:'btn sm'},'Zeitraum auslassen')),
    (e.skip_days||[]).map(day=>h('div',{class:'form-line'},day,h('button',{type:'button',class:'btn sm ghost',onclick:()=>ctx.patch(e.id,{skip_days:e.skip_days.filter(d=>d!==day)})},'Wieder zulassen'))),
    (e.skip_ranges||[]).map((range,i)=>h('div',{class:'form-line'},`${range.start} – ${range.end}`,h('button',{type:'button',class:'btn sm ghost',onclick:()=>ctx.patch(e.id,{skip_ranges:e.skip_ranges.filter((_,n)=>n!==i)})},'Wieder zulassen'))));
}

function pendingExceptions(events,ctx){
  return events.filter(e=>e.category==='exception'&&e.exception).map(e=>{
    const ex=e.exception,choices=events.filter(r=>r.recurrence&&!['trash','shift'].includes(r.category));
    const select=h('select',{class:'mini-select',required:true,'aria-label':'Rhythmus für Ausnahme'},h('option',{value:''},'Welcher Rhythmus?'),choices.map(r=>h('option',{value:r.id},displayTitle(r,ctx.state))));
    return h('form',{class:'exception-confirm',onsubmit:ev=>{ev.preventDefault();const target=ctx.state.entry[select.value];if(target)ctx.patchMany([[target.id,exceptionPatch(target,ex)],[e.id,{status:'done',needs_review:false}]]);}},
      h('p',{},e.details),h('p',{class:'muted sm'},`${ex.start} – ${ex.end}: Bitte zuordnen. Noch kein Termin ausgenommen.`),select,h('button',{class:'btn sm'},'Ausnahme bestätigen'),h('button',{type:'button',class:'btn sm ghost',onclick:()=>ctx.patch(e.id,{status:'done',needs_review:false})},'Verwerfen (Original bleibt)'));
  });
}

function manageEvents(events,ctx){
  const list=events.filter(e=>e.category!=='exception').sort((a,b)=>String(a.due_at||'').localeCompare(String(b.due_at||'')));
  const boxes=[];
  const type=h('select',{class:'mini-select','aria-label':'Verwaltung filtern'},h('option',{value:''},'Alle Termine'),Object.entries(CAT).map(([k,v])=>h('option',{value:k},v)));
  const rows=list.map(e=>{const check=h('input',{type:'checkbox','aria-label':`${displayTitle(e,ctx.state)} auswählen`});boxes.push({check,e});return h('div',{class:'manage-row',dataset:{category:e.category}},check,h('span',{},e.due_at?dayLabel(new Date(e.due_at)):'Ohne Datum',' · ',displayTitle(e,ctx.state)),eventMenu(e,ctx,e.due_at?new Date(e.due_at):null));});
  type.addEventListener('change',()=>rows.forEach((r,i)=>{r.hidden=!!type.value&&(type.value==='rhythm'?!list[i].recurrence:list[i].category!==type.value);if(r.hidden)boxes[i].check.checked=false;}));
  return h('details',{class:'inline-add'},h('summary',{},`Termine verwalten (${list.length})`),
    h('p',{class:'muted sm'},'Auch vergangene Dienste. Entfernen blendet Einträge aus; Originale bleiben erhalten.'),type,
    h('button',{type:'button',class:'btn sm ghost',onclick:()=>boxes.forEach(({check},i)=>{if(!rows[i].hidden)check.checked=true;})},'Sichtbare auswählen'),
    h('button',{type:'button',class:'btn sm ghost',onclick:()=>{const selected=boxes.filter(({check})=>check.checked);if(selected.length&&confirm(`${selected.length} ausgewählte Termine entfernen? Bei Rhythmen wird die ganze Serie ausgeblendet. Originale bleiben erhalten.`))ctx.patchMany(selected.map(({e})=>[e.id,{status:'done'}]));}},'Auswahl entfernen'),...rows);
}

function shiftMapping(events,ctx){
  const labels=[...new Set(events.filter(e=>e.category==='shift').map(e=>e.title))];
  const fields=labels.map(title=>({title,input:h('input',{class:'inp sm',value:shiftCode({title},ctx.settings.shiftCodes),maxlength:5,'aria-label':`Kürzel für ${title}`})}));
  return h('details',{class:'inline-add'},h('summary',{},'Dienst-Kürzel zuordnen'),
    h('p',{class:'muted sm'},'F = Früh, S = Spät, N = Nacht, O = Frei, U = Urlaub, D = sonstiger Dienst. Erkannte F1/F2/S1/S2 bleiben erhalten. Zeiten bitte vor Übernahme prüfen; Kürzel legen keine Zeiten fest.'),
    fields.length?h('form',{onsubmit:ev=>{ev.preventDefault();ctx.saveSettings({shiftCodes:Object.fromEntries(fields.map(f=>[f.title,f.input.value.trim()||'D']))});ctx.rerender();}},fields.map(f=>h('label',{class:'form-line'},f.title,f.input)),h('button',{class:'btn sm'},'Kürzel speichern')):h('p',{class:'muted sm'},'Nach dem Import hier je Dienstbezeichnung anpassbar.'));
}

export function renderEvents(root,ctx){
  const {state,ui}=ctx;
  const events=Object.values(state.entry).filter(e=>e.kind==='event'&&e.status!=='hidden'&&e.status!=='done');
  if(!['agenda','trash','shifts'].includes(ui.eventPane))ui.eventPane='agenda';
  root.append(h('div',{class:'toolbar event-toolbar'},segmented([['agenda','Agenda'],['trash','Abfuhr'],['shifts','Dienstplan importieren']],ui.eventPane,k=>{ui.eventPane=k;ctx.rerender();})),
    h('div',{class:'events-content'},ui.eventPane==='trash'?trashPane(events,ctx):ui.eventPane==='shifts'?shiftPane(events,ctx):agendaPane(events,ctx)));
}
export {shiftToEntry};
