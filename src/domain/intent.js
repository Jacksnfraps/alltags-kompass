// List intents from free speech – the local half of the intent contract that the AI path (/api/parse)
// fills as well: {action:'create_list'|'add_to_list', list_name, items[]}.
// Handles: fuzzy targets ("in die Tasche für den Alfsee" -> "Tasche Alfsee"), natural creation
// ("… muss dafür eine Tasche packen. Füge eine Liste hinzu für die Tasche." -> "Tasche Aasee"),
// header blocks ("Füge folgendes zur Liste X hinzu:\nFöhn\niPad") and packing phrases.
import {stripWhen} from './when.js';

export const norm=s=>String(s||'').toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const cap=s=>s?s[0].toLocaleUpperCase('de')+s.slice(1):s;
export const CONTAINERS=['tasche','koffer','rucksack','kiste','box','beutel','sporttasche','reisetasche','kulturbeutel','badetasche','strandtasche'];
const GENERIC=new Set([...CONTAINERS,'liste','packliste','sachen','zeug','dinge','für','den','die','das','der','dem','zum','zur','nach','und']);
// Destinations that are appointments or people's places, not trips: "Oma mit zum Arzt nehmen" stays a to-do.
const NOT_TRIP=/^(?:arzt|zahnarzt|kinderarzt|termin|konzert|probe|chorprobe|schule|kita|hort|arbeit|dienst|schicht|training|kino|theater|feier|party|meeting|sitzung|post|bank|apotheke|werkstatt|wochenende|abend|morgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)$/i;
export const isShoppingName=name=>/einkauf/.test(norm(name));

function lev(a,b){
  if(Math.abs(a.length-b.length)>1)return 2;
  const row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;
    for(let j=1;j<=b.length;j++){const tmp=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=tmp;}}
  return row[b.length];
}
// Tolerant word match: inflection ("Alfsees"), small typos ("Alfse"), never "Aasee" vs "Alfsee".
export const similar=(a,b)=>a===b||(a.length>=4&&b.length>=4&&(a.startsWith(b)||b.startsWith(a))&&Math.abs(a.length-b.length)<=3)||(Math.min(a.length,b.length)>=5&&lev(a,b)<=1);

// Best existing list for a free phrase. Distinctive words (Alfsee, Urlaub) count; generic words
// (Tasche, Liste) only decide when exactly one list fits.
export function findList(text,lists=[]){
  const toks=norm(text).split(' ').filter(Boolean);
  const scored=lists.map(l=>{
    const words=norm(l.title).split(' ').filter(w=>w.length>=3);
    const distinct=words.filter(w=>!GENERIC.has(w));
    const d=distinct.filter(w=>toks.some(t=>similar(t,w))).length;
    const g=words.filter(w=>GENERIC.has(w)&&toks.some(t=>similar(t,w))).length;
    return {list:l,d,g,share:distinct.length?d/distinct.length:0};
  });
  const strong=scored.filter(x=>x.d>0).sort((a,b)=>b.share-a.share||b.d-a.d||b.g-a.g);
  if(strong.length)return {list:strong[0].list,uncertain:strong.length>1&&strong[1].share===strong[0].share&&strong[1].d===strong[0].d&&strong[1].g===strong[0].g};
  const weak=scored.filter(x=>x.g>0);
  return weak.length===1?{list:weak[0].list,uncertain:false}:null;
}
function exactList(name,lists){const k=norm(name);return lists.find(l=>norm(l.title)===k)||null;}
// Resolves a spoken list name: exact, then fuzzy, else a new list with that name.
export function resolveName(name,lists=[]){
  const clean=cap(String(name||'').replace(/^[„"»\s]+|[“"«\s.,;:!?]+$/gu,'').replace(/\s+/g,' ').trim()).slice(0,60);
  if(!clean)return null;
  if(isShoppingName(clean))return {title:'Einkaufsliste',shopping:true,existing:true};
  const exact=exactList(clean,lists);if(exact)return {title:exact.title,existing:true};
  // Fuzzy only on distinctive words: "Tasche Aasee" must not land in "Tasche Alfsee" just because of "Tasche".
  const own=norm(clean).split(' ').filter(w=>!GENERIC.has(w)&&w.length>=3);
  const fuzzy=own.length?findList(clean,lists):null;
  if(fuzzy&&own.every(w=>norm(fuzzy.list.title).split(' ').some(t=>similar(t,w))))return {title:fuzzy.list.title,existing:true,uncertain:fuzzy.uncertain};
  return {title:clean,existing:false};
}

