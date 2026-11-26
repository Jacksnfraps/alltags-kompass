import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarPeople,eventPerson,monthCells,rhythmException,exceptionPatch} from '../src/domain/calendar.js';
import {localSort,sortingOperations} from '../src/domain/sort.js';
import {projectState,operation,occurrences,localDay} from '../src/domain/state.js';
import {parseShiftPlan,shiftCode,shiftToEntry} from '../src/domain/shifts.js';

const now=new Date(2026,10,26,12);
const choir={id:'chor',kind:'event',category:'rhythm',title:'Chorprobe',due_at:'2026-12-02T19:00',recurrence:'weekly',status:'open'};
test('Named children get individual filters; old children and family trash map without rewriting originals',()=>{
  const settings={kids:'Julian, Hanna',partner:'Vanessa'};
  assert.equal(calendarPeople(settings)['child:julian'].label,'Julian');
  assert.equal(eventPerson({person:'kids',title:'Julian Fußball'},settings),'child:julian');
  assert.equal(eventPerson({person:'kids',title:'Julian und Hanna'},settings),'kids');
  assert.equal(eventPerson({person:'family',category:'trash'},settings),'trash');
  assert.equal(localSort('Hanna hat morgen einen Termin',[],{now,people:{kids:['Julian','Hanna']}})[0].person,'child:hanna');
});
test('Month grid starts Monday, ends Sunday, handles leap year and month boundary',()=>{
  for(const [year,month,days] of [[2026,10,30],[2028,1,29],[2026,11,31]]){
    const cells=monthCells(year,month);assert.equal(cells[0].date.getDay(),1);assert.equal(cells.at(-1).date.getDay(),0);
    assert.equal(cells.filter(c=>c.inMonth).length,days);assert.equal(new Set(cells.map(c=>c.key)).size,cells.length);
  }
});
test('Shift grid preserves F1/F2/S1/S2/O/U with no invented times and editable labels',()=>{
  const plan='Name\t01.12.\t02.12.\t03.12.\t04.12.\t05.12.\t06.12.\nMustermann\tF1\tF2\tS1\tS2\tO\tU';
  const {rows}=parseShiftPlan(plan,now,{name:'Mustermann'});
  assert.deepEqual(rows.map(r=>shiftCode(shiftToEntry(r))),['F1','F2','S1','S2','O','U']);
  assert.ok(rows.every(r=>r.start===''&&r.end===''));
  assert.equal(shiftCode({title:'Früh Station A'},{'Früh Station A':'F2'}),'F2');
});
test('Dated rhythm cancellation applies automatically; exact original and retry safety preserved',()=>{
  const text='Übrigens am 09.12. ist kein Chor.';
  const capture={id:'cap',original_text:text,created_at:now.toISOString()};
  const initial=[operation('entry','chor',choir),operation('capture','cap',capture)];
  const state=projectState(initial);const ops=sortingOperations(capture,localSort(text,[],{now}),state);
  const result=projectState([...initial,...ops]);
  assert.equal(result.capture.cap.original_text,text);
  assert.deepEqual(result.entry.chor.skip_ranges,[{start:'2026-12-09',end:'2026-12-09'}]);
  assert.deepEqual(occurrences(result.entry.chor,new Date(2026,11,1),new Date(2026,11,17)).map(localDay),['2026-12-02','2026-12-16']);
  assert.deepEqual(sortingOperations(capture,localSort(text,[],{now}),result),[]);
});
test('Holiday range is inclusive and reversible; ambiguous rhythm never silently changes a series',()=>{
  const ex=rhythmException('Chor Ferien vom 09.12. bis 23.12.',[choir],now);
  assert.deepEqual(ex,{start:'2026-12-09',end:'2026-12-23',candidates:['chor']});
  const e={...choir,...exceptionPatch(choir,ex)};
  assert.deepEqual(occurrences(e,new Date(2026,11,1),new Date(2027,0,1)).map(localDay),['2026-12-02','2026-12-30']);
  assert.equal(exceptionPatch(e,ex).skip_ranges.length,1);
  assert.equal(occurrences({...e,skip_ranges:[]},new Date(2026,11,1),new Date(2027,0,1)).length,5);
  assert.equal(rhythmException('Am 09.12. kein Chor',[choir,{...choir,id:'chor2'}],now).candidates.length,2);
  assert.equal(rhythmException('Kein Chor am 31.02.',[choir],now),null);
  assert.equal(rhythmException('Am 09.12. Chorprobe',[choir],now),null);
});
test('Unassigned holiday request stays reviewable and does not create a misleading appointment',()=>{
  const text='Ferien vom 09.12. bis 23.12.';const cap={id:'x',original_text:text,created_at:now.toISOString()};
  const state=projectState([operation('entry','chor',choir),operation('capture','x',cap)]);
  const ops=sortingOperations(cap,localSort(text,[],{now}),state);
  assert.equal(ops.filter(o=>o.entity==='entry'&&o.action==='patch').length,0);
  const row=ops.find(o=>o.entity==='entry').data;assert.equal(row.category,'exception');assert.equal(row.needs_review,true);assert.equal(row.due_at,null);
});
