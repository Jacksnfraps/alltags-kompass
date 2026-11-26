// Shift plan (Dienstplan) parsing and validation. Used for pasted text and for AI photo reading.
const pad=n=>String(n).padStart(2,'0');
const TIME=/([01]?\d|2[0-3])[:.]([0-5]\d)/;
export const SHIFT_PRESETS={früh:['06:00','14:00'],spät:['14:00','22:00'],nacht:['22:00','06:00']};

export function parseShiftText(text,now=new Date()){
  const rows=[];
  for(const raw of text.split(/\r?\n|;/)){
    const line=raw.trim();if(!line)continue;
    const d=line.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/);if(!d)continue;
    const day=Number(d[1]),month=Number(d[2]);let year=d[3]?Number(d[3].length===2?'20'+d[3]:d[3]):now.getFullYear();
    const probe=new Date(year,month-1,day);if(probe.getMonth()!==month-1)continue;
    if(!d[3]&&probe<new Date(now.getFullYear(),now.getMonth()-1,1))year++;
    const rest=line.slice(d.index+d[0].length);
    const times=[...rest.matchAll(new RegExp(TIME.source,'g'))].map(m=>`${pad(Number(m[1]))}:${m[2]}`);
    let label=rest.replace(new RegExp(TIME.source,'g'),' ').replace(/\b(?:uhr|bis)\b|[-–—]/gi,' ').replace(/\s+/g,' ').trim();
    const lower=label.toLocaleLowerCase('de');
    const preset=Object.keys(SHIFT_PRESETS).find(k=>lower.startsWith(k)||lower===k[0]);
    let [start,end]=times;
    if(!start&&preset)[start,end]=SHIFT_PRESETS[preset];
    if(!label)label=preset?preset[0].toUpperCase()+preset.slice(1):'Dienst';
    rows.push({date:`${year}-${pad(month)}-${pad(day)}`,start:start||'',end:end||'',label:label.slice(0,60)});
  }
  return rows;
}
// Name filter for plans with several employees: "J. Twele" also matches "Twele, J.", "Twele J" or "Jan Twele".
export function cleanName(name){return String(name||'').replace(/<[^>]*>?/g,' ').replace(/[^\p{L} .,'-]/gu,'').replace(/\s+/g,' ').trim().slice(0,40);}
export function nameMatcher(name){
  const parts=cleanName(name).split(/[\s,.]+/).filter(w=>w.length>=3);
  const surname=parts.sort((a,b)=>b.length-a.length)[0];
  if(!surname)return null;
  const re=new RegExp(`(?<![\\p{L}])${surname.replace(/[-']/g,m=>'\\'+m)}(?![\\p{L}])`,'iu');
  return {surname,test:s=>re.test(String(s||'')),strip:s=>String(s||'').replace(new RegExp(`(?:\\b\\p{Lu}\\.\\s*)?${surname}(?:\\s*,\\s*\\p{Lu}[\\p{L}]*\\.?)?`,'giu'),' ').replace(/\s+/g,' ').trim()};
}
const DATE_G=/(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/g;
const OFF=/^(?:frei|x|-|–|—|\/|u|urlaub|k|krank|ft|feiertag|ruhe|za|aus|0)$/i;
const CODES={f:'früh',fr:'früh',frü:'früh',früh:'früh',fd:'früh',s:'spät',sp:'spät',spät:'spät',sd:'spät',n:'nacht',na:'nacht',nacht:'nacht',nd:'nacht'};
function cellShift(cell){
  const c=cell.trim();if(!c)return null;
  if(/^(?:o|0|frei|u|urlaub)$/i.test(c))return {start:'',end:'',label:/^(?:u|urlaub)$/i.test(c)?'Urlaub':'Frei'};
  if(OFF.test(c))return null;
  if(/^[FSN][1-9]?$/i.test(c)&&/\d/.test(c))return {start:'',end:'',label:c.toUpperCase()};
  const t=c.match(/^([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\s*[-–]\s*([01]?\d|2[0-3])(?:[:.]([0-5]\d))?$/);
  if(t)return {start:`${pad(Number(t[1]))}:${t[2]||'00'}`,end:`${pad(Number(t[3]))}:${t[4]||'00'}`,label:'Dienst'};
  const code=CODES[c.toLocaleLowerCase('de').replace(/dienst$/,'')];
  if(code){const [start,end]=SHIFT_PRESETS[code];return {start,end,label:code[0].toUpperCase()+code.slice(1)};}
  if(/^\p{L}{1,12}$/u.test(c))return {start:'',end:'',label:c};
  return null;
}
const cells=line=>(/[\t|;]/.test(line)?line.split(/[\t|;]/):line.split(/\s{2,}/).length>2?line.split(/\s{2,}/):line.split(/\s+/)).map(x=>x.trim()).filter(x=>x!=='');
const isDateRow=line=>[...line.matchAll(DATE_G)].length>=2;
function yearOf(day,month,given,now){
  let year=given?Number(given.length===2?'20'+given:given):now.getFullYear();
  if(!given&&new Date(year,month-1,day)<new Date(now.getFullYear(),now.getMonth()-1,1))year++;
  return year;
}

// Parses pasted plans. Two layouts: one line per shift ("02.12. 06:00-14:00 Früh J. Twele") or a week grid
// (header with dates, one row per employee). With a name, only that person's rows are kept.
export function parseShiftPlan(text,now=new Date(),{name=''}={}){
  const src=String(text||'').replace(/(\d)\s*[-–]\s*(\d)/g,'$1-$2');
  const lines=src.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const who=name?nameMatcher(name):null;
  const header=lines.find(isDateRow);
  if(header){
    const dates=[...header.matchAll(DATE_G)].map(m=>{const day=Number(m[1]),month=Number(m[2]);return `${yearOf(day,month,m[3],now)}-${pad(month)}-${pad(day)}`;});
    const people=lines.filter(l=>l!==header&&!isDateRow(l)&&/\p{L}{3,}/u.test(l));
    const mine=who?people.filter(l=>who.test(l)):people;
    const rows=[];
    for(const line of mine){
      const body=who?who.strip(line):line;
      const list=cells(body);
      // Name tokens precede the shift cells: drop leading words that are no shift code or time.
      while(list.length>dates.length&&!cellShift(list[0])?.start&&!OFF.test(list[0]))list.shift();
      const offset=Math.max(0,list.length-dates.length);
      dates.forEach((date,i)=>{const s=cellShift(list[i+offset]||'');if(s)rows.push({date,...s});});
    }
    return {rows,mode:'grid',total:people.length,matched:mine.length,name:who?cleanName(name):''};
  }
  const dated=lines.filter(l=>DATE_G.test(l)&&(DATE_G.lastIndex=0,true));
  const mine=who&&dated.some(l=>who.test(l))?dated.filter(l=>who.test(l)):dated;
  const rows=parseShiftText(mine.map(l=>who?who.strip(l):l).join('\n'),now);
  return {rows,mode:'lines',total:dated.length,matched:mine.length,name:who&&mine!==dated?cleanName(name):''};
}
// Rows from the AI may carry a "name" field: keep only that person's rows.
export function filterRowsByName(rows,name){
  const who=name?nameMatcher(name):null;if(!who||!rows.some(r=>r.name))return rows;
  return rows.filter(r=>!r.name||who.test(r.name));
}
export function validateShiftRows(value){
  if(!Array.isArray(value)||value.length>62)throw new Error('Ungültige Dienstplan-Antwort');
  return value.filter(r=>r&&typeof r==='object').map(r=>{
    const date=String(r.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(new Date(date).getTime()))throw new Error('Ungültiges Datum');
    const time=v=>{const s=String(v||'');return /^([01]\d|2[0-3]):[0-5]\d$/.test(s)?s:'';};
    const row={date,start:time(r.start),end:time(r.end),label:String(r.label||'Dienst').slice(0,60)};
    if(typeof r.name==='string'&&r.name.trim())row.name=cleanName(r.name);
    return row;
  });
}
export function shiftToEntry(row){
  return {title:row.label,due_at:`${row.date}T${row.start||'00:00'}`,all_day:!row.start,end_time:row.end||null,category:'shift',minutes:60,energy:'low'};
}

// Codes never imply a time. Explicit labels and user mappings take precedence.
export function shiftCode(entry,mapping={}){
  const label=String(entry.title||entry.label||'').trim();
  const custom=mapping[label];if(custom)return String(custom).slice(0,5);
  const code=label.match(/\b([FSN][1-9]?|O|U)\b/i);
  if(code)return code[1].toUpperCase();
  if(/urlaub/i.test(label))return 'U';
  if(/^(?:frei|0)$/i.test(label))return 'O';
  if(/früh/i.test(label))return 'F';
  if(/spät/i.test(label))return 'S';
  if(/nacht/i.test(label))return 'N';
  return 'D';
}
