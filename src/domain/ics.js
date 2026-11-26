// iCal (.ics) import for waste collection calendars. Pure functions: parsing, mapping to bins,
// de-duplication against existing entries and the monthly collection plan.
import {occurrences,localDay} from './state.js';

const pad=n=>String(n).padStart(2,'0');
export const BIN_RULES=[
  [/gelb|wertstoff|verpackung|lvp|leichtverpack/i,'Gelber Sack / Gelbe Tonne'],
  [/bio|grün|braun|kompost/i,'Biotonne'],
  [/papier|pappe|blau|ppk/i,'Altpapier'],
  [/rest|hausmüll|grau|schwarz/i,'Restmüll'],
  [/glas/i,'Glas'],
  [/sperr/i,'Sperrmüll'],
  [/schadstoff|problemstoff/i,'Schadstoffmobil'],
  [/weihnachtsbaum|tannenbaum/i,'Weihnachtsbäume']
];
export function binOf(summary){
  const s=String(summary||'').trim();
  return BIN_RULES.find(([re])=>re.test(s))?.[1]||s.replace(/^(?:abfuhr|abholung|leerung)\s*[:–-]?\s*/i,'').slice(0,60)||'Müllabfuhr';
}

const unescape=v=>v.replace(/\\n/gi,' ').replace(/\\([,;\\])/g,'$1').trim();
// "20261205", "20261205T060000", "20261205T050000Z" -> {date:'2026-12-05', time:'06:00'|''}
function icsDate(value,isDate){
  const m=String(value||'').match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if(!m)return null;
  if(!m[4]||isDate)return {date:`${m[1]}-${m[2]}-${m[3]}`,time:''};
  if(m[7]){const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5]));return {date:localDay(d),time:`${pad(d.getHours())}:${pad(d.getMinutes())}`};}
  return {date:`${m[1]}-${m[2]}-${m[3]}`,time:`${m[4]}:${m[5]}`};
}
// Collection calendars carry a time like 06:00 only as a placeholder – collection is all-day for us.
export function parseICS(text){
  const raw=String(text||'');
  if(!/BEGIN:VCALENDAR/i.test(raw))throw new Error('Keine iCal-Daten (BEGIN:VCALENDAR fehlt). Bitte den .ics-/iCal-Link oder die heruntergeladene .ics-Datei verwenden.');
  const lines=raw.replace(/\r\n?/g,'\n').replace(/\n[ \t]/g,'').split('\n');
  const events=[];let cur=null;
  for(const line of lines){
    if(/^BEGIN:VEVENT/i.test(line)){cur={exdates:[]};continue;}
    if(/^END:VEVENT/i.test(line)){if(cur?.start)events.push(cur);cur=null;continue;}
    if(!cur)continue;
    const i=line.indexOf(':');if(i<0)continue;
    const head=line.slice(0,i),value=line.slice(i+1);const [name,...params]=head.split(';');const key=name.toUpperCase();
    const isDate=params.some(p=>/^VALUE=DATE$/i.test(p));
    if(key==='UID')cur.uid=value.trim();
    else if(key==='SUMMARY')cur.summary=unescape(value);
    else if(key==='DTSTART')cur.start=icsDate(value.trim(),isDate);
    else if(key==='RRULE')cur.rrule=Object.fromEntries(value.split(';').map(x=>x.split('=')).filter(x=>x.length===2).map(([k,v])=>[k.toUpperCase(),v]));
    else if(key==='EXDATE')for(const v of value.split(','))cur.exdates.push(icsDate(v.trim(),isDate)?.date);
    else if(key==='STATUS')cur.status=value.trim().toUpperCase();
  }
  if(!events.length)throw new Error('Der Kalender enthält keine Termine.');
  return events.filter(e=>e.status!=='CANCELLED');
}
// RRULE -> our rhythm. Unsupported rules (e.g. BYDAY lists) keep only the first date and are reported.
export function recurrenceOf(rrule){
  if(!rrule)return {recurrence:null,supported:true};
  const n=Number(rrule.INTERVAL||1);const by=rrule.BYDAY||'';const multi=by.split(',').length>1||/\d/.test(by);
  const map={DAILY:{1:'daily'},WEEKLY:{1:'weekly',2:'biweekly',4:'fourweekly'},MONTHLY:{1:'monthly'}};
  const recurrence=multi?null:map[rrule.FREQ]?.[n]||null;
  let until=null;const u=String(rrule.UNTIL||'').match(/^(\d{4})(\d{2})(\d{2})/);if(u)until=`${u[1]}-${u[2]}-${u[3]}T23:59`;
  return {recurrence,until,supported:!!recurrence};
}

