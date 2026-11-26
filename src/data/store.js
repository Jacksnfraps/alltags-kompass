import { operation, projectState } from '../domain/state.js';
const DB = 'kompass-v2';
let database;
function request(req) { return new Promise((resolve,reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
function finished(tx) { return new Promise((resolve,reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Speichern abgebrochen.')); }); }
async function open() {
  if (database) return database;
  const req = indexedDB.open(DB,1);
  req.onupgradeneeded = () => {
    const db = req.result;
    const ops = db.createObjectStore('ops',{keyPath:['scope','id']}); ops.createIndex('scope','scope');
    const blobs = db.createObjectStore('blobs',{keyPath:['scope','id']}); blobs.createIndex('scope','scope');
    db.createObjectStore('meta',{keyPath:'key'});
  };
  database = await request(req); return database;
}
export class LocalStore {
  constructor(scope = 'guest') { this.scope = scope; }
  async operations() { const db = await open(); return request(db.transaction('ops').objectStore('ops').index('scope').getAll(this.scope)); }
  async state() { return projectState(await this.operations()); }
  async commit(ops, blobs = []) {
    const db = await open(); const tx = db.transaction(['ops','blobs'],'readwrite'); const done = finished(tx);
    for (const op of ops) tx.objectStore('ops').put({...op,scope:this.scope,pending:true});
    for (const blob of blobs) tx.objectStore('blobs').put({...blob,scope:this.scope,pending:true});
    await done;
  }
  async receive(rows) {
    const db = await open(); const tx = db.transaction('ops','readwrite'); const done = finished(tx);
    for (const row of rows) tx.objectStore('ops').put({...row,scope:this.scope,pending:false});
    await done;
  }
  async blobs() { const db = await open(); return request(db.transaction('blobs').objectStore('blobs').index('scope').getAll(this.scope)); }
  async blob(id) { const db = await open(); return request(db.transaction('blobs').objectStore('blobs').get([this.scope,id])); }
  async receiveBlob(row) { const db = await open(); const tx = db.transaction('blobs','readwrite'); const done = finished(tx); tx.objectStore('blobs').put({...row,scope:this.scope,pending:false}); await done; }
  async migrateLegacy() {
    if (this.scope !== 'guest') return;
    const db = await open(); const marker = await request(db.transaction('meta').objectStore('meta').get('legacy-migrated'));
    if (marker) return;
    const raw = localStorage.getItem('kompass.local.v1');
    const rows = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(rows) || rows.some(x => typeof x.original_text !== 'string')) throw new Error('Alter Speicher nicht lesbar. Originaldaten bleiben unverändert.');
    const tx = db.transaction(['ops','meta'],'readwrite'); const done = finished(tx);
    for (const row of rows) {
      const op = operation('capture',row.id,{original_text:row.original_text,sorting_status:'pending'});
      op.id = row.id; op.created_at = row.created_at;
      tx.objectStore('ops').put({...op,scope:'guest',pending:true});
    }
    tx.objectStore('meta').put({key:'legacy-migrated',value:true}); await done;
    // Keep old data untouched as a migration backup.
  }
}
