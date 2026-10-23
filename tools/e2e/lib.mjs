import { chromium } from 'playwright';
import crypto from 'node:crypto';
import path from 'node:path';
export const OUT = process.env.E2E_OUT || path.join(import.meta.dirname, 'out');
import fs from 'node:fs'; fs.mkdirSync(OUT, { recursive: true });
export function totp() { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = crypto.createHmac('sha1', '12345678901234567890').update(c).digest(); const o = h[19] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0'); }
export async function start() { const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); page.on('pageerror', e => console.log('PAGEERROR', e.message)); page.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text()); }); return { b, ctx, page }; }
export async function kcLogin(page) { await page.waitForSelector('input[name=username]'); await page.fill('input[name=username]', 'alice'); await page.fill('input[name=password]', 'alice-dev-only'); await page.click('input[type=submit],button[type=submit]'); }
export async function kcOtp(page) { await page.waitForSelector('input[name=otp]'); await page.fill('input[name=otp]', totp()); await page.click('input[type=submit],button[type=submit]'); }
export const shot = (page, n) => page.screenshot({ path: `${OUT}/${n}.png` });
