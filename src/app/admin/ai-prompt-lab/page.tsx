import type { Metadata } from 'next';

import AIPromptLabClient from './AIPromptLabClient';
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata';

export const metadata: Metadata = buildNoIndexPageMetadata({
  title: 'AI Prompt Lab | Genie.ph Admin',
  description: 'Private, non-persistent cake-analysis prompt testing workspace.',
});

export default function AIPromptLabPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(196,181,253,0.24),transparent_30%),linear-gradient(180deg,#fafafa_0%,#f4f1ff_100%)] py-6 sm:py-10">
      <AIPromptLabClient />
    </div>
  );
}
