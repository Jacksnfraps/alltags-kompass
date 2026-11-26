import test from 'node:test';
import assert from 'node:assert/strict';
import {Synchronizer} from '../src/data/sync.js';
import {projectState} from '../src/domain/state.js';
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
globalThis.window={removeEventListener(){}};
test('Offline lässt die Warteschlange unverändert',async()=>{
  navigator.onLine=false;let called=false;
  const sync=new Synchronizer({operations:async()=>{called=true;}},{},()=>{},()=>{});
  await sync.run();assert.equal(called,false);navigator.onLine=true;
});
test('Upload und Rücklesen bestätigen Daten erst nach Cloud-Erfolg',async()=>{
  const pending=[{id:'one',pending:true}];let received;const calls=[];
  const store={operations:async()=>pending,receive:async rows=>{received=rows;},blobs:async()=>[]};
  const cloud={upload:async rows=>{assert.equal(rows,pending);calls.push('upload');},pull:async()=>{calls.push('pull');return [{id:'one',seq:1}];}};
  // slice creates an equivalent payload, so compare contents in the adapter stub.
  cloud.upload=async rows=>{assert.deepEqual(rows,pending);calls.push('upload');};
  await new Synchronizer(store,cloud,()=>calls.push('render'),()=>{}).run();
  assert.deepEqual(calls,['upload','pull','render']);assert.equal(received[0].seq,1);
});
test('Netzfehler quittiert keine lokalen Operationen',async()=>{
  let received=false,message='';
  const store={operations:async()=>[{id:'one',pending:true}],receive:async()=>{received=true;}};
  const cloud={upload:async()=>{throw new Error('Test-Netzausfall');}};
  await new Synchronizer(store,cloud,()=>{},text=>{message=text;}).run();
  assert.equal(received,false);assert.match(message,/Lokal gesichert/);
});
test('Stop wartet auf laufenden Upload und verhindert weiteren Abgleich',async()=>{
  let release,started;const start=new Promise(r=>{started=r;});let pulled=false;
  const store={operations:async()=>[{id:'one',pending:true}]};
  const cloud={upload:()=>{started();return new Promise(r=>{release=r;});},pull:async()=>{pulled=true;}};
  const sync=new Synchronizer(store,cloud,()=>{},()=>{});const running=sync.run();await start;
  let stopped=false;const stopping=sync.stop().then(()=>{stopped=true;});await Promise.resolve();assert.equal(stopped,false);
  release();await running;await stopping;assert.equal(pulled,false);assert.equal(stopped,true);
});
test('Originaltext bleibt bei späteren Patches unverändert',()=>{
  const common={entity:'capture',entity_id:'c',created_at:'2026-11-25T00:00:00Z'};
  const state=projectState([{...common,id:'1',seq:1,action:'create',data:{original_text:'  Original\nDetail  '}},{...common,id:'2',seq:2,action:'patch',data:{original_text:'ersetzt',sorting_status:'reviewed'}}]);
  assert.equal(state.capture.c.original_text,'  Original\nDetail  ');assert.equal(state.capture.c.sorting_status,'reviewed');
});
