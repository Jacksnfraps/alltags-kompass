import {h,entryRow,segmented,snoozedSection,empty,isSnoozed,whenLabel,entryDetails,actionMenu} from '../ui.js';
import {shoppingItems} from '../domain/sort.js';

export const FILTERS=[['all','Alle'],['15','15 Min.'],['30','30 Min.'],['60','60 Min.'],['low','Wenig Energie'],['high','Fokus']];
export function filterTodos(entries,filter){
  if(filter==='15'||filter==='30'||filter==='60')return entries.filter(e=>e.minutes===Number(filter));
  if(filter==='low'||filter==='high')return entries.filter(e=>e.energy===filter);
  return entries;
}
export const itemsOf=e=>e.items?.length?e.items:shoppingItems(e.title).length?shoppingItems(e.title):[e.title];
// Flattens shopping entries to single checkable items; checked state lives in entry.items_done.
export function shoppingList(entries){
  return entries.filter(e=>e.category==='shopping'&&!e.cleared&&e.status!=='hidden').flatMap(e=>itemsOf(e).map(name=>({entry:e,name,done:e.status==='done'||(e.items_done||[]).includes(name)})));
}
const byDue=(a,b)=>(a.due_at||'9999').localeCompare(b.due_at||'9999')||(a.position??50)-(b.position??50)||a.created_at.localeCompare(b.created_at);

function tasksPane(todos,ctx){
  const {ui}=ctx;const filter=ui.todoFilter||'all';
  const general=todos.filter(e=>!['shopping','call','list'].includes(e.category));
  const open=general.filter(e=>e.status!=='done'&&!isSnoozed(e));
  const shown=filterTodos(open,filter).sort(byDue);
  const done=general.filter(e=>e.status==='done').sort((a,b)=>(b.done_at||'').localeCompare(a.done_at||''));
  const add=h('form',{class:'add-step',onsubmit:e=>{e.preventDefault();const v=add.querySelector('input').value.trim();if(v)ctx.quickAdd('todo',v,{minutes:Number(add.querySelector('select').value)});}},
    h('input',{class:'inp sm',placeholder:'Neues To-do …','aria-label':'Neues To-do'}),
    h('select',{class:'mini-select','aria-label':'Dauer'},h('option',{value:'15'},'15 Min.'),h('option',{value:'30',selected:true},'30 Min.'),h('option',{value:'60'},'60 Min.')),h('button',{class:'btn sm'},'＋'));
  return h('section',{class:`panel pane${(ui.todoPane||'tasks')==='tasks'?' on':''}`},
    h('div',{class:'panel-head'},h('h2',{},'Aufgaben'),h('span',{class:'count'},String(open.length))),
    h('div',{class:'chips-filter',role:'group','aria-label':'Filter'},FILTERS.map(([k,l])=>{const n=filterTodos(open,k).length;return h('button',{type:'button',class:`fchip${filter===k?' on':''}`,'aria-pressed':String(filter===k),onclick:()=>{ui.todoFilter=k;ctx.rerender();}},l,h('span',{class:'n'},String(n)));})),
    shown.length?shown.map(e=>entryRow(e,ctx,{extra:e.project_id&&ctx.state.project[e.project_id]?h('span',{class:'muted sm'},'◇ ',ctx.state.project[e.project_id].title):null})):empty(open.length?'Nichts passt zu diesem Filter.':'Keine offenen Aufgaben. Gut gemacht.'),
    add,snoozedSection(general.filter(e=>isSnoozed(e)&&e.status!=='done'),ctx),
    done.length?h('details',{class:'done-list'},h('summary',{},`Erledigt (${done.length})`),done.slice(0,30).map(e=>entryRow(e,ctx))):null);
}

