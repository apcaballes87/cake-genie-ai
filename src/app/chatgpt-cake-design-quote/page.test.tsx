import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Page, { metadata } from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/components/landing/LandingFooter', () => ({
  LandingFooter: () => <div>Footer</div>,
}));

describe('chatgpt cake design quote page', () => {
  it('renders ChatGPT-focused landing copy with canonical metadata', () => {
    render(<Page />);

    expect(
      screen.getByRole('heading', {
        name: /upload your ai-generated cake design and get an instant price quote/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/i made a cake design in chatgpt\. can someone make this into a real cake\?/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/genie\.ph can help turn that image into a practical custom cake quote in cebu/i),
    ).toBeInTheDocument();

    expect(metadata.title).toEqual({
      absolute: 'Turn Your ChatGPT Cake Design Into a Real Cake Quote in Cebu | Genie.ph',
    });
    expect(metadata.alternates?.canonical).toBe('https://genie.ph/chatgpt-cake-design-quote');
  });
});
