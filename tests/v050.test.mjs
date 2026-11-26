// v0.5.0: freie Listen-Erkennung – KI-Intent-Zerlegung mit Listen-/Projekt-Kontext und abgestimmtem lokalem Fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localSort,sortingOperations,validateSuggestions} from '../src/domain/sort.js';
import {projectState} from '../src/domain/state.js';
import {findList,detectListIntent} from '../src/domain/intent.js';
import {listItems} from '../src/views/todos.js';
import {createSorter,cleanNames} from '../scripts/gemini.mjs';

const now=new Date(2026,10,26,9,0);
const LIST_ID='11111111-1111-5111-a111-111111111111';
const baseOps=[{id:'l1',entity:'list',entity_id:LIST_ID,action:'create',data:{title:'Tasche Alfsee'},created_at:'2026-11-20T10:00:00Z'}];
const state0=()=>projectState(baseOps);
const lists=[{id:LIST_ID,title:'Tasche Alfsee'}];
// Runs the full local pipeline like the app: capture -> segments -> operations -> state.
function run(text,{state=state0(),parts=null}={}){
  const capture={id:`cap-${text.length}`,original_text:text};
  const p=parts||localSort(text,[],{now,lists:Object.values(state.list)});
  const ops=sortingOperations(capture,p,state);
  const all=[...baseOps,{id:'c',entity:'capture',entity_id:capture.id,action:'create',data:{original_text:text,sorting_status:'pending'},created_at:'2026-11-26T09:00:00Z'},...ops.map((o,i)=>({...o,created_at:`2026-11-26T09:00:0${Math.min(i,9)}Z`}))];
  const s=projectState(all);
  return {parts:p,ops,state:s,entries:Object.values(s.entry),review:Object.values(s.entry).filter(e=>e.needs_review)};
}
const listByTitle=(s,title)=>Object.values(s.list).find(l=>l.title===title);

test('1) Neue Liste aus „… zum Aasee … eine Tasche packen. Füge eine Liste hinzu für die Tasche.“',()=>{
  const text='Ich fahre am Wochenende zum Aasee und muss dafür eine Tasche packen. Füge eine Liste hinzu für die Tasche.';
  const r=run(text);
  const created=listByTitle(r.state,'Tasche Aasee');
  assert.ok(created,'Liste „Tasche Aasee“ angelegt');
  assert.equal(Object.values(r.state.list).length,2,'genau eine neue Liste, „Tasche Alfsee“ bleibt unberührt');
  assert.equal(r.entries.length,0,'keine To-dos aus den Anweisungssätzen');assert.equal(r.review.length,0);
  assert.deepEqual(r.state.capture[`cap-${text.length}`].linked_lists,[created.id],'Eingang verweist auf die Liste');
  assert.equal(r.parts.map(p=>p.text).join(''),text,'Original vollständig abgedeckt');
  // Natural creation variants.
  assert.equal(detectListIntent('Erstelle eine Packliste für den Urlaub',{lists}).list,'Packliste Urlaub');
  assert.deepEqual(detectListIntent('Erstelle eine Packliste für den Urlaub mit Sonnencreme und Badehose',{lists}).items,['Sonnencreme','Badehose']);
  assert.equal(detectListIntent('Neue Liste Baumarkt anlegen',{lists}).list,'Baumarkt');
  // Repeating the sort creates nothing twice.
  assert.deepEqual(sortingOperations({id:`cap-${text.length}`,original_text:text},r.parts,r.state),[]);
});

