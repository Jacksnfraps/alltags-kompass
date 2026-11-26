import {operation,entryDefaults} from './state.js';
import {parseWhen,stripWhen} from './when.js';
import {groupListIntents,resolveName,findList,isShoppingName,norm as inorm,similar} from './intent.js';

export const kindNames={idea:'Idee / Projekt',todo:'To-do',event:'Termin / Rhythmus',medication:'Tabletten-Zähler'};
export const normalize=s=>s.toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]+/gu,' ').trim();

export function stableId(text){
  const words=[2166136261,2246822519,3266489917,668265263];
  for(const c of text)for(let i=0;i<4;i++)words[i]=Math.imul(words[i]^c.charCodeAt(0),16777619+i*2)>>>0;
  const h=words.map(x=>x.toString(16).padStart(8,'0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20)}`;
}

// Splits into contiguous spans. Joining all span texts always yields the exact original.
export function splitOriginal(text){
  if(!text.trim())return [];
  const cuts=[0];
  const boundaries=/[.!?;]\s+|\n+|\s+(?=(?:außerdem|danach|und dann|ach ja|und noch)\b)/giu;
  for(const match of text.matchAll(boundaries)){
    const end=match.index+match[0].length;
    const before=text.slice(0,match.index+1);
    // Abbreviations, numbers and dates ("12.12.", "ca.", "Dr.") are no sentence ends.
    if(match[0].startsWith('.')&&/\b(?:z|b|bzw|ca|dr|nr|inkl|etc|evtl|ggf|str|tel|vs|u|o|a)\.$/iu.test(before))continue;
    // "3. Dezember", "12.12. Konzert", "2. Stock": a number-dot is no sentence end, except after a time ("19:30. Vanessa").
    if(match[0].startsWith('.')&&/\d\.$/u.test(before)&&!/\d:\d\d\.$/u.test(before)){
      const next=text.slice(end);
      const ordinal=/(?:^|[\s(])\d{1,2}\.$/u.test(before);
      if(/^[\p{Ll}\d]/u.test(next)||/\d{1,2}\.\d{1,2}\.$/u.test(before)||ordinal&&/^(?:jan|feb|mär|apr|mai|jun|jul|aug|sep|okt|nov|dez|stock|etage|klasse|advent|mal\b|woche|tag\b)/iu.test(next))continue;
    }
    if(end<text.length && text.slice(cuts.at(-1),end).trim())cuts.push(end);
  }
  cuts.push(text.length);
  return cuts.slice(0,-1).map((start,i)=>({start,end:cuts[i+1],text:text.slice(start,cuts[i+1])}));
}

const MED=/tablett|medikament|medikinet|ritalin|elvanse|methylphenidat|packung|rezept|kapsel|pille/;
const TODO_VERB=/kaufen|einkauf|besorgen|anrufen|telefonieren|zurückrufen|rückruf|erledigen|bestellen|abholen|bezahlen|überweisen|schicken|schreiben|putzen|aufräumen|reparieren|wegbringen|vereinbaren|ausmachen|kündigen|beantragen|zurückgeben|waschen|einreichen|mailen|buchen|ausfüllen|erinnern|gießen|ummelden/;
const EVENT_WORD=/termin|\buhr\b|konzert|chorprobe|probe|gospelchor|chor\b|müllabfuhr|tonne|gelber sack|altpapier|sperrmüll|dienstplan|\b(?:früh|spät|nacht)?dienst\b|schicht|elternabend|geburtstag am|treffen|arzt\b|zahnarzt|kinderarzt|training\b/;
const IDEA_WORD=/idee|projekt|wanddurchbruch|türzarge|zarge|spachtel|renovier|planen|bauen|ausmessen|\bmaß|breite|höhe|tiefe|umbau|vielleicht mal|könnte man|wäre schön|streichen|tapezier|fliesen|garten|urlaub/;
const CONSTRUCTION=/wanddurchbruch|türzarge|zarge|spachtel|renovier|umbau|breite|höhe|ausmessen|tapezier|streichen|fliesen|trockenbau|dübel|wand\b|decke\b|boden\b|laminat|sockelleiste/;
const ROOMS=/wohnzimmer|küche|bad|badezimmer|schlafzimmer|flur|kinderzimmer|arbeitszimmer|keller|dachboden|gäste ?zimmer/;
const THEMES=[['garten','Garten'],['urlaub|reise|ferien','Urlaub'],['geburtstag|party|feier','Feier & Geburtstag'],['umzug','Umzug'],['auto|reifen|tüv|werkstatt','Auto'],['steuer|finanzamt','Steuer'],['weihnacht|geschenk','Weihnachten & Geschenke'],['hochzeit','Hochzeit']];
const FOCUS=/planen|steuer|formular|antrag|bewerbung|schreiben|organisieren|rechnen|ausfüllen|beantragen|kündigen|einbauen|wanddurchbruch|durchbruch|recherchier|konzept|überlegen|vergleichen/;
const QUICK=/kaufen|besorgen|anrufen|abholen|gießen|wegbringen|schicken|mailen|kurz|schnell|bezahlen|überweisen|tablett|rezept/;
const BINS=[[/gelb/,'Gelbe Tonne / Gelber Sack'],[/bio/,'Biotonne'],[/papier/,'Altpapier'],[/rest/,'Restmüll'],[/sperr/,'Sperrmüll'],[/glas/,'Glas']];
const LABELS={breite:'Breite',höhe:'Höhe',tiefe:'Tiefe',länge:'Länge',stärke:'Stärke',dicke:'Stärke',durchmesser:'Durchmesser',fläche:'Fläche',bestand:'Bestand',packung:'Packung'};

export function personOf(t,people={}){
  const partner=normalize(people.partner||'Vanessa');
  const kids=(people.kids||[]).map(normalize).filter(Boolean);
  const isPartner=partner&&new RegExp(`\\b${partner}\\b`).test(t);
  const isKids=/\b(?:kinder|kind|sohn|tochter|kita|schule|elternabend|kinderarzt|hort|klassenfahrt|schulfest)\b/.test(t)||kids.some(k=>new RegExp(`\\b${k}\\b`).test(t));
  if(/\b(?:familie|wir alle)\b/.test(t))return 'family';
  if(isPartner)return 'vanessa';
  if(isKids)return 'kids';
  return 'me';
}

function facts(text){
  const out={};let n=0;
  for(const m of text.matchAll(/(?:\b(breite|höhe|tiefe|länge|stärke|dicke|durchmesser|fläche|bestand|packung)\b\D{0,12}?)?\b(\d+(?:[.,]\d+)?)\s*(mm|cm|m²|qm|m|kg|g|l|stück|stk|tabletten)\b/giu)){
    const label=m[1]?LABELS[m[1].toLocaleLowerCase('de')]:null;
    let key=label||`Angabe ${++n}`;if(out[key])key=`${key} ${++n}`;
    out[key]=`${m[2]} ${m[3]}`;
  }
  return out;
}

const STOP=/\b(?:füge|füg|hinzufügen|hinzu|folgendes|setzen|schreiben|ich|wir|muss|müssen|noch|mal|unbedingt|bitte|dringend|beim|im|vom|für|die|der|das|den|dem|ein|eine|einen|neue|neuen|neues|kaufen|einkaufen|besorgen|holen|mitbringen|einkauf|einkaufsliste|supermarkt|heute|morgen|übermorgen|nicht|vergessen|und dann|auch)\b/giu;
// "… auf die Einkaufsliste (setzen)", "… für den Einkaufszettel": the list phrase is no part of the item.
const LIST_PHRASE=/\s*(?:bitte\s+)?(?:mit\s+)?(?:auf|in|zur|für|zu)\s+(?:die\s+|den\s+|meine\s+|meinen\s+|unsere\s+|unseren\s+)?(?:einkaufs(?:liste|zettel)|einkaufen|einkauf)(?:\s+(?:setzen|schreiben|packen|tun|nehmen|aufnehmen|hinzufügen))?(?![\p{L}\p{N}])/giu;
export function shoppingItems(text){
  const body=text.replace(/^[\s\-*•]*(?:einkauf(?:sliste)?|einkaufen)\s*:\s*/iu,'').replace(LIST_PHRASE,' ').replace(/[.!?;:\n]+\s*$/u,'');
  return body.split(/,|\bund\b|\bsowie\b|\n|\//u).map(x=>x.replace(STOP,' ').replace(/\s+/g,' ').trim()).filter(x=>x&&x.length<60&&/\p{L}/u.test(x));
}
const cap=s=>s?s[0].toLocaleUpperCase('de')+s.slice(1):s;
export function callDetails(text,whenLabel=''){
  const clean=text.trim().replace(/[.!?;]+$/u,'');
  const why=(clean.match(/\b(?:wegen|wg\.|weil|bzgl\.?|bezüglich|für|um)\s+(.+)$/iu)?.[1]||'').replace(/\s+(?:heute|morgen|übermorgen|(?:am\s+)?(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)|(?:um\s+)?\d{1,2}(?:[:.]\d{2})?\s*uhr)\s*$/iu,'').trim();
  let who=clean.match(/\bbei\s+(?:der|dem|den)?\s*([\p{L}\-]+(?:\s+[\p{Lu}][\p{L}\-]+)?)/iu)?.[1]||'';
  if(!who){const before=clean.split(/\s+(?:an|zurück)?(?:rufen|anrufen|telefonieren|zurückrufen)\b|\s+anrufen\b|\s+zurückrufen\b/iu)[0];
    who=before.replace(/\b(?:mit|noch|mal|unbedingt|bitte|heute|morgen|übermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|ich|muss|wir|sollte|dringend|wegen.*)\b/giu,' ').replace(/\s+/g,' ').trim();}
  who=who.replace(/\s+(?:anrufen|zurückrufen|telefonieren|wegen|weil|für|um)\b.*$/iu,'').trim();
  if(who.length>40)who=who.split(' ').slice(0,3).join(' ');
  return {who:cap(who),when:whenLabel,why};
}

// Signals for "this is something to do" beyond the verb list: modal phrases and a lowercase
// infinitive at the end ("Fahrrad Reifen flicken"). German nouns are capitalised, so "Socken" is no verb.
const TODO_MODAL=/\b(?:ich muss|muss ich|wir müssen|müssen wir|muss noch|ich sollte|sollte ich|nicht vergessen|denk an|denke an|daran denken|dran denken|erledigen|weiter ?arbeiten|weitermachen|fertig machen|fertigmachen|vorbereiten|kümmern|machen lassen|to ?do)\b/;
const IDEA_SIGNAL=/\b(?:mir ist wichtig|wichtig wäre|wäre (?:gut|toll|schön|cool|praktisch)|ich (?:möchte|will|wünsche|hätte gern)|man könnte|könnte man|sollte man|wir könnten|vielleicht|irgendwann|feature|funktion|app\b|einbauen dass|dass man)\b/;
const EVENT_NOUN=/termin|konzert|chorprobe|probe\b|gospelchor|chor\b|auftritt|müllabfuhr|tonne|gelber sack|altpapier|sperrmüll|dienstplan|\b(?:früh|spät|nacht)?dienst\b|schicht|elternabend|elterngespräch|geburtstag am|treffen|verabredung|besuch\b|arzt\b|zahnarzt|kinderarzt|frisör|friseur|training\b|kino|theater|essen gehen|feier\b|party|meeting|sitzung|gottesdienst/;
const lastWordVerb=text=>{const w=text.trim().replace(/[.!?;:,]+$/u,'').split(/\s+/);const last=w.at(-1)||'';return w.length>=2&&w.length<=10&&/^\p{Ll}+(?:en|ern|eln)$/u.test(last)&&!/^(?:morgen|übermorgen|abend|wochen|garten|einen|keinen|meinen|deinen|seinen|ihren|unseren|allen|vielen|anderen)$/u.test(last);};

function metadata(text,options){
  const t=normalize(text);let kind='idea',uncertain=false;
  const when=parseWhen(text,options.now);
  const strongTodo=TODO_VERB.test(t)||TODO_MODAL.test(t);
  const ideaWord=IDEA_WORD.test(t)||CONSTRUCTION.test(t);
  const eventish=EVENT_NOUN.test(t)||EVENT_WORD.test(t);
  if(MED.test(t))kind='medication';
  // A fixed time with an appointment noun is an event, even if phrased as "nicht vergessen".
  else if(when.has_time&&eventish)kind='event';
  else if(IDEA_SIGNAL.test(t)&&!when.due_at)kind='idea';
  else if(strongTodo)kind='todo';
  // Construction/planning steps ("Türzarge einbauen") stay idea steps of their strand.
  else if(ideaWord&&!eventish)kind='idea';
  else if(lastWordVerb(text))kind='todo';
  else if(eventish||when.due_at)kind='event';
  // Only real ambiguity goes to "Kurz klären": very short fragments without any signal.
  else uncertain=t.split(' ').filter(Boolean).length<4;
  if(kind==='idea'&&!ideaWord&&t.split(' ').filter(Boolean).length<4)uncertain=true;
  const explicit=text.match(/\b(15|30|60)\s*(?:min|minute)/i)||(/\b(?:1|eine)\s*(?:std|stunde|h)\b/i.test(text)?[0,'60']:null);
  const minutes=explicit?Number(explicit[1]):/durchbruch|einbauen|renovier|spachtel|tapezier|streichen|aufräumen|steuer|antrag|bewerbung/.test(t)?60:QUICK.test(t)?15:30;
  const energy=minutes===60||(FOCUS.test(t)&&!QUICK.test(t))?'high':'low';
  const category=kind==='todo'?(/kaufen|einkauf|besorgen|supermarkt|drogerie/.test(t)?'shopping':/anruf|telefon|zurückruf|rückruf/.test(t)?'call':'general')
    :kind==='event'?(/müll|tonne|abfuhr|gelber sack|altpapier|sperrmüll/.test(t)?'trash':/\b(?:früh|spät|nacht)?dienst\b|dienstplan|schicht/.test(t)?'shift':when.recurrence?'rhythm':'appointment'):'general';
  const position=/ausmessen|\bmaß|planen|prüfen|besprechen|angebot/.test(t)?10:/durchbruch|abriss|rausreißen/.test(t)?20:/zarge|einbauen|montier/.test(t)?30:/spachtel|verputz/.test(t)?40:/schleifen/.test(t)?45:/streichen|tapezier|fliesen/.test(t)?50:/aufräumen|putzen|sockelleiste/.test(t)?60:55;
  const row={kind,minutes,energy,uncertain,facts:facts(text),position,category,person:personOf(t,options.people),due_at:when.due_at,all_day:when.due_at?!when.has_time:false,recurrence:when.recurrence};
  if(category==='shopping')row.items=shoppingItems(text);
  if(category==='call')row.contact=callDetails(text,when.label);
  return row;
}

// Short, readable titles: "Heute ist um 19:00 Uhr Chorprobe" -> "Chorprobe".
const FILLER=/^(?:(?:also|ach ja|und|übrigens|außerdem|dann|noch|mal|unbedingt|bitte|dringend|ist|sind|hab(?:e)? ich|haben wir|ich hab(?:e)?|wir haben|es ist|da ist|ich muss|muss ich|wir müssen|müssen wir|ich sollte|sollte ich|nicht vergessen:?|denk(?:e)? an|abends?|nachmittags?|vormittags?)\s+)+/iu;
export function cleanTitle(text){const out=text.replace(FILLER,'').replace(/^[\s,.;:–-]+/u,'').trim();return out.length>=3?cap(out):text.trim();}

// Compact summary for ideas: "Mir ist wichtig, dass man Bilder hinterlegen kann in Alltagskompass"
// (strand "Alltagskompass") -> "Bilder hinterlegen". The full original stays in the capture.
const IDEA_LEAD=/^(?:(?:also|ach ja|übrigens|idee|notiz)\s*[:,–-]?\s+)?(?:mir ist (?:es )?(?:wichtig|aufgefallen)|wichtig (?:ist|wäre)|ich (?:fände|finde) es (?:gut|schön|toll|wichtig|praktisch)|(?:es )?wäre (?:(?:super|sehr|echt|total|richtig|ziemlich|so)\s+)?(?:gut|schön|toll|praktisch|cool|hilfreich|sinnvoll|klasse|super)|ich (?:möchte|will|wünsche mir|hätte gerne?)|wir sollten|man sollte|man könnte|könnte man|wir könnten|vielleicht)\s*,?\s*(?:(?:dass|wenn|ob)\s+)?(?:(?:man|wir|ich|es)\s+)?/iu;
const IDEA_MODAL=/\s(?:kann|könnte|können|soll|sollte|sollten|müsste|würde|würden|wird)(?=[\s.,!?;]|$)/giu;
const escapeRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const word=src=>new RegExp(`(?<![\\p{L}\\p{N}])(?:${src})(?![\\p{L}\\p{N}])`,'giu');
// Words that carry no content in a spoken thought ("tatsächlich", "gegebenenfalls", "auf jeden Fall").
const SOFT=word('tatsächlich|eigentlich|gegebenenfalls|ggf\\.?|eventuell|evtl\\.?|irgendwie|irgendwann|einfach|halt|mal|noch|auch|wirklich|unbedingt|auf jeden fall|auf alle fälle|gerne?|bitte|quasi|sozusagen|grundsätzlich|möglichst|dringend|schon mal|endlich');
const CONTAINER=word('(?:in|im|bei|für)\\s+(?:de[mnr]|die|das|unsere[mnr]?|meine[mnr]?)?\\s*(?:programm|app|anwendung|tool|software)');
const SUBCLAUSE=/,?\s+(?:weil|damit|da|sobald|bevor|nachdem|obwohl|sodass|so dass|und zwar|denn|falls|wobei|was|wo)\s+.*$/iu;
const LEAD_ART=/^(?:de[rnms]|die|das|eine?[mnrs]?|meine?[mnrs]?|unsere?[mnrs]?)\s+(?=\S)/iu;
const GENERIC_END=/\s+(?:haben|sein|geben|bekommen|kriegen|werden)$/iu;
const SUBJECT=/^(?:(?:die|das|der)\s+)?(?:app|programm|anwendung|tool|kompass|alltagskompass)\s+(?:(?:mir|uns|dir|einem)\s+)?/iu;
const DANGLING=/(?:\s+(?:und|oder|sowie|mit|für|von|vom|im|in|am|an|auf|aus|bei|beim|nach|zum|zur|aller|allen|alle|der|die|das|den|dem|des|ein|eine|einen|einem|einer|mir|uns))+$/iu;
const VERB_TAIL=/\s+((?:\p{Ll}+(?:en|ern|eln))(?:\s+lassen)?)$/u;
// Long enumerations become "A, B usw." instead of being cut off mid-sentence.
const shortenList=s=>s.replace(/((?:[\p{L}\p{N}-]+\s+)?[\p{L}\p{N}-]+,\s*[\p{L}\p{N}-]+)(?:,\s*[\p{L}\p{N}-]+)*(?:,?\s+(?:und|oder|sowie)\s+[\p{L}\p{N}-]+)/gu,(m,head)=>m.split(/,|\s+(?:und|oder|sowie)\s+/u).length>3?`${head} usw.`:m);
// Cut at a phrase boundary (comma, preposition) – never mid-phrase and never with "…".
function phraseCut(s,max){
  if(s.length<=max)return s;
  let best=0;
  for(const m of s.matchAll(/,\s|\s(?=(?:mit|für|von|vom|im|in|am|an|auf|aus|bei|beim|nach|über|unter|zum|zur|ohne|durch|gegen|und|oder)\s)/giu))if(m.index>=12&&m.index<=max)best=m.index;
  return best?s.slice(0,best):s.split(' ').reduce((out,w)=>(out+' '+w).trim().length<=max?(out+' '+w).trim():out,'');
}
// A real short version of a spoken idea/to-do: strips filler, the "Mir ist wichtig, dass man …" frame,
// modal verbs, the app/strand the thought belongs to and trailing reasons. The original stays in the capture.
export function summarize(text,{projectTitle='',max=72}={}){
  let s=String(text||'').trim().replace(/[.!?;]+$/u,'');
  const full=s;
  s=s.replace(SOFT,' ').replace(/\s+/g,' ').replace(/\s+,/g,',').trim();
  s=s.replace(IDEA_LEAD,'').replace(FILLER,'').replace(IDEA_MODAL,'').replace(CONTAINER,m=>/^(?:für)/iu.test(m)?'für':'in');
  if(projectTitle)s=s.replace(new RegExp(`\\s+(?:in|im|für|bei|zum|zur|beim)\\s+(?:de[rnm]\\s+|die\\s+|das\\s+)?${escapeRe(projectTitle)}(?![\\p{L}\\p{N}])`,'iu'),'');
  s=s.replace(SUBCLAUSE,'').replace(SUBJECT,'').replace(LEAD_ART,'').replace(/\s+/g,' ').replace(/^[\s,.;:–-]+|[\s,;:–-]+$/gu,'').trim();
  if(s.split(' ').length>3)s=s.replace(GENERIC_END,'');
  if(s.length>max)s=shortenList(s);
  if(s.length>max){
    // Keep the action at the end ("… anzeigen") and shorten what comes before it.
    const tail=s.match(VERB_TAIL)?.[1]||'';const body=tail?s.slice(0,-tail.length).trim():s;
    s=[phraseCut(body,max-(tail?tail.length+1:0)).replace(DANGLING,''),tail].filter(Boolean).join(' ');
  }
  s=s.replace(/[\s,;:–-]+$/u,'');
  if(s.length<3)s=cleanTitle(full);
  return cap(s);
}
export const shortIdea=(text,projectTitle='',max=72)=>summarize(text,{projectTitle,max});

// Own lists: see intent.js (shared by the local fallback and the AI validation).
export {listIntent} from './intent.js';

// The shopping list is no list entity but a valid target for "… auf die Einkaufsliste" / AI list_name.
const withShopping=(lists=[])=>[...lists,{title:'Einkaufsliste'}];
// One result row for a list intent. create_list without items only creates the list (no entry).
function listPart(meta,part,li){
  const base={...meta,...part,kind:'todo',minutes:15,energy:'low',due_at:null,all_day:false,recurrence:null,project:'',missing_fields:[],uncertain:!!li.uncertain,person:'me'};
  if(li.shopping||isShoppingName(li.list))return {...base,category:'shopping',action:'add_to_list',list:'Einkaufsliste',items:li.items,title:(li.items.join(', ')||'Einkauf').slice(0,110)};
  return {...base,category:'list',action:li.action,list:li.list,items:li.items,title:(li.items.length?li.items.join(', '):li.list).slice(0,110)};
}

export function localSort(text,projects=[],options={}){
  const opts={now:new Date(),people:{},...options};
  // List intents first: header blocks and multi-sentence requests are grouped into one contiguous span.
  const isPerson=i=>personOf(normalize(i),opts.people)!=='me';
  const parts=groupListIntents(text,splitOriginal(text),{lists:withShopping(opts.lists),isPerson});
  const roomLabel=r=>`Umbau ${cap(r==='badezimmer'?'bad':r)}`;
  const anchors=parts.map(p=>normalize(p.text).match(new RegExp(`(?:wanddurchbruch|renovierung|umbau|renovieren)\\s+(?:(?:im|in der|in dem)\\s+)?(${ROOMS.source})`))).filter(Boolean);
  const labels=[...new Set(anchors.map(m=>roomLabel(m[1])))];
  return parts.map(({intent,...part})=>{
    const meta=metadata(part.text,opts);const t=normalize(part.text);let project='';
    if(intent)return listPart(meta,part,intent);
    const explicit=part.text.match(/projekt\s+([^:\n.!?]{2,60}):/i);
    if(explicit)project=explicit[1].trim();
    const room=t.match(ROOMS);
    const construction=CONSTRUCTION.test(t)&&meta.kind!=='todo'||/durchbruch|türzarge|spachtel/.test(t);
    if(!project&&construction){
      if(room)project=labels.find(l=>normalize(l).includes(room[0].replace('badezimmer','bad')))||roomLabel(room[0]);
      else if(labels.length===1)project=labels[0];
      else if(labels.length>1)meta.uncertain=true;
    }
    if(!project){const matches=projects.filter(p=>{const words=normalize(p.title).split(' ').filter(w=>w.length>3);return words.length&&words.every(w=>t.includes(w));});if(matches.length===1){project=matches[0].title;meta.uncertain=false;}else if(matches.length>1)meta.uncertain=true;}
    const theme=(meta.kind==='idea'||meta.kind==='todo')&&meta.category==='general'?THEMES.find(([re])=>new RegExp(`\\b(?:${re})`).test(t)):null;
    if(!project&&theme){project=theme[1];meta.uncertain=false;}
    if(!project&&construction&&!labels.length){const existing=projects.filter(p=>/^Umbau /.test(p.title));if(existing.length===1&&!room)project=existing[0].title;else if(existing.length>1)meta.uncertain=true;}
    if(construction&&meta.kind==='idea')meta.uncertain=meta.uncertain&&!project;
    const missing=construction&&/durchbruch|zarge|tür|fenster/.test(t)&&!(meta.facts.Breite&&meta.facts.Höhe)?['Breite, Höhe und Einbausituation prüfen']:[];
    const plain=part.text.trim().replace(/[.!?;]+$/u,'');
    const bin=meta.category==='trash'&&BINS.find(([re])=>re.test(t));
    const title=bin?bin[1]:meta.category==='shopping'&&meta.items?.length?meta.items.join(', '):meta.kind==='idea'?shortIdea(meta.due_at?stripWhen(plain):plain,project):cleanTitle(meta.kind==='event'||meta.due_at?stripWhen(plain):plain);
    return {...meta,...part,project,title:title.slice(0,110),missing_fields:missing};
  });
}

// AI list intent for one row, strictly checked: the target is an existing list (fuzzy) or a new name whose
// words occur in the text; items must literally occur in the segment. Otherwise null (local result wins).
const GENERIC_NAME=/^(?:liste|packliste|tasche|koffer|rucksack|kiste|box|beutel)$/;
function aiListRow(row,local,{lists=[],text=''}){
  const name=typeof row.list_name==='string'?row.list_name.trim().slice(0,60):'';
  const r=resolveName(name,withShopping(lists));if(!r)return null;
  const words=s=>inorm(s).split(' ').filter(Boolean);
  if(!r.existing){const src=words(`${text} ${local.text}`);if(words(r.title).some(w=>w.length>=3&&!GENERIC_NAME.test(w)&&!src.some(t=>similar(t,w))))return null;}
  const seg=words(local.text);
  const items=(Array.isArray(row.items)?row.items:[]).filter(x=>typeof x==='string').map(x=>x.replace(/\s+/g,' ').trim()).filter(x=>x&&x.length<=60)
    .filter(x=>{const w=words(x).filter(t=>t.length>=3);return w.length?w.every(t=>seg.some(s=>similar(s,t))):seg.includes(inorm(x));}).slice(0,40);
  if(row.action==='add_to_list'&&Array.isArray(row.items)&&row.items.length&&!items.length)return null;
  const base={...local,kind:'todo',minutes:15,energy:'low',due_at:null,all_day:false,recurrence:null,project:'',uncertain:false,missing_fields:[]};
  if(r.shopping)return items.length?{...base,category:'shopping',action:'add_to_list',list:'Einkaufsliste',items,title:items.join(', ').slice(0,110)}:null;
  return {...base,category:'list',action:r.existing?'add_to_list':'create_list',list:r.title,items,title:(items.join(', ')||r.title).slice(0,110)};
}

export function validateSuggestions(value,parts,context={}){
  if(!Array.isArray(value)||value.length!==parts.length)throw new Error('Unvollständige Sortierung');
  return value.map((row,i)=>{
    if(row.index!==i||!Object.hasOwn(kindNames,row.kind)||![15,30,60].includes(row.minutes)||!['low','high'].includes(row.energy)||typeof row.project!=='string'||row.project.length>120||typeof row.uncertain!=='boolean'||!Number.isInteger(row.position)||row.position<0||row.position>1000)throw new Error('Ungültige Sortierung');
    if(row.action!=null&&!['none','create_list','add_to_list'].includes(row.action))throw new Error('Ungültige Listen-Aktion');
    // Content/spans/facts/dates always remain locally derived. Cloud supplies metadata and list intents.
    const local=parts[i];const changedKind=row.kind!==local.kind;
    if(row.action&&row.action!=='none'){const ai=aiListRow(row,local,context);if(ai)return ai;}
    if(local.category==='list'||local.action)return local;
    return {...local,kind:row.kind,minutes:row.minutes,energy:row.energy,project:row.project,uncertain:row.uncertain,position:row.position,category:changedKind?'general':local.category};
  });
}

export function sortingOperations(capture,parts,state,source='local'){
  if(Object.values(state.entry).some(e=>e.capture_id===capture.id)||state.capture?.[capture.id]?.linked_lists?.length)return [];
  if(parts.map(p=>p.text).join('')!==capture.original_text)throw new Error('Originalabdeckung nicht vollständig.');
  const ops=[],known=new Map(Object.values(state.project).map(p=>[normalize(p.title),p.id]));
  const lists=new Map(Object.values(state.list||{}).map(l=>[normalize(l.title),l.id]));
  const linked=[];
  const listId=title=>{const key=normalize(title);let lid=lists.get(key);
    if(!lid){lid=stableId('list:'+key);const lop=operation('list',lid,{title});lop.id=lid;ops.push(lop);lists.set(key,lid);}
    return lid;};
  parts.forEach((p,i)=>{
    if(!p.text.trim())return;
    // "Füge eine Liste hinzu für die Tasche": creates/links the list, no to-do from the request sentence.
    if(p.category==='list'&&p.list&&!p.items?.length){linked.push(listId(p.list));return;}
    if(p.category==='shopping'&&p.action&&!p.items?.length)return;
    let project_id=null;
    if(p.project&&!p.uncertain){const key=normalize(p.project);project_id=known.get(key)||stableId('project:'+key);if(!known.has(key)){const op=operation('project',project_id,{title:p.project});op.id=project_id;ops.push(op);known.set(key,project_id);}}
    const id=stableId(`${capture.id}:part:${i}`);
    const data={...entryDefaults(p.kind),capture_id:capture.id,title:p.title,details:p.text,source_start:p.start,source_end:p.end,project_id,minutes:p.minutes,energy:p.energy,position:p.position,facts:p.facts||{},missing_fields:p.missing_fields||[],category:p.category||'general',needs_review:p.uncertain,suggested_project:p.project,sort_source:source,person:p.person||'me',due_at:p.due_at||null,all_day:!!p.all_day,recurrence:p.recurrence||null};
    if(p.items)data.items=p.items;if(p.contact)data.contact=p.contact;
    if(p.category==='list'&&p.list){const lid=listId(p.list);data.list_id=lid;data.project_id=null;linked.push(lid);}
    const op=operation('entry',id,data);op.id=id;ops.push(op);
  });
  ops.push(operation('capture',capture.id,{sorting_status:'reviewed',sort_source:source,...(linked.length?{linked_lists:[...new Set(linked)]}:{})},'patch'));return ops;
}
