import {h,kindPatch,displayTitle,VIEW_OF,KIND_ICON,whenLabel,dayLabel,timeLabel,empty,isSnoozed} from '../ui.js';
import {kindNames,localSort,normalize} from '../domain/sort.js';
import {occurrences,stockStatus,localDay} from '../domain/state.js';
import {shoppingList,listItems,activeLists} from './todos.js';
import {nextPerBin} from '../domain/ics.js';

// Archive of originals: collapsed unless opened in this session or a search is active.
export const inboxArchiveOpen=ui=>!!ui.inboxOpen||!!(ui.search||'').trim();

// Re-evaluates an entry that still waits in "Kurz klären" with the current (sharper) local rules.
// Returns a ready patch only when the new result is unambiguous; nothing is applied silently.
export function reviewSuggestion(entry,state,settings={}){
  const text=entry.details||entry.title||'';if(!text.trim())return null;
  const people={partner:settings.partner,kids:String(settings.kids||'').split(',').map(x=>x.trim()).filter(Boolean)};
  const [p]=localSort(text,Object.values(state.project),{now:new Date(entry.created_at||Date.now()),people,lists:Object.values(state.list||{}).filter(l=>!l.archived)});
  if(!p||p.uncertain)return null;
  const project=p.project?Object.values(state.project).find(x=>normalize(x.title)===normalize(p.project)):null;
  const patch={kind:p.kind,category:p.category,title:p.title,minutes:p.minutes,energy:p.energy,person:p.person,needs_review:false};
  if(p.due_at)Object.assign(patch,{due_at:p.due_at,all_day:p.all_day,recurrence:p.recurrence||null});
  if(project)patch.project_id=project.id;
  if(p.items)patch.items=p.items;if(p.contact)patch.contact=p.contact;
  if(p.category==='list'){const l=Object.values(state.list||{}).find(x=>normalize(x.title)===normalize(p.list));if(!l)return null;patch.list_id=l.id;}
  const label=[kindNames[p.kind].split(' ')[0],project?.title,p.due_at?whenLabel({due_at:p.due_at,all_day:p.all_day}):''].filter(Boolean).join(' · ');
  return {patch,label};
}

// Ideas & strands at a glance: open ideas, active strands and the next step of the most recently touched strand.
export function ideasSummary(state){
  const open=Object.values(state.entry).filter(e=>e.kind==='idea'&&e.status!=='done'&&e.status!=='hidden'&&!isSnoozed(e));
  const strands=Object.values(state.project).filter(p=>!p.archived&&!isSnoozed(p)).map(p=>{
    const steps=Object.values(state.entry).filter(e=>e.project_id===p.id&&e.status!=='done'&&e.status!=='hidden'&&!isSnoozed(e)).sort((a,b)=>(a.position??50)-(b.position??50)||a.created_at.localeCompare(b.created_at));
    const last=Object.values(state.entry).filter(e=>e.project_id===p.id).reduce((m,e)=>e.created_at>m?e.created_at:m,p.created_at||'');
    return {project:p,next:steps[0]||null,open:steps.length,last};
  }).filter(x=>x.open).sort((a,b)=>b.last.localeCompare(a.last));
  const loose=open.filter(e=>!e.project_id).length;
  return {count:open.length,strands,loose};
}

