import type { ReactNode } from 'react';
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata';

export const metadata = buildNoIndexPageMetadata({
  title: 'Order Confirmation',
  description: 'View the status and details of your Genie.ph order.',
});

export default function OrderConfirmationLayout({ children }: { children: ReactNode }) {
  return children;
}
