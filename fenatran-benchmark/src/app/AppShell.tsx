import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '../hooks/useProfile'

type AppShellProps = { children: ReactNode }

export function AppShell({ children }: AppShellProps) {
  const hasProfile = useProfile((state) => Boolean(state.profile))
  return (
    <div className="shell">
      <header className="shell__header">
        <Link to="/" className="shell__title">
          FENATRAN 2026 Benchmark
        </Link>
        {hasProfile && (
          <Link to="/profile" className="shell__link">
            Profile
          </Link>
        )}
      </header>
      <main className="shell__main">{children}</main>
      <footer className="shell__footer">Your data stays on this device until you export it</footer>
    </div>
  )
}

type TwoPaneProps = { list: ReactNode; detail: ReactNode; active?: 'list' | 'detail' }

// >= 1024 px: both panes side by side. Below that the panes stack, or only the `active` one shows.
export function TwoPane({ list, detail, active }: TwoPaneProps) {
  return (
    <div className={active ? `twopane twopane--${active}` : 'twopane'}>
      <section className="twopane__list" aria-label="List">
        {list}
      </section>
      <section className="twopane__detail" aria-label="Editor">
        {detail}
      </section>
    </div>
  )
}
