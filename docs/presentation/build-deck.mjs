// Builds acme-bank-sso-stepup.pptx. Content comes from the real, finished code and docs (see docs/).
// No company template is used or committed; to use the company template, copy these slides into it.
import pptxgen from 'pptxgenjs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const SKILL = process.env.PPTX_SKILL_DIR || '';
const SHOTS = path.resolve(import.meta.dirname, '../../demo/screenshots');

const NAVY = '12307A', BLUE = '1F56D6', TEAL = '0FB59A', INK = '0F1B33', SOFT = '52607A', BG = 'F3F6FB', WHITE = 'FFFFFF', AMBER = 'F59E0B', RED = 'D93A4A', LINE = 'DDE4EF';
const HEAD = 'Cambria', BODY = 'Calibri';
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
pres.title = 'One login, extra proof only when it matters';
pres.author = 'Acme Bank SSO step-up PoC';
pres.theme = { headFontFace: HEAD, bodyFontFace: BODY };

pres.defineSlideMaster({ title: 'CONTENT', background: { color: WHITE }, slideNumber: { x: 12.4, y: 7.0, w: 0.6, h: 0.3, fontFace: BODY, fontSize: 11, color: SOFT },
  objects: [{ placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 0.4, w: 11.9, h: 0.9, fontFace: HEAD, fontSize: 36, bold: true, color: NAVY, align: 'left', valign: 'middle', margin: 0 }, text: '' } }] });
pres.defineSlideMaster({ title: 'DARK', background: { color: NAVY },
  objects: [{ placeholder: { options: { name: 'title', type: 'title', x: 0.9, y: 2.2, w: 11.5, h: 1.6, fontFace: HEAD, fontSize: 48, bold: true, color: WHITE, align: 'left', valign: 'middle', margin: 0 }, text: '' } }] });

const seen = new Set(); const _add = pres.addSlide.bind(pres);
pres.addSlide = (o) => { if (o && o.sectionTitle && !seen.has(o.sectionTitle)) { seen.add(o.sectionTitle); pres.addSection({ title: o.sectionTitle }); } return _add(o); };
let n = 0;
const content = (title, notes, section) => { const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: section }); s.addText(title, { placeholder: 'title' }); s.addNotes(notes); n++; return s; };
const take = (s, text, y, o = {}) => s.addText(text, { x: 0.7, y, w: 11.9, h: 0.5, fontFace: BODY, fontSize: 18, color: SOFT, isTextBox: true, margin: 0, ...o });
const card = (s, x, y, w, h, head, body, o = {}) => {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: o.fill || BG }, line: { color: LINE, width: 1 }, rectRadius: 0.12, shadow: { type: 'outer', color: '000000', opacity: 0.12, blur: 6, offset: 2, angle: 90 } });
  s.addText(head, { x: x + 0.25, y: y + 0.18, w: w - 0.5, h: 0.8, fontFace: HEAD, fontSize: 20, bold: true, color: o.headColor || NAVY, isTextBox: true, margin: 0, valign: 'top' });
  s.addText(body, { x: x + 0.25, y: y + 1.05, w: w - 0.5, h: h - 1.2, fontFace: BODY, fontSize: o.size || 18, color: o.bodyColor || INK, isTextBox: true, margin: 0, valign: 'top', paraSpaceAfter: 6 });
};
const pill = (s, x, y, w, text, color, tcolor = WHITE) => s.addText(text, { x, y, w, h: 0.4, shape: pres.ShapeType.roundRect, rectRadius: 0.2, fill: { color }, color: tcolor, fontFace: BODY, fontSize: 14, bold: true, align: 'center', valign: 'middle', isTextBox: true, margin: 0 });
const box = (s, x, y, w, h, text, fill, tcolor = WHITE, size = 16) => s.addText(text, { x, y, w, h, shape: pres.ShapeType.roundRect, rectRadius: 0.1, fill: { color: fill }, color: tcolor, fontFace: BODY, fontSize: size, bold: true, align: 'center', valign: 'middle', isTextBox: true, margin: 4 });
const arrow = (s, x1, y1, x2, y2, color = SOFT) => s.addShape(pres.ShapeType.line, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipV: y2 < y1, flipH: x2 < x1, line: { color, width: 2, endArrowType: 'triangle' } });

