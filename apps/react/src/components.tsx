import { useEffect, useState } from 'react'
import { config } from './config'

export interface Me { user: string; name: string; email: string; level: 'LoA1' | 'LoA2' | 'unknown'; authTime: number | null; exp: number; stepUpWindowSeconds: number; serverTime: number }

export function Header({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <header className="ab-header">
      <div className="ab-brand"><span className="ab-logo">A</span> Acme Bank</div>
      <nav className="ab-nav">
        {config.apps.map((a) => (
          <a key={a.id} href={a.url} className={a.id === config.appId ? 'active' : ''}>{a.name}</a>
        ))}
      </nav>
      {onSignOut && <button className="ab-btn" onClick={onSignOut}>Sign out</button>}
    </header>
  )
}

function useNow(ms = 500) {
  const [n, setN] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return n
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function SessionPanel({ me, offset }: { me: Me | null; offset: number }) {
  const now = useNow()
  const nowSrv = now / 1000 + offset
  const win = me?.stepUpWindowSeconds ?? 60
  const left = me?.authTime && me.level === 'LoA2' ? Math.max(0, Math.ceil(me.authTime + win - nowSrv)) : 0
  const cls = 'ab-countdown' + (left === 0 ? ' off' : left <= 15 ? ' low' : '')
  return (
    <section className="ab-session" aria-label="Session panel">
      <div><span className="k">App</span><span className="v">{config.appName}</span></div>
      <div><span className="k">User</span><span className="v">{me?.user ?? '...'}</span></div>
      <div><span className="k">Assurance (acr)</span><span className="v">{me ? <span className={`ab-badge ${me.level === 'LoA2' ? 'loa2' : 'loa1'}`}>{me.level === 'LoA2' ? 'LoA2 password + TOTP' : 'LoA1 password'}</span> : '...'}</span></div>
      <div><span className="k">Authenticated at (auth_time)</span><span className="v">{me?.authTime ? new Date(me.authTime * 1000).toLocaleTimeString() : '...'}</span></div>
      <div className={cls} style={{ flex: 1 }}>
        <span className="k">Step-up window ({win}s)</span>
        <span className="v">{left > 0 ? `${fmt(left)} left` : me?.level === 'LoA2' ? 'expired: next sensitive action asks again' : 'no step-up active'}</span>
        <div className="bar"><i style={{ width: `${(left / win) * 100}%` }} /></div>
      </div>
    </section>
  )
}

export type Toast = { id: number; kind: 'ok' | 'err' | 'info'; text: string }
export function Toasts({ items }: { items: Toast[] }) {
  return <div className="ab-toasts" role="status">{items.map((t) => <div key={t.id} className={`ab-toast ${t.kind}`}>{t.text}</div>)}</div>
}

export function StepUpModal({ title, reason, windowSeconds, onGo, onCancel }: { title: string; reason: string; windowSeconds: number; onGo: () => void; onCancel: () => void }) {
  return (
    <div className="ab-modal-backdrop" role="dialog" aria-modal="true">
      <div className="ab-modal">
        <h2>Extra verification needed</h2>
        <p><b>{title}</b> is a sensitive action. Being signed in is not enough: the bank needs proof that it is really you, right now.</p>
        <div className="ab-note">{reason}</div>
        <ol className="ab-steps">
          <li>You go to the secure login page</li>
          <li>Enter the 6-digit code from your authenticator app</li>
          <li>You come back here and the action completes. The proof counts for {windowSeconds} seconds, in all Acme Bank apps</li>
        </ol>
        <div className="actions">
          <button className="ab-btn" onClick={onCancel}>Not now</button>
          <button className="ab-btn primary" onClick={onGo}>Verify with authenticator</button>
        </div>
      </div>
    </div>
  )
}