const PREP='(?:mit\\s+)?(?:zum|zur|zu|nach|ins|für|fürs|in\\s+den|in\\s+die|in\\s+das|an\\s+den|an\\s+die|ans|auf\\s+den|auf\\s+die)';
// "zum Aasee", "für den Urlaub", "nach Holland" -> Aasee / Urlaub / Holland
export function destinationOf(text){
  const s=String(text||'');const lower=s.charAt(0).toLocaleLowerCase('de')+s.slice(1);
  for(const m of lower.matchAll(/(?:^|\s)(?:zum|zur|nach|ins|fürs|in\s+den|in\s+die|an\s+den|an\s+die|ans|auf\s+den|für\s+(?:den|die|das))\s+(\p{Lu}[\p{L}-]+)/gu)){
    const w=m[1];if(!CONTAINERS.includes(w.toLocaleLowerCase('de'))&&!NOT_TRIP.test(w)&&!/^(?:liste|packliste)$/i.test(w))return w;
  }
  return null;
}
const CONTAINER_RE=new RegExp(`(?:in|auf)\\s+(?:die|den|das|meine[nm]?|unsere[nm]?)?\\s*(${CONTAINERS.join('|')})(?![\\p{L}])`,'giu');
const COMMANDS=new RegExp(`(?<![\\p{L}])(?:auf jeden fall|nicht vergessen|denk(?:e)? an|und dann|füge|füg|fügt|hinzu|hinzufügen|dazu|folgendes|folgende|folgenden|bitte|noch|auch|ich|wir|du|muss|müssen|musst|soll|sollte|sollten|will|möchte|möchten|dafür|mitnehmen|mitbringen|mit|nehmen|nimm|einpacken|einstecken|packen|pack|packe|ein|rein|hinein|kommt|kommen|gehört|gehören|setzen|setz|setze|schreiben|schreib|schreibe|eintragen|trag|trage|unbedingt|vergessen|also|außerdem|dann|hier|sachen|zeug|liste|packliste|brauche|brauchen|wichtig|ist|sind|fahre|fahren|fahr|gehe|gehen|geht|bin|sind|da|hin|zum|zur|nach|für|in|den|die|das|dem|der|des)(?![\\p{L}])`,'giu');
const ART=/^(?:de[nmrs]|die|das|eine?[nmrs]?|meine?[nmrs]?|unsere?[nmrs]?|deine?[nmrs]?|ein paar|paar|etwas|genug)\s+/iu;
export function cleanItem(raw){
  let s=String(raw).replace(/^[\s\-*•–]+|^\d+[.)]\s*/u,'').replace(/\s+/g,' ').trim();
  for(let i=0;i<3;i++)s=s.replace(ART,'').trim();
  s=s.replace(/^[\s,.;:–-]+|[\s,.;:!?–-]+$/gu,'');
  // "iPad", "eBook" keep their spelling; everything else starts upper-case.
  return /^\p{Ll}+\p{Lu}/u.test(s)?s:cap(s);
}
// What is left of a sentence once target, container, commands and time phrases are removed.
function residual(text,removeWords=[]){
  let s=stripWhen(String(text)).replace(CONTAINER_RE,' ');
  for(const w of removeWords)s=s.replace(new RegExp(`${PREP}?\\s*(?:de[nmr]\\s+|die\\s+|das\\s+)?(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?![\\p{L}])`,'giu'),' ');
  s=s.replace(COMMANDS,' ');
  const chunks=s.split(/,|\n|\s+und\s+|\s+sowie\s+|\s+oder\s+/u).map(cleanItem).filter(x=>x.length>=2&&/\p{L}/u.test(x));
  const nouns=chunks.filter(x=>/\p{Lu}/u.test(x.slice(1))||/^\p{Lu}/u.test(x)&&!/^(?:Ich|Wir|Du|Und)$/u.test(x));
  return (nouns.length?nouns:chunks.length===1&&chunks[0].split(' ').length<=3?chunks:[]).map(x=>x.slice(0,60));
}
const splitList=s=>String(s).split(/,|\n|;|\s+und\s+|\s+sowie\s+/u).map(cleanItem).filter(x=>x.length>=1&&/\p{L}/u.test(x)&&x.length<=60);
const containerOf=text=>{const m=norm(text).split(' ').find(w=>CONTAINERS.includes(w));return m||null;};

const CUE=new RegExp(`(?<![\\p{L}])(?:mitnehmen|mitbringen|nehmen|einpacken|einstecken|packen|pack|rein|hinein|dazu)(?![\\p{L}])|(?:in|auf)\\s+(?:die|den|das|meine[nm]?|unsere[nm]?)?\\s*(?:${CONTAINERS.join('|')})(?![\\p{L}])`,'iu');
const HEADERISH=/(?:folgendes|folgende|folgenden|diese sachen|das hier)/iu;

