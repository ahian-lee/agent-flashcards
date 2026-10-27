import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// vitest runs with `globals: false`, so Testing Library cannot auto-register
// its cleanup hook; do it explicitly to keep each test's DOM isolated.
afterEach(() => {
  cleanup()
})
