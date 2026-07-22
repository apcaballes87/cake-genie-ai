import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('search page layout stability', () => {
  it('hydrates URL searches with the same query and loading geometry as the server render', () => {
    const client = readSource('src/app/search/SearchingClient.tsx')
    const hook = readSource('src/hooks/useSearchEngine.ts')

    expect(client).toContain('useState(Boolean(initialQuery.trim()))')
    expect(client).toContain('initialQuery,')
    expect(hook).toContain("const normalizedInitialQuery = initialQuery.trim()")
    expect(hook).toContain('useState(Boolean(normalizedInitialQuery))')
    expect(hook).toContain('useState(normalizedInitialQuery)')
  })
})
