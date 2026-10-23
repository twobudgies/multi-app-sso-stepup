// Records the README animation: login -> step-up -> SSO -> timer -> expired -> step-up again.
// Output: docs/img/how-it-works.gif (override with GIF_OUT; GIF_FRAMES=dir also saves each frame as PNG). Needs the whole stack running; takes about 2 minutes.
import fs from 'node:fs';
import path from 'node:path';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { PNG } from 'pngjs';
import { chromium } from 'playwright';
import { kcLogin, kcOtp } from './lib.mjs';

const OUT = process.env.GIF_OUT || path.resolve(import.meta.dirname, '../../docs/img/how-it-works.gif');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const W = 1100, H = 680;
const frames = [];

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();

async function caption(step, text) {
  await page.evaluate(([s, t]) => {
    document.getElementById('gifcap')?.remove();
    const d = document.createElement('div');
    d.id = 'gifcap';
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;display:flex;align-items:center;gap:16px;padding:14px 24px;background:#0b1f3a;color:#fff;font:600 24px system-ui,sans-serif;border-top:4px solid #f5b301';
    d.innerHTML = `<span style="background:#f5b301;color:#0b1f3a;border-radius:20px;padding:2px 14px">${s}</span><span>${t}</span>`;
    document.documentElement.appendChild(d);
  }, [step, text]);
}
// One frame: settle, add the caption, screenshot. hold = how long the frame stays on screen in the GIF.
async function snap(step, text, hold = 1800, settle = 700) {
  await page.waitForTimeout(settle);
  await caption(step, text);
  const buf = await page.screenshot({ type: 'png' });
  if (process.env.GIF_FRAMES) { fs.mkdirSync(process.env.GIF_FRAMES, { recursive: true }); fs.writeFileSync(`${process.env.GIF_FRAMES}/${String(frames.length + 1).padStart(2, '0')}.png`, buf); }
  const png = PNG.sync.read(buf);
  frames.push({ data: png.data, width: png.width, height: png.height, hold });
  console.log('frame', frames.length, step, text);
}

// 1. Login
await page.goto('http://localhost:5300/');
await page.waitForSelector('input[name=username]');
await snap('1 Login', 'One login page at the identity provider (password)');
await kcLogin(page);
await page.waitForSelector('text=Welcome back');
await snap('1 Login', 'Signed in to the Customer Portal: level LoA1 (password only)');

// 2. Step-up
await page.click('button:text-is("Profile")');
await page.fill('input[type=email]', 'alice.demo@example.test');
await page.click('text=Save e-mail');
await page.waitForSelector('text=Extra verification needed');
await snap('2 Step-up', 'Risky action: login alone is not enough, extra proof is asked', 2400);
await page.click('text=Verify with authenticator');
await page.waitForSelector('input[name=otp]');
await snap('2 Step-up', 'Second factor: 6-digit authenticator code');
await kcOtp(page);
await page.waitForSelector('text=Change e-mail: done');
await snap('2 Step-up', 'Done. Level is now LoA2 and the 1-minute timer starts', 2400);

// 3. SSO
await page.goto('http://localhost:5400/');
await page.waitForSelector('text=Recent transfers');
await snap('3 SSO', 'Payments app opens with no login prompt (single sign-on)', 2200);
await page.fill('input[type=number]', '2500');
await page.click('button:text-is("Send")');
await page.waitForSelector('text=Send money: done.');
await snap('3 SSO', 'Large transfer works inside the window: no second prompt', 2200);
await page.goto('http://localhost:5200/BackOffice/Limits');
await page.waitForSelector('input[name=limit]');
await snap('3 SSO', 'Back Office also opens with no login prompt', 2000);

// 4. Timer (sped up: one frame about every 8 s of real time)
await page.goto('http://localhost:5400/');
await page.waitForSelector('text=Recent transfers');
for (let i = 0; i < 9; i++) {
  await snap('4 Timer', 'The step-up timer counts down (sped up)', 700, i === 0 ? 700 : 7300);
}

// 5. Expired
await snap('5 Expired', 'Timer reached zero: the extra proof has expired', 2400, 2000);
await page.fill('input[type=number]', '2500');
await page.click('button:text-is("Send")');
await page.waitForSelector('text=Extra verification needed');
await snap('5 Expired', 'The same transfer is blocked and asks for step-up again', 2400);

// 6. Step-up again. After the window passed, Keycloak may ask for the password again before the code.
await page.click('text=Verify with authenticator');
await page.waitForSelector('input[name=otp], input[name=password]');
if (await page.locator('input[name=password]').count()) {
  await snap('6 Step-up again', 'Window expired, so the identity provider asks for a fresh login first');
  await page.fill('input[name=password]', 'alice-dev-only');
  await page.click('input[type=submit],button[type=submit]');
  await page.waitForSelector('input[name=otp]');
}
await snap('6 Step-up again', 'Enter a fresh authenticator code');
await kcOtp(page);
await page.waitForSelector('text=Send money: done.');
await snap('6 Step-up again', 'Transfer completes and a new 1-minute timer starts', 3200);
await b.close();

const gif = GIFEncoder();
for (const f of frames) {
  const palette = quantize(f.data, 256);
  gif.writeFrame(applyPalette(f.data, palette), f.width, f.height, { palette, delay: f.hold });
}
gif.finish();
fs.writeFileSync(OUT, gif.bytes());
console.log('wrote', OUT, (gif.bytes().length / 1024 / 1024).toFixed(2), 'MB,', frames.length, 'frames');
