const KEY = 'kompass.local.v1';
export function readCaptures(storage = localStorage) {
  const raw = storage.getItem(KEY);
  if (!raw) return [];
  const value = JSON.parse(raw);
  if (!Array.isArray(value) || value.some(x => !x.id || typeof x.original_text !== 'string')) throw new Error('Lokaler Speicher ist nicht lesbar. Bitte keine Daten überschreiben.');
  return value;
}
export function saveCapture(capture, storage = localStorage) {
  const all = readCaptures(storage);
  const next = [capture, ...all];
  storage.setItem(KEY, JSON.stringify(next));
  return next;
}
