// v0.4.0: Kurzfassungen, Einkauf/eigene Listen, Müll-Kalender (.ics), Dienstplan-Filter, Hosting-Build.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarize,shoppingItems,localSort,listIntent,sortingOperations,stableId} from '../src/domain/sort.js';
import {projectState,entities} from '../src/domain/state.js';
import {displayTitle} from '../src/ui.js';
import {listItems,activeLists,todoCounts} from '../src/views/todos.js';
import {parseICS,icsToTrash,reconcileTrash,monthPlan,nextPerBin,binOf,feedUrl} from '../src/domain/ics.js';
import {parseShiftPlan,filterRowsByName,nameMatcher,validateShiftRows} from '../src/domain/shifts.js';
import {createSorter} from '../scripts/gemini.mjs';

const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const now=new Date(2026,10,25,9,0);

test('(a) Echte Kurzfassung statt Abschneiden bei Ideen und langen To-dos',()=>{
  const idea='Mir ist tatsächlich wichtig, dass man auch gegebenenfalls Bilder hinterlegen kann in dem Programm Alltagskompass';
  assert.equal(summarize(idea,{projectTitle:'Alltagskompass'}),'Bilder hinterlegen');
  assert.equal(summarize(idea),'Bilder hinterlegen in Alltagskompass');
  assert.equal(summarize('Ich muss auf jeden Fall noch die Winterreifen beim Auto wechseln lassen, bevor es kalt wird'),'Winterreifen beim Auto wechseln lassen');
  assert.equal(summarize('Ich sollte endlich mal die Steuererklärung für das letzte Jahr fertig machen, weil die Frist im Juli abläuft'),'Steuererklärung für das letzte Jahr fertig machen');
  const long=summarize('Es wäre super praktisch wenn die App mir morgens automatisch eine kurze Zusammenfassung aller Termine und offenen Aufgaben für den Tag anzeigen würde');
  assert.ok(!long.includes('…')&&long.length<=72&&long.endsWith('anzeigen'),long);
  for(const t of [idea,'Ich möchte irgendwann eine große Übersicht mit allen Räumen, Maßen, Materialien, Kosten und Fotos für das ganze Haus haben'])assert.ok(!summarize(t).includes('…'));
  // Display: summarised from the original section (older titles were cut with "…"); custom titles stay.
  const state={project:{k:{id:'k',title:'Alltagskompass'}}};
  assert.equal(displayTitle({kind:'idea',title:'Mir ist tatsächlich wichtig, dass man auch …',details:idea,project_id:'k'},state),'Bilder hinterlegen');
  assert.equal(displayTitle({kind:'todo',title:'Ich muss auf jeden Fall noch die Winterreifen beim Auto wechseln lassen, bevor es kalt wird'},state),'Winterreifen beim Auto wechseln lassen');
  assert.equal(displayTitle({kind:'idea',title:'Mein eigener Titel',title_custom:true,details:idea},state),'Mein eigener Titel');
  const [p]=localSort(idea,[{id:'k',title:'Alltagskompass'}],{now});
  assert.equal(p.title,'Bilder hinterlegen');assert.equal(p.text,idea,'Original bleibt vollständig');
});

test('(b) „auf die Einkaufsliste“ wird vollständig entfernt',()=>{
  assert.deepEqual(shoppingItems('Zahnpasta von Elmex auf die Einkaufsliste'),['Zahnpasta von Elmex']);
  assert.deepEqual(shoppingItems('Zahnpasta von Elmex auf die Einkaufsliste setzen'),['Zahnpasta von Elmex']);
  assert.deepEqual(shoppingItems('Bitte Kaffee auf den Einkaufszettel'),['Kaffee']);
  const [p]=localSort('Zahnpasta von Elmex auf die Einkaufsliste',[],{now});
  assert.equal(p.category,'shopping');assert.deepEqual(p.items,['Zahnpasta von Elmex']);assert.equal(p.title,'Zahnpasta von Elmex');
});

