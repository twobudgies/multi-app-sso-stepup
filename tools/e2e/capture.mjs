// Captures one screenshot per demo step (backup for the live demo). Output: demo/screenshots (override with E2E_OUT).
import path from 'node:path';
process.env.E2E_OUT ||= path.resolve(import.meta.dirname, '../../demo/screenshots');
const { start, kcLogin, kcOtp, shot } = await import('./lib.mjs');
const { b, page } = await start();
const snap = async (n) => { await page.waitForTimeout(900); await shot(page, n); console.log('captured', n); };

await page.goto('http://localhost:5300/');
await page.waitForSelector('input[name=username]'); await snap('01-keycloak-password-login');
await kcLogin(page); await page.waitForSelector('text=Welcome back'); await snap('02-portal-loa1');
await page.click('button:text-is("Profile")'); await page.fill('input[type=email]', 'alice.demo@example.test');
await page.click('text=Save e-mail'); await page.waitForSelector('text=Extra verification needed'); await snap('03-step-up-modal');
await page.click('text=Verify with authenticator'); await page.waitForSelector('input[name=otp]'); await snap('04-keycloak-totp-code');
await kcOtp(page); await page.waitForSelector('text=Change e-mail: done'); await snap('05-portal-loa2-countdown');
await page.goto('http://localhost:5400/'); await page.waitForSelector('text=Recent transfers'); await snap('06-payments-sso-no-prompt');
await page.fill('input[type=number]', '2500'); await page.click('button:text-is("Send")');
await page.waitForSelector('text=Send money: done.'); await snap('07-large-transfer-inside-window');
await page.goto('http://localhost:5200/BackOffice/Approvals'); await page.waitForSelector('text=Transfer approvals'); await snap('08-backoffice-sso-no-prompt');
await page.click('button:text-is("Approve") >> nth=0'); await page.waitForSelector('text=approved.'); await snap('09-backoffice-approved-inside-window');
console.log('waiting 72 s for the window to expire...'); await page.waitForTimeout(72000);
await page.goto('http://localhost:5400/'); await page.waitForSelector('text=Recent transfers'); await snap('10-panel-expired-countdown-zero');
await page.fill('input[type=number]', '2500'); await page.click('button:text-is("Send")');
await page.waitForSelector('text=Extra verification needed'); await snap('11-step-up-asked-again-after-expiry');
await page.click('text=Not now'); await snap('12-cancelled-nothing-performed');
await page.goto('http://localhost:5300/'); await page.waitForSelector('text=Welcome back');
await page.click('text=Sign out'); await page.waitForSelector('text=You are signed out'); await snap('13-signed-out');
await page.goto('http://localhost:5400/'); await page.waitForSelector('input[name=username]'); await snap('14-other-app-asks-login-after-signout');
await b.close();
