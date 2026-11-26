// v0.6.0: own Gemini key in the account settings (Supabase) with localStorage fallback in guest mode.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {AiKeyStore,cleanKey,maskKey,GUEST_SLOT,SETUP_HINT} from '../src/data/ai-key.js';
import {createGemini} from '../src/data/gemini.js';
import {localSort} from '../src/domain/sort.js';

const KEY='AIzaSyTestKey0123456789abcdefghijklmno';// fake, 39 characters
const KEY2='AIzaSyOtherKey123456789abcdefghijklmno';
function memoryStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),map:m};}
// Fake Supabase: one settings row per user, like the RLS-protected table.
function fakeSupabase(){
  const rows=new Map();
  const account=id=>({url:'https://x.supabase.co',session:{user:{id}},
    getUserSettings:async()=>rows.get(id)||null,
    saveUserSettings:async data=>{rows.set(id,{...(rows.get(id)||{}),...data});}});
  return {rows,account};
}

test('Angemeldet: Key liegt im Konto und ist auf einem zweiten Gerät nach dem Login automatisch da',async()=>{
  const db=fakeSupabase();
  const pc=new AiKeyStore(db.account('u1'),memoryStorage());await pc.load();
  assert.equal(pc.key,'');
  await pc.save(`  ${KEY}\n`);
  assert.equal(db.rows.get('u1').gemini_key,KEY,'im Konto gespeichert (bereinigt)');assert.equal(pc.where,'account');
  // iPhone: empty storage, same account -> key comes from Supabase and is cached per account.
  const phoneStorage=memoryStorage();const phone=new AiKeyStore(db.account('u1'),phoneStorage);
  assert.equal(await phone.load(),KEY);assert.equal(phone.where,'account');
  assert.equal(phoneStorage.getItem('kompass.gemini:https://x.supabase.co:u1'),KEY);
  // Other account sees nothing.
  assert.equal(await new AiKeyStore(db.account('u2'),memoryStorage()).load(),'');
  // Replaced on one device -> the other picks up the new key on next load.
  await pc.save(KEY2);assert.equal(await phone.load(),KEY2);
  // Removed -> gone everywhere; logout drops the device copy only.
  await phone.forgetDevice();assert.equal(phoneStorage.getItem('kompass.gemini:https://x.supabase.co:u1'),null);assert.equal(db.rows.get('u1').gemini_key,KEY2);
  await pc.remove();assert.equal(db.rows.get('u1').gemini_key,null);assert.equal(await phone.load(),'');
});

test('Gastmodus: Key nur in localStorage; Übernahme ins Konto nur auf Knopfdruck',async()=>{
  const storage=memoryStorage();
  const guest=new AiKeyStore({session:null},storage);await guest.save(KEY);
  assert.equal(storage.getItem(GUEST_SLOT),KEY);assert.equal(guest.where,'device');
  assert.equal(await new AiKeyStore({session:null},storage).load(),KEY,'bleibt nach Neustart');
  const db=fakeSupabase();const acc=new AiKeyStore(db.account('u1'),storage);await acc.load();
  assert.equal(acc.key,'','kein stilles Hochladen');assert.equal(acc.guestKey,KEY);assert.equal(db.rows.size,0);
  await acc.adoptGuestKey();assert.equal(db.rows.get('u1').gemini_key,KEY);assert.equal(storage.getItem(GUEST_SLOT),null);
});

test('Fehlerfälle: ungültiger Key, Tabelle fehlt, offline',async()=>{
  assert.throws(()=>cleanKey('hallo'),/Gemini-API-Key/);assert.throws(()=>cleanKey(''),/Gemini-API-Key/);
  assert.equal(maskKey(KEY),'AIza…lmno');
  const missing={url:'https://x.supabase.co',session:{user:{id:'u1'}},getUserSettings:async()=>{const e=new Error('Could not find the table public.kompass_user_settings');e.status=404;throw e;},saveUserSettings:async()=>{const e=new Error('PGRST205');e.status=404;throw e;}};
  const storage=memoryStorage();storage.setItem('kompass.gemini:https://x.supabase.co:u1',KEY);
  const s=new AiKeyStore(missing,storage);assert.equal(await s.load(),KEY,'Gerätekopie bleibt nutzbar');assert.equal(s.error,SETUP_HINT);
  await assert.rejects(s.save(KEY2),/004_user_settings\.sql/);
  Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
  try{const db=fakeSupabase();await assert.rejects(new AiKeyStore(db.account('u1'),memoryStorage()).save(KEY),/Offline/);assert.equal(db.rows.size,0);}
  finally{delete globalThis.navigator;}
});

