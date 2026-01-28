import { Metadata } from 'next';
import { Suspense } from 'react';
import SearchingClient from './SearchingClient';
import { LoadingSpinner } from '@/components/LoadingSpinner';

type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
    { searchParams }: Props,
): Promise<Metadata> {
    const resolvedParams = await searchParams
    const q = resolvedParams.q
    const query = typeof q === 'string' ? q : ''

    return {
        title: query ? `Results for "${query}" | Genie.ph` : 'Search Cake Designs | Genie.ph',
        description: query
            ? `Browse custom cake designs matching "${query}". Order from local bakeries in Cebu.`
            : 'Search for cake designs to customize. Find the perfect cake for any occasion.',
        // Don't index empty search pages or search result pages (content changes frequently)
        robots: {
            index: false,
            follow: true,
        },
    }
}

export default function SearchingPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>}>
            <SearchingClient />
        </Suspense>
    );
}
