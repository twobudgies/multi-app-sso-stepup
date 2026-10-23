import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { api, ApiError, StepUpRequired } from './api';
import { config } from './config';

interface Me { user: string; name: string; level: string; authTime: number | null; exp: number; stepUpWindowSeconds: number; serverTime: number }
interface Toast { id: number; kind: 'ok' | 'err' | 'info'; text: string }
interface Pending { action: string; payload: any; title: string; reason: string; maxAge?: number }

const TITLES: Record<string, string> = { 'add-payee': 'Add payee', transfer: 'Send money' };
const LIMIT_NOTE = 1000;

@Component({
  selector: 'app-root',
  template: `
  <header class="ab-header">
    <div class="ab-brand"><span class="ab-logo">A</span> Acme Bank</div>
    <nav class="ab-nav">
      @for (a of cfg.apps; track a.id) { <a [href]="a.url" [class.active]="a.id === cfg.appId">{{ a.name }}</a> }
    </nav>
    @if (phase() === 'ready') { <button class="ab-btn" (click)="auth.signOut()">Sign out</button> }
  </header>

  @if (phase() === 'loading') {
    <div class="ab-center"><div><span class="ab-spinner"></span></div><div>Signing you in through Acme Bank single sign-on...</div></div>
  } @else if (phase() === 'signedout') {
    <div class="ab-center"><h1>You are signed out</h1><p class="lead">Your Acme Bank session has ended.</p>
      <button class="ab-btn primary" (click)="signInAgain()">Sign in</button></div>
  } @else {
    <section class="ab-session" aria-label="Session panel">
      <div><span class="k">App</span><span class="v">{{ cfg.appName }}</span></div>
      <div><span class="k">User</span><span class="v">{{ me()?.user ?? '...' }}</span></div>
      <div><span class="k">Assurance (acr)</span><span class="v"><span class="ab-badge" [class.loa2]="me()?.level === 'LoA2'" [class.loa1]="me()?.level !== 'LoA2'">{{ me()?.level === 'LoA2' ? 'LoA2 password + TOTP' : 'LoA1 password' }}</span></span></div>
      <div><span class="k">Authenticated at (auth_time)</span><span class="v">{{ authTimeText() }}</span></div>
      <div class="ab-countdown" [class.low]="left() > 0 && left() <= 15" [class.off]="left() === 0" style="flex:1">
        <span class="k">Step-up window ({{ win() }}s)</span>
        <span class="v">{{ left() > 0 ? fmt(left()) + ' left' : (me()?.level === 'LoA2' ? 'expired: next sensitive action asks again' : 'no step-up active') }}</span>
        <div class="bar"><i [style.width.%]="left() / win() * 100"></i></div>
      </div>
    </section>

    <main class="ab-main">
      <h1>Payments and Transfers</h1>
      <p class="lead">Send money and manage who you pay.</p>
      <div class="ab-tabs">
        <button class="ab-btn" [class.primary]="tab() === 'send'" (click)="tab.set('send')">Send money</button>
        <button class="ab-btn" [class.primary]="tab() === 'payees'" (click)="tab.set('payees')">Payees</button>
      </div>

      @if (tab() === 'send') {
        <div class="ab-grid">
          <div class="ab-card">
            <h2>Send money <span class="ab-sensitive-tag">OVER {{ limitNote }} NEEDS STEP-UP</span></h2>
            <label class="ab-field">To<select [value]="to()" (change)="to.set($any($event.target).value)">
              @for (p of payees(); track p.name) { <option [value]="p.name">{{ p.name }}</option> }</select></label>
            <label class="ab-field">Amount (EUR)<input type="number" min="1" [value]="amount()" (input)="amount.set(+$any($event.target).value)" /></label>
            <div class="ab-note" style="margin-bottom:.8rem">{{ amount() > limitNote ? 'Large transfer: the bank will ask for extra verification.' : 'Small transfer: no extra verification needed.' }}</div>
            <button class="ab-btn primary" [disabled]="busy()" (click)="send()">@if (busy()) { <span class="ab-spinner"></span> } @else { Send }</button>
          </div>
          <div class="ab-card">
            <h2>Recent transfers</h2>
            <table class="ab-table"><thead><tr><th>To</th><th>Amount</th><th>Status</th></tr></thead><tbody>
              @for (t of transfers(); track t.id) { <tr><td>{{ t.to }}</td><td>{{ t.amount }} EUR</td><td><span class="ab-status" [class]="t.status">{{ t.status }}</span></td></tr> }
            </tbody></table>
          </div>
        </div>
      } @else {
        <div class="ab-grid">
          <div class="ab-card"><h2>Your payees</h2>
            <table class="ab-table"><thead><tr><th>Name</th><th>Account</th></tr></thead><tbody>
              @for (p of payees(); track p.name) { <tr><td>{{ p.name }}</td><td>{{ p.iban }}</td></tr> }
            </tbody></table></div>
          <div class="ab-card"><h2>Add payee <span class="ab-sensitive-tag">NEEDS STEP-UP</span></h2>
            <label class="ab-field">Name<input [value]="newName()" (input)="newName.set($any($event.target).value)" /></label>
            <label class="ab-field">Account number<input [value]="newIban()" (input)="newIban.set($any($event.target).value)" /></label>
            <button class="ab-btn primary" [disabled]="busy()" (click)="addPayee()">@if (busy()) { <span class="ab-spinner"></span> } @else { Add payee }</button></div>
        </div>
      }
    </main>

    @if (pending(); as p) {
      <div class="ab-modal-backdrop" role="dialog" aria-modal="true"><div class="ab-modal">
        <h2>Extra verification needed</h2>
        <p><b>{{ p.title }}</b> is a sensitive action. Being signed in is not enough: the bank needs proof that it is really you, right now.</p>
        <div class="ab-note">{{ p.reason }}</div>
        <ol class="ab-steps"><li>You go to the secure login page</li><li>Enter the 6-digit code from your authenticator app</li><li>You come back here and the action completes. The proof counts for {{ win() }} seconds, in all Acme Bank apps</li></ol>
        <div class="actions"><button class="ab-btn" (click)="cancel()">Not now</button><button class="ab-btn primary" (click)="goStepUp()">Verify with authenticator</button></div>
      </div></div>
    }
  }
  <div class="ab-toasts" role="status">@for (t of toasts(); track t.id) { <div class="ab-toast" [class]="t.kind">{{ t.text }}</div> }</div>
  `,
})
export class App implements OnInit, OnDestroy {
  cfg = config;
  limitNote = LIMIT_NOTE;
  phase = signal<'loading' | 'signedout' | 'ready'>('loading');
  tab = signal<'send' | 'payees'>('send');
  me = signal<Me | null>(null);
  offset = signal(0);
  now = signal(Date.now());
  payees = signal<any[]>([]);
  transfers = signal<any[]>([]);
  toasts = signal<Toast[]>([]);
  pending = signal<Pending | null>(null);
  busy = signal(false);
  to = signal('');
  amount = signal(50);
  newName = signal('');
  newIban = signal('');
  private timer: any;

