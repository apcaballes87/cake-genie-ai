import { describe, expect, it } from 'vitest'
import { genieBusinessProfile } from './genieBusinessProfile'

describe('Genie.ph founding history', () => {
  it('uses 2025 as the founding year across public business facts', () => {
    expect(genieBusinessProfile.foundedYear).toBe(2025)
  })
})
