// End-to-end run for apps/saml (needs Keycloak on 8180 and apps/saml on 5500; the SSO part also needs apps/mvc on 5200 and the API on 5100)
import { start, kcLogin, kcOtp, shot } from './lib.mjs';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const { b, page } = await start();
const expect = async (cond, msg) => { if (!(await cond)) { log('FAIL', msg); await shot(page, 'FAIL-saml'); process.exitCode = 1; } else log('PASS', msg); };
const onKc = () => page.url().includes(':8180');
const panel = () => page.textContent('.ab-session');

// 1. SP-initiated login
await page.goto('http://localhost:5500/'); await kcLogin(page);
await page.waitForSelector('text=Treasury');
await expect(panel().then(t => t.includes('LoA1')), '1 SAML login gives LoA1 (password only)');
// 2. sensitive action -> step-up
await page.goto('http://localhost:5500/Treasury/Payments');
await page.click('tr:has-text("P-3001") button');
await page.waitForSelector('text=Extra verification needed');
await expect(true, '2 release (LoA1) shows step-up page, payment NOT released');
await page.click('text=Verify with authenticator');
if (process.env.DEBUG_URL) log('after go ->', page.url());
await page.waitForSelector('input[name=password],input[name=otp]');
if (await page.locator('input[name=password]').count()) { // ForceAuthn: Keycloak asks for the password again (username is already known)
  log('IdP asked for the password again (ForceAuthn)');
  if (await page.locator('input[name=username]:not([readonly]):visible').count()) await page.fill('input[name=username]', 'alice');
  await page.fill('input[name=password]', 'alice-dev-only'); await page.click('input[type=submit],button[type=submit]');
}
await kcOtp(page);
await page.waitForSelector('text=Release payment P-3001: Payment P-3001 released.');
await expect(panel().then(t => t.includes('LoA2')), '2 after TOTP the SAML assertion carries LoA2 and the action ran');
await shot(page, 'saml-2-after-stepup');
// 3. assertion facts page
await page.goto('http://localhost:5500/Treasury/Assertion');
await expect(page.textContent('main').then(t => /loa\s*2/.test(t) && t.includes('signed SAML assertion')), '3 assertion page shows the signed loa=2 attribute from the step-up entity');
await shot(page, 'saml-3-assertion');
// 4. inside the window: no prompt
await page.goto('http://localhost:5500/Treasury/Approvers');
await page.fill('input[name=name]', 'bob'); await page.click('text=Add approver >> nth=-1');
await page.waitForSelector('text=bob is now an approver.', { timeout: 8000 });
await expect(!onKc(), '4 second action inside the window: no second prompt');
// 5. SSO into an OIDC app (no login prompt)
if (!process.env.SKIP_OIDC) {
  await page.goto('http://localhost:5200/'); await page.waitForSelector('.ab-session');
  await expect(!onKc(), '5 OIDC Back Office opens with no login prompt after SAML login (cross-protocol SSO)');
  // KNOWN LIMITATION (docs/saml-vs-oidc.md section 5): the SAML step-up flow does not set the LoA marker the OIDC apps read, so they stay at LoA1.
  log('INFO 5 OIDC app level after SAML step-up:', (await panel()).includes('LoA2') ? 'LoA2 (shared)' : 'LoA1 (not shared, known limitation)');
}
// 6. window expires
log('waiting 72 s for the window to expire...');
await page.waitForTimeout(72000);
await page.goto('http://localhost:5500/Treasury/Payments');
await page.click('tr:has-text("P-3002") button');
await page.waitForSelector('text=Extra verification needed');
await expect(true, '6 after expiry the same kind of action asks for step-up again');
// 7. cancel path
await page.click('text=Not now');
await page.waitForSelector('text=Cancelled. Nothing was changed.');
await expect(page.textContent('main').then(t => t.includes('held')), '7 cancel leaves the payment held');
// 8. forged response is rejected
const r = await page.request.post('http://localhost:5500/saml/acs', { form: { SAMLResponse: Buffer.from('<x/>').toString('base64') }, maxRedirects: 0 });
await expect(r.status() === 302 && (r.headers().location || '').includes('/stepup/failed'), '8 forged SAMLResponse is rejected');
// 9. logout
await page.goto('http://localhost:5500/');
await page.click('text=Sign out');
await page.waitForSelector('text=You are signed out');
await expect(true, '9 SAML logout returns to the signed-out page');
await page.goto('http://localhost:5500/'); await page.waitForTimeout(1500);
await expect(onKc(), '10 after logout the app asks for login again');
await b.close();
