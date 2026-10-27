import { TextArea, TextField } from '../../../components/ui'
import type { ComponentEvaluation } from '../../../data/types'
import { MediaSection, type MediaLibrary } from '../../media'
import type { RequiredErrors } from '../schema'

type ComponentFormProps = {
  component: ComponentEvaluation
  errors: RequiredErrors
  library: MediaLibrary
  onChange: (update: (component: ComponentEvaluation) => ComponentEvaluation) => void
}

export function ComponentForm({ component, errors, library, onChange }: ComponentFormProps) {
  const set = (patch: Partial<ComponentEvaluation>) => onChange((c) => ({ ...c, ...patch }))
  return (
    <>
      <div className="eval__fields">
        <TextField
          label="Component"
          placeholder="For example battery, headlamp, seat"
          value={component.name}
          error={errors.name}
          maxLength={120}
          onChange={(event) => set({ name: event.target.value })}
        />
        <TextField
          label="Manufacturer"
          placeholder="Supplier or truck brand"
          value={component.manufacturer}
          maxLength={120}
          onChange={(event) => set({ manufacturer: event.target.value })}
        />
      </div>
      <MediaSection
        label="Images, videos and voice notes"
        library={library}
        target={{ role: 'component' }}
        ids={component.mediaIds}
        onIdsChange={(update) => onChange((c) => ({ ...c, mediaIds: update(c.mediaIds) }))}
      />
      <TextArea
        label="Comments and observations"
        value={component.comments}
        rows={5}
        maxLength={5000}
        onChange={(event) => set({ comments: event.target.value })}
      />
    </>
  )
}