// Turns feed events into trash entries with deterministic ids (same feed twice -> same ids, no duplicates).
export function icsToTrash(events,{from=new Date(),stableId}){
  const start=localDay(new Date(from.getFullYear(),from.getMonth(),1));
  const rows=[],seen=new Set();let unsupported=0;
  for(const e of events){
    const {recurrence,until,supported}=recurrenceOf(e.rrule);if(!supported)unsupported++;
    if(!recurrence&&e.start.date<start)continue;
    // The UID identifies an event across syncs (a moved pickup keeps its id). Feeds that reuse a UID
    // for several dates fall back to UID + date.
    let key=e.uid?`ics:${e.uid}`:`ics:${e.start.date}:${e.summary||''}`;
    if(seen.has(key))key+=`:${e.start.date}`;seen.add(key);
    rows.push({id:stableId(key),title:binOf(e.summary),due_at:`${e.start.date}T00:00`,all_day:true,recurrence,until,skip_days:e.exdates.filter(Boolean),category:'trash',person:'family',ics_uid:e.uid||null,source:'ics',summary:e.summary||''});
  }
  return {rows,unsupported};
}

// Compares feed rows with the current state: new rows, changed dates, rows already covered by a
// manually entered rhythm of the same bin (skipped) and feed entries that vanished from the feed.
export function reconcileTrash(rows,state){
  const entries=Object.values(state.entry);
  const manual=entries.filter(e=>e.category==='trash'&&e.source!=='ics'&&e.status!=='hidden'&&e.status!=='done');
  const create=[],update=[];let skipped=0;
  for(const r of rows){
    const have=state.entry[r.id];
    if(have){if(have.due_at!==r.due_at||have.recurrence!==r.recurrence||(have.until||null)!==(r.until||null))update.push([r.id,{due_at:r.due_at,recurrence:r.recurrence,until:r.until,title:have.title_custom?have.title:r.title}]);continue;}
    const day=new Date(r.due_at);const next=new Date(day.getTime()+864e5);
    if(!r.recurrence&&manual.some(m=>m.title===r.title&&occurrences(m,day,next).length)){skipped++;continue;}
    create.push(r);
  }
  const ids=new Set(rows.map(r=>r.id));const last=rows.reduce((m,r)=>r.due_at>m?r.due_at:m,'');const today=localDay();
  const vanished=entries.filter(e=>e.source==='ics'&&!ids.has(e.id)&&e.status!=='hidden'&&!e.recurrence&&e.due_at&&e.due_at.slice(0,10)>=today&&e.due_at<=last).map(e=>[e.id,{status:'hidden'}]);
  return {create,update,vanished,skipped};
}

// Every pickup in one month, chronological, then by bin.
export function monthPlan(entries,year,month){
  const from=new Date(year,month,1),to=new Date(year,month+1,1);
  return entries.filter(e=>e.category==='trash'&&e.status!=='hidden'&&e.status!=='done')
    .flatMap(e=>occurrences(e,from,to).map(date=>({entry:e,date,bin:e.title})))
    .sort((a,b)=>a.date-b.date||a.bin.localeCompare(b.bin,'de'));
}
// Next pickup per bin type (one row per bin instead of one per feed event).
export function nextPerBin(entries,from){
  const by=new Map();
  for(const e of entries.filter(x=>x.category==='trash'&&x.status!=='hidden'&&x.status!=='done'&&!(x.until&&new Date(x.until)<from))){
    const [d]=occurrences(e,from,new Date(from.getTime()+400*864e5));if(!d)continue;
    const cur=by.get(e.title);if(!cur||d<cur.date)by.set(e.title,{entry:e,date:d,bin:e.title});
  }
  return [...by.values()].sort((a,b)=>a.date-b.date);
}
export function feedUrl(value){
  const v=String(value||'').trim().replace(/^webcal:\/\//i,'https://');
  let u;try{u=new URL(v);}catch{throw new Error('Bitte eine vollständige Adresse eingeben (https://… oder webcal://…).');}
  if(!/^https?:$/.test(u.protocol))throw new Error('Nur http(s)- oder webcal-Adressen werden unterstützt.');
  return u.href;
}
