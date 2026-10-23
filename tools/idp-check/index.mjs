// IdP capability probe: compares the IdP's discovery document with what the chosen profile expects.
// Usage: node tools/idp-check/index.mjs [--issuer URL] [--profile name]
// Discovery metadata is NOT proof (some IdPs under-report); the final check is docs/manual-checks.md.
import fs from 'node:fs';
import path from 'node:path';
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const issuer = (arg('--issuer', process.env.IDP_ISSUER || 'http://localhost:8180/realms/stepup')).replace(/\/$/, '');
const name = arg('--profile', process.env.IDP_PROFILE || 'keycloak');
if (!/^[A-Za-z0-9_-]+$/.test(name)) { console.error('bad profile name'); process.exit(2); }
const file = path.resolve(import.meta.dirname, '../../idp/profiles', `${name}.json`);
const profile = JSON.parse(fs.readFileSync(file, 'utf8'));
const res = await fetch(`${issuer}/.well-known/openid-configuration`).catch((e) => { console.error('Cannot reach IdP:', e.message); process.exit(2); });
if (!res.ok) { console.error('Discovery failed:', res.status); process.exit(2); }
const d = await res.json();

const rows = []; let bad = 0;
const row = (level, what, detail) => { rows.push([level, what, detail]); if (level === 'MISMATCH') bad++; };
const has = (arr, v) => Array.isArray(arr) && arr.includes(v);

row(d.issuer === issuer ? 'ok' : 'MISMATCH', 'issuer matches', `${d.issuer}`);
row(has(d.response_types_supported, 'code') ? 'ok' : 'MISMATCH', 'authorization code flow', '');
row(has(d.code_challenge_methods_supported, 'S256') ? 'ok' : 'MISMATCH', 'PKCE S256', JSON.stringify(d.code_challenge_methods_supported));
row(d.end_session_endpoint ? 'ok' : 'warn', 'RP-initiated logout endpoint', d.end_session_endpoint ?? 'missing: sign-out cannot end the IdP session');
row(d.jwks_uri ? 'ok' : 'MISMATCH', 'jwks_uri', d.jwks_uri ?? '');
const cap = profile.capabilities;
if (profile.stepUpRequest.acrValues?.LoA2) {
  const want = profile.stepUpRequest.acrValues.LoA2;
  const adv = d.acr_values_supported;
  row(!adv ? 'warn' : has(adv, want) ? 'ok' : 'warn', `acr_values_supported contains "${want}"`, adv ? JSON.stringify(adv) : 'not advertised (many IdPs omit it: verify manually)');
}
if (cap.claimsParam) row(d.claims_parameter_supported ? 'ok' : 'warn', 'claims parameter supported', String(d.claims_parameter_supported));
if (cap.emitsAuthTime) row(has(d.claims_supported, profile.authTime.claim) ? 'ok' : 'warn', `claims_supported lists "${profile.authTime.claim}"`, d.claims_supported ? 'checked' : 'claims_supported not advertised: verify manually');
else row('warn', 'profile has no auth time', 'policies with a max age will be REFUSED at API start-up');
if (cap.maxAge || cap.promptLogin) row(d.prompt_values_supported ? (has(d.prompt_values_supported, 'login') ? 'ok' : 'warn') : 'warn', 'prompt=login', d.prompt_values_supported ? JSON.stringify(d.prompt_values_supported) : 'prompt_values_supported not advertised');
row(profile.tested ? 'ok' : 'warn', `profile "${name}" tested against a real IdP`, profile.tested ? 'yes (Keycloak)' : 'NO: template only');

console.log(`IdP: ${issuer}\nProfile: ${name}\n`);
for (const [l, w, dt] of rows) console.log(`${l.padEnd(9)} ${w}${dt ? '  -> ' + dt : ''}`);
console.log(bad ? `\n${bad} mismatch(es). Fix the profile or the IdP before relying on it.` : '\nNo hard mismatches. Warnings need a manual check (docs/manual-checks.md).');
process.exit(bad ? 1 : 0);
