import { uuid } from './id.js';
export const entities = ['capture','entry','project','stock','dose','adjustment','attachment','list'];
export function operation(entity, entity_id, data, action = 'create') {
  return {id:uuid(),entity,entity_id,action,data,created_at:new Date().toISOString()};
}
export function projectState(operations) {
  const state = Object.fromEntries(entities.map(key => [key,{}]));
  const sorted = [...operations].sort((a,b) => {
    if (a.seq && b.seq) return a.seq - b.seq;
    if (a.seq) return -1; if (b.seq) return 1;
    return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
  });
  // Creates first: dependent patches are preserved even when devices upload out of order.
  for (const op of sorted) if (op.action === 'create' && state[op.entity] && !state[op.entity][op.entity_id]) {
    state[op.entity][op.entity_id] = {...op.data,id:op.entity_id,created_at:op.created_at};
  }
  for (const op of sorted) if (op.action === 'patch' && state[op.entity]?.[op.entity_id]) {
    const patch = {...op.data}; delete patch.id; delete patch.created_at;
    if (op.entity === 'capture') { delete patch.original_text; delete patch.attachments; }
    Object.assign(state[op.entity][op.entity_id],patch);
  }
  return state;
}
export function stockBalance(stock, state) {
  let total = Number(stock.initial) || 0;
  for (const row of Object.values(state.adjustment)) if (row.stock_id === stock.id && row.active !== false) total += (Number(row.amount) || 0) * (row.direction === 'out' ? -1 : 1);
  const days = new Set();
  for (const row of Object.values(state.dose)) if (row.stock_id === stock.id && row.active !== false && !days.has(row.day)) { days.add(row.day); total -= Number(row.amount) || 0; }
  return total;
}
export function localDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function nextOccurrence(entry, from = new Date()) {
  if (!entry.due_at) return null;
  const date = new Date(entry.due_at);
  if (!Number.isFinite(date.getTime())) return null;
  if (!['daily','weekly','biweekly','fourweekly','monthly'].includes(entry.recurrence)) return date;
  const originalDay = date.getDate();
  let limit = 0;
  while (date < from && limit++ < 10000) {
    if (entry.recurrence === 'monthly') { date.setDate(1); date.setMonth(date.getMonth()+1); const last = new Date(date.getFullYear(),date.getMonth()+1,0).getDate(); date.setDate(Math.min(originalDay,last)); }
    else date.setDate(date.getDate() + ({weekly:7,biweekly:14,fourweekly:28}[entry.recurrence] || 1));
  }
  return date;
}
export function entryDefaults(kind = 'idea') {
  return {kind,title:'',details:'',project_id:null,minutes:30,energy:'low',status:'open',position:0,facts:{},missing_fields:[],contact:{},due_at:null,recurrence:null,person:'me',category:'general',revisit_at:null,done_at:null,all_day:false};
}

// All occurrences of an entry inside [from,to). Non-recurring entries yield at most one date.
export function occurrences(entry, from, to) {
  if (!entry.due_at) return [];
  const start = new Date(entry.due_at); if (!Number.isFinite(start.getTime())) return [];
  const until = entry.until ? new Date(entry.until) : null;
  const skip = new Set(entry.skip_days || []);
  if (!['daily','weekly','biweekly','fourweekly','monthly'].includes(entry.recurrence)) return start >= from && start < to ? [start] : [];
  const out = []; let date = nextOccurrence(entry, from); let guard = 0;
  while (date && date < to && guard++ < 400) {
    if (until && date > until) break;
    if (!skip.has(localDay(date))) out.push(new Date(date));
    date = nextOccurrence(entry, new Date(date.getTime() + 60000));
  }
  return out;
}
export const LOW_STOCK = 30;
export function stockStatus(stock, state, today = localDay()) {
  const balance = stockBalance(stock, state);
  const perDay = Number(stock.daily) || 1;
  const takenToday = Object.values(state.dose).some(d => d.stock_id === stock.id && d.day === today && d.active !== false);
  const threshold = Number(stock.threshold) || LOW_STOCK;
  return {balance, perDay, takenToday, daysLeft: Math.floor(Math.max(balance,0) / perDay), low: balance <= threshold, threshold};
}
