// v0.6.1: calm re-rendering while typing, list input keeps focus, lists on the start page.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEditGuard,isField,DIRTY_MS} from '../src/editing.js';
import {projectState} from '../src/domain/state.js';
import {pinnedLists} from '../src/views/todos.js';

const src=p=>readFileSync(new URL(p,import.meta.url),'utf8');
// Minimal element stand-ins for the guard's decisions (the DOM swap itself is checked in the browser).
const field=(tag,type='text')=>({tagName:tag,type,dataset:{},closest:()=>({}),contains:()=>false});
function fakeRoot(active,dirty=[]){const doc={activeElement:active};return {ownerDocument:doc,contains:el=>el===active||dirty.includes(el),querySelectorAll:()=>dirty};}

test('Hintergrund-Aktualisierung wartet, solange getippt wird',()=>{
  let t=1_000_000;const title=field('INPUT'),time=field('INPUT','time');
  let root=fakeRoot(time);const guard=createEditGuard(()=>root,()=>t);
  assert.equal(guard.editing(),true,'Uhrzeit-Feld fokussiert');
  assert.equal(guard.defer(),true);assert.equal(guard.pending,true,'Aktualisierung vorgemerkt');
  // Focus gone, but the title holds unsaved typing -> still waiting.
  root=fakeRoot(null,[title]);guard.markInput({target:title});assert.ok(title.dataset.dirty);
  assert.equal(guard.editing(),true);
  t+=DIRTY_MS+1;assert.equal(guard.editing(),false,'vergessene Eingabe blockiert höchstens 3 Minuten');
  assert.equal(guard.take(),true);assert.equal(guard.pending,false);
  // Checkboxes and buttons are actions, not typing.
  assert.equal(isField(field('INPUT','checkbox')),false);assert.equal(isField(field('BUTTON')),false);assert.equal(isField(field('SELECT')),true);
});

test('Nach Enter in einem Hinzufügen-Formular: Feld leer, Entwurf erledigt',()=>{
  const input=field('INPUT');input.value='Zahnbürste';input.dataset.dirty='1';
  const form={classList:{contains:c=>c==='add-step'},dataset:{},querySelectorAll:sel=>sel==='[data-dirty]'?[input]:[input]};
  const guard=createEditGuard(()=>({contains:()=>true}));
  guard.afterSubmit({target:form});
  assert.equal(input.value,'');assert.equal(input.dataset.dirty,undefined);assert.equal(form.dataset.submitted,'1');
  // Edit forms ("Speichern") keep their values for the handler; they are rebuilt fresh by render.
  const kept=field('INPUT');kept.value='Zahnarzt';const edit={classList:{contains:()=>false},dataset:{},querySelectorAll:()=>[kept]};
  guard.afterSubmit({target:edit});assert.equal(kept.value,'Zahnarzt');
});

test('Sync, Realtime, Rückkehr in die App und Uhr laufen als Hintergrund-Aktualisierung',()=>{
  const main=src('../src/main.js');
  assert.match(main,/new Synchronizer\(target,cloud,async\(\)=>\{if\(store===target\)await refresh\(\{background:true\}\);\}/);
  assert.match(main,/visibilitychange',\(\)=>\{if\(!document\.hidden&&ready\)\{refresh\(\{background:true\}\)/);
  assert.match(main,/setInterval\(\(\)=>\{if\(ready&&!document\.hidden\)backgroundRender\(\);\},5\*60\*1000\)/);
  assert.match(main,/if\(!background\)render\(\);else if\(changed\|\|editGuard\.pending\)backgroundRender\(\);/,'unveränderte Daten zeichnen nichts neu');
  assert.match(main,/editGuard\.swap\(content,next\)/);
});

test('Listen wahlweise auf der Startseite (gerätübergreifend über die Liste selbst)',()=>{
  const ops=[
    {id:'a',entity:'list',entity_id:'L1',action:'create',data:{title:'Tasche Alfsee'},created_at:'2026-11-27T08:00:00Z'},
    {id:'b',entity:'list',entity_id:'L2',action:'create',data:{title:'Baumarkt'},created_at:'2026-11-27T08:00:01Z'},
    {id:'c',entity:'list',entity_id:'L1',action:'patch',data:{pinned:true},created_at:'2026-11-27T08:01:00Z'}];
  assert.deepEqual(pinnedLists(projectState(ops)).map(l=>l.title),['Tasche Alfsee']);
  const off=projectState([...ops,{id:'d',entity:'list',entity_id:'L1',action:'patch',data:{pinned:false},created_at:'2026-11-27T08:02:00Z'}]);
  assert.deepEqual(pinnedLists(off),[]);
  const archived=projectState([...ops,{id:'e',entity:'list',entity_id:'L1',action:'patch',data:{archived:true},created_at:'2026-11-27T08:03:00Z'}]);
  assert.deepEqual(pinnedLists(archived),[],'archivierte Listen verschwinden auch vom Start');
  const todos=src('../src/views/todos.js'),inbox=src('../src/views/inbox.js');
  assert.match(todos,/patchList\(list\.id,\{pinned:!list\.pinned\}\)/);assert.match(todos,/'☆ Auf Start'/);
  assert.match(inbox,/pinned\.map\(l=>listCard\(l,ctx\)\)/);
  assert.match(todos,/class:'add-step'[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*Zur Liste \$\{list\.title\} hinzufügen/,'Start-Karte und Listen-Tab nutzen dasselbe Hinzufügen-Formular');
});
