import { Injectable } from '@angular/core';
import { OAuthService, OAuthStorage, AuthConfig } from 'angular-oauth2-oidc';
import { levelFromClaims, safeReturnPath, stepUpParams } from '../../../../packages/idp-profile/index';
import { config } from './config';

/** Tokens stay in memory. Only the short-lived PKCE verifier / nonce / state survive the redirect (sessionStorage). */
class SplitStorage implements OAuthStorage {
  private mem = new Map<string, string>();
  private persistent = (k: string) => /^(nonce|PKCE_verifier|session_state|requested_route)/.test(k);
  getItem(k: string) { return this.persistent(k) ? sessionStorage.getItem(k) : (this.mem.get(k) ?? null); }
  setItem(k: string, v: string) { this.persistent(k) ? sessionStorage.setItem(k, v) : this.mem.set(k, v); }
  removeItem(k: string) { this.persistent(k) ? sessionStorage.removeItem(k) : this.mem.delete(k); }
}

export interface Carried { action: string; payload: unknown; returnTo: string }
const KNOWN_ACTIONS = ['add-payee', 'transfer'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  carried: Carried | null = null;
  startError: string | null = null;

  constructor(private oauth: OAuthService) {
    const cfg: AuthConfig = {
      issuer: config.issuer,
      clientId: config.clientId,
      redirectUri: window.location.origin + '/',
      postLogoutRedirectUri: window.location.origin + '/',
      responseType: 'code', // Authorization Code + PKCE (S256)
      scope: 'openid profile email',
      showDebugInformation: false,
      requireHttps: false, // dev only: Keycloak on http://localhost
      strictDiscoveryDocumentValidation: false,
      clearHashAfterLogin: true,
      disablePKCE: false,
      useSilentRefresh: false,
    };
    oauth.configure(cfg);
    oauth.setStorage(new SplitStorage());
  }

  /** Returns true when signed in (state and nonce are verified by the library). */
  async init(): Promise<boolean> {
    try {
      await this.oauth.loadDiscoveryDocumentAndTryLogin();
    } catch (e: any) {
      this.startError = e?.params?.error === 'access_denied' ? 'Step-up was cancelled. Nothing was changed.' : `Sign-in failed: ${e?.message ?? e}`;
      return false;
    }
    const q = new URLSearchParams(window.location.search);
    if (q.get('error')) {
      this.startError = q.get('error') === 'access_denied' ? 'Step-up was cancelled. Nothing was changed.' : `Sign-in failed: ${q.get('error')}`;
      window.history.replaceState({}, '', '/');
      return false;
    }
    if (!this.oauth.hasValidAccessToken()) return false;
    // our own state travels after the library's state nonce, after ';'
    const raw = this.oauth.state ? decodeURIComponent(this.oauth.state) : '';
    if (raw) {
      try {
        const s = JSON.parse(atob(raw));
        const returnTo = safeReturnPath(s.returnTo); // re-validate allow-list
        if (KNOWN_ACTIONS.includes(s.action)) this.carried = { action: s.action, payload: s.payload, returnTo };
        window.history.replaceState({}, '', returnTo);
      } catch { /* ignore malformed state */ }
    }
    return true;
  }

  get token() { return this.oauth.getAccessToken(); }
  get claims() { return (this.oauth.getIdentityClaims() ?? {}) as Record<string, unknown>; }
  get level() { return levelFromClaims(config.profile, this.claims); }

  signIn() { this.oauth.initCodeFlow(); }
  stepUp(state: Carried, maxAge?: number) {
    const params = stepUpParams(config.profile, maxAge);
    this.oauth.initCodeFlow(btoa(JSON.stringify(state)), params); // state: non-sensitive only
  }
  signOut() { sessionStorage.setItem('ab.loggedOut', '1'); this.oauth.logOut(); }
}
