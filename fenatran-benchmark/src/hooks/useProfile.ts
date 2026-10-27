import { create } from 'zustand'
import { profileRepository } from '../data/repositories/profile'
import type { Profile } from '../data/types'

// undefined = still loading, null = no profile saved yet; failed = the read threw
type ProfileState = {
  profile: Profile | null | undefined
  failed: boolean
  load: () => Promise<void>
  save: (profile: Profile) => Promise<void>
}

export const useProfile = create<ProfileState>((set) => ({
  profile: undefined,
  failed: false,
  load: async () => {
    set({ failed: false })
    try {
      set({ profile: (await profileRepository.get()) ?? null })
    } catch {
      set({ failed: true })
    }
  },
  save: async (profile) => {
    await profileRepository.save(profile)
    set({ profile })
  },
}))
