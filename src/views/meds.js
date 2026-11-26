import {h,empty,entryRow,dayLabel} from '../ui.js';
import {stockStatus,localDay,LOW_STOCK} from '../domain/state.js';

function suggestedCount(entries){
  for(const e of entries)for(const v of Object.values(e.facts||{})){const m=String(v).match(/^(\d+)\s*(?:stück|stk|tabletten)/i);if(m)return Number(m[1]);}
  return 100;
}
function createForm(ctx,initial){
  const name=h('input',{class:'inp sm',placeholder:'Bezeichnung (optional)','aria-label':'Bezeichnung',value:''});
  const count=h('input',{class:'inp sm',type:'number',min:'1',max:'2000',required:true,value:String(initial),'aria-label':'Stück in der Packung'});
  const daily=h('input',{class:'inp sm',type:'number',min:'1',max:'20',value:'1','aria-label':'Stück pro Tag'});
  const threshold=h('input',{class:'inp sm',type:'number',min:'1',max:'500',value:String(LOW_STOCK),'aria-label':'Warnen ab'});
  return h('form',{class:'med-form',onsubmit:e=>{e.preventDefault();ctx.createStock({name:name.value.trim()||'ADHS-Medikation',initial:Number(count.value),daily:Number(daily.value)||1,threshold:Number(threshold.value)||LOW_STOCK,pack_size:Number(count.value)});}},
    h('label',{},'Bezeichnung',name),h('label',{},'Bestand (Stück)',count),h('label',{},'Pro Tag',daily),h('label',{},'Warnen ab',threshold),h('button',{class:'btn'},'Bestand anlegen'));
}

function history(stock,state){
  const days=[];const today=new Date();
  for(let i=6;i>=0;i--){const d=new Date(today);d.setDate(today.getDate()-i);const k=localDay(d);
    const taken=Object.values(state.dose).some(x=>x.stock_id===stock.id&&x.day===k&&x.active!==false);
    days.push(h('span',{class:`dot${taken?' on':''}`,title:`${dayLabel(d)}: ${taken?'genommen':'—'}`},['So','Mo','Di','Mi','Do','Fr','Sa'][d.getDay()]));}
  return h('div',{class:'week-dots','aria-label':'Letzte 7 Tage'},days);
}

function stockCard(stock,ctx){
  const {state}=ctx;const st=stockStatus(stock,state);const today=localDay();
  const todayDose=Object.values(state.dose).find(d=>d.stock_id===stock.id&&d.day===today&&d.active!==false);
  const correct=h('form',{class:'form-line',onsubmit:e=>{e.preventDefault();const v=Number(e.target.querySelector('input').value);if(!Number.isFinite(v)||v<0)return;const diff=v-st.balance;if(diff)ctx.adjustStock(stock.id,Math.abs(diff),diff>0?'in':'out','Korrektur');}},
    h('input',{class:'inp sm',type:'number',min:'0',value:String(st.balance),'aria-label':'Tatsächlicher Bestand'}),h('button',{class:'btn sm'},'Korrigieren'));
  const refill=h('form',{class:'form-line',onsubmit:e=>{e.preventDefault();const v=Number(e.target.querySelector('input').value);if(v>0)ctx.adjustStock(stock.id,v,'in','Neue Packung');}},
    h('input',{class:'inp sm',type:'number',min:'1',value:String(stock.pack_size||100),'aria-label':'Stück neue Packung'}),h('button',{class:'btn sm'},'＋ Packung'));
  return h('article',{class:`card med${st.low?' low':''}`},
    h('div',{class:'med-head'},h('h3',{},stock.name||'Medikation'),h('span',{class:'muted sm'},`${st.perDay} / Tag · Warnung ab ${st.threshold}`)),
    h('div',{class:'med-main'},
      h('div',{class:'med-count'},h('strong',{},String(st.balance)),h('span',{},'Stück'),h('small',{},`≈ ${st.daysLeft} Tage`)),
      todayDose?h('div',{class:'med-today done'},h('span',{},'✓ Heute erledigt'),h('button',{type:'button',class:'btn sm ghost',onclick:()=>ctx.undoDose(todayDose.id)},'Rückgängig'))
        :h('button',{type:'button',class:'btn big',onclick:()=>ctx.takeDose(stock)},`✓ Heute genommen (−${st.perDay})`)),
    history(stock,state),
    st.low?h('div',{class:'calm-warn',role:'status'},
      stock.rx_requested_at?h('span',{},`Rezept angefordert am ${new Date(stock.rx_requested_at).toLocaleDateString('de-DE')}. Neue Packung hier eintragen, sobald sie da ist.`)
        :[h('span',{},`Noch ${st.balance} Stück – Neues Rezept anfordern.`),h('button',{type:'button',class:'btn sm',onclick:()=>ctx.patchStock(stock.id,{rx_requested_at:new Date().toISOString()})},'Erledigt: angefordert')]):null,
    h('details',{class:'inline-add'},h('summary',{},'Packung / Korrektur'),h('div',{class:'med-tools'},h('span',{class:'lbl'},'Neue Packung'),refill,h('span',{class:'lbl'},'Bestand zählen & korrigieren'),correct,
      h('button',{type:'button',class:'btn sm ghost',onclick:()=>{if(confirm('Bestand archivieren? Verlauf bleibt erhalten.'))ctx.patchStock(stock.id,{archived:true});}},'Bestand archivieren'))));
}

export function renderMeds(root,ctx){
  const {state}=ctx;
  const stocks=Object.values(state.stock).filter(s=>!s.archived);
  const related=Object.values(state.entry).filter(e=>e.kind==='medication'&&e.status!=='hidden');
  const open=related.filter(e=>e.status!=='done');
  const left=h('div',{class:'stack'},stocks.map(s=>stockCard(s,ctx)),
    h(stocks.length?'details':'div',{class:stocks.length?'inline-add':'card'},stocks.length?h('summary',{},'＋ Weiteren Bestand anlegen'):h('h3',{},'Packung anlegen'),createForm(ctx,suggestedCount(open))));
  const right=h('section',{class:'panel'},h('div',{class:'panel-head'},h('h2',{},'Notizen & Rezepte'),h('span',{class:'count'},String(open.length))),
    open.length?open.map(e=>entryRow(e,ctx)):empty('Gedanken zu Tabletten oder Rezepten landen automatisch hier.'),
    h('p',{class:'muted sm'},'Der Zähler zählt nur den Bestand. Er gibt keine Dosierungs- oder Therapieempfehlung.'));
  root.append(h('div',{class:'cols meds-cols'},left,right));
}
