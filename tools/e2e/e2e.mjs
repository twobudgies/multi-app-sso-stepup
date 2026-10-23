import { start, kcLogin, kcOtp, shot } from './lib.mjs';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const { b, page } = await start();
const expect = async (cond, msg) => { if (!(await cond)) { log('FAIL', msg); await shot(page, 'FAIL'); process.exitCode = 1; } else log('PASS', msg); };
const onKc = () => page.url().includes(':8180');

// 1. login at React
await page.goto('http://localhost:5300/'); await kcLogin(page);
await page.waitForSelector('text=Welcome back');
await expect(page.textContent('.ab-session').then(t => t.includes('LoA1')), '1 React login gives LoA1');
// 2. step-up at React
await page.click('button:text-is("Profile")'); await page.fill('input[type=email]', 'alice.demo@example.test');
await page.click('text=Save e-mail'); await page.waitForSelector('text=Extra verification needed');
await expect(true, '2 change-email (LoA1) shows step-up modal, nothing performed');
await page.click('text=Verify with authenticator'); await kcOtp(page);
await page.waitForSelector('text=Change e-mail: done');
await expect(page.textContent('.ab-session').then(t => t.includes('LoA2')), '2 after TOTP React shows LoA2 and action done');
// 3. SSO to Angular, shared window: large transfer without prompt
await page.goto('http://localhost:5400/');
await page.waitForSelector('text=Recent transfers');
await expect(!onKc(), '3 Angular: no login prompt (SSO)');
await expect(page.textContent('.ab-session').then(t => t.includes('LoA2')), '3 Angular shows LoA2 from the shared session');
await page.fill('input[type=number]', '2500'); await page.click('button:text-is("Send")');
await page.waitForSelector('text=Send money: done.', { timeout: 8000 });
await expect(!(await page.locator('text=Extra verification needed').count()), '3 large transfer inside window: NO second prompt (shared window)');
// 4. MVC inside window
await page.goto('http://localhost:5200/BackOffice/Limits');
await page.waitForSelector('input[name=limit]');
await expect(!onKc(), '4 MVC: no login prompt (SSO)');
await page.fill('input[name=limit]', '7000'); await page.click('text=Save limit');
await page.waitForSelector('text=Daily transfer limit updated.', { timeout: 8000 });
await expect(true, '4 MVC change-limit inside window done without prompt');
// 5. window expires
log('waiting for the 60 s window to expire...');
await page.waitForTimeout(72000);
await page.goto('http://localhost:5400/'); await page.waitForSelector('text=Recent transfers');
await page.fill('input[type=number]', '2500'); await page.click('button:text-is("Send")');
await page.waitForSelector('text=Extra verification needed');
await expect(true, '5 after expiry the same action asks for step-up again');
await shot(page, 'e2e-5-expired-modal');
// 6. cancel
await page.click('text=Not now');
await expect(page.waitForSelector('text=Cancelled. Nothing was changed.').then(() => true), '6 "Not now" cancels, nothing performed');
// 6b. IdP error on return (cancel at the IdP is reported as access_denied)
await page.goto('http://localhost:5300/callback?error=access_denied&state=x');
await page.waitForTimeout(3000);
const body6 = await page.innerText('body').catch(() => '');
await expect(!/Sign-in failed: undefined/.test(body6), '6b React handles an error callback without crashing (url ' + page.url().slice(0, 60) + ')');
// 7. logout at React ends the SSO session for all apps
await page.goto('http://localhost:5300/'); await page.waitForSelector('text=Welcome back');
await page.click('text=Sign out'); await page.waitForSelector('text=You are signed out');
await page.goto('http://localhost:5400/'); await page.waitForTimeout(2500);
await expect(onKc(), '7 after sign-out at React, Angular shows the IdP login (SSO session ended)');
await b.close();
