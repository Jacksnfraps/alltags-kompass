import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWhen,stripWhen} from '../src/domain/when.js';
import {localSort,splitOriginal,sortingOperations,shoppingItems,callDetails} from '../src/domain/sort.js';
import {projectState,occurrences,stockStatus,stockBalance,operation} from '../src/domain/state.js';
import {parseShiftText,validateShiftRows,shiftToEntry} from '../src/domain/shifts.js';
import {filterTodos,shoppingList} from '../src/views/todos.js';
import {projectFacts,orderSteps} from '../src/views/ideas.js';
import {createSorter} from '../scripts/gemini.mjs';

const now=new Date(2026,10,25,10,0); // Mittwoch, 25.11.2026

test('Datumserkennung: Wochentag, Rhythmus, Datum, Uhrzeit, relativ',()=>{
  assert.deepEqual(parseWhen('Chorprobe mittwochs 19:30',now),{due_at:'2026-11-25T19:30',has_time:true,recurrence:'weekly',label:'Mittwochs 19:30'});
  assert.equal(parseWhen('Morgen 15 Uhr Zahnarzt',now).due_at,'2026-11-26T15:00');
  assert.equal(parseWhen('12.12. Konzert um 18 Uhr',now).due_at,'2026-12-12T18:00');
  assert.equal(parseWhen('Elternabend am 3. Dezember 19 Uhr',now).due_at,'2026-12-03T19:00');
  assert.equal(parseWhen('Gelbe Tonne alle zwei Wochen Freitag',now).recurrence,'biweekly');
  assert.equal(parseWhen('1.3. Geburtstag',now).due_at.slice(0,10),'2027-03-01');
  assert.equal(parseWhen('Breite 2.5 m und 42,5 cm',now).due_at,null);
  assert.equal(stripWhen('Chorprobe mittwochs 19:30'),'Chorprobe');
  assert.equal(stripWhen('Vanessa Elternabend am 3. Dezember 19 Uhr'),'Vanessa Elternabend');
});

test('Zerlegung trennt nach Uhrzeit-Punkt, aber nicht nach Datum/Ordinalzahl; Original bleibt exakt',()=>{
  for(const t of ['Chorprobe 19:30. Vanessa anrufen.','Am 3. Dezember Konzert. 12.12. Probe.','Im 2. Stock streichen. Höhe 80. Danach spachteln.']){
    const parts=splitOriginal(t);assert.equal(parts.map(p=>p.text).join(''),t);
  }
  assert.equal(splitOriginal('Chorprobe 19:30. Vanessa anrufen.').length,2);
  assert.equal(splitOriginal('Am 3. Dezember Konzert. 12.12. Probe.').length,2);
  assert.equal(splitOriginal('Im 2. Stock streichen. Höhe 80. Danach spachteln.').length,3);
});

test('Automatische Zuordnung: Einkauf, Anruf (Wer/Wann/Weshalb), Personen, Müll, Rhythmus',()=>{
  const text='Mama anrufen wegen Geburtstag morgen. Eier, Brot und Butter besorgen. Bei der Krankenkasse anrufen wegen Rechnung. Vanessa Elternabend am 3. Dezember 19 Uhr. Kinderarzt Termin Freitag 9 Uhr. Gelbe Tonne alle zwei Wochen Freitag. Chorprobe mittwochs 19:30. Steuererklärung machen.';
  const p=localSort(text,[],{now});
  assert.equal(p.map(x=>x.text).join(''),text);
  assert.deepEqual(p[0].contact,{who:'Mama',when:'morgen',why:'Geburtstag'});
  assert.equal(p[0].category,'call');assert.equal(p[0].project,'');
  assert.deepEqual(p[1].items,['Eier','Brot','Butter']);assert.equal(p[1].category,'shopping');
  assert.equal(p[2].contact.who,'Krankenkasse');
  assert.equal(p[3].person,'vanessa');assert.equal(p[3].kind,'event');assert.equal(p[3].title,'Vanessa Elternabend');
  assert.equal(p[4].person,'kids');assert.equal(p[4].due_at,'2026-11-27T09:00');
  assert.equal(p[5].category,'trash');assert.equal(p[5].recurrence,'biweekly');assert.equal(p[5].all_day,true);
  assert.equal(p[6].category,'rhythm');assert.equal(p[6].recurrence,'weekly');
  assert.equal(p[7].project,'Steuer');assert.equal(p[7].energy,'high');
  assert.equal(localSort('Termin mit Mia',[],{now,people:{kids:['Mia']}})[0].person,'kids');
});