test('(b) Eigene Listen: freie Eingabe landet nur mit dem Gegenstand in der passenden Liste',()=>{
  const lists=[{id:'L',title:'Tasche Alfsee'}];
  for(const text of ['Ich muss auf jeden Fall einen Föhn mit zum Alfsee nehmen','Föhn auf Liste Tasche Alfsee','Ich muss zum Alfsee noch einen Föhn mitnehmen']){
    const [p]=localSort(text,[],{now,lists});
    assert.equal(p.category,'list',text);assert.equal(p.list,'Tasche Alfsee',text);assert.deepEqual(p.items,['Föhn'],text);assert.equal(p.uncertain,false);
  }
  assert.deepEqual(listIntent('Liste Tasche Alfsee: Handtuch, Sonnencreme und Badehose').items,['Handtuch','Sonnencreme','Badehose']);
  // No list yet: a packing list is proposed; people and appointments are no packing items.
  assert.equal(localSort('Luftmatratze mit nach Holland nehmen',[],{now})[0].list,'Packliste Holland');
  assert.notEqual(localSort('Ich muss Oma mit zum Arzt nehmen',[],{now})[0].category,'list');
  assert.notEqual(localSort('Vanessa mit zum Konzert nehmen',[],{now,people:{partner:'Vanessa'}})[0].category,'list');
  // Operations: existing list is reused, a new one is created once with a stable id.
  const state={...projectState([]),list:{L:{id:'L',title:'Tasche Alfsee'}}};
  const cap={id:'c1',original_text:'Föhn auf Liste Tasche Alfsee'};
  const ops=sortingOperations(cap,localSort(cap.original_text,[],{now,lists}),state);
  assert.equal(ops.find(o=>o.entity==='entry').data.list_id,'L');assert.ok(!ops.some(o=>o.entity==='list'));
  const cap2={id:'c2',original_text:'Föhn auf Liste Skiurlaub'};
  const ops2=sortingOperations(cap2,localSort(cap2.original_text,[],{now}),projectState([]));
  const lop=ops2.find(o=>o.entity==='list');assert.equal(lop.data.title,'Skiurlaub');assert.equal(lop.id,lop.entity_id);
  const s2=projectState(ops2);assert.deepEqual(activeLists(s2).map(l=>l.title),['Skiurlaub']);
  assert.deepEqual(listItems(Object.values(s2.entry),lop.entity_id).map(i=>i.name),['Föhn']);
  assert.equal(todoCounts(s2).lists,1);assert.equal(todoCounts(s2).tasks,0,'Listeneinträge zählen nicht als Aufgaben');
  assert.ok(entities.includes('list'));assert.match(read('../supabase/migrations/003_lists.sql'),/'list'\)/);
});

const ICS=['BEGIN:VCALENDAR','VERSION:2.0',
  'BEGIN:VEVENT','UID:bio-1@abfall','DTSTART;VALUE=DATE:20261204','SUMMARY:Biotonne','END:VEVENT',
  'BEGIN:VEVENT','UID:gelb-1@abfall','DTSTART;VALUE=DATE:20261210','SUMMARY:Gelber Sack','END:VEVENT',
  'BEGIN:VEVENT','UID:rest@abfall','DTSTART:20261201T060000','RRULE:FREQ=WEEKLY;INTERVAL=2','SUMMARY:Restmüll-',' tonne','END:VEVENT',
  'BEGIN:VEVENT','UID:alt@abfall','DTSTART;VALUE=DATE:20260301','SUMMARY:Altpapier','END:VEVENT',
  'END:VCALENDAR'].join('\r\n');

