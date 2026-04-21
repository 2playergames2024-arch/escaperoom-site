import { createClient } from '@sanity/client'

export const client = createClient({
  projectId: 'y7gmp9xi',
  dataset: 'production',
  apiVersion: '2026-04-01',   // current safe date
  useCdn: true,
})