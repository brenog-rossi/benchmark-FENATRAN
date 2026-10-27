import { db } from '../db'
import type { Media } from '../types'

export const mediaRepository = {
  async add(media: Media): Promise<void> {
    await db.media.add(media)
  },

  get(id: string): Promise<Media | undefined> {
    return db.media.get(id)
  },

  async update(id: string, changes: Partial<Omit<Media, 'id'>>): Promise<void> {
    await db.media.update(id, changes)
  },

  listByEvaluation(evaluationId: string): Promise<Media[]> {
    return db.media.where('evaluationId').equals(evaluationId).sortBy('createdAt')
  },

  async remove(id: string): Promise<void> {
    await db.media.delete(id)
  },

  async removeByEvaluation(evaluationId: string): Promise<void> {
    await db.media.where('evaluationId').equals(evaluationId).delete()
  },

  async totalBytes(): Promise<number> {
    let total = 0
    await db.media.each((media) => {
      total += media.blob.size
    })
    return total
  },
}