test('(c) .ics-Müllimport: Tonnen erkennen, Rhythmus übernehmen, keine Duplikate',()=>{
  const events=parseICS(ICS);assert.equal(events.length,4);
  assert.equal(events[2].summary,'Restmüll-tonne','gefaltete Zeilen werden zusammengesetzt');
  assert.equal(binOf('Gelber Sack'),'Gelber Sack / Gelbe Tonne');assert.equal(binOf('Leerung Papiertonne'),'Altpapier');
  const {rows}=icsToTrash(events,{from:now,stableId});
  assert.equal(rows.length,3,'vergangene Einzeltermine vor dem aktuellen Monat entfallen');
  const rest=rows.find(r=>r.title==='Restmüll');assert.equal(rest.recurrence,'biweekly');assert.equal(rest.all_day,true);
  // First sync creates everything; a second identical sync creates nothing.
  const first=reconcileTrash(rows,projectState([]));assert.equal(first.create.length,3);
  const ops=first.create.map(({id,summary,...data})=>({id,entity:'entry',entity_id:id,action:'create',data:{kind:'event',status:'open',...data},created_at:'2026-11-25T10:00:00Z'}));
  const state=projectState(ops);
  const again=reconcileTrash(icsToTrash(parseICS(ICS),{from:now,stableId}).rows,state);
  assert.deepEqual([again.create.length,again.update.length,again.vanished.length],[0,0,0]);
  // A moved pickup is updated in place, a manually entered rhythm on the same day is not duplicated.
  const moved=reconcileTrash(icsToTrash(parseICS(ICS.replace('20261204','20261205')),{from:now,stableId}).rows,state);
  assert.equal(moved.update.length,1);assert.equal(moved.update[0][1].due_at,'2026-12-05T00:00');
  const manual=projectState([{id:'m',entity:'entry',entity_id:'m',action:'create',data:{kind:'event',status:'open',category:'trash',title:'Biotonne',due_at:'2026-11-20T00:00',all_day:true,recurrence:'biweekly'},created_at:'2026-11-01T00:00:00Z'}]);
  assert.equal(reconcileTrash(rows,manual).skipped,1);
  assert.throws(()=>parseICS('<html>Fehler</html>'),/iCal/);
  assert.equal(feedUrl('webcal://abfall.example.de/kalender.ics'),'https://abfall.example.de/kalender.ics');
  assert.throws(()=>feedUrl('ftp://x'),/http/);
});

test('(c) Monats-Abfuhrplan chronologisch nach Datum und Tonne, nächste Abholung je Tonne',()=>{
  const {rows}=icsToTrash(parseICS(ICS),{from:now,stableId});
  const entries=rows.map(r=>({...r,kind:'event',status:'open'}));
  const dec=monthPlan(entries,2026,11);
  assert.deepEqual(dec.map(p=>`${p.date.getDate()}. ${p.bin}`),['1. Restmüll','4. Biotonne','10. Gelber Sack / Gelbe Tonne','15. Restmüll','29. Restmüll']);
  const next=nextPerBin(entries,new Date(2026,11,2));
  assert.equal(next[0].bin,'Biotonne');assert.equal(next.find(n=>n.bin==='Restmüll').date.getDate(),15);
  const src=read('../src/views/events.js');
  assert.match(src,/Monats-Abfuhrplan/);assert.match(src,/Vorheriger Monat/);assert.match(src,/Nächster Monat/);assert.match(src,/\.ics-Datei importieren/);
  assert.match(read('../scripts/serve.mjs'),/pathname === '\/api\/ics'/);
});

