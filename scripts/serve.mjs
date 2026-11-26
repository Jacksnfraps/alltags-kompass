import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
import { networkInterfaces } from 'node:os';
import { loadConfig } from './config.mjs';
import {createSorter} from './gemini.mjs';
const config = await loadConfig(new URL('../',import.meta.url));
const portArg = process.argv.indexOf('--port');
if (portArg > -1 && Number(process.argv[portArg+1])) config.port = Number(process.argv[portArg+1]);
const sorter=createSorter(config);
const root = fileURLToPath(new URL('../', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png'};
const sameOrigin = req => { const origin=req.headers.origin; try { return req.method==='POST' && req.headers['x-kompass-token']===sorter.token && origin && new URL(origin).host===req.headers.host; } catch { return false; } };
async function readJson(req,res,max){ let size=0; const chunks=[]; for await (const chunk of req){ size+=chunk.length; if(size>max){ res.writeHead(413); res.end(); return null; } chunks.push(chunk); } try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { res.writeHead(400); res.end(); return null; } }
const PRIVATE_HOST=/^(?:localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|\[?f[cd][0-9a-f]{2}:)/i;
async function fetchCalendar(raw){
  let url;try{url=new URL(String(raw||'').trim().replace(/^webcal:\/\//i,'https://'));}catch{return {ok:false,status:400,error:'Ungültige Adresse'};}
  if(!/^https?:$/.test(url.protocol)||PRIVATE_HOST.test(url.hostname))return {ok:false,status:400,error:'Nur öffentliche http(s)-/webcal-Adressen'};
  try{
    const response=await fetch(url,{headers:{Accept:'text/calendar, text/plain, */*','User-Agent':'Kompass-PWA (lokal)'},signal:AbortSignal.timeout(12000),redirect:'follow'});
    if(!response.ok)return {ok:false,status:502,error:`Kalender antwortet mit ${response.status}`};
    const text=(await response.text()).slice(0,2_000_000);
    if(!/BEGIN:VCALENDAR/i.test(text))return {ok:false,status:422,error:'Adresse liefert keine iCal-Daten'};
    return {ok:true,text};
  }catch{return {ok:false,status:504,error:'Kalender nicht erreichbar'};}
}
const server = createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (pathname === '/api/config') {
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(JSON.stringify({supabaseUrl:config.supabaseUrl,supabaseKey:config.supabaseKey,aiEnabled:sorter.enabled,sortToken:sorter.token}));
      return;
    }
    // /api/parse: intent parsing with list/project context. /api/sort stays as alias for older clients.
    if(pathname === '/api/parse' || pathname === '/api/sort'){
      if(!sameOrigin(req)){res.writeHead(403);res.end();return;}
      const payload=await readJson(req,res,120000);if(!payload)return;
      if(typeof payload.text!=='string'||!payload.text.trim()||payload.text.length>16000){res.writeHead(400);res.end();return;}
      const result=await sorter.sort(payload.text,{lists:payload.lists,projects:payload.projects});res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(result));return;
    }
    if(pathname === '/api/shiftplan'){
      if(!sameOrigin(req)){res.writeHead(403);res.end();return;}
      const payload=await readJson(req,res,6_000_000);if(!payload)return;
      if(typeof payload.image!=='string'||!['image/jpeg','image/png','image/webp'].includes(payload.mime||'')){res.writeHead(400);res.end();return;}
      const result=await sorter.readShiftPlan(payload.image,payload.mime,Number(payload.year)||new Date().getFullYear(),typeof payload.name==='string'?payload.name:'');
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(result));return;
    }
    if(pathname === '/api/ics'){
      // Fetches a waste-collection calendar for the browser (CORS). Same-origin + token, size and time limits.
      if(!sameOrigin(req)){res.writeHead(403);res.end();return;}
      const payload=await readJson(req,res,4000);if(!payload)return;
      const result=await fetchCalendar(payload.url);
      res.writeHead(result.ok?200:result.status,{'Content-Type':result.ok?'text/calendar; charset=utf-8':'application/json; charset=utf-8','Cache-Control':'no-store'});
      res.end(result.ok?result.text:JSON.stringify({error:result.error}));return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const allowed = relative === 'index.html' || relative === 'sw.js' || relative === 'icon.svg' || relative === 'icon-180.png' || relative === 'icon-512.png' || relative === 'manifest.webmanifest' || relative.startsWith('src/');
    const file = resolve(root,relative);
    if (!allowed || !file.startsWith(resolve(root)+sep)) { res.writeHead(404); res.end(); return; }
    const content = await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)] || 'text/plain','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}); res.end(content);
  } catch { res.writeHead(404); res.end('Nicht gefunden'); }
}).listen(config.port,'0.0.0.0',() => {
  const port = server.address().port;
  console.log(`Kompass auf diesem PC: http://localhost:${port}`);
  for (const addresses of Object.values(networkInterfaces())) for (const address of addresses || []) {
    if (address.family === 'IPv4' && !address.internal) console.log(`iPhone im selben WLAN: http://${address.address}:${port}`);
  }
  console.log('Fenster offen lassen. Windows-Firewall nur für private Netzwerke zulassen.');
  console.log('Heimnetz-HTTP: normaler Browser-Test. Installation/Offline-PWA benötigt HTTPS.');
});
