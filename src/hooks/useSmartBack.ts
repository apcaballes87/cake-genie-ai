'use client';

import { useRouter } from 'next/navigation';
import { useNavigation, PageType } from '@/contexts/NavigationContext';
import { readSearchReturnState } from '@/lib/searchReturnState';

/**
 * Hook for smart back navigation that follows app structure
 * instead of browser history.
 * 
 * Usage:
 * const { goBack, canGoBack } = useSmartBack('search');
 * 
 * <button onClick={goBack}>Back</button>
 */
export function useSmartBack(currentPage: PageType) {
    const router = useRouter();
    const { navigationState, recordNavigation, getBackDestination, canGoBack: contextCanGoBack } = useNavigation();

    const goBack = () => {
        if (currentPage === 'customizing' && navigationState.currentPage === 'customizing') {
            const searchReturnState = readSearchReturnState();
            const isSearchSourced =
                navigationState.entrySource === 'search' ||
                navigationState.previousPage === 'search' ||
                searchReturnState?.targetPath === window.location.pathname;

            if (searchReturnState && isSearchSourced) {
                router.push(searchReturnState.returnUrl);
                return;
            }
        }

        const destination = getBackDestination();
        router.push(destination);
    };

    const goBackWithSource = (source: string) => {
        // First record this navigation with the source
        recordNavigation(currentPage, source);
        // Then go back
        const destination = getBackDestination();
        router.push(destination);
    };

    return {
        goBack,
        goBackWithSource,
        canGoBack: contextCanGoBack,
        getBackDestination,
    };
}

/**
 * Hook for recording navigation when entering a page
 * 
 * Usage:
 * useRecordNavigation('customizing', 'search');
 */
export function useRecordNavigation() {
    const { recordNavigation } = useNavigation();

    return recordNavigation;
}
