// Builds dist/ for free static hosting (GitHub Pages, Cloudflare Pages, Netlify Drop …) so the app works
// from anywhere (mobile data/5G) – without a running laptop. Only PUBLIC values end up in config.json:
// the Supabase project URL and the publishable/anon key (both are meant to be public; RLS protects data).
// Never a Gemini key here: with the own key from the account settings (v0.6.0) the browser calls Gemini directly.
import {cp,mkdir,rm,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadConfig} from './config.mjs';

const root=new URL('../',import.meta.url);
const out=new URL('../dist/',import.meta.url);
const config=await loadConfig(root);
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const file of ['index.html','sw.js','manifest.webmanifest','icon.svg','icon-180.png','icon-512.png'])await cp(new URL(file,root),new URL(file,out));
await cp(new URL('src/',root),new URL('src/',out),{recursive:true});
const pub={supabaseUrl:config.supabaseUrl,supabaseKey:config.supabaseKey,aiEnabled:false,sortToken:'',hosted:true,requireLogin:config.requireLogin&&!!config.supabaseUrl};
await writeFile(new URL('config.json',out),JSON.stringify(pub,null,2)+'\n');
// GitHub Pages: no Jekyll processing. Cloudflare Pages/Netlify: app files always revalidated (updates arrive at once).
await writeFile(new URL('.nojekyll',out),'');
await writeFile(new URL('_headers',out),'/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n/sw.js\n  Cache-Control: no-cache\n/config.json\n  Cache-Control: no-cache\n/src/*\n  Cache-Control: no-cache\n');
// A deploy is only complete when every manifest file is present, including nested src/data files.
const hashes={};
async function audit(dir,prefix=''){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const name=prefix+entry.name;const url=new URL(entry.name+(entry.isDirectory()?'/':''),dir);
    if(entry.isDirectory()){await audit(url,name+'/');continue;}
    let bytes=await readFile(url);
    if(/\.(?:js|mjs|ts|css|html|json|svg|webmanifest)$/.test(name)||name==='_headers'){
      bytes=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'));
      await writeFile(url,bytes);
    }
    const text=bytes.toString('utf8');
    if(entry.name.startsWith('.env')||/AIza[0-9A-Za-z_-]{35}/.test(text)||(config.geminiKey&&text.includes(config.geminiKey)))throw new Error(`Secret-Prüfung fehlgeschlagen: ${name}`);
    hashes[name]=createHash('sha256').update(bytes).digest('hex');
  }
}
await audit(out);
const sw=await readFile(new URL('sw.js',out),'utf8');
for(const [,asset] of sw.matchAll(/'\.\/([^']+)'/g))if(!(asset in hashes))throw new Error(`Offline-Datei fehlt: ${asset}`);
const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
const buildId=createHash('sha256').update(JSON.stringify(hashes)).digest('hex').slice(0,16);
await writeFile(new URL('build-info.json',out),JSON.stringify({version:pkg.version,buildId,files:hashes},null,2)+'\n');
console.log(`Build ${pkg.version} / ${buildId}: ${Object.keys(hashes).length} Dateien geprüft, keine Gemini-Secrets.`);
console.log(`Statische Version erstellt: ${fileURLToPath(out)}`);
if(!config.supabaseUrl)console.log('Hinweis: Ohne SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY in .env läuft die gehostete Version nur im Gastmodus (Daten nur auf dem jeweiligen Gerät, kein Login).');
else console.log(`Supabase: ${config.supabaseUrl} · Anmeldung ${pub.requireLogin?'wird beim Start angeboten':'optional'}.`);
console.log('Ordner "dist" bei einem kostenlosen Static-Hosting hochladen (siehe EINRICHTUNG.md → „Von unterwegs nutzen“).');
