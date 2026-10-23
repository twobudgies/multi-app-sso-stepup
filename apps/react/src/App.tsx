import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from 'oidc-client-ts'
import { levelFromClaims, safeReturnPath, stepUpParams } from '../../../packages/idp-profile/index'
import { userManager } from './auth'
import { api, ApiError, StepUpRequired } from './api'
import { config } from './config'
import { Header, SessionPanel, StepUpModal, Toasts, type Me, type Toast } from './components'

const KNOWN_ACTIONS = ['change-email'] // never trusted for authorization: the API re-checks on retry
const FLASH = 'ab.flash'
const LOGGED_OUT = 'ab.loggedOut'

type Pending = { action: string; payload: unknown; title: string; reason: string; maxAge?: number }
type Carried = { action: string; payload: unknown; returnTo: string }

// Process the redirect callback exactly once (the one-time code cannot be used twice).
let callbackPromise: Promise<{ user: User | null; carried?: Carried; error?: string }> | null = null
type Start = { user: User | null; carried?: Carried; error?: string }
function processStart(): Promise<Start> {
  if (!callbackPromise) {
    callbackPromise = (async (): Promise<Start> => {
      if (window.location.pathname === '/callback') {
        try {
          const user = await userManager.signinCallback()
          const st = (user?.state ?? {}) as Partial<Carried>
          const returnTo = safeReturnPath(st.returnTo) // re-validate the allow-list
          window.history.replaceState({}, '', returnTo)
          const carried = st.action && KNOWN_ACTIONS.includes(st.action) ? { action: st.action, payload: st.payload, returnTo } : undefined
          return { user: user ?? null, carried }
        } catch (e: any) {
          window.history.replaceState({}, '', '/')
          return { user: null, error: e?.error === 'access_denied' || /cancel/i.test(String(e?.message)) ? 'Step-up was cancelled. Nothing was changed.' : `Sign-in failed: ${e?.message ?? e}` }
        }
      }
      return { user: null }
    })()
  }
  return callbackPromise!
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState<'loading' | 'signedout' | 'ready'>('loading')
  const [tab, setTab] = useState<'accounts' | 'profile'>('accounts')
  const [accounts, setAccounts] = useState<any[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [email, setEmail] = useState('')
  const started = useRef(false)
  const tokenRef = useRef('')

  const toast = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000)
  }, [])

  const refresh = useCallback(async (token: string) => {
    const m = await api<Me>(token, '/me')
    setMe(m); setOffset(m.serverTime - Date.now() / 1000); setEmail(m.email)
    setAccounts(await api(token, '/accounts'))
    return m
  }, [])

  const signIn = useCallback((extra?: { state?: unknown; extraQueryParams?: Record<string, string> }) =>
    userManager.signinRedirect(extra), [])

  const run = useCallback(async (action: string, payload: any, title: string, token = tokenRef.current, isRetry = false) => {
    setBusy(true)
    try {
      const r = await api<any>(token, `/sensitive/${action}`, payload)
      toast('ok', `${title}: done.`)
      await refresh(token)
      return r
    } catch (e) {
      if (e instanceof StepUpRequired && !isRetry) {
        setPending({ action, payload, title, reason: e.info.message, maxAge: e.info.maxAge })
      } else if (e instanceof StepUpRequired) {
        toast('err', 'The identity provider did not give a strong enough login, so the action was NOT performed.')
      } else toast('err', e instanceof ApiError ? e.message : String(e))
    } finally { setBusy(false) }
  }, [refresh, toast])

  useEffect(() => {
    if (started.current) return
    started.current = true
    ;(async () => {
      const res = await processStart()
      const flash = sessionStorage.getItem(FLASH)
      if (res.error) { // never auto-retry after an IdP error: a persistent error would loop forever
        setErrorText(res.error); setPhase('signedout'); return
      }
      if (!res.user) {
        if (sessionStorage.getItem(LOGGED_OUT)) { setPhase('signedout'); return }
        await signIn() // SSO: if the IdP session exists, no password prompt
        return
      }
      sessionStorage.removeItem(LOGGED_OUT)
      tokenRef.current = res.user.access_token
      setUser(res.user)
      if (flash) { toast('info', flash); sessionStorage.removeItem(FLASH) }
      try {
        const m = await refresh(res.user.access_token)
        setPhase('ready')
        if (res.carried) {
          const lvl = levelFromClaims(config.profile, res.user.profile as Record<string, unknown>)
          if (lvl !== 'LoA2') toast('err', 'The identity provider did not raise the login level, so the action was NOT performed.')
          else if (res.carried.returnTo === '/profile') { setTab('profile'); await run(res.carried.action, res.carried.payload, 'Change e-mail', res.user.access_token, true) }
        }
        void m
      } catch (e) { toast('err', String(e)); setPhase('ready') }
    })()
  }, [refresh, run, signIn, toast])

  // pick up flash messages (e.g. cancelled step-up) after the redirect round trip
  useEffect(() => { if (phase === 'ready') { const f = sessionStorage.getItem(FLASH); if (f) { toast('info', f); sessionStorage.removeItem(FLASH) } } }, [phase, toast])

  const signOut = async () => {
    sessionStorage.setItem(LOGGED_OUT, '1')
    await userManager.signoutRedirect({ id_token_hint: user?.id_token })
  }

  const goStepUp = () => {
    if (!pending) return
    const p = pending; setPending(null)
    void signIn({
      state: { action: p.action, payload: p.payload, returnTo: '/profile' }, // non-sensitive only
      extraQueryParams: stepUpParams(config.profile, p.maxAge ?? me?.stepUpWindowSeconds),
    })
  }

  if (phase === 'loading') return (<><Header /><div className="ab-center"><div><span className="ab-spinner" /></div><div>Signing you in through Acme Bank single sign-on...</div></div></>)
  if (phase === 'signedout') return (<><Header /><div className="ab-center"><h1>{errorText ? 'Sign-in was not completed' : 'You are signed out'}</h1><p className="lead">{errorText || 'Your Acme Bank session has ended.'}</p><button className="ab-btn primary" onClick={() => { sessionStorage.removeItem(LOGGED_OUT); void signIn() }}>Sign in</button></div></>)

  return (
    <>
      <Header onSignOut={signOut} />
      <SessionPanel me={me} offset={offset} />
      <main className="ab-main">
        <h1>Welcome back, {me?.name ?? me?.user}</h1>
        <p className="lead">Customer Portal: your accounts and profile.</p>
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
          <button className={'ab-btn' + (tab === 'accounts' ? ' primary' : '')} onClick={() => setTab('accounts')}>Accounts</button>
          <button className={'ab-btn' + (tab === 'profile' ? ' primary' : '')} onClick={() => setTab('profile')}>Profile</button>
        </div>
        {tab === 'accounts' && (
          <div className="ab-grid">
            {accounts.map((a) => (
              <div className="ab-card" key={a.id}><div className="tag">{a.id}</div><h2>{a.name}</h2>
                <div className="ab-amount">{a.balance.toLocaleString('en', { style: 'currency', currency: a.currency })}</div>
                <span className="tag">Available balance</span></div>
            ))}
          </div>
        )}
        {tab === 'profile' && (
          <div className="ab-grid">
            <div className="ab-card"><div className="tag">Personal details</div><h2>{me?.name} (@{me?.user})</h2>
              <p>E-mail on file<br /><b>{me?.email}</b></p></div>
            <div className="ab-card"><div className="tag">Security</div>
              <h2>Change e-mail address <span className="ab-sensitive-tag">NEEDS STEP-UP</span></h2>
              <label className="ab-field">New e-mail<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" /></label>
              <button className="ab-btn primary" disabled={busy} onClick={() => run('change-email', { email }, 'Change e-mail')}>{busy ? <span className="ab-spinner" /> : 'Save e-mail'}</button>
            </div>
          </div>
        )}
      </main>
      {pending && <StepUpModal title={pending.title} reason={pending.reason} windowSeconds={me?.stepUpWindowSeconds ?? 60} onGo={goStepUp} onCancel={() => { setPending(null); toast('info', 'Cancelled. Nothing was changed.') }} />}
      <Toasts items={toasts} />
    </>
  )
}