  win = computed(() => this.me()?.stepUpWindowSeconds ?? 60);
  left = computed(() => {
    const m = this.me();
    return m?.authTime && m.level === 'LoA2' ? Math.max(0, Math.ceil(m.authTime + this.win() - (this.now() / 1000 + this.offset()))) : 0;
  });
  authTimeText = computed(() => { const t = this.me()?.authTime; return t ? new Date(t * 1000).toLocaleTimeString() : '...'; });

  constructor(public auth: AuthService) {}
  fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  toast(kind: Toast['kind'], text: string) {
    const id = Date.now() + Math.random();
    this.toasts.update((t) => [...t, { id, kind, text }]);
    setTimeout(() => this.toasts.update((t) => t.filter((x) => x.id !== id)), 6000);
  }

  async ngOnInit() {
    this.timer = setInterval(() => this.now.set(Date.now()), 500);
    const ok = await this.auth.init();
    const flash = sessionStorage.getItem('ab.flash');
    if (this.auth.startError) sessionStorage.setItem('ab.flash', this.auth.startError);
    if (!ok) {
      if (sessionStorage.getItem('ab.loggedOut')) { this.phase.set('signedout'); return; }
      this.auth.signIn(); // SSO: no prompt if the IdP session exists
      return;
    }
    sessionStorage.removeItem('ab.loggedOut');
    if (flash) { this.toast('info', flash); sessionStorage.removeItem('ab.flash'); }
    try {
      await this.refresh();
      this.phase.set('ready');
      const c = this.auth.carried;
      if (c) {
        if (this.auth.level !== 'LoA2') this.toast('err', 'The identity provider did not raise the login level, so the action was NOT performed.');
        else { this.tab.set(c.returnTo === '/payees' ? 'payees' : 'send'); await this.run(c.action, c.payload, true); }
      }
    } catch (e) { this.toast('err', String(e)); this.phase.set('ready'); }
  }
  ngOnDestroy() { clearInterval(this.timer); }

  signInAgain() { sessionStorage.removeItem('ab.loggedOut'); this.auth.signIn(); }

  async refresh() {
    const t = this.auth.token;
    const m = await api<Me>(t, '/me');
    this.me.set(m); this.offset.set(m.serverTime - Date.now() / 1000);
    this.payees.set(await api(t, '/payees')); this.transfers.set(await api(t, '/transfers'));
    if (!this.to() && this.payees().length) this.to.set(this.payees()[0].name);
  }

  send() { return this.run('transfer', { amount: this.amount(), to: this.to() }); }
  addPayee() { return this.run('add-payee', { payeeName: this.newName(), iban: this.newIban() || undefined }); }

  async run(action: string, payload: any, isRetry = false) {
    const title = TITLES[action] ?? action;
    this.busy.set(true);
    try {
      await api(this.auth.token, `/sensitive/${action}`, payload);
      this.toast('ok', `${title}: done.`);
      if (action === 'add-payee') { this.newName.set(''); this.newIban.set(''); }
      await this.refresh();
    } catch (e) {
      if (e instanceof StepUpRequired && !isRetry) this.pending.set({ action, payload, title, reason: e.message, maxAge: e.maxAge });
      else if (e instanceof StepUpRequired) this.toast('err', 'The identity provider did not give a strong enough login, so the action was NOT performed.');
      else this.toast('err', e instanceof ApiError ? e.message : String(e));
    } finally { this.busy.set(false); }
  }

  cancel() { this.pending.set(null); this.toast('info', 'Cancelled. Nothing was changed.'); }
  goStepUp() {
    const p = this.pending(); if (!p) return;
    this.pending.set(null);
    this.auth.stepUp({ action: p.action, payload: p.payload, returnTo: this.tab() === 'payees' ? '/payees' : '/' }, p.maxAge ?? this.me()?.stepUpWindowSeconds);
  }
}