// 1 Title
{ const s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Intro' }); n++;
  s.addText('One login, extra proof only when it matters', { placeholder: 'title' });
  s.addText('Single sign-on and step-up MFA across three apps, with a live demo', { x: 0.9, y: 3.9, w: 11.5, h: 0.6, fontFace: BODY, fontSize: 22, color: 'CADCFC', isTextBox: true, margin: 0 });
  s.addText('Acme Bank (fictional)  |  Proof of concept  |  Tested with Keycloak only', { x: 0.9, y: 6.4, w: 11.5, h: 0.4, fontFace: BODY, fontSize: 14, color: '9DB3E8', isTextBox: true, margin: 0 });
  s.addNotes('Welcome. 45 minutes: about 12 of them a live demo. For managers: the one-line takeaway under each slide title is for you. For developers: details are in the appendix and in the repo docs. Everything shown is fake data; only Keycloak was ever run.'); }

// 2 Problem
{ const s = content('The problem: many logins, some risky actions', 'Three pains. Many apps means many passwords. A password alone is a weak gate for risky actions. But asking for a second factor on every click makes people hate security. We want both: easy by default, strict when it matters.', 'Intro');
  take(s, 'For managers: staff and customers want one easy login, but a stolen password must not be enough to move money.', 1.4);
  card(s, 0.7, 2.4, 3.8, 3.6, 'Many apps, many logins', 'Every app asks again. People reuse passwords or write them down.');
  card(s, 4.75, 2.4, 3.8, 3.6, 'One password is a weak gate', 'A phished password could change contact details or approve a transfer.');
  card(s, 8.8, 2.4, 3.8, 3.6, 'MFA on every click does not work', 'Constant prompts annoy users. Better: extra proof only for risky actions.'); }

// 3 Agenda
{ const s = content('Today in 45 minutes', 'Timing: about 5 min problem and SSO basics, 8 min architecture, tokens and step-up concepts, 12 min live demo, 5 min IdP flexibility, 5 min security and what was verified, 10 min questions and buffer.', 'Intro');
  take(s, 'For managers: a short concept part, a live demo in the middle, then trade-offs and honesty about what was tested.', 1.4);
  const rows = [['5 min', 'The problem and single sign-on basics'], ['8 min', 'Architecture, tokens and step-up MFA'], ['12 min', 'Live demo: Acme Bank'], ['5 min', 'Connecting any identity provider'], ['5 min', 'Security decisions and what was verified'], ['10 min', 'Questions and buffer']];
  rows.forEach((r, i) => { const y = 2.3 + i * 0.72; pill(s, 0.7, y, 1.5, r[0], i === 2 ? TEAL : BLUE); s.addText(r[1], { x: 2.5, y, w: 9.5, h: 0.4, fontFace: BODY, fontSize: 20, color: INK, bold: i === 2, isTextBox: true, margin: 0, valign: 'middle' }); }); }

