import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapture, needsRefill } from '../src/domain/captures.js';
import { readCaptures, saveCapture } from '../src/data/local.js';
const memory = () => { const map = new Map(); return {getItem:k=>map.get(k) ?? null,setItem:(k,v)=>map.set(k,v)}; };
test('Original einschließlich Zeilenumbrüchen bleibt nach Speichern erhalten', () => {
 const text = '  Idee: Regal\nMaße: 42,5 cm.\nUnd noch Milch kaufen.  ';
 const store = memory(); saveCapture(createCapture(text,'test-id','2026-11-25T10:00:00Z'),store);
 assert.equal(readCaptures(store)[0].original_text,text);
 assert.equal(readCaptures(store)[0].sorting_status,'pending');
});
test('Leere Eingabe wird abgewiesen',()=>assert.throws(()=>createCapture(' \n ')));
test('Speicherfehler werden sichtbar weitergegeben',()=>assert.throws(()=>saveCapture(createCapture('Gedanke'),{getItem:()=>null,setItem:()=>{throw new Error('Quota');}}),/Quota/));
test('Beschädigte Daten werden nicht überschrieben',()=>{
 let written = false;
 assert.throws(()=>saveCapture(createCapture('Neu'),{getItem:()=>'{broken',setItem:()=>{written=true;}}));
 assert.equal(written,false);
});
test('Erinnerung schließt Grenze 30 ein',()=>{assert.equal(needsRefill(30),true);assert.equal(needsRefill(31),false);assert.equal(needsRefill(0),true);});
