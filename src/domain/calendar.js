import {localDay} from './state.js';

export const childId=name=>'child:'+encodeURIComponent(name.trim().toLocaleLowerCase('de'));
export function calendarPeople(settings={}) {
  const kids=String(settings.kids||'').split(',').map(n=>n.trim()).filter(Boolean);
  return {me:{label:'Ich',short:'I'},vanessa:{label:settings.partner||'Partnerin',short:(settings.partner||'P')[0].toUpperCase()},
    ...Object.fromEntries(kids.map(n=>[childId(n),{label:n,short:n[0].toUpperCase()}])),
    kids:{label:kids.length?kids.join(' & ')+' (gemeinsam)':'Kinder',short:'K'},family:{label:'Familie (alle)',short:'F'},trash:{label:'Abfuhr',short:'♲'}};
}
export function eventPerson(e,settings={}) {
  if(e.category==='trash')return 'trash';
  if(e.person==='kids') {
    for(const text of [e.title||'',e.details||'']){
      const matches=Object.entries(calendarPeople(settings)).filter(([id,p])=>id.startsWith('child:')&&text.toLocaleLowerCase('de').split(/[^\p{L}]+/u).includes(p.label.toLocaleLowerCase('de')));
      if(matches.length===1)return matches[0][0];
      if(matches.length>1)break;
    }
  }
  return e.person||'me';
}
export function monthCells(year,month) {
  const first=new Date(year,month,1),offset=(first.getDay()+6)%7;
  const size=Math.ceil((offset+new Date(year,month+1,0).getDate())/7)*7;
  return Array.from({length:size},(_,i)=>{const date=new Date(year,month,1-offset+i);return {date,key:localDay(date),inMonth:date.getMonth()===month};});
}

// Conservative offline recognition: a dated cancellation needs an unambiguous rhythm name.
export function rhythmException(text,events,now=new Date()) {
  if(!/\b(?:kein(?:e|en)?|entfällt|ausfall|ferien|pause)\b/i.test(text))return null;
  const matches=[...text.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(?:(\d{4})\b)?/g)];
  if(!matches.length||matches.length>2)return null;
  const days=matches.map((m,i)=>{let year=Number(m[3])||now.getFullYear();if(i&&!m[3]&&Number(m[2])<Number(matches[0][2]))year=Number(matches[0][3])||now.getFullYear(),year++;
    const d=new Date(year,Number(m[2])-1,Number(m[1]));return d.getMonth()===Number(m[2])-1&&d.getDate()===Number(m[1])?localDay(d):null;});
  if(days.some(d=>!d)||days.length===2&&!/\bbis\b|[––-]/.test(text.slice(matches[0].index+matches[0][0].length,matches[1].index)))return null;
  const start=days[0],end=days[1]||start;if(end<start)return null;
  const tokens=text.toLocaleLowerCase('de').match(/[\p{L}]{4,}/gu)||[];
  const common=new Set(['übrigens','keine','keinen','ferien','pause','entfällt','ausfall','nicht','findet','statt','jeden','dieses','wegen']);
  const candidates=events.filter(e=>e.kind==='event'&&e.recurrence&&!['trash','shift'].includes(e.category)&&!['hidden','done'].includes(e.status)).filter(e=>{
    const words=(e.title||'').toLocaleLowerCase('de').match(/[\p{L}]{4,}/gu)||[];
    const named=tokens.filter(t=>!common.has(t)&&words.some(w=>w===t||(t.length>=4&&w.startsWith(t))));
    // A generic "kein Problem" must not cancel an otherwise positive appointment.
    return named.some(t=>/\b(?:ferien|pause|entfällt|ausfall)\b/i.test(text)||new RegExp(`\\bkein(?:e|en)?\\s+${t}\\b`,'i').test(text));
  });
  return {start,end,candidates:candidates.map(e=>e.id)};
}
export function exceptionPatch(event,exception) {
  const ranges=[...(event.skip_ranges||[])];
  if(!ranges.some(r=>r.start===exception.start&&r.end===exception.end))ranges.push({start:exception.start,end:exception.end});
  return {skip_ranges:ranges};
}
