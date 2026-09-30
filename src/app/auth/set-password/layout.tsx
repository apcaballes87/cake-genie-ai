import type { ReactNode } from 'react';
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata';

export const metadata = buildNoIndexPageMetadata({
  title: 'Set Password',
  description: 'Set the password for your Genie.ph account.',
});

export default function SetPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
