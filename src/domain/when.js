// Small German date/time parser for local sorting. Pure and deterministic (pass `now`).
const DAYS=['sonntag','montag','dienstag','mittwoch','donnerstag','freitag','samstag'];
const SHORT={so:0,mo:1,di:2,mi:3,do:4,fr:5,sa:6};
const MONTHS=['januar','februar','märz','april','mai','juni','juli','august','september','oktober','november','dezember'];
const pad=n=>String(n).padStart(2,'0');
export function localIso(date){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;}

export function parseWhen(text,now=new Date()){
  const t=text.toLocaleLowerCase('de');
  let date=null,recurrence=null,label='';
  if(/\b(?:täglich|jeden tag)\b/.test(t))recurrence='daily';
  else if(/\b(?:alle (?:zwei|2) wochen|14-?tägig|zweiwöchentlich|jede zweite woche)\b/.test(t))recurrence='biweekly';
  else if(/\b(?:monatlich|jeden monat)\b/.test(t))recurrence='monthly';
  const base=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  // JS \b is ASCII-only ("übermorgen" would fail), so use Unicode letter lookarounds.
  const rel=t.match(/(?<![\p{L}\p{N}])(heute|übermorgen|morgen)(?![\p{L}\p{N}])/u);
  if(rel){date=new Date(base);date.setDate(date.getDate()+({heute:0,morgen:1,übermorgen:2})[rel[1]]);label=rel[1];}
  const numeric=t.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?(?!\d)/);
  const named=t.match(new RegExp(`\\b(\\d{1,2})\\.?\\s*(${MONTHS.join('|')})(?:\\s+(\\d{4}))?`));
  if(numeric||named){
    const day=Number((numeric||named)[1]);const month=numeric?Number(numeric[2])-1:MONTHS.indexOf(named[2]);
    let year=(numeric?numeric[3]:named[3]);year=year?Number(year.length===2?'20'+year:year):base.getFullYear();
    const candidate=new Date(year,month,day);
    if(candidate.getMonth()===month&&candidate.getDate()===day){
      if(!(numeric?numeric[3]:named[3])&&candidate<base)candidate.setFullYear(year+1);
      date=candidate;label=`${pad(day)}.${pad(month+1)}.`;
    }
  }
  if(!date&&/(?:^|\s)(?:am|übers|diese[sn]?|nächste[sn]?)?\s*wochenende(?![\p{L}])/u.test(t)){
    date=new Date(base);const d=date.getDay();if(d!==0&&d!==6)date.setDate(date.getDate()+6-d);label='Wochenende';
  }
  if(!date){
    const weekday=t.match(/\b(?:(jeden|jede|immer|ab)\s+)?(sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag)(s)?\b/)||t.match(/\b(so|mo|di|mi|do|fr|sa)\.?\s+(?=\d)/);
    if(weekday){
      const target=weekday[2]?DAYS.indexOf(weekday[2]):SHORT[weekday[1]];
      date=new Date(base);let diff=(target-date.getDay()+7)%7;
      if(/\bnächste[nm]?\s+(?:woche\s+)?\w*tag\b|\bnächsten\s+\w+/.test(t)&&diff===0)diff=7;
      date.setDate(date.getDate()+diff);label=weekday[2]?weekday[2][0].toUpperCase()+weekday[2].slice(1):'';
      if(weekday[2]&&(weekday[1]&&weekday[1]!=='ab'||weekday[3])&&!recurrence)recurrence=weekday[1]==='ab'?null:'weekly';
      if(recurrence==='weekly')label=label+'s';
    }
  }
  let hasTime=false;
  let tt=t;for(const m of [numeric,named])if(m)tt=tt.replace(m[0],' ');
  const time=tt.match(/\b(?:um\s+)?([01]?\d|2[0-3])[:.]([0-5]\d)\s*(?:uhr)?(?![.,]?\d)/)||tt.match(/\b(?:um\s+)?([01]?\d|2[0-3])\s*uhr\b/)||tt.match(/\bum\s+([01]?\d|2[0-3])\b(?![.:,]\d)/);
  if(time){
    hasTime=true;if(!date){date=new Date(base);if(new Date(base).setHours(Number(time[1]),Number(time[2]||0))<now.getTime())date.setDate(date.getDate()+1);}
    date.setHours(Number(time[1]),Number(time[2]||0));label=`${label?label+' ':''}${pad(Number(time[1]))}:${pad(Number(time[2]||0))}`;
  }
  return {due_at:date?localIso(date):null,has_time:hasTime,recurrence:date?recurrence:null,label};
}

// Removes date/time/rhythm phrases so an event title stays short ("Chorprobe mittwochs 19:30" -> "Chorprobe").
export function stripWhen(text){
  const out=text
    .replace(/\b(?:alle (?:zwei|2) wochen|14-?tägig|zweiwöchentlich|jede zweite woche|täglich|jeden tag|monatlich|jeden monat)\b/giu,' ')
    .replace(/\b(?:am|ab|jeden|jede|immer|nächsten|nächste)?\s*\b(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)s?\b/giu,' ')
    .replace(/\b(?:am\s+)?\d{1,2}\.\d{1,2}\.(?:\d{2,4})?/gu,' ')
    .replace(/\b(?:am\s+)?\d{1,2}\.?\s*(?:januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)(?:\s+\d{4})?/giu,' ')
    .replace(/\b(?:um\s+)?(?:[01]?\d|2[0-3])(?:[:.][0-5]\d)?\s*uhr\b|\b(?:um\s+)?(?:[01]?\d|2[0-3])[:.][0-5]\d\b/giu,' ')
    .replace(/(?<![\p{L}\p{N}])(?:heute|übermorgen|morgen)(?:\s+(?:abend|früh|nachmittag|vormittag|mittag|nacht))?(?![\p{L}\p{N}])/giu,' ')
    .replace(/(?<![\p{L}\p{N}])(?:am|übers|dieses|diesem|nächstes|nächstem)?\s*wochenende(?![\p{L}\p{N}])/giu,' ')
    .replace(/\s+([,.;!?])/g,'$1').replace(/\s+/g,' ').replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g,'').trim();
  return out||text.trim();
}
