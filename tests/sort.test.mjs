import test from 'node:test';
import assert from 'node:assert/strict';
import {localSort,splitOriginal,sortingOperations,validateSuggestions,stableId} from '../src/domain/sort.js';
import {projectState} from '../src/domain/state.js';
import {createSorter} from '../scripts/gemini.mjs';
const text='Wanddurchbruch Wohnzimmer planen. Türzarge einbauen. Danach spachteln. Milch kaufen. Mittwoch Gospelchor. Tabletten Packung 100 Stück.';
test('Zerlegung deckt Original einschließlich Leerzeichen und Dezimalmaßen exakt ab',()=>{
  for(const original of [text,'  Breite ca. 42,5 cm.\n\nHöhe 2.5 m!  ','Ein Gedanke ohne Satzzeichen','Erst planen; dann bauen.','Dr. Müller anrufen. Außerdem Milch kaufen.']){
    const parts=splitOriginal(original);assert.equal(parts.map(p=>p.text).join(''),original);
    for(const p of parts)assert.equal(original.slice(p.start,p.end),p.text);
  }
});
test('Gemischter Dump erhält vier Typen und gemeinsames Bauprojekt',()=>{
  const parts=localSort(text);assert.equal(parts.length,6);
  assert.deepEqual(parts.map(p=>p.kind),['idea','idea','idea','todo','event','medication']);
  assert.equal(parts[0].project,'Umbau Wohnzimmer');assert.equal(parts[1].project,parts[0].project);assert.equal(parts[2].project,parts[0].project);
  assert.ok(parts[0].position<parts[1].position&&parts[1].position<parts[2].position);
  assert.equal(parts[3].minutes,15);assert.equal(parts[1].energy,'high');
});
test('Mehrdeutiger Raumbezug wird nicht still einem Projekt zugewiesen',()=>{
  const parts=localSort('Wanddurchbruch Wohnzimmer. Umbau Küche. Türzarge einbauen.');
  assert.equal(parts[2].project,'');assert.equal(parts[2].uncertain,true);
  assert.equal(localSort('Vielleicht etwas Neues.')[0].uncertain,true);
});
test('Bestehender eindeutiger Strang wird wiederverwendet; explizite Zeit und Fakten bleiben',()=>{
  const part=localSort('Türzarge ausmessen 15 Minuten, Breite 80 cm.',[{id:'p',title:'Umbau Wohnzimmer'}])[0];
  assert.equal(part.project,'Umbau Wohnzimmer');assert.equal(part.minutes,15);assert.ok(Object.values(part.facts).includes('80 cm'));
});
test('Operationen erhalten Original, verknüpfen alle Teile und sind wiederholbar ohne Duplikate',()=>{
  const capture={id:'source',original_text:text};const state=projectState([]);
  const ops=sortingOperations(capture,localSort(text),state);const projected=projectState(ops);
  assert.equal(Object.keys(projected.entry).length,6);assert.equal(Object.keys(projected.project).length,1);
  assert.ok(Object.values(projected.entry).every(e=>e.capture_id==='source'));
  assert.deepEqual(sortingOperations(capture,localSort(text),projected),[]);
  assert.deepEqual(ops.filter(o=>o.action==='create').map(o=>o.id),sortingOperations(capture,localSort(text),state).filter(o=>o.action==='create').map(o=>o.id));
  assert.equal(capture.original_text,text);assert.match(stableId('project'),/^[0-9a-f-]{36}$/);
});
test('Unvollständige Zuordnung wird verworfen statt Text zu verlieren',()=>{
  const parts=localSort(text);assert.throws(()=>validateSuggestions([],parts));
  assert.throws(()=>sortingOperations({id:'x',original_text:text},parts.slice(1),projectState([])));
});
test('Ohne Key wird keine API aufgerufen',async()=>{
  let calls=0;const sorter=createSorter({},async()=>{calls++;});
  const result=await sorter.sort(text);assert.equal(result.source,'local');assert.equal(calls,0);assert.equal(result.parts.map(p=>p.text).join(''),text);
});
test('Simuliertes API-Limit aktiviert lokalen Fallback und verhindert Folgerufe',async()=>{
  let calls=0;const sorter=createSorter({geminiKey:'test',freeOnly:true,model:'gemini-2.5-flash-lite'},async()=>{calls++;return {ok:false,status:429};});
  assert.equal((await sorter.sort(text)).source,'local');assert.equal((await sorter.sort(text)).source,'local');assert.equal(calls,1);
});
test('Simulierter Netzausfall oder ungültiges JSON bleibt lokal nutzbar',async()=>{
  for(const fetcher of [async()=>{throw new Error('simulierter Ausfall');},async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:'kein JSON'}]}}]})})]){
    const sorter=createSorter({geminiKey:'test',freeOnly:true,model:'gemini-2.5-flash'},fetcher);const result=await sorter.sort(text);assert.equal(result.source,'local');assert.equal(result.parts.map(p=>p.text).join(''),text);
  }
});
test('Gültige KI-Metadaten dürfen Originalspannen und Fakten nicht ändern',async()=>{
  const parts=localSort(text);const metadata=parts.map((p,index)=>({index,kind:p.kind,minutes:p.minutes,energy:p.energy,project:p.project,uncertain:p.uncertain,position:p.position,text:'nicht übernehmen'}));
  const sorter=createSorter({geminiKey:'test',freeOnly:true,model:'gemini-2.5-flash-lite'},async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(metadata)}]}}]})}));
  const result=await sorter.sort(text);assert.equal(result.source,'gemini');assert.equal(result.parts.map(p=>p.text).join(''),text);
});
