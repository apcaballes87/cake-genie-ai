import { Metadata } from 'next';
import ReturnPolicyClient from './ReturnPolicyClient';

export const metadata: Metadata = {
    title: 'Return Policy | Genie.ph',
    description: 'Read our return and refund policy for custom made-to-order cakes in Cebu.',
    alternates: {
        canonical: 'https://genie.ph/return-policy',
    },
};

export default function ReturnPolicyPage() {
    return <ReturnPolicyClient />;
}