// 4 SSO
{ const s = content('Single sign-on: log in once, use many apps', 'Analogy: the reception desk of a building checks your ID once and gives you a badge; every office door then trusts the badge. The identity provider (IdP) is the reception desk. Apps never see your password, only a signed proof.', 'Basics');
  take(s, 'For managers: one trusted login page, many apps. Fewer passwords, one place to add stronger checks.', 1.4);
  box(s, 5.0, 2.4, 3.3, 1.0, 'Identity provider (Keycloak)\nthe only place a password is typed', NAVY, WHITE, 16);
  box(s, 0.7, 5.0, 3.3, 1.0, 'Customer Portal', BLUE); box(s, 5.0, 5.0, 3.3, 1.0, 'Payments and Transfers', BLUE); box(s, 9.3, 5.0, 3.3, 1.0, 'Back Office', BLUE);
  arrow(s, 2.35, 5.0, 5.0, 3.4); arrow(s, 6.65, 5.0, 6.65, 3.4); arrow(s, 10.95, 5.0, 8.3, 3.4);
  s.addText('1. First app sends you to the login page', { x: 0.7, y: 2.5, w: 4.0, h: 0.8, fontFace: BODY, fontSize: 15, color: SOFT, isTextBox: true, margin: 0 });
  s.addText('2. Other apps find your IdP session: no prompt', { x: 8.6, y: 2.5, w: 4.0, h: 0.8, fontFace: BODY, fontSize: 15, color: '0B6B58', bold: true, isTextBox: true, margin: 0 }); }

// 5 Demo domain
{ const s = content('The demo: three parts of one fictional bank', 'Acme Bank is fictional, with fake data. Each app is built differently on purpose: React and Angular run in the browser, MVC runs on a server. Same look, same nav bar, same session panel.', 'Basics');
  take(s, 'For managers: one story to follow: a customer, a payment, and a back-office approval.', 1.4);
  card(s, 0.7, 2.4, 3.8, 3.9, 'Customer Portal', 'React app, port 5300\nAccounts, balances, profile\nSensitive: change e-mail address');
  card(s, 4.75, 2.4, 3.8, 3.9, 'Payments and Transfers', 'Angular app, port 5400\nSend money, add payee\nSensitive: add payee, send over 1000');
  card(s, 8.8, 2.4, 3.8, 3.9, 'Back Office', 'ASP.NET Core MVC, port 5200\nLimits, approvals, users\nSensitive: change limit, approve transfer'); }

// 6 Architecture
{ const s = content('Architecture: three apps, one API, one IdP', 'The apps log users in through Keycloak using the Authorization Code flow with PKCE. They call one shared API with an access token. The API is the only place that decides about step-up. The API fetches Keycloak public keys (JWKS) to check signatures.', 'Concepts');
  take(s, 'For developers: the API validates every token itself; apps only carry it.', 1.4);
  box(s, 0.7, 2.5, 3.2, 0.9, 'Customer Portal (React)', BLUE); box(s, 0.7, 3.7, 3.2, 0.9, 'Payments (Angular)', BLUE); box(s, 0.7, 4.9, 3.2, 0.9, 'Back Office (MVC)', BLUE);
  box(s, 5.3, 3.7, 3.0, 1.4, 'Shared API\nenforces step-up', TEAL, INK, 18); box(s, 9.7, 3.7, 2.9, 1.4, 'Keycloak\nlogin + TOTP', NAVY, WHITE, 18);
  arrow(s, 3.9, 2.95, 5.3, 4.1); arrow(s, 3.9, 4.15, 5.3, 4.4); arrow(s, 3.9, 5.35, 5.3, 4.8);
  arrow(s, 9.7, 4.4, 8.3, 4.4);
  s.addText('access token', { x: 3.9, y: 5.8, w: 2.6, h: 0.4, fontFace: BODY, fontSize: 14, color: SOFT, isTextBox: true, margin: 0 });
  s.addText('public keys (JWKS)', { x: 8.3, y: 3.95, w: 1.4, h: 0.4, fontFace: BODY, fontSize: 12, align: 'center', color: SOFT, isTextBox: true, margin: 0 });
  s.addText('Apps log in via the IdP (redirect, code + PKCE)', { x: 5.3, y: 2.35, w: 7.3, h: 0.5, fontFace: BODY, fontSize: 16, color: NAVY, bold: true, isTextBox: true, margin: 0 }); }

