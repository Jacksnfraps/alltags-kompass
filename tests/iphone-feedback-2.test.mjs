// v0.3.2: zweite iPhone-Runde (Eingabe unten, Kurzfassungen, Ideen-Kachel, ein Menü pro Eintrag).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shortIdea,localSort} from '../src/domain/sort.js';
import {displayTitle} from '../src/ui.js';
import {ideasSummary} from '../src/views/inbox.js';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const now=new Date(2026,10,25,9,0);

test('Ideen bekommen eine Kurzfassung, das Original bleibt unverändert',()=>{
  assert.equal(shortIdea('Mir ist wichtig, dass man Bilder hinterlegen kann in Alltagskompass','Alltagskompass'),'Bilder hinterlegen');
  assert.equal(shortIdea('Mir ist wichtig, dass man Bilder hinterlegen kann in Alltagskompass'),'Bilder hinterlegen in Alltagskompass');
  assert.equal(shortIdea('Es wäre schön, wenn wir im Sommer einen Kräutergarten anlegen.'),'Im Sommer einen Kräutergarten anlegen');
  assert.equal(shortIdea('Wanddurchbruch Wohnzimmer planen'),'Wanddurchbruch Wohnzimmer planen');
  const long=shortIdea('Ich möchte irgendwann eine große Übersicht mit allen Räumen, Maßen, Materialien, Kosten und Fotos für das ganze Haus haben');
  assert.ok(long.length<=72&&!long.includes('…'),long);
  const text='Mir ist wichtig, dass man Bilder hinterlegen kann in Alltagskompass.';
  const [p]=localSort(text,[{id:'k',title:'Alltagskompass'}],{now});
  assert.equal(p.title,'Bilder hinterlegen');assert.equal(p.text,text,'Originalabschnitt bleibt vollständig');
});

test('Angezeigte Titel sind frei von Datum/Uhrzeit, eigene Titel bleiben',()=>{
  const state={project:{k:{id:'k',title:'Alltagskompass'}}};
  assert.equal(displayTitle({kind:'event',title:'Heute ist um 19:00 Uhr Chorprobe',due_at:'2026-11-25T19:00'},state),'Chorprobe');
  assert.equal(displayTitle({kind:'event',title:'Chorprobe mittwochs 19:30',due_at:'2026-11-25T19:30'},state),'Chorprobe');
  assert.equal(displayTitle({kind:'event',title:'Vanessa Elternabend am 3. Dezember 19 Uhr',due_at:'2026-12-03T19:00'},state),'Vanessa Elternabend');
  assert.equal(displayTitle({kind:'idea',title:'Mir ist wichtig, dass man Bilder hinterlegen kann in Alltagskompass',project_id:'k'},state),'Bilder hinterlegen');
  assert.equal(displayTitle({kind:'event',title:'Heute 19 Uhr Probe',title_custom:true},state),'Heute 19 Uhr Probe');
  assert.equal(displayTitle({kind:'event',category:'trash',title:'Gelbe Tonne / Gelber Sack'},state),'Gelbe Tonne / Gelber Sack');
  assert.equal(displayTitle({kind:'todo',title:'Ich muss Milch kaufen'},state),'Milch kaufen');
});

test('Startseite fasst Ideen & Stränge zusammen',()=>{
  const e=(id,data)=>({id,kind:'idea',status:'open',created_at:`2026-11-2${id.length}T10:00:00Z`,...data});
  const state={project:{p:{id:'p',title:'Umbau Wohnzimmer',created_at:'2026-11-01T00:00:00Z'},q:{id:'q',title:'Alt',archived:true}},
    entry:{a:e('a',{project_id:'p',title:'Türzarge einbauen',position:30}),bb:e('bb',{project_id:'p',title:'Ausmessen',position:10}),ccc:e('ccc',{title:'Kräutergarten'}),d:e('d',{title:'Erledigt',status:'done'}),t:{id:'t',kind:'todo',status:'open',title:'Milch',created_at:'2026-11-25T00:00:00Z'}}};
  const s=ideasSummary(state);
  assert.equal(s.count,3);assert.equal(s.loose,1);assert.equal(s.strands.length,1);
  assert.equal(s.strands[0].next.title,'Ausmessen','nächster Schritt nach Position');
  assert.match(read('../src/views/inbox.js'),/tile\('Ideen & Projekte'/);
});

test('Ein Menü pro Eintrag: keine ✎+…-Doppelungen mehr, einheitliche Tap-Größe',()=>{
  for(const f of ['../src/views/events.js','../src/views/todos.js','../src/views/ideas.js','../src/ui.js']){
    const src=read(f);
    assert.ok(!src.includes("'✎'"),`${f}: kein separates Stift-Menü`);
    assert.ok(!/summary',\{[^}]*\},'…'/.test(src),`${f}: keine winzigen …-Punkte`);
  }
  const css=read('../src/styles.css');
  assert.match(css,/@media \(hover:none\),\(max-width:700px\)\{:root\{--tap:44px\}\}/);
  assert.match(css,/\.act,\.more>summary,\.row-actions \.icon-btn\{[^}]*width:var\(--tap\)/);
});

test('Eingabezeile mobil unten über der Navigation, mit Safe-Area und Tastatur-Anhebung',()=>{
  const css=read('../src/styles.css');
  assert.match(css,/\.capture\{position:fixed;[^}]*bottom:calc\(var\(--nav-h\) \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css,/body\.kb-open \.capture\{bottom:var\(--kb,0px\)/);
  assert.match(css,/body\.kb-open:not\(\.dump-focus\) \.capture\{display:none\}/);
  const main=read('../src/main.js');
  assert.match(main,/visualViewport\?\.addEventListener\('resize',syncKeyboard\)/);
});
