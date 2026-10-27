import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Button, EmailField, TextField } from '../../components/ui'
import { profileSchema, type ProfileFormInput } from '../../data/schemas'
import type { Profile } from '../../data/types'
import { requestPersistence } from '../../lib/storage'

type OnboardingFlowProps = {
  initial?: Profile
  onDone: (profile: Profile) => Promise<void> | void
}

// One page for the first start and for editing the profile later.
export function OnboardingFlow({ initial, onDone }: OnboardingFlowProps) {
  const [saving, setSaving] = useState(false)
  const form = useForm<ProfileFormInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { email: initial?.email ?? '', name: initial?.name ?? '' },
    mode: 'onTouched',
  })
  const { register, control, formState } = form
  const { errors } = formState

  const submit = form.handleSubmit(async (values) => {
    setSaving(true)
    if (!initial) await requestPersistence()
    try {
      await onDone({ email: values.email, name: values.name.trim() })
    } finally {
      setSaving(false)
    }
  })

  return (
    <form className="onboarding" onSubmit={submit} noValidate>
      <div className="onboarding__body">
        <div className="onboarding__step">
          <h1 className="onboarding__title">{initial ? 'Your profile' : 'Welcome'}</h1>
          <p>Tell us who is evaluating. Your e-mail identifies your evaluations in the export.</p>
          <Controller
            control={control}
            name="email"
            render={({ field }) => (
              <EmailField
                name={field.name}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={errors.email?.message}
                hint="Use your work e-mail"
              />
            )}
          />
          <TextField
            label="Name (optional)"
            autoComplete="name"
            error={errors.name?.message}
            {...register('name')}
          />
          <p className="onboarding__notice">
            Your answers, photos, videos and voice notes stay on this device until you export them.
            Nothing is sent to any server.
          </p>
        </div>
      </div>
      <div className="onboarding__actions">
        <Button type="submit" disabled={saving} className="onboarding__primary">
          {initial ? 'Save profile' : 'Start'}
        </Button>
      </div>
    </form>
  )
}
