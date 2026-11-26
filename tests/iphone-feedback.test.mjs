// v0.3.1: Rückmeldungen aus dem iPhone-Test (relative Daten, selbstständigere Sortierung, eingeklapptes Archiv, chronologische Agenda).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseWhen,stripWhen} from '../src/domain/when.js';
import {localSort,sortingOperations} from '../src/domain/sort.js';
import {projectState} from '../src/domain/state.js';
import {kindPatch} from '../src/ui.js';
import {inboxArchiveOpen,reviewSuggestion} from '../src/views/inbox.js';
import {agenda,whenText} from '../src/views/events.js';

const now=new Date(2026,10,25,9,0); // Mittwoch, 25.11.2026, 09:00

test('Relative Angaben werden auf Datum und Uhrzeit aufgelöst',()=>{
  assert.deepEqual(parseWhen('Heute ist um 19:00 Uhr Chorprobe',now),{due_at:'2026-11-25T19:00',has_time:true,recurrence:null,label:'heute 19:00'});
  assert.equal(parseWhen('morgen 14:30 Zahnarzt',now).due_at,'2026-11-26T14:30');
  assert.equal(parseWhen('übermorgen Elternabend',now).due_at,'2026-11-27T00:00');
  assert.equal(parseWhen('Übermorgen um 10 Uhr Friseur',now).due_at,'2026-11-27T10:00');
  assert.equal(parseWhen('Freitag 18 Uhr Kino',now).due_at,'2026-11-27T18:00');
  assert.equal(parseWhen('am Wochenende Gartenhaus streichen',now).due_at,'2026-11-28T00:00');
  assert.equal(parseWhen('Heute 8 Uhr',new Date(2026,10,25,9,0)).due_at,'2026-11-25T08:00','„heute“ bleibt heute, auch wenn die Uhrzeit schon vorbei ist');
  assert.equal(stripWhen('Heute Abend Elternabend'),'Elternabend');
  assert.equal(stripWhen('Übermorgen um 10 Uhr Friseur'),'Friseur');
});

test('Eindeutige Einträge landen ohne Rückfrage im richtigen Bereich',()=>{
  const projects=[{id:'u',title:'Umbau Wohnzimmer'},{id:'k',title:'Alltagskompass'}];
  const [choir]=localSort('Heute ist um 19:00 Uhr Chorprobe',projects,{now});
  assert.equal(choir.kind,'event');assert.equal(choir.uncertain,false);assert.equal(choir.due_at,'2026-11-25T19:00');assert.equal(choir.title,'Chorprobe');assert.equal(choir.all_day,false);
  const [wall]=localSort('Ich muss heute an dem Durchbruch weiter arbeiten',projects,{now});
  assert.equal(wall.kind,'todo');assert.equal(wall.uncertain,false);assert.equal(wall.project,'Umbau Wohnzimmer');assert.equal(wall.title,'An dem Durchbruch weiter arbeiten');
  const [idea]=localSort('Mir ist wichtig, dass man Bilder hinterlegen kann in Alltagskompass',projects,{now});
  assert.equal(idea.kind,'idea');assert.equal(idea.uncertain,false);assert.equal(idea.project,'Alltagskompass');
  const [idea2]=localSort('Mir ist wichtig, dass man Bilder hinterlegen kann',[],{now});
  assert.equal(idea2.kind,'idea');assert.equal(idea2.uncertain,false);
  for(const [text,kind] of [['Fahrrad Reifen flicken','todo'],['Steuererklärung machen','todo'],['Freitag Kino mit Vanessa','event'],['Chorprobe heute 19 Uhr nicht vergessen','event'],['Paket bei der Post abholen','todo']]){
    const [p]=localSort(text,[],{now});assert.equal(p.kind,kind,text);assert.equal(p.uncertain,false,text);
  }
  // Echte Mehrdeutigkeit bleibt in „Kurz klären“.
  assert.equal(localSort('Vielleicht etwas Neues.',[],{now})[0].uncertain,true);
  assert.equal(localSort('Hmm, das da',[],{now})[0].uncertain,true);
});

