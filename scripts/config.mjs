import { readFile } from 'node:fs/promises';
export async function loadConfig(root) {
  let content='';
  try{content=await readFile(new URL('.env',root),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  const file={};
  for(const line of content.split(/\r?\n/)){const match=line.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/);if(match)file[match[1]]=match[2].replace(/^(['"])(.*)\1$/,'$2');}
  const env={...file,...process.env};
  const supabaseUrl=(env.SUPABASE_URL||'').replace(/\/$/,'');const supabaseKey=env.SUPABASE_PUBLISHABLE_KEY||'';
  if(supabaseUrl&&!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl))throw new Error('SUPABASE_URL muss eine https://…supabase.co-Projektadresse sein.');
  if(supabaseKey.startsWith('sb_secret_'))throw new Error('Nur Publishable-/anon-Key erlaubt.');
  if(supabaseKey.startsWith('ey')){const payload=JSON.parse(Buffer.from(supabaseKey.split('.')[1],'base64url'));if(payload.role!=='anon')throw new Error('Kein Service-Role-Key im Browser erlaubt.');}
  return {supabaseUrl,supabaseKey,geminiKey:env.GEMINI_API_KEY||'',model:env.GEMINI_MODEL||'gemini-2.5-flash-lite',freeOnly:env.GEMINI_FREE_TIER_CONFIRMED==='true',dailyLimit:Number(env.GEMINI_DAILY_LIMIT||100),requireLogin:env.KOMPASS_REQUIRE_LOGIN!=='false',port:Number(env.PORT||4173)};
}
