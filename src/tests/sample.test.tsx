import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

describe('Sample Test', () => {
    it('should pass', () => {
        expect(true).toBe(true)
    })

    it('renders a heading', () => {
        render(<h1>Hello World</h1>)
        const heading = screen.getByText('Hello World')
        expect(heading).toBeInTheDocument()
    })
})
