import { InMemoryWebStorage, UserManager, WebStorageStateStore } from 'oidc-client-ts'
import { config } from './config'

// Tokens live in memory only (never localStorage). The library keeps the short-lived
// login "state" (non-sensitive: PKCE verifier, our action id, return path) in sessionStorage during the redirect.
export const userManager = new UserManager({
  authority: config.issuer,
  client_id: config.clientId,
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: `${window.location.origin}/`,
  response_type: 'code', // Authorization Code + PKCE (S256 is the library default)
  scope: 'openid profile email',
  userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
  stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  automaticSilentRenew: false,
  loadUserInfo: false,
  // keep acr and auth_time in user.profile (stripped by default); the client only reads them to detect an ignored step-up
  filterProtocolClaims: ['iss', 'aud', 'exp', 'nbf', 'iat', 'jti', 'nonce', 'azp', 'at_hash'],
})
