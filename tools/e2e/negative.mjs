// Negative paths that need a misbehaving IdP, simulated by rewriting the browser's authorize request.
import { start, kcLogin, shot } from './lib.mjs';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
let failed = false;
const check = (c, m) => { log(c ? 'PASS' : 'FAIL', m); if (!c) failed = true; };

// A. Real IdP error on return (prompt=none with no SSO session => error=login_required), per app. Must not loop.
for (const [name, url, text] of [['React', 'http://localhost:5300/', 'Sign-in was not completed'], ['Angular', 'http://localhost:5400/', 'Sign-in was not completed'], ['MVC', 'http://localhost:5200/', 'Sign-in was not completed']]) {
  const { b, page } = await start();
  let authRequests = 0;
  await page.route('**/protocol/openid-connect/auth?*', (r) => { authRequests++; const u = new URL(r.request().url()); u.searchParams.set('prompt', 'none'); return r.continue({ url: u.href }); });
  await page.goto(name === 'MVC' ? 'http://localhost:5200/signin-oidc?error=login_required&state=x' : url); // MVC: browser redirects cannot be rewritten, so deliver the IdP error to the callback directly
  await page.waitForTimeout(4000);
  const body = await page.innerText('body');
  check(body.includes(text) && (name === 'MVC' || authRequests === 1), `A ${name}: IdP error on return shows a message and does not loop (auth requests: ${authRequests})`);
  await shot(page, `neg-A-${name}`);
  await b.close();
}

// B. IdP ignores acr_values/max_age: step-up comes back LoA1. Action must NOT be performed.
for (const [name, setup] of [
  ['React', async (page) => { await page.goto('http://localhost:5300/'); await kcLogin(page); await page.waitForSelector('text=Welcome back'); await page.click('button:text-is("Profile")'); await page.click('text=Save e-mail'); }],
  ['MVC', async (page) => { await page.goto('http://localhost:5200/BackOffice/Approvals'); await kcLogin(page); await page.waitForSelector('text=Transfer approvals'); await page.click('button:text-is("Approve") >> nth=0'); }],
]) {
  const { b, page } = await start();
  await setup(page).catch(async (e) => { log('setup problem', e.message.slice(0, 80)); });
  await page.waitForSelector('text=Extra verification needed');
  const strip = (href) => { const u = new URL(href); u.searchParams.delete('acr_values'); u.searchParams.delete('max_age'); return u.href; };
  if (name === 'MVC') // the step-up redirect is a 302 from the server: rewrite its Location header
    await page.route('**/stepup/go', async (r) => { const resp = await r.fetch({ maxRedirects: 0 }); const h = { ...resp.headers() }; if (h.location) h.location = strip(h.location); return r.fulfill({ response: resp, headers: h }); });
  else await page.route('**/protocol/openid-connect/auth?*', (r) => r.continue({ url: strip(r.request().url()) }));
  await page.click('text=Verify with authenticator');
  await page.waitForTimeout(3500);
  const body = await page.innerText('body');
  check(/did not raise the login level|NOT performed/.test(body), `B ${name}: IdP ignored acr_values, client refuses to continue and the action is NOT performed`);
  check(!/: done\./.test(body), `B ${name}: no success message`);
  await shot(page, `neg-B-${name}`);
  await b.close();
}
process.exit(failed ? 1 : 0);