function shoppingPane(todos,ctx){
  const {ui}=ctx;const list=shoppingList(todos);
  const open=list.filter(i=>!i.done),done=list.filter(i=>i.done);
  const toggle=(item,checked)=>toggleItem(ctx,item,checked);
  const add=h('form',{class:'add-step',onsubmit:e=>{e.preventDefault();const v=add.querySelector('input').value.trim();if(!v)return;const items=shoppingItems(v);ctx.quickAdd('todo',v,{category:'shopping',minutes:15,items:items.length?items:[v]});}},
    h('input',{class:'inp sm',placeholder:'Artikel, z. B. Milch, Brot','aria-label':'Einkauf hinzufügen'}),h('button',{class:'btn sm'},'＋'));
  const row=item=>h('label',{class:`shop-item${item.done?' done':''}`},h('input',{type:'checkbox',class:'check',checked:item.done,onchange:ev=>toggle(item,ev.target.checked)}),h('span',{},item.name));
  return h('section',{class:`panel pane${ui.todoPane==='shopping'?' on':''}`},
    h('div',{class:'panel-head'},h('h2',{},'Einkaufsliste'),h('span',{class:'count'},String(open.length))),
    add,open.length?h('div',{class:'shop-grid'},open.map(row)):empty('Einkaufsliste ist leer. „… kaufen“ im Brain-Dump landet automatisch hier.'),
    done.length?h('div',{class:'shop-done'},h('div',{class:'panel-head'},h('span',{class:'lbl'},`Im Wagen (${done.length})`),
      h('button',{type:'button',class:'btn sm ghost',onclick:()=>{const ids=[...new Set(done.map(i=>i.entry.id))].filter(id=>{const e=todos.find(t=>t.id===id);return itemsOf(e).every(n=>done.some(d=>d.entry.id===id&&d.name===n));});ctx.patchMany(ids.map(id=>[id,{cleared:true,status:'done'}]));}},'Abgehakte entfernen')),
      h('div',{class:'shop-grid'},done.map(row))):null);
}