function tile(label,value,sub,onclick,cls=''){
  return h('button',{type:'button',class:`tile ${cls}`,onclick},h('span',{class:'tile-label'},label),h('strong',{},value),h('span',{class:'tile-sub'},sub));
}
export function overview(ctx){
  const {state}=ctx;const entries=Object.values(state.entry).filter(e=>e.status!=='hidden');
  const review=entries.filter(e=>e.needs_review&&e.status!=='done');
  const todos=entries.filter(e=>e.kind==='todo'&&e.status!=='done'&&!isSnoozed(e));
  const quick=todos.filter(e=>e.minutes===15&&!['shopping','call','list'].includes(e.category)).length;
  const now=new Date(),soon=new Date(now.getTime()+14*864e5);
  const next=entries.filter(e=>e.kind==='event'&&e.status!=='done').flatMap(e=>occurrences(e,new Date(now.getFullYear(),now.getMonth(),now.getDate()),soon).map(d=>({e,d}))).sort((a,b)=>a.d-b.d)[0];
  const stock=Object.values(state.stock).find(s=>!s.archived);const st=stock&&stockStatus(stock,state);
  const tasks=todos.filter(e=>!['shopping','call','list'].includes(e.category));
  const shop=shoppingList(entries.filter(e=>e.kind==='todo')).filter(i=>!i.done);
  const lists=activeLists(state).map(l=>({l,n:listItems(entries,l.id).filter(i=>!i.done).length}));
  const bins=nextPerBin(entries.filter(e=>e.kind==='event'&&e.category==='trash'&&e.due_at),new Date(now.getFullYear(),now.getMonth(),now.getDate()));
  // Calm start page: one tile per area that has something, each jumps straight to its list.
  const grid=h('div',{class:'tiles'},
    review.length?tile('Kurz klären',String(review.length),'Zuordnung wählen',()=>document.getElementById('review')?.scrollIntoView({behavior:'smooth'}),'warn'):null,
    tile('Nächster Termin',next?`${dayLabel(next.d)}${next.e.all_day?'':' '+timeLabel(next.d)}`:'—',next?displayTitle(next.e,state):'keine in 14 Tagen',()=>ctx.navigate('events','agenda')),
    tile('To-dos',String(tasks.length),tasks.length?`${quick} × 15 Min.`:'nichts offen',()=>ctx.navigate('todos','tasks')),
    tile('Einkauf',String(shop.length),shop.length?shop.slice(0,3).map(i=>i.name).join(', '):'Liste ist leer',()=>ctx.navigate('todos','shopping')),
    lists.length?tile('Listen',String(lists.reduce((n,x)=>n+x.n,0)),lists.map(x=>`${x.l.title} ${x.n}`).join(' · '),()=>ctx.navigate('todos','lists')):null,
    bins.length?tile('Müll',dayLabel(bins[0].date),bins.slice(0,2).map(b=>`${b.bin}${b===bins[0]?'':' '+dayLabel(b.date)}`).join(' · '),()=>ctx.navigate('events','trash'),localDay(bins[0].date)===localDay(new Date(now.getTime()+864e5))?'warn':''):null,
    (()=>{const ideas=ideasSummary(state);const top=ideas.strands[0];
      const sub=top?`${top.project.title} → ${displayTitle(top.next,state)}`:ideas.loose?`${ideas.loose} lose Idee${ideas.loose===1?'':'n'}`:'noch nichts offen';
      const extra=[ideas.strands.length?`${ideas.strands.length} Str${ideas.strands.length===1?'ang':'änge'}`:'',ideas.loose&&top?`${ideas.loose} lose`:''].filter(Boolean).join(' · ');
      return tile('Ideen & Projekte',String(ideas.count),extra?`${sub} · ${extra}`:sub,()=>ctx.navigate('ideas'),'ideas');})(),
    st?tile('Tabletten',String(st.balance),st.low?'Rezept anfordern':`≈ ${st.daysLeft} Tage`,()=>ctx.navigate('meds'),st.low?'warn':''):null);
  // Two-column phone grid without holes: an unpaired half tile takes the full row.
  const half=[...grid.children].filter(t=>!t.classList.contains('ideas'));
  if(half.length%2)half.at(-1).classList.add('wide');
  return grid;
}

