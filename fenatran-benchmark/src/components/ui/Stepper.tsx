import { Progress } from './Progress'

type StepperProps = { current: number; total: number }

// current is 1-based
export function Stepper({ current, total }: StepperProps) {
  return (
    <div className="stepper">
      <span className="label">
        Step {current} of {total}
      </span>
      <Progress value={current} max={total} label={`Step ${current} of ${total}`} />
    </div>
  )
}