// Own lists (packing lists, topic lists). Items are checkable like the shopping list; a packing list
// can be reset for the next trip ("Alle Haken entfernen").
export function listItems(entries,listId){
  return entries.filter(e=>e.category==='list'&&e.list_id===listId&&!e.cleared&&e.status!=='hidden').flatMap(e=>itemsOf(e).map(name=>({entry:e,name,done:e.status==='done'||(e.items_done||[]).includes(name)})));
}
export function activeLists(state){return Object.values(state.list||{}).filter(l=>!l.archived).sort((a,b)=>a.title.localeCompare(b.title,'de'));}
function toggleItem(ctx,item,checked){
  const e=item.entry;const all=itemsOf(e);const names=new Set(e.status==='done'?all:(e.items_done||[]));
  checked?names.add(item.name):names.delete(item.name);
  const complete=all.every(n=>names.has(n));
  ctx.patch(e.id,{items_done:[...names],status:complete?'done':'open',done_at:complete?new Date().toISOString():null});
}
function listsPane(todos,ctx){
  const {ui,state}=ctx;const lists=activeLists(state);
  if(ui.listId&&!lists.some(l=>l.id===ui.listId))ui.listId=null;
  const current=lists.find(l=>l.id===ui.listId)||lists[0]||null;
  const newList=h('form',{class:'add-step',onsubmit:e=>{e.preventDefault();const v=newList.querySelector('input').value.trim();if(v)ctx.createList(v);}},
    h('input',{class:'inp sm',placeholder:'Neue Liste, z. B. Tasche Alfsee','aria-label':'Neue Liste'}),h('button',{class:'btn sm'},'＋ Liste'));
  const head=h('div',{class:'panel-head'},h('h2',{},'Listen'),h('span',{class:'count'},String(lists.length)));
  if(!current)return h('section',{class:`panel pane${ui.todoPane==='lists'?' on':''}`},head,
    empty('Noch keine eigenen Listen. Lege z. B. „Tasche Alfsee“ an – oder sprich einfach „Föhn mit zum Alfsee nehmen“ bzw. „Föhn auf Liste Tasche Alfsee“.'),newList);
  const items=listItems(todos,current.id);const open=items.filter(i=>!i.done),done=items.filter(i=>i.done);
  const entries=[...new Set(items.map(i=>i.entry))];
  const add=h('form',{class:'add-step',onsubmit:e=>{e.preventDefault();const v=add.querySelector('input').value.trim();if(!v)return;
    const names=v.split(/,| und /).map(x=>x.trim()).filter(Boolean);
    ctx.quickAdd('todo',`${v} auf Liste ${current.title}`,{category:'list',list_id:current.id,minutes:15,items:names,title:names.join(', ')});}},
    h('input',{class:'inp sm',placeholder:`Auf „${current.title}“ …`,'aria-label':`Zur Liste ${current.title} hinzufügen`}),h('button',{class:'btn sm'},'＋'));
  const row=item=>h('label',{class:`shop-item${item.done?' done':''}`},h('input',{type:'checkbox',class:'check',checked:item.done,onchange:ev=>toggleItem(ctx,item,ev.target.checked)}),h('span',{},item.name));
  const menu=actionMenu('Listen-Optionen',[
    h('div',{class:'row-form'},
      h('button',{type:'button',class:'btn sm ghost',onclick:()=>{const v=prompt('Liste umbenennen:',current.title);if(v&&v.trim())ctx.patchList(current.id,{title:v.trim()});}},'Umbenennen'),
      h('button',{type:'button',class:'btn sm ghost',onclick:()=>ctx.patchMany(entries.map(e=>[e.id,{items_done:[],status:'open',done_at:null}]))},'Alle Haken entfernen'),
      h('button',{type:'button',class:'btn sm ghost',onclick:()=>{if(confirm(`Liste „${current.title}“ archivieren? Einträge und Originale bleiben erhalten.`))ctx.patchList(current.id,{archived:true});}},'Archivieren'))]);
  return h('section',{class:`panel pane${ui.todoPane==='lists'?' on':''}`},head,
    h('div',{class:'chips-filter list-chips',role:'group','aria-label':'Liste wählen'},lists.map(l=>{const n=listItems(todos,l.id).filter(i=>!i.done).length;
      return h('button',{type:'button',class:`fchip${l.id===current.id?' on':''}`,'aria-pressed':String(l.id===current.id),onclick:()=>{ui.listId=l.id;ctx.rerender();}},l.title,h('span',{class:'n'},String(n)));})),
    h('div',{class:'panel-head'},h('span',{class:'lbl'},current.title),menu),
    add,open.length?h('div',{class:'shop-grid'},open.map(row)):empty(done.length?'Alles abgehakt.':'Diese Liste ist noch leer.'),
    done.length?h('div',{class:'shop-done'},h('div',{class:'panel-head'},h('span',{class:'lbl'},`Abgehakt (${done.length})`),
      h('button',{type:'button',class:'btn sm ghost',onclick:()=>ctx.patchMany(entries.filter(e=>itemsOf(e).every(n=>done.some(d=>d.entry===e&&d.name===n))).map(e=>[e.id,{cleared:true,status:'done'}]))},'Abgehakte entfernen')),
      h('div',{class:'shop-grid'},done.map(row))):null,
    h('details',{class:'inline-add'},h('summary',{},'＋ Weitere Liste anlegen'),newList));
}

