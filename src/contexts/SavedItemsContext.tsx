'use client';

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
    ReactNode,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { CakeGenieSavedItem, CustomizationDetails } from '@/lib/database.types';
import {
    getSavedItems,
    saveProductItem,
    saveCustomDesign,
    removeSavedItem,
    unsaveProduct,
    unsaveCustomDesign,
} from '@/services/supabaseService';

// --- Types ---

interface SavedItemsDataType {
    savedItems: CakeGenieSavedItem[];
    isLoading: boolean;
    savedProductIds: Set<string>;
    savedDesignHashes: Set<string>;
}

interface SavedItemsActionsType {
    toggleSaveProduct: (product: {
        productId: string;
        productName: string;
        productPrice: number;
        productImage: string;
    }) => Promise<void>;
    toggleSaveDesign: (design: {
        analysisPHash: string;
        customizationSnapshot: CustomizationDetails;
        customizedImageUrl: string;
    }) => Promise<void>;
    isProductSaved: (productId: string) => boolean;
    isDesignSaved: (analysisPHash: string) => boolean;
    removeSavedItemById: (savedItemId: string) => Promise<void>;
    refreshSavedItems: () => Promise<void>;
}

type SavedItemsContextType = SavedItemsDataType & SavedItemsActionsType;

// --- Contexts ---

const SavedItemsDataContext = createContext<SavedItemsDataType | undefined>(undefined);
const SavedItemsActionsContext = createContext<SavedItemsActionsType | undefined>(undefined);

// --- Provider ---

interface SavedItemsProviderProps {
    children: ReactNode;
}