// Detects a list intent in one segment. context: {dest, list} from earlier sentences of the same thought.
// Returns {action,list,items,header,uncertain,shopping} or null.
export function detectListIntent(text,{lists=[],context={},isPerson=()=>false}={}){
  const raw=String(text||'');const plain=raw.trim().replace(/[.!?;]+$/u,'');if(!plain)return null;
  const ci=plain.indexOf(':');const head=(ci>=0?plain.slice(0,ci):plain).trim();const tail=ci>=0?plain.slice(ci+1):'';
  const tailItems=splitList(tail);
  const finish=(name,items,{header=false,generic=null}={})=>{
    let title=name;
    // "eine Liste für die Tasche": the container gets the trip from the context ("Tasche Aasee").
    if(generic){const dest=context.dest;const ctxList=context.list&&norm(context.list).includes(generic)?context.list:null;title=ctxList||(dest?`${cap(generic)} ${dest}`:cap(generic));}
    const r=resolveName(title,lists);if(!r)return null;
    const clean=[...new Set(items.filter(i=>norm(i)&&!CONTAINERS.includes(norm(i))))];
    return {action:r.existing?'add_to_list':'create_list',list:r.title,items:clean,header,uncertain:!!r.uncertain,shopping:!!r.shopping};
  };
  let m;
  // 1) "Liste Tasche Alfsee: Föhn, iPad" / "Packliste Urlaub:"
  if(ci>=0&&(m=head.match(/^(?:auf\s+(?:die\s+)?|zur\s+|neue\s+)?((?:pack)?liste)\s+[„"»]?(.+?)[“"«]?$/iu)))
    return finish(/^pack/i.test(m[1])&&!/^packliste/i.test(m[2])?`Packliste ${m[2]}`:m[2],tailItems,{header:!tailItems.length});
  // 2) "… zu der Liste Tasche Alfsee hinzu(:)" / "Föhn auf Liste Tasche Alfsee"
  if((m=head.match(/^(.*?)(?:^|\s)(?:zu|zur|zum|in|auf|an)\s+(?:der|die|den|dem|meine[rnm]?|unsere[rnm]?)?\s*((?:pack)?liste)\s+(?!hinzu|dazu|für\b|an\b)[„"»]?([^„"»“«,\n]+?)[“"«]?(?:\s+(?:hinzu(?:fügen)?|dazu|setzen|schreiben|packen|aufnehmen|eintragen))?$/iu))){
    const before=residual(m[1]);
    return finish(/^pack/i.test(m[2])?`Packliste ${m[3]}`:m[3],[...before,...tailItems],{header:!before.length&&!tailItems.length});
  }
  // 3) "Füge eine Liste hinzu für die Tasche", "Erstelle eine Packliste für den Urlaub (mit A und B)"
  if((m=head.match(/(?:^|\s)(?:eine?n?\s+|neue[n]?\s+|meine\s+)*((?:pack)?liste)\s+(?:(?:hinzu|an|anlegen|erstellen|machen)\s+)?(?:für|fürs|zum|zur)\s+(?:den\s+|die\s+|das\s+|meine[nrm]?\s+|unsere[nrm]?\s+)?([\p{L}\d][\p{L}\d -]*?)(?:\s+mit\s+(.+))?(?:\s+(?:an|anlegen|erstellen|machen|hinzu|hinzufügen))?$/iu))){
    const word=m[2].trim();const items=[...(m[3]?splitList(m[3]):[]),...tailItems];
    const gen=CONTAINERS.includes(norm(word))?norm(word):null;
    if(gen)return finish('',items,{generic:gen,header:ci>=0&&!items.length});
    return finish(/^pack/i.test(m[1])?`Packliste ${word}`:word,items,{header:ci>=0&&!items.length});
  }
  // 4) "Erstelle eine neue Liste Baumarkt", "Liste Baumarkt anlegen", "Lege eine Packliste an"
  if((m=head.match(/(?:erstell\w*|leg\w*|mach\w*|füg\w*|neue[n]?)\s+(?:mir\s+)?(?:eine?n?\s+)?(?:neue[n]?\s+)?((?:pack)?liste)(?:\s+[„"»]?([^„"»“«:]+?)[“"«]?)?(?:\s+(?:an|anlegen|erstellen|hinzu|hinzufügen))?$/iu)||head.match(/^((?:pack)?liste)\s+[„"»]?(.+?)[“"«]?\s+(?:anlegen|erstellen)$/iu))){
    const word=(m[2]||'').trim();
    if(!word){if(context.dest)return finish(`${/^pack/i.test(m[1])?'Packliste':'Liste'} ${context.dest}`,tailItems,{header:ci>=0&&!tailItems.length});return null;}
    const gen=CONTAINERS.includes(norm(word))?norm(word):null;
    return gen?finish('',tailItems,{generic:gen}):finish(word,tailItems,{header:ci>=0&&!tailItems.length});
  }
  // 5) Header without the word "Liste": "Für die Tasche Alfsee:" / "Alfsee folgendes einpacken:"
  if(ci>=0||HEADERISH.test(head)){
    const hit=findList(head,lists);
    if(hit&&(ci>=0||CUE.test(head))&&(tailItems.length||/:\s*$/.test(raw.trim())||HEADERISH.test(head)))return {action:'add_to_list',list:hit.list.title,items:tailItems,header:!tailItems.length,uncertain:hit.uncertain,shopping:false};
  }
  // 6) Packing phrases: "zum Alfsee muss ich auch Unterwäsche mitnehmen", "in die Tasche für den Alfsee
  //    muss noch ein Ladekabel", "… zum Aasee und muss dafür eine Tasche packen".
  if(!CUE.test(plain))return null;
  const hit=findList(plain,lists);
  const dest=destinationOf(plain);
  const container=containerOf(plain);
  let target=null,remove=[];
  if(hit&&(hit.list&&norm(hit.list.title).split(' ').some(w=>!GENERIC.has(w)&&norm(plain).split(' ').some(t=>similar(t,w)))||!dest)){
    target={title:hit.list.title,existing:true,uncertain:hit.uncertain};
    remove=norm(plain).split(' ').filter(t=>norm(hit.list.title).split(' ').some(w=>w.length>=3&&similar(t,w)));
  }else if(dest){target=null;remove=[dest];}
  else if(container&&context.list&&norm(context.list).includes(container)){target={title:context.list,existing:lists.some(l=>l.title===context.list)};}
  else return null;
  const items=residual(plain,remove).filter(i=>!isPerson(i));
  const onlyContainer=!items.length||items.every(i=>CONTAINERS.includes(norm(i)));
  if(!target){
    if(isShoppingName(dest))return null;
    const named=container||(onlyContainer?items.map(norm).find(i=>CONTAINERS.includes(i)):null);
    target=resolveName(named?`${cap(named)} ${dest}`:`Packliste ${dest}`,lists);
    if(!target.existing){const byDest=findList(dest,lists);if(byDest)target={title:byDest.list.title,existing:true,uncertain:byDest.uncertain};}
  }
  const real=items.filter(i=>!CONTAINERS.includes(norm(i)));
  if(!real.length&&target.existing)return null;
  if(!real.length&&!container&&!items.length)return null;
  return {action:target.existing?'add_to_list':'create_list',list:target.title,items:real,header:false,uncertain:!!target.uncertain,shopping:false};
}

// A short line below a header ("Föhn", "- iPad", "2 Handtücher") belongs to that header.
export function isItemLine(text){
  const t=String(text).trim().replace(/^[-*•–]\s*|^\d+[.)]\s*/u,'').replace(/[.,;]+$/u,'').trim();
  if(!t||t.endsWith(':'))return false;
  return t.split(/\s+/).length<=5&&!/(?<![\p{L}])(?:muss|müssen|ist|sind|habe|haben|möchte|will|termin|uhr|liste)(?![\p{L}])/iu.test(t);
}

// Groups split segments: header + following item lines become one segment, earlier sentences give
// later ones their context ("zum Aasee …" + "Liste für die Tasche"). Spans stay contiguous, so the
// joined texts still equal the original exactly.
export function groupListIntents(text,spans,{lists=[],isPerson}={}){
  const out=[];const known=[...lists];const ctx={dest:null,list:null};
  for(let i=0;i<spans.length;i++){
    let span=spans[i];
    const intent=span.text.trim()?detectListIntent(span.text,{lists:known,context:ctx,isPerson}):null;
    if(intent&&(intent.header||!intent.items.length&&/:\s*$/.test(span.text.trim()))){
      let j=i+1;const items=[];
      while(j<spans.length&&(isItemLine(spans[j].text)||!spans[j].text.trim())){if(spans[j].text.trim())items.push(cleanItem(spans[j].text));j++;}
      if(items.length){span={start:span.start,end:spans[j-1].end,text:text.slice(span.start,spans[j-1].end)};intent.items=[...intent.items,...items];intent.header=false;i=j-1;}
    }
    if(intent){ctx.list=intent.list;if(!intent.shopping&&!known.some(l=>norm(l.title)===norm(intent.list)))known.push({title:intent.list});}
    ctx.dest=destinationOf(span.text)||ctx.dest;
    out.push({...span,intent});
  }
  return out;
}

// Compatibility helper (v0.4.0 API): {list, items, explicit}.
export function listIntent(text,lists=[]){
  const r=detectListIntent(text,{lists});
  return r?{list:r.list,items:r.items,explicit:true,action:r.action}:null;
}
