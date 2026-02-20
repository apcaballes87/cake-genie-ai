import { Metadata } from 'next';
import TermsClient from './TermsClient';

export const metadata: Metadata = {
    title: 'Terms of Service | Genie.ph',
    description: 'Read the terms and conditions for using Genie.ph, the AI-powered custom cake marketplace in Cebu.',
    alternates: {
        canonical: 'https://genie.ph/terms',
    },
};

export default function TermsPage() {
    return <TermsClient />;
}
