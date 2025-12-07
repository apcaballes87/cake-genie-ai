import ContributeClient from './ContributeClient';

export default async function ContributePage({ params }: { params: Promise<{ orderId: string }> }) {
    const { orderId } = await params;
    return <ContributeClient orderId={orderId} />;
}
