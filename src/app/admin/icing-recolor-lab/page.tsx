import type { Metadata } from 'next';

import IcingRecolorLabClient from './IcingRecolorLabClient';
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata';

export const metadata: Metadata = buildNoIndexPageMetadata({
  title: 'Icing Recolor Lab',
  description:
    'Internal test page for mask-based instant icing recolor experiments without per-click AI generation.',
});

export default function IcingRecolorLabPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)]">
      <IcingRecolorLabClient />
    </div>
  );
}
