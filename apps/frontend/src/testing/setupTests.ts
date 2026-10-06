import '@testing-library/jest-dom/vitest'

import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// A loaded CI runner takes over a second to mount the first MUI screen.
configure({ reactStrictMode: true, asyncUtilTimeout: 3000 })

afterEach(cleanup)