test('Sortier-Operationen speichern Termin-/Personen-/Einkaufsfelder',()=>{
  const text='Milch und Eier kaufen. Mittwoch 18 Uhr Konzert mit Vanessa.';
  const ops=sortingOperations({id:'c1',original_text:text},localSort(text,[],{now}),projectState([]));
  const entries=Object.values(projectState(ops).entry);
  assert.deepEqual(entries.find(e=>e.category==='shopping').items,['Milch','Eier']);
  const ev=entries.find(e=>e.kind==='event');assert.equal(ev.person,'vanessa');assert.equal(ev.due_at,'2026-11-25T18:00');
});

test('Wiederkehrende Termine: Vorkommen, Auslassen, Ende',()=>{
  const e={due_at:'2026-11-04T19:30',recurrence:'weekly'};
  const from=new Date(2026,10,25),to=new Date(2026,11,9);
  assert.deepEqual(occurrences(e,from,to).map(d=>d.getDate()),[25,2]);
  assert.deepEqual(occurrences({...e,skip_days:['2026-11-25']},from,to).map(d=>d.getDate()),[2]);
  assert.deepEqual(occurrences({...e,until:'2026-11-30T00:00'},from,to).map(d=>d.getDate()),[25]);
  assert.equal(occurrences({due_at:'2026-11-27T00:00',recurrence:'biweekly'},from,new Date(2027,0,1)).length,3);
  assert.equal(occurrences({due_at:'2026-11-01T00:00',recurrence:'fourweekly'},from,new Date(2027,0,1)).length,2);
  assert.equal(occurrences({due_at:'2026-11-26T10:00'},from,to).length,1);
});

test('Tabletten-Zähler: Entnahme, Doppeltipp, Rückgängig, Packung, Korrektur, Warnschwelle ≤ 30',()=>{
  const stock={id:'s',initial:100,daily:1};
  const ops=[operation('stock','s',stock)];
  const dose=(id,day)=>{const o=operation('dose',id,{stock_id:'s',day,amount:1});return o;};
  ops.push(dose('d1','2026-11-24'),dose('d2','2026-11-25'),dose('d3','2026-11-25'));
  let state=projectState(ops);assert.equal(stockBalance(stock,state),98);
  assert.equal(stockStatus(stock,state,'2026-11-25').takenToday,true);
  ops.push(operation('dose','d2',{active:false},'patch'),operation('dose','d3',{active:false},'patch'));
  state=projectState(ops);assert.equal(stockBalance(stock,state),99);assert.equal(stockStatus(stock,state,'2026-11-25').takenToday,false);
  ops.push(operation('adjustment','a1',{stock_id:'s',amount:69,direction:'out'}));
  state=projectState(ops);let st=stockStatus(stock,state,'2026-11-25');assert.equal(st.balance,30);assert.equal(st.low,true);assert.equal(st.daysLeft,30);
  ops.push(operation('adjustment','a2',{stock_id:'s',amount:100}));
  state=projectState(ops);st=stockStatus(stock,state,'2026-11-25');assert.equal(st.balance,130);assert.equal(st.low,false);
});

test('Dienstplan: Text-Erkennung, Voreinstellungen, Validierung von KI-Antworten',()=>{
  const rows=parseShiftText('Mo 30.11. 06:00-14:00 Frühdienst\n02.12. Spät\nunlesbar\n03.12.2026 22:00 – 06:00 Nacht',now);
  assert.deepEqual(rows,[{date:'2026-11-30',start:'06:00',end:'14:00',label:'Frühdienst'},{date:'2026-12-02',start:'14:00',end:'22:00',label:'Spät'},{date:'2026-12-03',start:'22:00',end:'06:00',label:'Nacht'}]);
  assert.equal(parseShiftText('05.01. Früh',now)[0].date,'2027-01-05');
  assert.throws(()=>validateShiftRows([{date:'morgen'}]));
  assert.deepEqual(validateShiftRows([{date:'2026-12-01',start:'6:00',end:'14:00',label:'F'}]),[{date:'2026-12-01',start:'',end:'14:00',label:'F'}]);
  assert.equal(shiftToEntry(rows[0]).due_at,'2026-11-30T06:00');assert.equal(shiftToEntry({date:'2026-12-01',start:'',end:'',label:'Frei'}).all_day,true);
});

