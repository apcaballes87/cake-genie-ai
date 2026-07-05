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
        mainToppers: [],
        supportElements: [],
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
  });
});
