import { useNavigate } from 'react-router-dom'
import { useProfile } from '../../hooks/useProfile'
import type { Profile } from '../../data/types'
import { OnboardingFlow } from './OnboardingFlow'

export function EditProfile() {
  const profile = useProfile((state) => state.profile)
  const save = useProfile((state) => state.save)
  const navigate = useNavigate()
  const done = async (updated: Profile) => {
    await save(updated)
    void navigate('/')
  }
  return <OnboardingFlow initial={profile ?? undefined} onDone={done} />
}