test('2) Mehrzeiliger Block: 3 Einträge in „Tasche Alfsee“, kein To-do „Füge folgendes“, nichts in „Kurz klären“',()=>{
  const text='Füge folgendes zu der Liste Tasche Alfsee Hinzu:\nFöhn\niPad\nHaussocken';
  const r=run(text);
  assert.equal(r.parts.length,1,'Einleitung und Zeilen sind eine Einheit');
  assert.equal(r.review.length,0,'0 Einträge in „Kurz klären“');
  assert.ok(!r.entries.some(e=>/füge|folgendes/i.test(e.title)),'kein To-do aus dem Einleitungssatz');
  assert.ok(r.entries.every(e=>e.list_id===LIST_ID));
  assert.deepEqual(listItems(r.entries,LIST_ID).map(i=>i.name),['Föhn','iPad','Haussocken']);
  assert.equal(Object.values(r.state.list).length,1,'keine neue Liste');
  // Comma variant and a header without the word "Liste".
  assert.deepEqual(run('Füge Föhn, iPad und Haussocken zur Liste Tasche Alfsee hinzu').parts[0].items,['Föhn','iPad','Haussocken']);
  const b=run('Für die Tasche Alfsee:\n- Badehose\n- Sonnencreme');assert.deepEqual(listItems(b.entries,LIST_ID).map(i=>i.name),['Badehose','Sonnencreme']);
  // Shopping block goes to the shopping list.
  const sh=run('Einkaufsliste:\nMilch\nBrot');assert.equal(sh.entries[0].category,'shopping');assert.deepEqual(sh.entries[0].items,['Milch','Brot']);
});

test('3) Freie Varianten treffen „Tasche Alfsee“ und tragen nur den Gegenstand ein',()=>{
  for(const [text,item] of [['in die Tasche für den Alfsee muss noch ein Ladekabel','Ladekabel'],['zum Alfsee muss ich auch Unterwäsche mitnehmen','Unterwäsche'],['Sonnencreme für Alfsee noch einpacken','Sonnencreme'],['Ich muss auf jeden Fall einen Föhn mit zum Alfsee nehmen','Föhn'],['Zum Alfsees die Luftmatratze mitnehmen','Luftmatratze']]){
    const r=run(text);
    assert.equal(r.entries.length,1,text);assert.equal(r.entries[0].list_id,LIST_ID,text);assert.deepEqual(r.entries[0].items,[item],text);assert.equal(r.review.length,0,text);
  }
  assert.equal(findList('Tasche für den Alfsee',lists).list.title,'Tasche Alfsee');
  assert.equal(findList('zum Aasee',lists),null,'Aasee ist nicht Alfsee');
  // Everyday sentences stay untouched.
  for(const text of ['Paket zur Post bringen','Ich muss Oma mit zum Arzt nehmen','Milch kaufen','Wanddurchbruch Wohnzimmer planen'])assert.notEqual(run(text).parts[0].category,'list',text);
});

const fakeGemini=(rows,capture={})=>async(url,opts)=>{capture.body=JSON.parse(opts.body);return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(rows)}]}}]})};};
const meta={kind:'todo',minutes:15,energy:'low',project:'',uncertain:false,position:50};

test('4a) KI-Pfad: Kontext wird übergeben, freie Formulierung landet validiert in der Liste',async()=>{
  const seen={};const text='Das Ladekabel gehört auch noch zu den Alfsee-Sachen.';
  const sorter=createSorter({geminiKey:'k',freeOnly:true,model:'gemini-2.5-flash-lite'},fakeGemini([{index:0,...meta,action:'add_to_list',list_name:'Tasche Alfsee',items:['Ladekabel']}],seen));
  const res=await sorter.sort(text,{lists:['Tasche Alfsee'],projects:['Umbau Wohnzimmer']});
  const user=JSON.parse(seen.body.contents[0].parts[0].text);
  assert.ok(user.vorhandene_listen.includes('Tasche Alfsee'));assert.ok(user.vorhandene_projekte.includes('Umbau Wohnzimmer'));
  assert.match(seen.body.systemInstruction.parts[0].text,/create_list/);
  assert.equal(res.source,'gemini');
  const [p]=res.parts;assert.equal(p.category,'list');assert.equal(p.list,'Tasche Alfsee');assert.deepEqual(p.items,['Ladekabel']);
  // The browser re-validates the server answer against its own segments (list -> list_name).
  const local=localSort(text,[],{now,lists});
  const again=validateSuggestions(res.parts.map((x,index)=>({...x,index,action:x.action||'none',list_name:x.list_name??x.list??''})),local,{lists,text});
  const r=run(text,{parts:again});assert.equal(r.entries[0].list_id,LIST_ID);assert.deepEqual(r.entries[0].items,['Ladekabel']);
  // create_list from AI with the place from an earlier segment.
  const t2='Am Wochenende geht es an den Aasee. Mach mir dafür eine Liste für die Tasche.';
  const l2=localSort(t2,[],{now,lists});
  const v=validateSuggestions(l2.map((x,index)=>({index,...meta,action:index===1?'create_list':'none',list_name:index===1?'Tasche Aasee':'',items:[]})),l2,{lists,text:t2});
  assert.equal(v[1].action,'create_list');assert.equal(v[1].list,'Tasche Aasee');
});

