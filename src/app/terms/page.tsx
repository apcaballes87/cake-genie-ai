import TermsClient from './TermsClient';
import { buildMarketingPageMetadata } from '@/lib/utils/metadata';

export const metadata = buildMarketingPageMetadata({
    title: 'Terms of Service',
    description: 'Read the terms and conditions for using Genie.ph, the AI-powered custom cake marketplace serving Cebu customers.',
    canonicalPath: 'https://genie.ph/terms',
});

export default function TermsPage() {
    return <TermsClient />;
}
