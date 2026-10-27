import { z } from 'zod'

// zod 4 probes `new Function` for its JIT; the CSP (no 'unsafe-eval') blocks it and logs an error.
// Import `z` from here so the setting applies before any schema is built.
z.config({ jitless: true })

export { z }