test('Mit Key: KI-Sortierung direkt aus dem Browser (gleicher Vertrag, Limits, Fallback); ohne Key lokal',async()=>{
  const lists=[{id:'L1',title:'Tasche Alfsee'}];const text='zum Alfsee muss ich auch Unterwäsche mitnehmen';
  const parts=localSort(text,[],{lists});
  let seen;const ok=async(url,opts)=>{seen={url,opts};return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify([{index:0,kind:'todo',minutes:15,energy:'low',project:'',uncertain:false,position:50,action:'add_to_list',list_name:'Tasche Alfsee',items:['Unterwäsche']}])}]}}]})};};
  const store={};const memory={load:()=>store.v,save:v=>{store.v=v;}};
  const ai=createGemini({geminiKey:KEY,freeOnly:true,model:'gemini-2.5-flash-lite',dailyLimit:1},ok,()=>Date.UTC(2026,10,26),memory);
  const r=await ai.sort(text,{lists:['Tasche Alfsee']},{parts,lists});
  assert.equal(r.source,'gemini');assert.equal(r.parts[0].list,'Tasche Alfsee');assert.deepEqual(r.parts[0].items,['Unterwäsche']);
  assert.equal(seen.opts.headers['x-goog-api-key'],KEY,'Key nur im Header, nie in der URL');assert.ok(!seen.url.includes(KEY));
  // Budget survives a reload (memory) -> second call the same day is local.
  const again=createGemini({geminiKey:KEY,freeOnly:true,model:'gemini-2.5-flash-lite',dailyLimit:1},ok,()=>Date.UTC(2026,10,26),memory);
  const r2=await again.sort(text,{},{parts,lists});assert.equal(r2.source,'local');assert.match(r2.reason,/Tageslimit/);assert.deepEqual(r2.parts[0].items,['Unterwäsche']);
  // Without key: never calls out.
  let called=false;const off=createGemini({geminiKey:'',freeOnly:true,model:'gemini-2.5-flash-lite'},async()=>{called=true;});
  assert.equal(off.enabled,false);assert.equal((await off.sort(text,{},{parts,lists})).source,'local');assert.equal(called,false);
  // Key check: rejected key is reported as invalid.
  assert.deepEqual(await createGemini({geminiKey:KEY,freeOnly:true,model:'gemini-2.5-flash-lite'},async()=>({ok:false,status:400})).verify(),{ok:false,invalid:true,reason:'Google lehnt den Key ab – bitte in AI Studio prüfen.'});
  assert.equal((await ai.verify()).ok,true);
});

test('Key landet nie in config.json, Repository-Dateien oder dem Operationslog',()=>{
  const build=readFileSync(new URL('../scripts/build-static.mjs',import.meta.url),'utf8');
  assert.match(build,/const pub=\{supabaseUrl:config\.supabaseUrl,supabaseKey:config\.supabaseKey,aiEnabled:false/);assert.doesNotMatch(build.split('const pub=')[1].split('\n')[0],/gemini/i);
  const server=readFileSync(new URL('../scripts/serve.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(server.match(/JSON\.stringify\(\{supabaseUrl[^\n]*/)[0],/geminiKey/,'/api/config gibt keinen Key heraus');
  const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.doesNotMatch(main,/operation\([^)]*gemini/i,'kein Key im Operationslog');
  assert.doesNotMatch(main,/settings\.gemini|kompass\.settings[^\n]*gemini/i,'nicht in den exportierbaren Einstellungen');
  const sql=readFileSync(new URL('../supabase/migrations/004_user_settings.sql',import.meta.url),'utf8');
  assert.match(sql,/enable row level security/);assert.match(sql,/revoke all on public\.kompass_user_settings from anon/);
  // No real-looking key anywhere in the shipped sources.
  for(const dir of ['../src/','../src/data/','../src/domain/','../src/views/','../scripts/'])for(const f of readdirSync(new URL(dir,import.meta.url)).filter(f=>/\.m?js$/.test(f)))
    assert.doesNotMatch(readFileSync(new URL(dir+f,import.meta.url),'utf8'),/AIza[0-9A-Za-z_-]{35}/,f);
});