test('(d) Dienstplan: Fotos entfernen und Wochenplan auf „J. Twele“ filtern',()=>{
  const grid=['Name\tMo 30.11.\tDi 01.12.\tMi 02.12.\tDo 03.12.\tFr 04.12.','Müller, A.\tF\tF\tS\tfrei\tN','Twele, J.\tS\tfrei\tF\t06:00-14:00\tN','Schmidt, B.\tN\tN\tfrei\tF\tF'].join('\n');
  const r=parseShiftPlan(grid,now,{name:'J. Twele'});
  assert.equal(r.mode,'grid');assert.equal(r.matched,1);assert.equal(r.total,3);
  assert.deepEqual(r.rows.map(x=>`${x.date} ${x.start}-${x.end} ${x.label}`),['2026-11-30 14:00-22:00 Spät','2026-12-01 - Frei','2026-12-02 06:00-14:00 Früh','2026-12-03 06:00-14:00 Dienst','2026-12-04 22:00-06:00 Nacht']);
  const lines=parseShiftPlan('30.11. 06:00-14:00 Früh J. Twele\n30.11. 14:00-22:00 Spät A. Müller\n02.12. Spät J. Twele',now,{name:'J. Twele'});
  assert.equal(lines.rows.length,2);assert.ok(lines.rows.every(x=>!/twele/i.test(x.label)),'Name nicht im Titel');
  assert.equal(parseShiftPlan('02.12. Spät\n03.12. Früh',now,{name:'J. Twele'}).rows.length,2,'ohne Namen im Text bleiben alle Zeilen');
  assert.ok(nameMatcher('J. Twele').test('Twele, Jan'));assert.ok(!nameMatcher('J. Twele').test('Tweleborg'));
  const ai=validateShiftRows([{date:'2026-12-01',start:'06:00',end:'14:00',label:'Früh',name:'Twele, J.'},{date:'2026-12-01',start:'14:00',end:'22:00',label:'Spät',name:'Müller'}]);
  assert.deepEqual(filterRowsByName(ai,'J. Twele').map(x=>x.label),['Früh']);
  // Removal = attachment patch removed:true; the shift pane hides removed photos and offers ✕ per photo.
  const st=projectState([{id:'a',entity:'attachment',entity_id:'a',action:'create',data:{parent_type:'shiftplan',blob_id:'a'},created_at:'2026-11-25T08:00:00Z'},{id:'b',entity:'attachment',entity_id:'a',action:'patch',data:{removed:true},created_at:'2026-11-25T08:01:00Z'}]);
  assert.equal(st.attachment.a.removed,true);
  assert.match(read('../src/views/events.js'),/!a\.removed/);assert.match(read('../src/views/events.js'),/onRemove:/);
  assert.match(read('../src/ui.js'),/class:'thumb-del'/);assert.match(read('../src/main.js'),/removeAttachment:att=>/);
  assert.match(read('../src/views/events.js'),/class:'shift-row shift-head'/,'Prüf-Tabelle mit Kopfzeile');
});

test('(d) KI-Auslesung fragt nur nach „J. Twele“ und filtert die Antwort',async()=>{
  let sent='';
  const fetcher=async(url,opts)=>{sent=opts.body;return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify([{date:'2026-12-01',start:'06:00',end:'14:00',label:'Früh',name:'J. Twele'},{date:'2026-12-01',start:'14:00',end:'22:00',label:'Spät',name:'A. Müller'}])}]}}]})};};
  const sorter=createSorter({geminiKey:'k',freeOnly:true,model:'gemini-2.5-flash-lite'},fetcher);
  const res=await sorter.readShiftPlan('AAAA','image/png',2026,'J. Twele<script>');
  assert.match(sent,/NUR die Dienste der Person „J. Twele/);assert.ok(!sent.includes('<script>'),'Name wird bereinigt');
  assert.deepEqual(res.rows.map(r=>r.label),['Früh']);
});

test('(6) Hosting-Build: nur öffentliche Werte, lokaler Betrieb bleibt',()=>{
  const build=read('../scripts/build-static.mjs');
  assert.match(build,/aiEnabled:false,sortToken:''/);
  // The build may READ the secret to detect leaks; only the emitted public object must exclude it.
  const publicObject=build.match(/const pub=([^;]+);/)[1];
  assert.doesNotMatch(publicObject,/geminiKey|gemini_key/,'kein Gemini-Key in der ausgegebenen Konfiguration');
  const main=read('../src/main.js');
  assert.match(main,/fetch\('\.\/config\.json'/);assert.match(main,/fetch\('\.\/api\/config'/);
  assert.match(read('../EINRICHTUNG.md'),/Von unterwegs nutzen/);assert.match(read('../.gitignore'),/dist\//);
});
