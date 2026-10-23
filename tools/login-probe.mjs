// Headless login against Keycloak to inspect tokens (dev verification tool, Node 18+).
// Usage: node tools/login-probe.mjs [--otp] [--max-age N] [--acr 2] [--cookies file]
import crypto from 'node:crypto';
import fs from 'node:fs';
const ISS = process.env.IDP_ISSUER || 'http://localhost:8180/realms/stepup';
const CLIENT = 'app-react', REDIRECT = 'http://localhost:5300/cb';
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const jarFile = arg('--cookies');
const jar = new Map(jarFile && fs.existsSync(jarFile) ? JSON.parse(fs.readFileSync(jarFile)) : []);
const cookieHdr = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
function store(res) { for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)); } }
async function get(url, init = {}) { const r = await fetch(url, { redirect: 'manual', ...init, headers: { cookie: cookieHdr(), ...(init.headers || {}) } }); store(r); return r; }
function totp(secret) { // RFC 6238, HMAC-SHA1, secret is the raw ASCII seed stored in the realm
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac('sha1', secret).update(c).digest(); const o = h[19] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const q = new URLSearchParams({ client_id: CLIENT, redirect_uri: REDIRECT, response_type: 'code', scope: 'openid', state: 's', nonce: 'n', code_challenge: challenge, code_challenge_method: 'S256' });
if (arg('--acr')) q.set('acr_values', arg('--acr'));
if (arg('--max-age')) q.set('max_age', arg('--max-age'));
let r = await get(`${ISS}/protocol/openid-connect/auth?${q}`);
let loc = r.headers.get('location'), html = r.status === 200 ? await r.text() : '';
for (let i = 0; i < 6 && !(loc && loc.startsWith(REDIRECT)); i++) {
  if (loc) { r = await get(new URL(loc, ISS).href); loc = r.headers.get('location'); html = r.status === 200 ? await r.text() : ''; continue; }
  const action = /action="([^"]+)"/.exec(html)?.[1].replaceAll('&amp;', '&');
  if (!action) throw new Error('no form found: ' + html.slice(0, 300));
  const body = new URLSearchParams();
  if (html.includes('name="password"')) { body.set('username', 'alice'); body.set('password', 'alice-dev-only'); }
  else if (html.includes('name="otp"')) body.set('otp', totp('12345678901234567890'));
  else throw new Error('unknown form: ' + html.slice(0, 300));
  r = await get(action, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
  loc = r.headers.get('location'); html = r.status === 200 ? await r.text() : '';
}
if (jarFile) fs.writeFileSync(jarFile, JSON.stringify([...jar]));
if (!loc?.startsWith(REDIRECT)) throw new Error('did not reach redirect: ' + html.slice(0, 300));
const code = new URL(loc).searchParams.get('code');
const t = await (await fetch(`${ISS}/protocol/openid-connect/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: CLIENT, redirect_uri: REDIRECT, code, code_verifier: verifier }) })).json();
const dec = (j) => JSON.parse(Buffer.from(j.split('.')[1], 'base64url'));
const a = dec(t.access_token), id = dec(t.id_token);
if (process.argv.includes('--token')) { console.log(t.access_token); process.exit(0); }
console.log(JSON.stringify({ access: { acr: a.acr, auth_time: a.auth_time, aud: a.aud, iss: a.iss, exp: a.exp, iat: a.iat }, id: { acr: id.acr, auth_time: id.auth_time, nonce: id.nonce } }, null, 1));
