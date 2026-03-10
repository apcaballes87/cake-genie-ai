import ReturnPolicyClient from './ReturnPolicyClient';
import { buildMarketingPageMetadata } from '@/lib/utils/metadata';

export const metadata = buildMarketingPageMetadata({
    title: 'Return and Refund Policy',
    description: 'Read Genie.ph\'s return and refund policy for custom made-to-order cakes in Cebu, including guidance for damaged or incorrect orders.',
    canonicalPath: 'https://genie.ph/return-policy',
});

export default function ReturnPolicyPage() {
    return <ReturnPolicyClient />;
}
