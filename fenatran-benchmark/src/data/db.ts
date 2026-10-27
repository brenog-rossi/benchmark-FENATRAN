import Dexie, { type EntityTable } from 'dexie'
import type { Evaluation, Media, StoredProfile } from './types'

const DB_NAME = 'fenatran-benchmark-2026'

export class BenchmarkDb extends Dexie {
  profile!: EntityTable<StoredProfile, 'id'>
  evaluations!: EntityTable<Evaluation, 'id'>
  media!: EntityTable<Media, 'id'>

  constructor(name = DB_NAME) {
    super(name)
    this.version(1).stores({
      profile: 'id',
      evaluations: 'id, status, updatedAt',
      media: 'id, evaluationId',
    })
    // v2: the profile keeps only name and e-mail.
    this.version(2).upgrade((tx) =>
      tx
        .table('profile')
        .toCollection()
        .modify((profile: Record<string, unknown>) => {
          for (const key of Object.keys(profile)) {
            if (!['id', 'name', 'email'].includes(key)) delete profile[key]
          }
        }),
    )
  }
}

export const db = new BenchmarkDb()