// 7 Tokens
{ const s = content('The token journey', 'Three tokens. The ID token tells the app who logged in and how. The access token goes to the API and is short lived: 5 minutes here. The refresh token is not used by the apps in this PoC; when the access token ends the apps go through single sign-on again. A refresh would keep the old login time, which we verified.', 'Concepts');
  take(s, 'For managers: short-lived passes limit the damage if one leaks.', 1.4);
  card(s, 0.7, 2.4, 3.8, 3.7, 'ID token', 'Read by the app\nWho logged in and how\nNever sent to the API');
  card(s, 4.75, 2.4, 3.8, 3.7, 'Access token', 'Sent to the API\nLives 5 minutes (setting)\nCarries level (acr), login time (auth_time), audience');
  card(s, 8.8, 2.4, 3.8, 3.7, 'Where they live', 'React, Angular: browser memory only\nMVC: on the server, browser has only an HttpOnly cookie');
  s.addText('A refresh keeps the original login time, so it can never replace a step-up (verified against Keycloak).', { x: 0.7, y: 6.3, w: 11.9, h: 0.5, fontFace: BODY, fontSize: 16, color: NAVY, bold: true, isTextBox: true, margin: 0 }); }

// 8 Step-up concept
{ const s = content('Step-up MFA: prove it is really you, right now', 'LoA1 means a password only. LoA2 means a password plus a code from an authenticator app (TOTP). The token says what level was reached (acr) and when (auth_time). For risky actions the API asks for LoA2 and a recent login.', 'Concepts');
  take(s, 'For managers: being logged in is not the same as being sure. Risky actions need fresh proof.', 1.4);
  card(s, 0.7, 2.4, 5.7, 3.1, 'LoA1: password', 'Enough to look at accounts and balances.\nToken says acr = 1', { fill: BG });
  card(s, 6.9, 2.4, 5.7, 3.1, 'LoA2: password + authenticator code', 'Needed to change e-mail, add payee, send over 1000, change limits, approve transfers.\nToken says acr = 2', { fill: 'E6FAF5', headColor: '0B6B58' });
  s.addText('And it must be recent: the login time (auth_time) must be within 60 seconds.', { x: 0.7, y: 5.8, w: 11.9, h: 0.5, fontFace: BODY, fontSize: 20, bold: true, color: NAVY, isTextBox: true, margin: 0 }); }

// 9 Step-up flow
{ const s = content('The step-up flow in six steps', 'User clicks a sensitive action. The app calls the API. The API sees the level is too low or too old and answers 401 with a challenge that says which level and how recent. The app shows a clear popup, sends the user to Keycloak for the authenticator code, comes back, and retries. The API checks again; nothing is trusted from the client.', 'Concepts');
  take(s, 'For developers: this is RFC 9470 (OAuth step-up authentication challenge).', 1.4);
  const steps = ['1  Click a sensitive action', '2  API says 401: stronger or newer login needed', '3  App explains why (popup)', '4  Keycloak asks for the authenticator code', '5  App gets a new token (acr 2, new login time)', '6  Retry: API checks again, then performs it'];
  steps.forEach((t, i) => { const col = i % 2, row = Math.floor(i / 2); box(s, 0.7 + col * 6.1, 2.3 + row * 1.35, 5.8, 1.05, t, i === 1 ? AMBER : (i === 3 ? NAVY : BLUE), i === 1 ? INK : WHITE, 17); }); }

// 10 API decides
{ const s = content('The API decides, not the app', 'If the browser app decided, anyone could edit it in dev tools. So the app just sends the token. The API reads the level and login time from the signed token. Not enough: it refuses and does not perform the action. We ran this: a password-only token and an old token are both refused.', 'Concepts');
  take(s, 'For managers: the security rule cannot be bypassed by tampering with the website.', 1.4);
  card(s, 0.7, 2.4, 5.6, 3.9, 'What the API checks', 'Signature, issuer, audience, expiry\nLevel (acr) at least LoA2\nLogin time within 60 seconds\nOnly then: perform the action', {});
  s.addShape(pres.ShapeType.roundRect, { x: 6.7, y: 2.4, w: 5.9, h: 3.9, fill: { color: INK }, line: { color: INK }, rectRadius: 0.12 });
  s.addText([{ text: 'HTTP 401 Unauthorized', options: { bold: true, color: 'FFB4BC', breakLine: true } }, { text: 'WWW-Authenticate: Bearer', options: { color: WHITE, breakLine: true } }, { text: ' error="insufficient_', options: { color: '9DE8D6', breakLine: true } }, { text: '   user_authentication",', options: { color: '9DE8D6', breakLine: true } }, { text: ' acr_values="2",', options: { color: '9DE8D6', breakLine: true } }, { text: ' max_age="60"', options: { color: '9DE8D6' } }], { x: 6.95, y: 2.7, w: 5.4, h: 3.3, fontFace: 'Courier New', fontSize: 16, isTextBox: true, margin: 0, valign: 'top' }); }

