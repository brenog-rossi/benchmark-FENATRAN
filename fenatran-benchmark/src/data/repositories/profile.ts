import { db } from '../db'
import type { Profile, StoredProfile } from '../types'

export const profileRepository = {
  async get(): Promise<Profile | undefined> {
    const stored = await db.profile.get('profile')
    if (!stored) return undefined
    const profile: Partial<StoredProfile> = { ...stored }
    delete profile.id
    return profile as Profile
  },

  async save(profile: Profile): Promise<void> {
    await db.profile.put({ ...profile, id: 'profile' })
  },
}
