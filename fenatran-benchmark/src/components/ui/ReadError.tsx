import { Button } from './Button'
import { EmptyState } from './EmptyState'

// Shown when data on the device could not be read, instead of an endless "Loading...".
export function ReadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert">
      <EmptyState
        icon="error"
        title="Could not read data on this device"
        text="Nothing was deleted. Try again; if it keeps failing, close and reopen the app."
        action={<Button onClick={onRetry}>Try again</Button>}
      />
    </div>
  )
}