export const SavedItemsProvider: React.FC<SavedItemsProviderProps> = ({ children }) => {
    const { user, isAuthenticated } = useAuth();
    const [savedItems, setSavedItems] = useState<CakeGenieSavedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Derived sets for quick lookup
    const savedProductIds = useMemo(() => {
        return new Set(
            savedItems
                .filter(item => item.item_type === 'product' && item.product_id)
                .map(item => item.product_id!)
        );
    }, [savedItems]);

    const savedDesignHashes = useMemo(() => {
        return new Set(
            savedItems
                .filter(item => item.item_type === 'custom_design' && item.analysis_p_hash)
                .map(item => item.analysis_p_hash!)
        );
    }, [savedItems]);

    // Fetch saved items on mount / auth change
    const fetchSavedItems = useCallback(async () => {
        if (!isAuthenticated || !user || user.is_anonymous) {
            setSavedItems([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const { data, error } = await getSavedItems(user.id);
            if (error) {
                console.error('Error fetching saved items:', error);
                setSavedItems([]);
            } else {
                setSavedItems(data || []);
            }
        } catch (err) {
            console.error('Exception fetching saved items:', err);
            setSavedItems([]);
        } finally {
            setIsLoading(false);
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        fetchSavedItems();
    }, [fetchSavedItems]);

    // Actions
    const toggleSaveProduct = useCallback(async (product: {
        productId: string;
        productName: string;
        productPrice: number;
        productImage: string;
    }) => {
        if (!user || user.is_anonymous) {
            // Could dispatch a login prompt event here
            console.warn('User must be logged in to save items');
            return;
        }

        const isSaved = savedProductIds.has(product.productId);

        // Optimistic update
        if (isSaved) {
            setSavedItems(prev => prev.filter(item => item.product_id !== product.productId));
        } else {
            const optimisticItem: CakeGenieSavedItem = {
                saved_item_id: `temp-${Date.now()}`,
                user_id: user.id,
                product_id: product.productId,
                product_name: product.productName,
                product_price: product.productPrice,
                product_image: product.productImage,
                analysis_p_hash: null,
                customization_snapshot: null,
                customized_image_url: null,
                item_type: 'product',
                created_at: new Date().toISOString(),
            };
            setSavedItems(prev => [optimisticItem, ...prev]);
        }

        try {
            if (isSaved) {
                const { error } = await unsaveProduct(user.id, product.productId);
                if (error) {
                    console.error('Error unsaving product:', error);
                    // Rollback
                    fetchSavedItems();
                }
            } else {
                const { data, error } = await saveProductItem(user.id, product);
                if (error) {
                    console.error('Error saving product:', error);
                    // Rollback
                    fetchSavedItems();
                } else if (data) {
                    // Replace optimistic item with real one
                    setSavedItems(prev =>
                        prev.map(item =>
                            item.saved_item_id.startsWith('temp-') && item.product_id === product.productId
                                ? data
                                : item
                        )
                    );
                }
            }
        } catch (err) {
            console.error('Exception toggling save product:', err);
            fetchSavedItems();
        }
    }, [user, savedProductIds, fetchSavedItems]);

    const toggleSaveDesign = useCallback(async (design: {
        analysisPHash: string;
        customizationSnapshot: CustomizationDetails;
        customizedImageUrl: string;
    }) => {
        if (!user || user.is_anonymous) {
            console.warn('User must be logged in to save items');
            return;
        }

        const isSaved = savedDesignHashes.has(design.analysisPHash);

        // Optimistic update
        if (isSaved) {
            setSavedItems(prev => prev.filter(item => item.analysis_p_hash !== design.analysisPHash));
        } else {
            const optimisticItem: CakeGenieSavedItem = {
                saved_item_id: `temp-${Date.now()}`,
                user_id: user.id,
                product_id: null,
                product_name: null,
                product_price: null,
                product_image: null,
                analysis_p_hash: design.analysisPHash,
                customization_snapshot: design.customizationSnapshot,
                customized_image_url: design.customizedImageUrl,
                item_type: 'custom_design',
                created_at: new Date().toISOString(),
            };
            setSavedItems(prev => [optimisticItem, ...prev]);
        }

        try {
            if (isSaved) {
                const { error } = await unsaveCustomDesign(user.id, design.analysisPHash);
                if (error) {
                    console.error('Error unsaving design:', error);
                    fetchSavedItems();
                }
            } else {
                const { data, error } = await saveCustomDesign(user.id, design);
                if (error) {
                    console.error('Error saving design:', error);
                    fetchSavedItems();
                } else if (data) {
                    setSavedItems(prev =>
                        prev.map(item =>
                            item.saved_item_id.startsWith('temp-') && item.analysis_p_hash === design.analysisPHash
                                ? data
                                : item
                        )
                    );
                }
            }
        } catch (err) {
            console.error('Exception toggling save design:', err);
            fetchSavedItems();
        }
    }, [user, savedDesignHashes, fetchSavedItems]);

    const isProductSavedFn = useCallback((productId: string): boolean => {
        return savedProductIds.has(productId);
    }, [savedProductIds]);

    const isDesignSaved = useCallback((analysisPHash: string): boolean => {
        return savedDesignHashes.has(analysisPHash);
    }, [savedDesignHashes]);

    const removeSavedItemById = useCallback(async (savedItemId: string) => {
        // Optimistic update
        const itemToRemove = savedItems.find(item => item.saved_item_id === savedItemId);
        setSavedItems(prev => prev.filter(item => item.saved_item_id !== savedItemId));

        try {
            const { error } = await removeSavedItem(savedItemId);
            if (error) {
                console.error('Error removing saved item:', error);
                // Rollback
                if (itemToRemove) {
                    setSavedItems(prev => [itemToRemove, ...prev]);
                }
            }
        } catch (err) {
            console.error('Exception removing saved item:', err);
            if (itemToRemove) {
                setSavedItems(prev => [itemToRemove, ...prev]);
            }
        }
    }, [savedItems]);

    // Data context value
    const dataValue = useMemo<SavedItemsDataType>(() => ({
        savedItems,
        isLoading,
        savedProductIds,
        savedDesignHashes,
    }), [savedItems, isLoading, savedProductIds, savedDesignHashes]);

    // Actions context value (stable references)
    const actionsValue = useMemo<SavedItemsActionsType>(() => ({
        toggleSaveProduct,
        toggleSaveDesign,
        isProductSaved: isProductSavedFn,
        isDesignSaved,
        removeSavedItemById,
        refreshSavedItems: fetchSavedItems,
    }), [toggleSaveProduct, toggleSaveDesign, isProductSavedFn, isDesignSaved, removeSavedItemById, fetchSavedItems]);

    return (
        <SavedItemsDataContext.Provider value={dataValue}>
            <SavedItemsActionsContext.Provider value={actionsValue}>
                {children}
            </SavedItemsActionsContext.Provider>
        </SavedItemsDataContext.Provider>
    );
};

// --- Hooks ---

/**
 * Hook to access saved items data (items list, loading state, saved IDs).
 * Components using this will re-render when data changes.
 */
export function useSavedItemsData(): SavedItemsDataType {
    const context = useContext(SavedItemsDataContext);
    if (context === undefined) {
        throw new Error('useSavedItemsData must be used within a SavedItemsProvider');
    }
    return context;
}

/**
 * Hook to access saved items actions (save, unsave, check).
 * Components using this will NOT re-render when data changes.
 */
export function useSavedItemsActions(): SavedItemsActionsType {
    const context = useContext(SavedItemsActionsContext);
    if (context === undefined) {
        throw new Error('useSavedItemsActions must be used within a SavedItemsProvider');
    }
    return context;
}

/**
 * Hook to access both saved items data and actions.
 * Kept for convenience but causes re-renders on data changes.
 */
export function useSavedItems(): SavedItemsContextType {
    const data = useSavedItemsData();
    const actions = useSavedItemsActions();
    return { ...data, ...actions };
}
