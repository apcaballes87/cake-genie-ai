import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CartItemCard from './CartItemCard';
import type { CartItem } from '@/types';

describe('CartItemCard', () => {
  it('renders structured AI chat history entries with their saved reference image link', () => {
    const item: CartItem = {
      id: 'cart-item-1',
      image: 'https://example.com/cake.webp',
      status: 'complete',
      type: '1 Tier',
      thickness: '4 in',
      size: '6" Round',
      totalPrice: 1499,
      details: {
        flavors: ['Chocolate Cake'],
        mainToppers: [
          {
            type: 'printout',
            description: 'Gold crown with colorful jewels',
            size: 'medium',
            quantity: 1,
            group_id: 'topper-1',
            classification: 'hero',
          },
        ],
        supportElements: [
          {
            type: 'support_printout',
            description: 'Butterflies',
            size: 'small',
            group_id: 'support-1',
          },
        ],
        cakeMessages: [],
        icingDesign: {
          base: 'soft_icing',
          drip: false,
          gumpasteBaseBoard: false,
          colors: {},
        },
        additionalInstructions: 'Keep the original topper.',
        ai_chat_history: [
          {
            prompt: 'make the side pink',
            referenceImageUrl: 'https://example.com/reference.webp',
            referenceImageName: 'reference.webp',
            createdAt: '2026-07-05T10:00:00.000Z',
          },
        ],
        chat_history: ['make the side pink'],
      },
    };

    render(
      <CartItemCard
        item={item}
        onRemove={vi.fn()}
        onZoom={vi.fn()}
      />,
    );

    expect(screen.getByText('AI Chat Requests:')).toBeInTheDocument();
    expect(screen.getByText('make the side pink')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reference\.webp/i })).toHaveAttribute('href', 'https://example.com/reference.webp');
    expect(screen.getByText('Gold crown with colorful jewels (Printout)')).toBeInTheDocument();
    expect(screen.getByText('Butterflies (Printout)')).toBeInTheDocument();
    expect(screen.getByText('View Customization Details').closest('details')).toHaveAttribute('open');
  });

  it('keeps customization details expanded while a cart item is still saving', () => {
    const item: CartItem = {
      id: 'pending-cart-item',
      image: 'https://example.com/cake.webp',
      status: 'pending',
      type: '1 Tier',
      thickness: '4 in',
      size: '6" Round',
      totalPrice: 1499,
      details: {
        flavors: ['Chocolate Cake'],
        mainToppers: [],
        supportElements: [],
        cakeMessages: [],
        icingDesign: {
          base: 'soft_icing',
          drip: false,
          gumpasteBaseBoard: false,
          colors: {},
        },
        additionalInstructions: '',
      },
    };

    render(<CartItemCard item={item} onRemove={vi.fn()} onZoom={vi.fn()} />);

    expect(screen.getByText('View Customization Details').closest('details')).toHaveAttribute('open');
  });

  it('shows persisted tier sizes beside their assigned flavors', () => {
    const item: CartItem = {
      id: 'tiered-cart-item',
      image: 'https://example.com/cake.webp',
      status: 'complete',
      type: '3 Tier Fondant',
      thickness: '5 in',
      size: '7"10"14" Fondant',
      totalPrice: 12599,
      details: {
        flavors: ['Vanilla Cake', 'Ube Cake', 'Chocolate Cake'],
        tier_flavors: [
          { tier: 'top', size: '7"', flavor: 'Vanilla Cake' },
          { tier: 'middle', size: '10"', flavor: 'Ube Cake' },
          { tier: 'bottom', size: '14"', flavor: 'Chocolate Cake' },
        ],
        mainToppers: [],
        supportElements: [],
        cakeMessages: [],
        icingDesign: { base: 'fondant', drip: false, gumpasteBaseBoard: false, colors: {} },
        additionalInstructions: '',
      },
    };

    render(<CartItemCard item={item} onRemove={vi.fn()} onZoom={vi.fn()} />);

    expect(screen.getByText('7" Top Tier Flavor:')).toBeInTheDocument();
    expect(screen.getByText('10" Middle Tier Flavor:')).toBeInTheDocument();
    expect(screen.getByText('14" Bottom Tier Flavor:')).toBeInTheDocument();
  });
});