test('4b) KI-Pfad strikt: erfundene Gegenstände/Listen werden verworfen, Fehler -> lokaler Fallback',async()=>{
  const text='zum Alfsee muss ich auch Unterwäsche mitnehmen';const local=localSort(text,[],{now,lists});
  // Invented item: dropped -> local result (Unterwäsche in Tasche Alfsee) wins.
  const v=validateSuggestions([{index:0,...meta,action:'add_to_list',list_name:'Tasche Alfsee',items:['Sonnenbrille']}],local,{lists,text});
  assert.deepEqual(v[0].items,['Unterwäsche']);assert.equal(v[0].list,'Tasche Alfsee');
  // Invented new list name that is nowhere in the text: rejected.
  const v2=validateSuggestions([{index:0,...meta,action:'create_list',list_name:'Koffer Mallorca',items:['Unterwäsche']}],local,{lists,text});
  assert.equal(v2[0].list,'Tasche Alfsee');
  // Fuzzy AI name is mapped onto the existing list.
  const v3=validateSuggestions([{index:0,...meta,action:'add_to_list',list_name:'Alfsee Tasche',items:['Unterwäsche']}],local,{lists,text});
  assert.equal(v3[0].list,'Tasche Alfsee');assert.equal(v3[0].action,'add_to_list');
  assert.throws(()=>validateSuggestions([{index:0,...meta,action:'delete_everything'}],local,{lists,text}),/Listen-Aktion/);
  // Invalid AI answer, missing key or daily limit: identical local result.
  const bad=createSorter({geminiKey:'k',freeOnly:true,model:'gemini-2.5-flash-lite'},fakeGemini([{index:0,...meta,action:'delete_everything'}]));
  const r1=await bad.sort(text,{lists:['Tasche Alfsee']});assert.equal(r1.source,'local');assert.deepEqual(r1.parts[0].items,['Unterwäsche']);
  const off=createSorter({},async()=>{throw new Error('nie');});
  const r2=await off.sort('Füge folgendes zu der Liste Tasche Alfsee Hinzu:\nFöhn\niPad\nHaussocken',{lists:['Tasche Alfsee']});
  assert.equal(r2.source,'local');assert.equal(r2.parts.length,1);assert.deepEqual(r2.parts[0].items,['Föhn','iPad','Haussocken']);
  let t=Date.UTC(2026,10,26);const ok=fakeGemini([{index:0,...meta,action:'add_to_list',list_name:'Tasche Alfsee',items:['Unterwäsche']}]);
  const limited=createSorter({geminiKey:'k',freeOnly:true,model:'gemini-2.5-flash-lite',dailyLimit:1},ok,()=>t);
  assert.equal((await limited.sort(text,{lists:['Tasche Alfsee']})).source,'gemini');
  const r3=await limited.sort(text,{lists:['Tasche Alfsee']});assert.equal(r3.source,'local');assert.match(r3.reason,/Tageslimit/);assert.deepEqual(r3.parts[0].items,['Unterwäsche']);
  // Context sanitising and the route.
  assert.deepEqual(cleanNames(['Tasche Alfsee','Tasche Alfsee','<b>x</b>',3,null]),['Tasche Alfsee','b x /b']);
  assert.match(readFileSync(new URL('../scripts/serve.mjs',import.meta.url),'utf8'),/pathname === '\/api\/parse'/);
  assert.match(readFileSync(new URL('../src/main.js',import.meta.url),'utf8'),/fetch\('\.\/api\/parse'/);
});
