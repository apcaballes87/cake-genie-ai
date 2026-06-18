import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CakeFlavorBottomSheet } from './CakeFlavorBottomSheet';

vi.mock('@/components/LazyImage', () => ({
  default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));

Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

describe('CakeFlavorBottomSheet', () => {
  it('renders a labeled dialog with radio flavor options', () => {
    render(
      <CakeFlavorBottomSheet
        isOpen
        onClose={vi.fn()}
        flavors={['Chocolate Cake']}
        cakeType="Bento"
        onFlavorChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: /Cake Flavor/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Chocolate Cake/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Vanilla Cake/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Ube Cake/i })).toBeDisabled();
  });

  it('forwards flavor changes through the radio control', () => {
    const onFlavorChange = vi.fn();

    render(
      <CakeFlavorBottomSheet
        isOpen
        onClose={vi.fn()}
        flavors={['Chocolate Cake']}
        cakeType="1 Tier"
        onFlavorChange={onFlavorChange}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /Vanilla Cake/i }));

    expect(onFlavorChange).toHaveBeenCalledWith(['Vanilla Cake']);
  });
});