// 11 Shared window timeline
{ const s = content('One shared window for all three apps', 'Because all apps share one identity provider session and the API judges the login time, proving yourself in one app counts for the others for about a minute. In the demo you do the authenticator code once and then use Payments and Back Office with no new prompt, until the countdown ends. The effective window is up to 65 seconds because of a 5 second clock leeway.', 'Concepts');
  take(s, 'For managers: one proof, valid in all apps, for a short time. The length is a setting.', 1.4);
  s.addShape(pres.ShapeType.roundRect, { x: 0.7, y: 3.3, w: 11.9, h: 0.5, fill: { color: LINE }, line: { color: LINE }, rectRadius: 0.25 });
  s.addShape(pres.ShapeType.roundRect, { x: 2.5, y: 3.3, w: 7.2, h: 0.5, fill: { color: TEAL }, line: { color: TEAL }, rectRadius: 0.25 });
  const mk = [[0.7, 'Login\n(password)', 2.2], [2.5, 'Authenticator code\nwindow starts', 4.5], [5.6, 'Payments and Back Office:\nno prompt', 5.7], [9.0, 'About 60 s later:\nwindow ends', 6.1]];
  s.addText('Window: 60 s (up to 65 s with clock leeway)', { x: 2.5, y: 3.3, w: 7.2, h: 0.5, fontFace: BODY, fontSize: 15, bold: true, color: INK, align: 'center', valign: 'middle', isTextBox: true, margin: 0 });
  s.addText('Login (password)', { x: 0.7, y: 2.6, w: 1.9, h: 0.6, fontFace: BODY, fontSize: 15, color: SOFT, isTextBox: true, margin: 0 });
  s.addText('Authenticator code: window starts', { x: 2.5, y: 4.0, w: 3.0, h: 0.8, fontFace: BODY, fontSize: 15, color: NAVY, bold: true, isTextBox: true, margin: 0 });
  s.addText('Inside the window: Payments and Back Office open with no prompt', { x: 5.0, y: 2.4, w: 4.5, h: 0.8, fontFace: BODY, fontSize: 15, color: '0B6B58', bold: true, isTextBox: true, margin: 0 });
  s.addText('Window over: the next sensitive action asks again', { x: 9.3, y: 4.0, w: 3.3, h: 0.8, fontFace: BODY, fontSize: 15, color: RED, bold: true, isTextBox: true, margin: 0 });
  s.addText('Refreshing a token does not extend the window: it keeps the old login time.', { x: 0.7, y: 5.6, w: 11.9, h: 0.5, fontFace: BODY, fontSize: 18, color: INK, isTextBox: true, margin: 0 }); }

// 12 Demo divider
{ const s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Demo' }); n++;
  s.addText('Live demo', { placeholder: 'title' });
  s.addText('Acme Bank: one login, three apps, extra proof when it matters (about 12 minutes)', { x: 0.9, y: 3.9, w: 11.5, h: 0.6, fontFace: BODY, fontSize: 22, color: 'CADCFC', isTextBox: true, margin: 0 });
  s.addNotes('Before this slide: the checklist in demo/run-demo.md is done, private browser window open at the Customer Portal, authenticator app visible, backup screenshots ready. Remember: the window is about a minute (up to 65 s), and a TOTP code cannot be reused, so wait for the next code between step-ups.'); }

