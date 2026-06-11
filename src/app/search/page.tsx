import { Metadata } from 'next';
import { Suspense } from 'react';
import SearchingClient from './SearchingClient';
import { SearchPageSkeleton } from '@/components/LoadingSkeletons';
import { buildNoIndexPageMetadata } from '@/lib/utils/metadata';
import { searchProductsFTSCount } from '@/services/supabaseService';

type Props = {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
    { searchParams }: Props,
): Promise<Metadata> {
    const resolvedParams = await searchParams
    const q = resolvedParams.q
    const query = typeof q === 'string' ? q : ''

    let countText = '';
    if (query) {
        const count = await searchProductsFTSCount(query);
        countText = `${count} `;
    }

    return buildNoIndexPageMetadata({
        title: query ? `${countText}Cake designs for "${query}"` : 'Search Cake Designs',
        description: query
            ? `Browse ${countText.toLowerCase()}custom cake designs matching "${query}". Order from local bakeries in Cebu.`
            : 'Search for cake designs to customize. Find the perfect cake for any occasion.',
        follow: true,
    })
}

export default function SearchingPage() {
    return (
        <Suspense fallback={<SearchPageSkeleton />}>
            <SearchingClient />
        </Suspense>
    );
}
