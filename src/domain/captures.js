import { uuid } from './id.js';
export function createCapture(text, id = uuid(), now = new Date().toISOString()) {
  if (!text.trim()) throw new Error('Bitte erst einen Gedanken eingeben.');
  return { id, owner_id: null, original_text: text, created_at: now, sorting_status: 'pending' };
}
export function needsRefill(remaining, threshold = 30) { return remaining <= threshold; }
