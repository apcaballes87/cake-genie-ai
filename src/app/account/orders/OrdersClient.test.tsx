import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrderDetails } from './OrdersClient';

vi.mock('@/hooks', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'customer@example.com' },
  }),
}));

vi.mock('@/components/ImageZoomModal', () => ({
  ImageZoomModal: () => null,
}));

vi.mock('@/services/xenditService', () => ({
  createXenditPayment: vi.fn(),
}));

describe('OrderDetails', () => {
  it('renders persisted AI chat history for order items', () => {
    render(
      <OrderDetails
        order={{
          order_id: 'order-1',
          order_number: '1001',
          created_at: '2026-07-05T10:00:00.000Z',
          delivery_date: '2026-07-06',
          delivery_time_slot: '10AM - 12NN',
          payment_status: 'paid',
          order_status: 'confirmed',
          total_amount: 1499,
          cakegenie_order_items: [
            {
              item_id: 'item-1',
              cake_type: '1 Tier',
              cake_thickness: '4 in',
              cake_size: '6" Round',
              final_price: 1499,
              original_image_url: 'https://example.com/original.webp',
              customized_image_url: 'https://example.com/cake.webp',
              customization_details: {
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
                ai_chat_history: [
                  {
                    prompt: 'make the side pink',
                    referenceImageUrl: 'https://example.com/reference.webp',
                    referenceImageName: 'reference.webp',
                    createdAt: '2026-07-05T10:01:00.000Z',
                  },
                ],
                chat_history: ['make the side pink'],
              },
            },
          ],
        } as never}
        onOrderUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText('AI Chat Requests:')).toBeInTheDocument();
    expect(screen.getByText('make the side pink')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reference\.webp/i })).toHaveAttribute('href', 'https://example.com/reference.webp');
  });
});