// 13 Demo script
{ const s = content('Demo script: what you will see', 'Walk through the ten steps. Step 7 is the wait: use it to talk. If anything breaks, switch to the numbered screenshots 01 to 14 in demo/screenshots and narrate. Tip: after one step-up wait for the next authenticator code before the next one.', 'Demo');
  const rows = [['1', 'Sign in to the Customer Portal (password): LoA1'], ['2', 'Change e-mail: popup asks for extra proof'], ['3', 'Authenticator code: LoA2, countdown starts'], ['4', 'Click Payments in the nav: no login prompt'], ['5', 'Send 2500 inside the minute: no second prompt'], ['6', 'Back Office: approve a transfer, no prompt'], ['7', 'Wait for the countdown to reach zero'], ['8', 'Send 2500 again: asked again. "Not now" cancels'], ['9', 'API refuses a tampered call (optional)'], ['10', 'Sign out: other apps ask for a login']];
  rows.forEach((r, i) => { const col = i < 5 ? 0 : 1, row = i % 5; const x = 0.7 + col * 6.1, y = 1.6 + row * 1.0; pill(s, x, y + 0.1, 0.6, r[0], i === 6 ? AMBER : BLUE, i === 6 ? INK : WHITE); s.addText(r[1], { x: x + 0.8, y, w: 5.0, h: 0.8, fontFace: BODY, fontSize: 17, color: INK, isTextBox: true, margin: 0, valign: 'middle' }); });
  s.addText('Login: alice / alice-dev-only (fake). Tips: wait for the next authenticator code between step-ups; clocks in sync.', { x: 0.7, y: 6.6, w: 11.9, h: 0.4, fontFace: BODY, fontSize: 14, color: SOFT, isTextBox: true, margin: 0 }); }

// 14 Screens
{ const s = content('What the demo looks like (backup screenshots)', 'These are real screenshots from a run against live Keycloak. If the live demo fails, narrate from these. Left: the step-up popup that explains why. Right: after the authenticator code, the session panel shows LoA2 and the countdown.', 'Demo');
  s.addImage({ path: path.join(SHOTS, '03-step-up-modal.png'), x: 0.7, y: 1.5, w: 5.9, h: 3.69, objectName: 'Step-up popup screenshot' });
  s.addImage({ path: path.join(SHOTS, '05-portal-loa2-countdown.png'), x: 6.75, y: 1.5, w: 5.9, h: 3.69, objectName: 'Session panel screenshot' });
  s.addText('Step 3: a clear popup explains why extra proof is needed', { x: 0.7, y: 5.35, w: 5.9, h: 0.7, fontFace: BODY, fontSize: 16, color: INK, isTextBox: true, margin: 0 });
  s.addText('Step 5: the session panel shows LoA2 and the 60 s countdown', { x: 6.75, y: 5.35, w: 5.9, h: 0.7, fontFace: BODY, fontSize: 16, color: INK, isTextBox: true, margin: 0 });
  s.addText('All 14 numbered screenshots are in demo/screenshots', { x: 0.7, y: 6.3, w: 11.9, h: 0.4, fontFace: BODY, fontSize: 14, color: SOFT, isTextBox: true, margin: 0 }); }

