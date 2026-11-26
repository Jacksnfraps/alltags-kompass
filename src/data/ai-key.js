// The user's own Gemini API key.
// Signed in: stored in the account settings in Supabase (table kompass_user_settings, own row only),
//   so it is there on every device after logging in with the same account. A copy is cached on the
//   device (per account) for offline starts and removed again on logout.
// Not signed in: stored only in this browser (localStorage, guest slot).
// Never part of config.json, the operation log, the backup export or the repository.
export const GUEST_SLOT='kompass.gemini:guest';
// Google-issued keys may contain dots (verified with a 53-character key).
// Do not assume the historical AIza prefix or 39-character shape.
const PATTERN=/^[A-Za-z0-9_.-]{30,80}$/;
export function cleanKey(value){
  const key=String(value??'').replace(/\s+/g,'');
  if(!PATTERN.test(key))throw new Error('Bitte den vollständigen Gemini-API-Key kopieren: 30–80 Zeichen, Buchstaben, Ziffern, Punkt, Unterstrich oder Bindestrich. Keine Anführungszeichen.');
  return key;
}
export const maskKey=key=>key?`${key.slice(0,4)}…${key.slice(-4)}`:'';
const online=()=>typeof navigator==='undefined'||navigator.onLine!==false;
const missingTable=error=>error?.status===404||/PGRST205|schema cache|Could not find the table/i.test(error?.message||'');
export const SETUP_HINT='In Supabase fehlt die Tabelle für Kontoeinstellungen: einmal supabase/migrations/004_user_settings.sql im SQL-Editor ausführen.';

export class AiKeyStore{
  constructor(cloud,storage=globalThis.localStorage){
    this.cloud=cloud;this.storage=storage;this.key='';this.where='';this.error='';this.revision=0;
  }
  get signedIn(){return !!this.cloud?.session?.user?.id;}
  get slot(){return this.signedIn?`kompass.gemini:${this.cloud.url}:${this.cloud.session.user.id}`:GUEST_SLOT;}
  #get(slot){try{return this.storage?.getItem(slot)||'';}catch{return '';}}
  #set(slot,value){try{value?this.storage?.setItem(slot,value):this.storage?.removeItem(slot);}catch{/* device copy is a convenience */}}
  get guestKey(){return this.signedIn?this.#get(GUEST_SLOT):'';}
  // Device copy first (instant, offline), then the account value wins when reachable.
  async load(){
    const revision=++this.revision;
    this.key=this.#get(this.slot);this.where=this.key?(this.signedIn?'account':'device'):'';this.error='';
    if(!this.signedIn||!online())return this.key;
    try{
      const key=(await this.cloud.getUserSettings())?.gemini_key||'';
      if(revision!==this.revision)return this.key;
      this.key=key;this.where=key?'account':'';this.#set(this.slot,key);
    }catch(error){if(revision===this.revision)this.error=missingTable(error)?SETUP_HINT:'Kontoeinstellungen gerade nicht erreichbar – gespeicherter Stand dieses Geräts wird genutzt.';}
    return this.key;
  }
  async save(raw){
    const key=cleanKey(raw);
    ++this.revision;
    if(this.signedIn){
      if(!online())throw new Error('Offline: Key noch nicht im Konto gespeichert. Bitte bei Internetverbindung erneut speichern.');
      try{await this.cloud.saveUserSettings({gemini_key:key});}
      catch(error){throw new Error(missingTable(error)?SETUP_HINT:`Key nicht im Konto gespeichert: ${error.message}`);}
    }
    ++this.revision;this.#set(this.slot,key);this.key=key;this.where=this.signedIn?'account':'device';this.error='';
    return key;
  }
  async remove(){
    ++this.revision;
    if(this.signedIn){
      try{await this.cloud.saveUserSettings({gemini_key:null});}
      catch(error){throw new Error(missingTable(error)?SETUP_HINT:`Key nicht aus dem Konto entfernt: ${error.message}`);}
    }
    ++this.revision;this.#set(this.slot,'');this.key='';this.where='';
  }
  // Moves a key typed in guest mode into the account (explicit button), then clears the guest copy.
  async adoptGuestKey(){const key=await this.save(this.guestKey);this.#set(GUEST_SLOT,'');return key;}
  // On logout: the account's device copy goes away; the account value stays in Supabase.
  forgetDevice(){++this.revision;if(this.signedIn)this.#set(this.slot,'');this.key='';this.where='';}
}
