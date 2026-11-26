import {kindNames} from './domain/sort.js';
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
export function renderEntries(content,state,view,onUpdate){
  const kind={ideas:'idea',todos:'todo',events:'event',meds:'medication'}[view];
  const entries=Object.values(state.entry).filter(e=>e.kind===kind);
  if(!entries.length){content.append(el('p','Noch keine passenden Gedanken. Neue Eingaben werden automatisch lokal sortiert.','notice'));return;}
  const groups=new Map();for(const entry of entries){const key=entry.project_id||'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(entry);}
  for(const [projectId,rows] of groups){
    const section=el('section','','sort-group');
    section.append(el('h3',state.project[projectId]?.title||'Einzelne Gedanken'));
    const all=projectId?Object.values(state.entry).filter(e=>e.project_id===projectId):rows;
    const facts=[...new Set(all.flatMap(e=>Object.values(e.facts||{})))];
    if(facts.length)section.append(el('p',`Maße & Eckdaten: ${facts.join(' · ')}`,'sort-facts'));
    const checks=[...new Set(all.flatMap(e=>e.missing_fields||[]))];
    if(checks.length)section.append(el('p',`Noch zu prüfen: ${checks.join(' · ')}`,'sort-check'));
    for(const entry of rows.sort((a,b)=>a.position-b.position||a.created_at.localeCompare(b.created_at))){
      const card=el('article','','entry card');card.append(el('h3',entry.title),el('p',entry.details));
      card.append(el('span',`${entry.minutes} Min. · ${entry.energy==='high'?'Fokus':'Wenig Energie'} · Schätzung`,'tag'));
      const details=el('details','','sort-original');details.append(el('summary','Vollständiges Original ansehen'),el('pre',state.capture[entry.capture_id]?.original_text||'Original noch nicht synchronisiert.'));card.append(details);
      const edit=el('details','','sort-edit');if(entry.needs_review)edit.open=true;
      edit.append(el('summary',entry.needs_review?'Zuordnung noch unklar – einmal auswählen':'Zuordnung ändern'));
      const type=el('select');type.setAttribute('aria-label','Bereich');
      for(const [key,label] of Object.entries(kindNames)){const option=el('option',label);option.value=key;option.selected=entry.kind===key;type.append(option);}
      const project=el('select');project.setAttribute('aria-label','Projekt');
      const none=el('option','Kein Projekt');none.value='';project.append(none);
      for(const p of Object.values(state.project)){const option=el('option',p.title);option.value=p.id;option.selected=entry.project_id===p.id;project.append(option);}
      const apply=el('button','Übernehmen','secondary');apply.type='button';apply.addEventListener('click',()=>onUpdate(entry.id,{kind:type.value,project_id:project.value||null,needs_review:false}));
      edit.append(type,project,apply);card.append(edit);section.append(card);
    }content.append(section);
  }
}
