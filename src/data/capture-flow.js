import {uuid} from '../domain/id.js';
import {operation} from '../domain/state.js';

// A failed sort must never turn a successful original save into a failed save.
export async function saveAndSort(store,text,sort,onSaved=()=>{}){
  if(!text.trim())throw new Error('Bitte erst einen Gedanken eingeben.');
  const capture={id:uuid(),original_text:text};
  await store.commit([operation('capture',capture.id,{original_text:text,sorting_status:'pending'})]);
  // Presentation failures must not prevent the automatic sorting attempt.
  try{await onSaved(capture);}catch{/* The original is durable; sorting still proceeds. */}
  try{return {capture,sorted:true,source:await sort(capture,store)};}
  catch{return {capture,sorted:false,source:null};}
}
