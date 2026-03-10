import { Metadata } from 'next';
import { Suspense } from 'react';
import SearchingClient from './SearchingClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata';

type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
    { searchParams }: Props,
): Promise<Metadata> {
    const resolvedParams = await searchParams
    const q = resolvedParams.q
    const query = typeof q === 'string' ? q : ''

    return buildNoIndexPageMetadata({
        title: query ? `Results for "${query}"` : 'Search Cake Designs',
        description: query
            ? `Browse custom cake designs matching "${query}". Order from local bakeries in Cebu.`
            : 'Search for cake designs to customize. Find the perfect cake for any occasion.',
        follow: true,
    })
}

export default function SearchingPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
            <SearchingClient />
        </Suspense>
    );
}