function callsPane(todos,ctx){
  const {ui}=ctx;
  const calls=todos.filter(e=>e.category==='call');
  const open=calls.filter(e=>e.status!=='done'&&!isSnoozed(e)).sort(byDue);const done=calls.filter(e=>e.status==='done');
  const f={who:h('input',{class:'inp sm',placeholder:'Wer?','aria-label':'Wer'}),when:h('input',{class:'inp sm',placeholder:'Wann?','aria-label':'Wann'}),why:h('input',{class:'inp sm',placeholder:'Weshalb?','aria-label':'Weshalb'})};
  const add=h('form',{class:'call-form',onsubmit:e=>{e.preventDefault();if(!f.who.value.trim())return;const text=`${f.who.value.trim()} anrufen${f.why.value.trim()?' wegen '+f.why.value.trim():''}${f.when.value.trim()?' ('+f.when.value.trim()+')':''}`;ctx.quickAdd('todo',text,{category:'call',minutes:15,contact:{who:f.who.value.trim(),when:f.when.value.trim(),why:f.why.value.trim()}});}},f.who,f.when,f.why,h('button',{class:'btn sm'},'＋'));
  const callRow=e=>{
    const c=e.contact||{};const isDone=e.status==='done';
    const edit=h('form',{class:'call-form',onsubmit:ev=>{ev.preventDefault();const [who,when,why]=[...ev.target.querySelectorAll('input')].map(i=>i.value.trim());ctx.patch(e.id,{contact:{who,when,why},title:`${who} anrufen${why?' wegen '+why:''}`});}},
      h('input',{class:'inp sm',value:c.who||'','aria-label':'Wer'}),h('input',{class:'inp sm',value:c.when||whenLabel(e),'aria-label':'Wann'}),h('input',{class:'inp sm',value:c.why||'','aria-label':'Weshalb'}),h('button',{class:'btn sm'},'Speichern'));
    return h('div',{class:`row call${isDone?' done':''}`},
      h('input',{type:'checkbox',class:'check',checked:isDone,'aria-label':'Erledigt',onchange:ev=>ctx.patch(e.id,ev.target.checked?{status:'done',done_at:new Date().toISOString()}:{status:'open',done_at:null})}),
      h('div',{class:'row-main'},h('div',{class:'call-grid'},
        h('span',{class:'who'},'☎ ',c.who||e.title),h('span',{class:'when'},c.when||whenLabel(e)||'—'),h('span',{class:'why'},c.why||'')),
        !c.who?h('span',{class:'muted sm'},e.title):null),
      h('div',{class:'row-actions'},entryDetails(e,ctx,{top:[h('span',{class:'lbl'},'Wer · Wann · Weshalb'),edit],label:'Anruf bearbeiten'})));
  };
  return h('section',{class:`panel pane${ui.todoPane==='calls'?' on':''}`},
    h('div',{class:'panel-head'},h('h2',{},'Anrufe'),h('span',{class:'count'},String(open.length))),
    h('div',{class:'call-grid call-legend'},h('span',{},'Wer'),h('span',{},'Wann'),h('span',{},'Weshalb')),
    open.length?open.map(callRow):empty('Keine Anrufe offen.'),add,
    snoozedSection(calls.filter(e=>isSnoozed(e)&&e.status!=='done'),ctx),
    done.length?h('details',{class:'done-list'},h('summary',{},`Erledigt (${done.length})`),done.slice(0,20).map(callRow)):null);
}

export function todoCounts(state){
  const todos=Object.values(state.entry).filter(e=>e.kind==='todo'&&e.status!=='hidden');
  const lists=activeLists(state);
  return {tasks:todos.filter(e=>!['shopping','call','list'].includes(e.category)&&e.status!=='done'&&!isSnoozed(e)).length,shopping:shoppingList(todos).filter(i=>!i.done).length,
    lists:lists.reduce((n,l)=>n+listItems(todos,l.id).filter(i=>!i.done).length,0),calls:todos.filter(e=>e.category==='call'&&e.status!=='done'&&!isSnoozed(e)).length};
}
export function renderTodos(root,ctx){
  const {state,ui}=ctx;
  const todos=Object.values(state.entry).filter(e=>e.kind==='todo'&&e.status!=='hidden');
  const counts=todoCounts(state);
  if(!ui.todoPane){ui.todoPane=counts.tasks||!(counts.shopping||counts.calls||counts.lists)?'tasks':counts.shopping?'shopping':counts.lists?'lists':'calls';}
  root.append(h('div',{class:'toolbar pane-tabs'},segmented([['tasks',`Aufgaben ${counts.tasks}`],['shopping',`Einkauf ${counts.shopping}`],['lists',`Listen ${counts.lists}`],['calls',`Anrufe ${counts.calls}`]],ui.todoPane||'tasks',k=>{ui.todoPane=k;ctx.rerender();})),
    h('div',{class:'panes cols4'},tasksPane(todos,ctx),shoppingPane(todos,ctx),listsPane(todos,ctx),callsPane(todos,ctx)));
}
