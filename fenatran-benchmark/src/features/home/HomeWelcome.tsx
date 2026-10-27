import { useProfile } from '../../hooks/useProfile'

const STEPS = [
  'Tap New evaluation and choose Truck or Component.',
  'Fill in what you see. Add photos, videos and voice notes; everything saves automatically.',
  'Finalize when you are done. You can still edit later.',
  'At the end of the day, export and send everything to the WhatsApp group.',
]

export function HomeWelcome() {
  const name = useProfile((state) => state.profile?.name ?? '')
  return (
    <div className="welcome">
      <span className="label">FENATRAN 2026</span>
      <h1>Welcome{name ? `, ${name.split(' ')[0]}` : ''}</h1>
      <ol className="welcome__steps">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="welcome__note">
        Works offline. Nothing is sent to any server; data stays on this device until you export it.
      </p>
    </div>
  )
}
