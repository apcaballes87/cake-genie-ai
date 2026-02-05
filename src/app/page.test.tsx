import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';

// Mock Supabase client
// Mock Supabase client
vi.mock('@/lib/supabase/client', () => {
    const mockClient = {
        auth: {
            getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({ data: null, error: null })
                })
            })
        })
    };
    return {
        createClient: () => mockClient,
        getSupabaseClient: () => mockClient,
    };
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
    }),
    useSearchParams: () => ({
        get: vi.fn(),
    }),
    usePathname: () => '/',
}));

// Mock CartContext
vi.mock('@/contexts/CartContext', () => ({
    useCart: () => ({
        cart: [],
        addToCart: vi.fn(),
        removeFromCart: vi.fn(),
    }),
    useCartData: () => ({
        cart: [],
    })
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: null,
        loading: false,
    })
}));

// Mock ImageContext
vi.mock('@/contexts/ImageContext', () => ({
    useImageContext: () => ({
        uploadedImage: null,
        setUploadedImage: vi.fn(),
    }),
    useImageManagement: () => ({
        handleImageUpload: vi.fn(),
        isAnalyzing: false,
    })
}));

// Mock CustomizationContext
vi.mock('@/contexts/CustomizationContext', () => ({
    useCustomizationContext: () => ({
        activeCustomization: null,
        setActiveCustomization: vi.fn(),
        customizations: {},
        setCustomization: vi.fn(),
    }),
    useCakeCustomization: () => ({
        initializeCustomizations: vi.fn(),
        clearCustomizations: vi.fn(),
    })
}));

// Mock SavedItemsContext
vi.mock('@/contexts/SavedItemsContext', () => ({
    useSavedItemsActions: () => ({
        toggleSavedItem: vi.fn(),
        isItemSaved: vi.fn(),
    }),
    useSavedItemsData: () => ({
        savedItems: [],
    })
}));

describe('Home Page', () => {
    it('renders main landing page sections', async () => {
        render(<Page />);

        // Verify Header elements
        const logos = screen.getAllByAltText('Genie Logo');
        expect(logos.length).toBeGreaterThan(0);
        expect(screen.getByPlaceholderText('Search for custom cakes...')).toBeInTheDocument();

        // Verify Main Sections
        const shopByOccasion = screen.getAllByText('Shop by Occasion');
        expect(shopByOccasion.length).toBeGreaterThan(0);

        expect(screen.getByText('Have a cake photo?')).toBeInTheDocument();
        expect(screen.getByText('Available Cakes For Today')).toBeInTheDocument();
        expect(screen.getByText('Our Partner Shops')).toBeInTheDocument();

        // Verify Quick Links (check for one of them)
        expect(screen.getByText('Minimalist Cakes')).toBeInTheDocument();
    });
});
