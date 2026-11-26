import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AiKeyStore,cleanKey} from '../src/data/ai-key.js';
const KEY='TestKeyForAccountStorage0123456789abcdefgh';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
test('Punkt-Key mit 53 Zeichen wird bereinigt und im Konto gespeichert',async()=>{
 const key='Test.'+'x'.repeat(48);let saved;
 const cloud={url:'https://test.supabase.co',session:{user:{id:'one'}},saveUserSettings:async row=>{saved=row;}};
 assert.equal(key.length,53);assert.equal(cleanKey(' \n'+key+'\r\n'),key);
 const keys=new AiKeyStore(cloud,storage());await keys.save(key);assert.deepEqual(saved,{gemini_key:key});assert.equal(keys.where,'account');
});
test('RLS-Fehler wird nicht als fehlende Tabelle falsch diagnostiziert',async()=>{
 const cloud={url:'https://test.supabase.co',session:{user:{id:'one'}},saveUserSettings:async()=>{const e=new Error('permission denied for table kompass_user_settings');e.status=403;throw e;}};
 await assert.rejects(new AiKeyStore(cloud,storage()).save(KEY),/permission denied/);
});
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