export function renderInbox(root,ctx){
  const {state,ui}=ctx;
  const entries=Object.values(state.entry).filter(e=>e.status!=='hidden');
  const review=entries.filter(e=>e.needs_review&&e.status!=='done');
  let captures=Object.values(state.capture).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const q=(ui.search||'').trim().toLocaleLowerCase('de');
  if(q)captures=captures.filter(c=>c.original_text.toLocaleLowerCase('de').includes(q));
  const unsorted=captures.filter(c=>!c.linked_lists?.length&&!Object.values(state.entry).some(e=>e.capture_id===c.id));

  const reviewBox=h('section',{class:'panel',id:'review'},
    h('div',{class:'panel-head'},h('h2',{},'Kurz klären'),h('span',{class:'count'},String(review.length)),
      (()=>{const all=review.map(e=>[e.id,reviewSuggestion(e,state,ctx.settings)]).filter(([,x])=>x);return all.length>1?h('button',{type:'button',class:'btn sm',onclick:()=>ctx.patchMany(all.map(([id,x])=>[id,x.patch]))},`✓ ${all.length} Vorschläge übernehmen`):null;})()),
    review.length?review.map(e=>{const sug=reviewSuggestion(e,state,ctx.settings);return h('div',{class:'review-row'},
      h('div',{class:'row-title',title:e.title},displayTitle(e,state)),
      sug?h('button',{type:'button',class:'btn sm suggest',title:'Vorschlag übernehmen (später über „…“ änderbar)',onclick:()=>ctx.patch(e.id,sug.patch)},'✓ ',sug.label):null,
      h('div',{class:'quick-kinds'},Object.entries(kindNames).map(([k,l])=>h('button',{type:'button',class:`kbtn${e.kind===k?' on':''}`,title:l,onclick:()=>ctx.patch(e.id,kindPatch(e,k))},KIND_ICON[k],' ',l.split(' ')[0])),
        Object.keys(state.project).length?h('select',{class:'mini-select','aria-label':'Strang zuordnen',onchange:ev=>{if(ev.target.value)ctx.patch(e.id,{project_id:ev.target.value,kind:'idea',needs_review:false});}},h('option',{value:''},'◇ Strang…'),Object.values(state.project).map(p=>h('option',{value:p.id},p.title))):null));}):
      empty('Nichts offen. Neue Gedanken werden automatisch einsortiert; nur Unklares landet hier.'));

  // The archive of original texts is collapsed by default (session-only state) so the start
  // page stays calm; searching keeps it open.
  const total=Object.keys(state.capture).length;
  const open=inboxArchiveOpen(ui);
  const toggle=h('button',{type:'button',class:'archive-toggle','aria-expanded':String(open),'aria-controls':'inbox-archive',onclick:()=>{ui.inboxOpen=!open;if(open)ui.search='';ctx.rerender();}},
    h('span',{class:'chev'},open?'▾':'▸'),open?'Eingänge ausblenden':`Letzte Eingänge (${total}) anzeigen`,
    !open&&captures[0]?h('span',{class:'muted sm last'},' · zuletzt ',new Date(captures[0].created_at).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'})):null);
  const list=h('section',{class:`panel archive${open?' open':''}`},
    h('div',{class:'panel-head'},toggle,
      unsorted.length?h('button',{type:'button',class:'btn sm',onclick:()=>ctx.sortAll(unsorted)},`${unsorted.length} sortieren`):null),
    open?h('div',{id:'inbox-archive',class:'archive-body'},
    h('input',{type:'search',class:'search wide',placeholder:'Originaltexte durchsuchen …','aria-label':'Gedanken durchsuchen',value:ui.search||'',oninput:e=>{ui.search=e.target.value;ctx.rerender({keepFocus:'search'});}}),
    captures.length?captures.map(c=>{
      const linked=Object.values(state.entry).filter(e=>e.capture_id===c.id).sort((a,b)=>(a.source_start??0)-(b.source_start??0)||a.created_at.localeCompare(b.created_at));
      const long=c.original_text.length>220||c.original_text.split('\n').length>4;
      // Lists this thought created or filled ("Füge eine Liste hinzu für die Tasche" creates no to-do).
      const lists=(c.linked_lists||[]).map(id=>state.list?.[id]).filter(Boolean);
      const done=linked.length||lists.length;
      return h('article',{class:'capture-item'},
        h('div',{class:'cap-head'},h('time',{datetime:c.created_at},new Date(c.created_at).toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'})),
          h('span',{class:'chip'},done?`${linked.length?`${linked.length} Einträge`:`${lists.length} Liste${lists.length===1?'':'n'}`} · ${c.sort_source==='gemini'?'Gemini':c.sort_source==='manual'?'direkt':'lokal'}`:'noch unsortiert')),
        h('pre',{class:long?'clamp':'',onclick:e=>e.currentTarget.classList.toggle('clamp'),title:long?'Antippen für vollständigen Text':null},c.original_text),
        done?h('div',{class:'links'},lists.filter(l=>!linked.some(e=>e.list_id===l.id)).map(l=>h('button',{type:'button',class:'link-chip',onclick:()=>{ctx.ui.listId=l.id;ctx.navigate('todos','lists');},title:'Liste'},'☰ ',l.title)),
          linked.filter(e=>e.status!=='hidden').map(e=>h('button',{type:'button',class:`link-chip${e.status==='done'?' done':''}${e.needs_review?' warn':''}`,onclick:()=>{if(e.list_id)ctx.ui.listId=e.list_id;ctx.navigate(VIEW_OF[e.kind],e.category==='list'?'lists':e.category==='shopping'?'shopping':undefined);},title:e.category==='list'&&state.list?.[e.list_id]?`Liste ${state.list[e.list_id].title}`:kindNames[e.kind]},e.category==='list'?'☰':KIND_ICON[e.kind],' ',displayTitle(e,state).slice(0,48),e.category==='list'&&state.list?.[e.list_id]?` → ${state.list[e.list_id].title}`:'',e.due_at?` · ${whenLabel(e)}`:''))):
          h('button',{type:'button',class:'btn sm',onclick:()=>ctx.sortAll([c])},'Jetzt sortieren'));
    }):empty(q?'Kein Gedanke passt zur Suche.':'Hier ist Platz für alles, was dich beschäftigt. Der Originaltext bleibt immer vollständig erhalten.')):null);

  // "Kurz klären" only appears when something is genuinely unclear; the tile already says "alles zugeordnet".
  root.append(overview(ctx),h('div',{class:`cols inbox-cols${review.length?'':' single'}`},review.length?reviewBox:null,list));
}
