import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getOrderPaymentSummary, OrderDetails, OrderPaymentSummary } from './OrdersClient';

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

describe('OrderPaymentSummary', () => {
  const baseOrder = {
    total_amount: 1499,
    discount_amount: 100,
    delivery_fee: 80,
    amount_collected: 0,
  };

  it('shows a paid order as paid in full even when collected amount is missing or stale', () => {
    render(
      <OrderPaymentSummary
        order={{ ...baseOrder, payment_status: 'paid', amount_collected: 0 }}
      />,
    );

    expect(screen.getByText('Paid in full')).toBeInTheDocument();
    expect(screen.getAllByText('₱1,499.00')).toHaveLength(2);
    expect(screen.getByText('-₱100.00')).toBeInTheDocument();
    expect(screen.getByText('₱80.00')).toBeInTheDocument();
    expect(screen.queryByText('Balance due')).not.toBeInTheDocument();
    expect(getOrderPaymentSummary({ ...baseOrder, payment_status: 'paid', amount_collected: undefined })).toMatchObject({
      amountPaid: 1499,
      balance: 0,
      state: 'paid',
    });
  });

  it('shows the collected amount and remaining balance for partial orders', () => {
    render(
      <OrderPaymentSummary
        order={{ ...baseOrder, total_amount: 2000, amount_collected: 500, payment_status: 'partial' }}
      />,
    );

    expect(screen.getAllByText('Balance due')).toHaveLength(2);
    expect(screen.getByText('₱500.00')).toBeInTheDocument();
    expect(screen.getByText('₱1,500.00')).toBeInTheDocument();
  });

  it('shows the full total as due for pending orders', () => {
    render(
      <OrderPaymentSummary
        order={{ ...baseOrder, amount_collected: 700, payment_status: 'pending' }}
      />,
    );

    expect(screen.getByText('₱0.00')).toBeInTheDocument();
    expect(screen.getAllByText('₱1,499.00')).toHaveLength(2);
    expect(screen.getAllByText('Balance due')).toHaveLength(2);
  });

  it('does not claim a paid amount or balance while manual payment is under review', () => {
    render(
      <OrderPaymentSummary
        order={{ ...baseOrder, payment_status: 'verifying' }}
      />,
    );

    expect(screen.getByText('Payment under review')).toBeInTheDocument();
    expect(screen.getAllByText('Under review')).toHaveLength(2);
    expect(screen.getByText('Balance due')).toBeInTheDocument();
  });

  it('marks refunded orders without showing a balance', () => {
    render(
      <OrderPaymentSummary
        order={{ ...baseOrder, payment_status: 'refunded' }}
      />,
    );

    expect(screen.getAllByText('Refunded')).toHaveLength(2);
    expect(screen.getByText('Amount paid')).toBeInTheDocument();
    expect(screen.queryByText('Balance due')).not.toBeInTheDocument();
  });

  it('clamps partial payments to a safe range', () => {
    expect(getOrderPaymentSummary({ ...baseOrder, payment_status: 'partial', amount_collected: -20 })).toMatchObject({
      amountPaid: 0,
      balance: 1499,
    });
    expect(getOrderPaymentSummary({ ...baseOrder, payment_status: 'partial', amount_collected: 2000 })).toMatchObject({
      amountPaid: 1499,
      balance: 0,
      state: 'paid',
    });
  });
});
