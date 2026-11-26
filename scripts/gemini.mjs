import {randomBytes} from 'node:crypto';
import {createGemini,cleanNames} from '../src/data/gemini.js';

// Optional Gemini gateway of the local server (key from .env, stays on the server).
// The logic itself lives in src/data/gemini.js and is shared with the browser, which uses it
// with the user's own key from the account settings (v0.6.0).
export {cleanNames};
export function createSorter(config,fetcher=fetch,clock=()=>Date.now()){
  return {...createGemini(config,fetcher,clock),token:randomBytes(24).toString('hex')};
}