// 15 IdP agnostic
{ const s = content('Any identity provider: a profile file, not new code', 'IdPs differ in how you ask for stronger authentication and which claims carry the level and the login time. Those differences live in a small JSON profile. Only Keycloak was tested. Entra, Okta and Cognito profiles are templates built from the providers documentation and have never been run against a real tenant. The API even refuses to start with the Entra template when a time limit is configured, because Entra does not document a login-time claim.', 'IdP');
  take(s, 'For managers: switching provider is configuration work and testing, not a rewrite. We only proved Keycloak.', 1.4);
  const rows = [['Keycloak', 'Tested: login, SSO, step-up, expiry, logout', TEAL, INK], ['Microsoft Entra ID', 'Template, untested. Uses authentication contexts; no documented login-time claim', AMBER, INK], ['Okta', 'Template, untested', AMBER, INK], ['Amazon Cognito', 'Template, untested. Needs managed login and a paid feature plan', AMBER, INK], ['Other OIDC', 'Generic profile, untested elsewhere', AMBER, INK]];
  rows.forEach((r, i) => { const y = 2.3 + i * 0.85; pill(s, 0.7, y + 0.1, 2.6, r[0], r[2], r[3]); s.addText(r[1], { x: 3.6, y, w: 9.0, h: 0.7, fontFace: BODY, fontSize: 17, color: INK, isTextBox: true, margin: 0, valign: 'middle' }); }); }

// 16 Security decisions
{ const s = content('Security decisions and honest trade-offs', 'PKCE and the code flow keep tokens out of URLs. Enforcement on the API makes browser tampering useless. Tokens in browser memory are weaker than a backend-for-frontend; we chose simplicity and say so. Known weaknesses: the window is really up to 65 seconds, many small transfers avoid the over 1000 rule, no back-channel logout, everything runs on plain http on localhost.', 'Security');
  take(s, 'For managers: strong where it matters, and we list where it is not production grade.', 1.4);
  card(s, 0.7, 2.3, 5.9, 3.9, 'Chosen on purpose', 'Authorization Code + PKCE everywhere\nStep-up enforced in the API\nTokens in memory; MVC keeps them on the server\nOne shared window, set by configuration', { size: 17 });
  card(s, 6.8, 2.3, 5.8, 3.9, 'Known weaknesses', 'Browser memory is exposed to XSS (a BFF is the production pattern)\nSmall transfers avoid step-up (no cumulative limits)\nNo front/back-channel logout\nDev setup: http, fake TOTP seed is public', { size: 17, headColor: RED }); }

// 17 Verified
{ const s = content('What was actually run, and what was only reviewed', 'Be precise. Run against live Keycloak with a headless browser: 13 end to end checks all passed, 7 negative-path checks all passed (IdP error on return, IdP ignoring the stronger-login request), 9 evaluator cases with shifted clock passed, API checks with curl. Only reviewed or not run: Windows, real tenants of other IdPs, Angular for the ignored-request case, real clock skew between two machines.', 'Security');
  take(s, 'For managers: we separate what we proved from what we only believe.', 1.4);
  card(s, 0.7, 2.3, 5.9, 3.9, 'Run, with evidence', 'Login, step-up, shared window, expiry, cancel, sign-out across all three apps\nIdP error and ignored step-up request\nEvaluator with shifted clock\nAPI refuses weak, stale and tampered tokens', { size: 16, headColor: '0B6B58', fill: 'E6FAF5' });
  card(s, 6.8, 2.3, 5.8, 3.9, 'Only reviewed, or not run', 'Windows laptop: nothing run\nEntra, Okta, Cognito: templates only\nAngular with an ignored request (same code pattern)\nReal clock skew between machines', { size: 16, headColor: '8A5A00', fill: 'FFF3D6' }); }

// 18 Next
{ const s = content('Limits and next steps', 'This is a proof of concept. Next steps if we continue: try it on the Windows laptop, test one real IdP tenant, move SPA tokens behind a backend-for-frontend, add cumulative limits, add back-channel logout, and consider WebAuthn passkeys.', 'Close');
  take(s, 'For managers: it works end to end in the lab; production needs the items below.', 1.4);
  card(s, 0.7, 2.3, 3.8, 3.7, 'Try next', 'Run on the Windows laptop\nTest a real Entra or Okta tenant');
  card(s, 4.75, 2.3, 3.8, 3.7, 'Harden', 'Backend-for-frontend for SPAs\nHTTPS everywhere\nCumulative transfer limits');
  card(s, 8.8, 2.3, 3.8, 3.7, 'Extend', 'Back-channel logout\nPasskeys (WebAuthn)\nPer-action window lengths'); }

