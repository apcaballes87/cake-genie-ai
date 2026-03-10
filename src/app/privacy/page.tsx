import PrivacyClient from './PrivacyClient';
import { buildMarketingPageMetadata } from '@/lib/utils/metadata';

export const metadata = buildMarketingPageMetadata({
    title: 'Privacy Policy',
    description: 'Learn how Genie.ph collects, uses, and protects your personal information when you use our AI-powered custom cake marketplace.',
    canonicalPath: 'https://genie.ph/privacy',
});

export default function PrivacyPage() {
    return <PrivacyClient />;
}
