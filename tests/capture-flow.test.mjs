import test from 'node:test';
import assert from 'node:assert/strict';
import {saveAndSort} from '../src/data/capture-flow.js';
import {localSort,sortingOperations} from '../src/domain/sort.js';
import {projectState} from '../src/domain/state.js';
function memory(){const ops=[];return {ops,commit:async rows=>{ops.push(...rows);},state:async()=>projectState(ops)};}
test('Speichern löst Sortierung automatisch nach Original-Commit aus, ohne Login/Key',async()=>{
  const store=memory();const text='  Wanddurchbruch Wohnzimmer planen. Türzarge einbauen. Danach spachteln. Milch kaufen. Mittwoch Gospelchor. Tabletten Packung 100 Stück.\n';
  let calls=0;
  const result=await saveAndSort(store,text,async(capture,target)=>{
    calls++;const state=await target.state();assert.equal(state.capture[capture.id].original_text,text);
    await target.commit(sortingOperations(capture,localSort(text),state));return 'local';
  });
  const state=await store.state();assert.equal(calls,1);assert.equal(result.sorted,true);
  assert.equal(state.capture[result.capture.id].original_text,text);
  assert.equal(Object.keys(state.entry).length,6);assert.equal(Object.keys(state.project).length,1);
  assert.deepEqual(new Set(Object.values(state.entry).map(e=>e.kind)),new Set(['idea','todo','event','medication']));
  assert.ok(Object.values(state.entry).every(e=>[15,30,60].includes(e.minutes)));
});
test('Sortierfehler lässt Original pending und nachträglich sortierbar',async()=>{
  const store=memory();const result=await saveAndSort(store,'  unverändert\nDetail  ',async()=>{throw new Error('simulierter Sortierausfall');});
  assert.equal(result.sorted,false);const state=await store.state();
  assert.equal(state.capture[result.capture.id].original_text,'  unverändert\nDetail  ');
  assert.equal(state.capture[result.capture.id].sorting_status,'pending');assert.equal(Object.keys(state.entry).length,0);
  await store.commit(sortingOperations(result.capture,localSort(result.capture.original_text),state));
  assert.ok(Object.keys((await store.state()).entry).length>0);
});
test('Fehlgeschlagener Original-Commit startet keine Sortierung und leert kein Eingabefeld',async()=>{
  let sorted=false,cleared=false;
  await assert.rejects(saveAndSort({commit:async()=>{throw new Error('Speicher voll');}},'Gedanke',async()=>{sorted=true;},()=>{cleared=true;}),/Speicher voll/);
  assert.equal(sorted,false);assert.equal(cleared,false);
});
test('UI-Zwischenschritt kann automatische Sortierung nicht verhindern',async()=>{
  let calls=0;const result=await saveAndSort(memory(),'Gedanke',async()=>{calls++;return 'local';},()=>{throw new Error('simulierter UI-Ausfall');});
  assert.equal(calls,1);assert.equal(result.sorted,true);
});