// 19 Q&A
{ const s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'Close' }); n++;
  s.addText('Questions', { placeholder: 'title' });
  s.addText('Everything is in the repo: README, docs/, demo/, and the security review checklist', { x: 0.9, y: 3.9, w: 11.5, h: 0.6, fontFace: BODY, fontSize: 20, color: 'CADCFC', isTextBox: true, margin: 0 });
  s.addNotes('Use docs/presentation/rehearsal-guide.md for the ten likely questions and short answers.'); }

// ---- Appendix
{ const s = content('Appendix: glossary', 'Reference only. Not part of the 45 minute flow.', 'Appendix');
  const g = [['SSO', 'Log in once, use many apps'], ['IdP', 'The login service (Keycloak here)'], ['OIDC', 'The standard apps use to talk to the IdP'], ['PKCE', 'Protects the login code from theft'], ['Access token', 'Short-lived pass shown to the API'], ['acr', 'Token field: how strong the login was'], ['auth_time', 'Token field: when the user really logged in'], ['TOTP', '6-digit code from an authenticator app'], ['Step-up', 'Extra proof only for risky actions'], ['JWKS', 'The IdP public keys used to check tokens']];
  g.forEach((r, i) => { const col = i < 5 ? 0 : 1, row = i % 5; s.addText([{ text: r[0] + '  ', options: { bold: true, color: NAVY } }, { text: r[1], options: { color: INK } }], { x: 0.7 + col * 6.1, y: 1.7 + row * 0.95, w: 5.8, h: 0.8, fontFace: BODY, fontSize: 17, isTextBox: true, margin: 0, valign: 'middle' }); }); }

{ const s = content('Appendix: FAQ', 'Short answers. The rehearsal guide has more.', 'Appendix');
  const f = [['Why not just MFA at login?', 'It annoys users on every login; step-up asks only for risky actions.'], ['Where is the rule enforced?', 'In the API, from signed token claims.'], ['What if the IdP ignores the request?', 'Client and API both check the returned level; the action is not performed.'], ['Is refresh used?', 'No. A refresh would keep the old login time anyway.'], ['Does it work with Entra or Okta?', 'Templates exist; only Keycloak was tested.'], ['Why 60 seconds?', 'So expiry is visible in a live demo; it is a setting.']];
  f.forEach((r, i) => { const col = i % 2, row = Math.floor(i / 2); card(s, 0.7 + col * 6.1, 1.6 + row * 1.85, 5.8, 1.65, r[0], r[1], { size: 15 }); }); }

{ const s = content('Appendix: repo map and ports', 'Reference.', 'Appendix');
  const rows = [['apps/react', 'Customer Portal', '5300'], ['apps/angular', 'Payments and Transfers', '5400'], ['apps/mvc', 'Back Office', '5200'], ['api/', 'Shared API, enforces step-up', '5100'], ['idp/', 'Keycloak realm and IdP profiles', '8180'], ['packages/', 'Shared profile loaders and look', '-'], ['tools/ , demo/ , docs/', 'Probes, demo script, all documentation', '-']];
  const tbl = [[{ text: 'Folder', options: { bold: true, color: WHITE, fill: { color: NAVY } } }, { text: 'Purpose', options: { bold: true, color: WHITE, fill: { color: NAVY } } }, { text: 'Port', options: { bold: true, color: WHITE, fill: { color: NAVY } } }], ...rows.map((r) => r.map((t) => ({ text: t, options: { color: INK } })))];
  s.addTable(tbl, { x: 0.7, y: 1.6, w: 11.9, colW: [3.6, 6.9, 1.4], fontFace: BODY, fontSize: 16, border: { type: 'solid', color: LINE, pt: 1 }, rowH: 0.55 }); }

const out = path.resolve(import.meta.dirname, 'acme-bank-sso-stepup.pptx');
await pres.writeFile({ fileName: out });
console.log('written', out, 'slides', n);
