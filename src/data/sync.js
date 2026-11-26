export class Synchronizer {
  constructor(store,cloud,onChange,onStatus) {Object.assign(this,{store,cloud,onChange,onStatus});this.stopped=false;}
  start() {
    this.unsubscribe=this.cloud.subscribe(()=>this.run());
    this.timer=setInterval(()=>{if(!document.hidden)this.run();},30000);
    this.online=()=>this.run();window.addEventListener('online',this.online);this.run();
  }
  stop() {this.stopped=true;this.unsubscribe?.();clearInterval(this.timer);window.removeEventListener('online',this.online);return this.finished || Promise.resolve();}
  async run() {
    if(this.busy){this.again=true;return;} if(this.stopped || !navigator.onLine)return;
    this.busy=true;
    let finish;this.finished=new Promise(resolve=>{finish=resolve;});
    try {
      const pending=(await this.store.operations()).filter(x=>x.pending);
      this.onStatus(pending.length?`${pending.length} Änderungen werden synchronisiert …`:'Cloud abgleichen …');
      for(let i=0;i<pending.length;i+=50){if(this.stopped)return;await this.cloud.upload(pending.slice(i,i+50));}
      if(this.stopped)return;
      await this.store.receive(await this.cloud.pull());
      for(const row of (await this.store.blobs()).filter(x=>x.pending)){if(this.stopped)return;await this.cloud.uploadBlob(row);await this.store.receiveBlob(row);}
      if(this.stopped)return;
      await this.onChange();this.onStatus('Cloud aktuell · automatischer Abgleich aktiv');
    } catch(error) {if(!this.stopped)this.onStatus(`Lokal gesichert · ${error.message}`);this.again=false;}
    finally {this.busy=false;finish();if(this.again&&!this.stopped){this.again=false;queueMicrotask(()=>this.run());}}
  }
}
