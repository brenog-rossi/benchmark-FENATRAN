import { useEffect, type ReactNode } from 'react'
import { ReadError } from '../../components/ui'
import { useProfile } from '../../hooks/useProfile'
import { OnboardingFlow } from './OnboardingFlow'

// Shows onboarding until a profile is saved, then the wrapped content.
export function ProfileGate({ children }: { children: ReactNode }) {
  const profile = useProfile((state) => state.profile)
  const failed = useProfile((state) => state.failed)
  const load = useProfile((state) => state.load)
  const save = useProfile((state) => state.save)

  useEffect(() => {
    if (profile === undefined) void load()
  }, [profile, load])

  if (failed) return <ReadError onRetry={() => void load()} />
  if (profile === undefined) return <p className="onboarding__loading">Loading...</p>
  if (profile === null) return <OnboardingFlow onDone={save} />
  return children
}
