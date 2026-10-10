import ContributeClient from './ContributeClient';
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata';

export const metadata = buildNoIndexPageMetadata({
    title: 'Order Contribution',
    description: 'Contribute to a Genie.ph order.',
});

export default async function ContributePage({ params }: { params: Promise<{ orderId: string }> }) {
    const { orderId } = await params;
    return <ContributeClient orderId={orderId} />;
}
