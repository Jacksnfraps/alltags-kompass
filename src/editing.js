// Calm re-rendering while the user types (v0.6.1).
// The view is rebuilt from state on every change. That must never cost input:
//  - Background refreshes (sync every 30 s, realtime, app back in front, 5-min clock) wait while a
//    field in the view has focus or holds unsaved typing ("dirty", for at most DIRTY_MS).
//  - A re-render caused by the user's own action keeps the form being typed in as it is (the same
//    DOM node, so focus and the iPhone keyboard stay) and rebuilds everything around it.
//  - Unsaved typing in other forms is carried over into the rebuilt view.
//  - After "＋"/Enter in an add form (.add-step) the field is emptied and keeps focus, so the next
//    item can be typed right away.
export const DIRTY_MS=3*60*1000;
const TEXTISH=/^(?:text|search|email|url|tel|number|date|time|datetime-local|month|week|password|)$/;
export function isField(el){
  if(!el||!el.tagName)return false;
  if(el.tagName==='TEXTAREA'||el.tagName==='SELECT')return true;
  return el.tagName==='INPUT'&&TEXTISH.test(el.type||'');
}
// Stable identity of a node inside root: chain of tag/class/label signatures plus position among
// siblings with the same signature. Survives rows being added elsewhere in most cases.
const sigOf=n=>`${n.tagName}.${n.getAttribute('class')||''}[${n.getAttribute('name')||n.getAttribute('aria-label')||n.getAttribute('placeholder')||''}]`;
export function keyOf(el,root){
  const parts=[];
  for(let n=el;n&&n!==root;n=n.parentElement){
    const sig=sigOf(n);let i=0;
    for(let s=n.previousElementSibling;s;s=s.previousElementSibling)if(sigOf(s)===sig)i++;
    parts.unshift(`${sig}#${i}`);
  }
  return parts;
}
export function findByKey(root,parts){
  let n=root;
  for(const part of parts){
    const cut=part.lastIndexOf('#');const sig=part.slice(0,cut),index=Number(part.slice(cut+1));
    let i=0,hit=null;
    for(const c of n.children)if(sigOf(c)===sig){if(i===index){hit=c;break;}i++;}
    if(!hit)return null;n=hit;
  }
  return n;
}
const isDirty=(el,now)=>el.dataset.dirty&&now-Number(el.dataset.dirty)<DIRTY_MS;

export function createEditGuard(getRoot,clock=()=>Date.now()){
  let pending=false;
  const guard={
    // True while the user is typing in the view: focused field, or unsaved typing in a form.
    editing(){
      const root=getRoot();if(!root)return false;
      const a=root.ownerDocument.activeElement;
      if(a&&root.contains(a)&&isField(a))return true;
      const now=clock();
      return [...root.querySelectorAll('[data-dirty]')].some(el=>isDirty(el,now));
    },
    // Background refresh: render now, or remember it for when typing is done.
    defer(){if(guard.editing()){pending=true;return true;}pending=false;return false;},
    get pending(){return pending;},
    take(){const p=pending;pending=false;return p;},
    markInput(ev){
      const el=ev.target,root=getRoot();
      if(root&&root.contains(el)&&isField(el)&&el.type!=='search'&&el.closest('form'))el.dataset.dirty=String(clock());
    },
    // Runs after the form's own submit handler (document bubbling phase).
    afterSubmit(ev){
      const form=ev.target,root=getRoot();if(!root||!root.contains(form))return;
      for(const el of form.querySelectorAll('[data-dirty]'))delete el.dataset.dirty;
      form.dataset.submitted='1';
      if(form.classList.contains('add-step'))for(const el of form.querySelectorAll('input'))if(isField(el)&&el.type!=='number')el.value='';
    },
    // Replaces root's content with next while keeping the form (or field) being typed in.
    swap(root,next){
      const doc=root.ownerDocument,now=clock();
      // 1) unsaved typing elsewhere -> same field in the new view
      const focused=doc.activeElement&&root.contains(doc.activeElement)&&isField(doc.activeElement)?doc.activeElement:null;
      let island=focused?(focused.closest('form')||focused):null;
      if(island&&!root.contains(island))island=focused;
      // A submitted non-add form (e.g. "Speichern") is rebuilt fresh; focus moves to its new twin.
      if(island?.dataset?.submitted&&!island.classList.contains('add-step'))island=null;
      for(const el of root.querySelectorAll('[data-dirty]')){
        if(!isDirty(el,now)||(island&&island.contains(el)))continue;
        const twin=findByKey(next,keyOf(el,root));
        if(twin&&isField(twin)&&twin.tagName===el.tagName){twin.value=el.value;twin.dataset.dirty=el.dataset.dirty;}
      }
      if(island)delete island.dataset.submitted;
      const twin=island?findByKey(next,keyOf(island,root)):null;
      if(!island||!twin||twin.tagName!==island.tagName){
        const key=focused?keyOf(focused,root):null;
        root.replaceChildren(...next.childNodes);root.className=next.className;
        if(key){const again=findByKey(root,key);if(again&&isField(again)){try{again.focus({preventScroll:true});}catch{/* best effort */}}}
        return false;
      }
      // 2) keep the island node: rebuild every ancestor level around it without detaching it
      //    (detaching would blur the field and close the iPhone keyboard).
      const oldChain=[],newChain=[];
      for(let n=island;n!==root;n=n.parentElement)oldChain.unshift(n);
      for(let n=twin;n!==next;n=n.parentElement)newChain.unshift(n);
      let oldParent=root,newParent=next;
      for(let level=0;level<oldChain.length;level++){
        const keep=oldChain[level],skip=newChain[level];
        if(level>0)syncAttributes(oldParent,newParent);
        for(const c of [...oldParent.childNodes])if(c!==keep)c.remove();
        const kids=[...newParent.childNodes];const at=kids.indexOf(skip);
        for(const c of kids.slice(0,at))keep.before(c);
        let after=keep;for(const c of kids.slice(at+1)){after.after(c);after=c;}
        oldParent=keep;newParent=skip;
      }
      root.className=next.className;
      return true;
    }
  };
  return guard;
}
function syncAttributes(target,source){
  for(const {name} of [...target.attributes])if(!source.hasAttribute(name)&&name!=='open')target.removeAttribute(name);
  for(const {name,value} of [...source.attributes])if(target.getAttribute(name)!==value)target.setAttribute(name,value);
}