test('To-do-Filter und Einkaufsliste mit Abhaken einzelner Artikel',()=>{
  const e=[{minutes:15,energy:'low'},{minutes:30,energy:'high'},{minutes:60,energy:'high'},{minutes:15,energy:'low'}];
  assert.equal(filterTodos(e,'15').length,2);assert.equal(filterTodos(e,'low').length,2);assert.equal(filterTodos(e,'high').length,2);assert.equal(filterTodos(e,'all').length,4);
  const list=shoppingList([{id:'a',category:'shopping',title:'Eier, Brot besorgen',items:['Eier','Brot'],items_done:['Brot'],status:'open'},{id:'b',category:'shopping',title:'Milch kaufen',status:'open'},{id:'c',category:'shopping',title:'Alt',cleared:true,status:'done'}]);
  assert.deepEqual(list.map(i=>[i.name,i.done]),[['Eier',false],['Brot',true],['Milch',false]]);
  assert.deepEqual(shoppingItems('Einkauf: Milch, Eier und 2 kg Kartoffeln'),['Milch','Eier','2 kg Kartoffeln']);
  assert.deepEqual(callDetails('Bei der Krankenkasse anrufen wegen Rechnung',''),{who:'Krankenkasse',when:'',why:'Rechnung'});
});

test('Strang: Maße-Zusammenfassung, Warnung bei fehlenden Maßen, Reihenfolge',()=>{
  const steps=[{title:'Türzarge einbauen',details:'Türzarge einbauen',facts:{},missing_fields:['Breite, Höhe und Einbausituation prüfen'],position:30,created_at:'b',status:'open'},{title:'Planen',details:'Wanddurchbruch planen, Breite 90 cm',facts:{Breite:'90 cm'},position:10,created_at:'a',status:'open'}];
  let r=projectFacts({title:'Umbau Wohnzimmer'},steps);assert.deepEqual(r.missing,['Höhe']);assert.equal(r.rows[0].value,'90 cm');
  r=projectFacts({title:'Umbau Wohnzimmer',facts:{Höhe:'2,05 m'}},steps);assert.deepEqual(r.missing,[]);
  assert.deepEqual(projectFacts({title:'Garten'},[{title:'Hochbeet',details:'Hochbeet',facts:{},status:'open'}]).missing,[]);
  assert.deepEqual(orderSteps(steps).map(s=>s.title),['Planen','Türzarge einbauen']);
});

test('Gemini-Gateway: Tageslimit, Abkühlphase statt Dauersperre, Dienstplan nur validiert',async()=>{
  let t=Date.UTC(2026,10,25,9),calls=0;
  const ok=async()=>{calls++;return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify([{date:'2026-12-01',start:'06:00',end:'14:00',label:'Früh'}])}]}}]})};};
  const sorter=createSorter({geminiKey:'k',freeOnly:true,model:'gemini-2.5-flash-lite',dailyLimit:2},ok,()=>t);
  assert.equal((await sorter.readShiftPlan('AAAA','image/jpeg',2026)).rows.length,1);
  await sorter.readShiftPlan('AAAA','image/jpeg',2026);
  assert.equal((await sorter.readShiftPlan('AAAA','image/jpeg',2026)).source,'local');assert.equal(calls,2);
  t+=864e5;assert.equal((await sorter.readShiftPlan('AAAA','image/jpeg',2026)).source,'gemini');
  let fails=0;const bad=createSorter({geminiKey:'k',freeOnly:true,model:'gemini-2.5-flash',cooldownMs:1000},async()=>{fails++;return {ok:false,status:429};},()=>t);
  await bad.sort('Milch kaufen.');await bad.sort('Milch kaufen.');assert.equal(fails,1);
  t+=2000;await bad.sort('Milch kaufen.');assert.equal(fails,2);
  const off=createSorter({},async()=>{throw new Error('nie');});assert.equal((await off.readShiftPlan('A','image/png',2026)).source,'local');
});
