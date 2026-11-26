export class Cloud {
  constructor(config) {
    this.url = config.supabaseUrl || ''; this.key = config.supabaseKey || '';
    this.sessionKey = `kompass.auth:${this.url}`;
    this.session = JSON.parse(localStorage.getItem(this.sessionKey) || 'null');
  }
  get configured() { return !!(this.url && this.key); }
  saveSession(session) {
    this.session = session?.access_token ? {...session,expires_at:session.expires_at || Math.floor(Date.now()/1000)+session.expires_in} : null;
    if(this.session) localStorage.setItem(this.sessionKey,JSON.stringify(this.session));
    else localStorage.removeItem(this.sessionKey);
  }
  async request(path, options = {}, token = this.session?.access_token) {
    const response = await fetch(this.url+path,{...options,headers:{apikey:this.key,...(token?{Authorization:`Bearer ${token}`} : {}),...options.headers},signal:AbortSignal.timeout(20000)});
    if(!response.ok) { const body = await response.json().catch(()=>({})); const error = new Error(body.msg || body.message || body.error_description || `Cloud-Antwort ${response.status}`); error.status=response.status; throw error; }
    return response;
  }
  async token() {
    if(!this.session) throw new Error('Bitte anmelden.');
    if(this.session.expires_at*1000 < Date.now()+60000) {
      if(!this.refreshing) this.refreshing = this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:this.session.refresh_token})},null).then(r=>r.json()).then(s=>this.saveSession(s)).finally(()=>{this.refreshing=null;});
      await this.refreshing;
    }
    return this.session.access_token;
  }
  async login(email,password,signup=false) {
    const response = await this.request(signup?'/auth/v1/signup':'/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})},null);
    const session = await response.json(); if(session.access_token) this.saveSession(session);
    return !!session.access_token;
  }
  async logout() { const token=this.session?.access_token; this.saveSession(null); if(token && navigator.onLine) await this.request('/auth/v1/logout',{method:'POST'},token); }
  async upload(rows) {
    const token=await this.token();
    const payload=rows.map(({id,entity,entity_id,action,data,created_at})=>({id,entity,entity_id,action,data,created_at,owner_id:this.session.user.id}));
    await this.request('/rest/v1/kompass_ops?on_conflict=owner_id,id',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(payload)},token);
  }
  async pull() {
    const token=await this.token(); const all=[];
    // Full reconciliation avoids skipping records committed out of sequence.
    for(let offset=0;;offset+=500) {
      const response=await this.request(`/rest/v1/kompass_ops?select=*&owner_id=eq.${this.session.user.id}&order=seq.asc&limit=500&offset=${offset}`,{},token);
      const page=await response.json(); all.push(...page); if(page.length<500) return all;
    }
  }
  async uploadBlob(row) {
    const token=await this.token();
    const response=await fetch(`${this.url}/storage/v1/object/kompass-photos/${this.session.user.id}/${row.id}`,{method:'POST',headers:{apikey:this.key,Authorization:`Bearer ${token}`,'Content-Type':row.blob.type,'x-upsert':'false'},body:row.blob,signal:AbortSignal.timeout(30000)});
    if(response.ok) return;
    const body=await response.json().catch(()=>({}));
    if(response.status===409 || body.error==='Duplicate' || body.statusCode==='409') return;
    throw new Error('Foto bleibt lokal in der Warteschlange.');
  }
  async downloadBlob(id) { return (await this.request(`/storage/v1/object/authenticated/kompass-photos/${this.session.user.id}/${id}`,{},await this.token())).blob(); }
  subscribe(onChange) {
    let stopped=false,socket,heartbeat,retry,ref=0;
    const connect=async()=>{
      if(stopped) return;
      if(!navigator.onLine) {retry=setTimeout(connect,15000);return;}
      try {
        const token=await this.token(); if(stopped)return;
        socket=new WebSocket(this.url.replace(/^http/,'ws')+`/realtime/v1/websocket?apikey=${encodeURIComponent(this.key)}&vsn=1.0.0`);
        const send=(topic,event,payload)=>socket.readyState===1 && socket.send(JSON.stringify({topic,event,payload,ref:String(++ref)}));
        socket.onopen=()=>{
          send('realtime:kompass','phx_join',{config:{broadcast:{self:false},presence:{key:''},postgres_changes:[{event:'INSERT',schema:'public',table:'kompass_ops',filter:`owner_id=eq.${this.session.user.id}`}]},access_token:token});
          heartbeat=setInterval(async()=>{send('phoenix','heartbeat',{});try{send('realtime:kompass','access_token',{access_token:await this.token()});}catch{socket.close();}},25000);
          onChange();
        };
        socket.onmessage=event=>{ const message=JSON.parse(event.data); if(message.event==='postgres_changes')onChange(); };
        socket.onclose=()=>{clearInterval(heartbeat);if(!stopped)retry=setTimeout(connect,15000);};
        socket.onerror=()=>socket.close();
      } catch {if(!stopped)retry=setTimeout(connect,30000);}
    };
    connect();return()=>{stopped=true;clearTimeout(retry);clearInterval(heartbeat);socket?.close();};
  }
}