test('Automatisch einsortiert, Original bleibt vollständig und verknüpft',()=>{
  const text='Heute ist um 19:00 Uhr Chorprobe. Ich muss heute an dem Durchbruch weiter arbeiten. Mir ist wichtig, dass man Bilder hinterlegen kann in Alltagskompass.';
  const capture={id:'c1',original_text:text};
  const state=projectState([{id:'p1',entity:'project',entity_id:'p1',action:'create',data:{title:'Umbau Wohnzimmer'},created_at:'2026-11-01T00:00:00.000Z'}]);
  const parts=localSort(text,Object.values(state.project),{now});
  const ops=sortingOperations(capture,parts,state);
  const entries=ops.filter(o=>o.entity==='entry').map(o=>o.data);
  assert.equal(entries.length,3);
  assert.ok(entries.every(e=>e.needs_review===false));
  assert.equal(entries.map(e=>e.details).join(''),text);
  assert.equal(entries[1].project_id,'p1');
});

test('Manueller Wechsel zu „Termin“ übernimmt Datum relativ zum Schreibzeitpunkt',()=>{
  const entry={kind:'idea',category:'general',details:'Heute ist um 19:00 Uhr Chorprobe',created_at:'2026-11-24T08:00:00'};
  const patch=kindPatch(entry,'event');
  assert.equal(patch.due_at,'2026-11-24T19:00');assert.equal(patch.all_day,false);assert.equal(patch.category,'appointment');assert.equal(patch.needs_review,false);
  assert.equal(kindPatch({kind:'event',category:'appointment',details:'x',due_at:'2026-11-30T10:00'},'todo').due_at,undefined);
});

test('Alte Rückfragen bekommen einen Ein-Tipp-Vorschlag, wenn jetzt eindeutig',()=>{
  const state={project:{p:{id:'p',title:'Umbau Wohnzimmer'}}};
  const s=reviewSuggestion({details:'Ich muss heute an dem Durchbruch weiter arbeiten',created_at:'2026-11-25T08:00:00',needs_review:true},state);
  assert.equal(s.patch.kind,'todo');assert.equal(s.patch.project_id,'p');assert.equal(s.patch.needs_review,false);
  assert.equal(reviewSuggestion({details:'Hmm, das da',created_at:'2026-11-25T08:00:00'},state),null);
});

test('Eingangs-Archiv ist standardmäßig eingeklappt und wird nicht dauerhaft geöffnet gespeichert',()=>{
  assert.equal(inboxArchiveOpen({}),false);
  assert.equal(inboxArchiveOpen({inboxOpen:true}),true);
  assert.equal(inboxArchiveOpen({search:'chor'}),true,'Suche zeigt Treffer');
  assert.equal(inboxArchiveOpen({search:'  '}),false);
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.ok(!/UI_KEYS=\[[^\]]*inboxOpen/.test(main),'inboxOpen darf nicht in localStorage landen');
});

test('Agenda ist rein chronologisch nach Datum und Uhrzeit',()=>{
  const from=new Date(2026,10,25);
  const events=[
    {id:'a',title:'Zahnarzt',due_at:'2026-11-26T14:30',all_day:false},
    {id:'b',title:'Chorprobe',due_at:'2026-11-25T19:00',all_day:false,recurrence:'weekly'},
    {id:'c',title:'Müll',due_at:'2026-11-26T00:00',all_day:true},
    {id:'d',title:'Frühstück',due_at:'2026-11-25T08:00',all_day:false}];
  const items=agenda(events,8,from);
  assert.deepEqual(items.map(i=>i.entry.title),['Frühstück','Chorprobe','Müll','Zahnarzt','Chorprobe']);
  for(let i=1;i<items.length;i++)assert.ok(items[i].date>=items[i-1].date);
  assert.equal(whenText(new Date(),false).startsWith('Heute, '),true);
  assert.match(whenText(new Date(2030,0,2,19,0),false),/^\S+ 02\.01\., 19:00$/);
});

test('Termin-Titel bricht nicht mehr Buchstabe für Buchstabe um (CSS)',()=>{
  const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
  assert.ok(!/overflow-wrap:\s*anywhere/.test(css),'kein Zeichenumbruch mehr');
  assert.match(css,/\.row-title\{[^}]*min-width:0[^}]*overflow-wrap:break-word/);
  assert.match(css,/\.undated-head \.row-title\{[^}]*min-width:0/);
});
