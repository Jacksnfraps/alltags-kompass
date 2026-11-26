import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AiKeyStore} from '../src/data/ai-key.js';
const KEY='TestKeyForAccountStorage0123456789abcdefgh';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('Späte Kontoantwort nach Logout stellt den lokalen Key nicht wieder her',async()=>{
 let resolve;const cloud={url:'https://test.supabase.co',session:{user:{id:'one'}},getUserSettings:()=>new Promise(r=>{resolve=r;})};
 const local=storage();const keys=new AiKeyStore(cloud,local);const load=keys.load();keys.forgetDevice();resolve({gemini_key:KEY});await load;
 assert.equal(keys.key,'');assert.equal(local.getItem(keys.slot),null);
});
test('Späte alte Antwort überschreibt keinen gerade gespeicherten Key',async()=>{
 let resolve;const cloud={url:'https://test.supabase.co',session:{user:{id:'one'}},getUserSettings:()=>new Promise(r=>{resolve=r;}),saveUserSettings:async()=>{}};
 const keys=new AiKeyStore(cloud,storage());const load=keys.load();await keys.save(KEY);resolve({gemini_key:'OldTestKey0123456789012345678901234567890'});await load;assert.equal(keys.key,KEY);
});
test('UI prüft einen Ersatz-Key vor dem Konto-Schreiben; Migration ist wiederholbar',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.ok(main.indexOf('if(check.invalid)')<main.indexOf('await keys.save(candidate)'));
 const sql=readFileSync(new URL('../supabase/migrations/004_user_settings.sql',import.meta.url),'utf8');
 for(const name of ['read','insert','update','delete'])assert.ok(sql.includes(`drop policy if exists own_settings_${name}`));
 assert.match(sql,/begin;/);assert.match(sql,/commit;/);
});
