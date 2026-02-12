'use client'

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
    ReactNode,
    useRef,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient, User, PostgrestError } from '@supabase/supabase-js';
import { debounce } from 'lodash-es';
import { showError } from '@/lib/utils/toast';

import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { CakeGenieCartItem, CakeGenieAddress, CakeGenieMerchant } from '@/lib/database.types';
import {
    getCartPageData,
    addToCart as addToCartService,
    updateCartItemQuantity as updateQuantityService,
    removeCartItem as removeItemService,
} from '@/services/supabaseService';

// --- NEW BATCHED LOCALSTORAGE WRITER ---
const queuedWrites: { [key: string]: string | null } = {};
let isFlushScheduled = false;

const flushWrites = () => {
    if (typeof window === 'undefined') return;
    try {
        for (const key in queuedWrites) {
            if (Object.prototype.hasOwnProperty.call(queuedWrites, key)) {
                const value = queuedWrites[key];
                if (value === null) {
                    localStorage.removeItem(key);
                } else {
                    localStorage.setItem(key, value);
                }
                delete queuedWrites[key];
            }
        }
    } catch (e) {
        if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
            console.error("LocalStorage quota exceeded. Cannot save cart state.");
            showError("Could not save session. Browser storage might be full.");
        } else {
            console.error("Failed to write to localStorage:", e);
        }
    } finally {
        isFlushScheduled = false;
    }
};

// Debounce the flush operation to batch multiple writes within 100ms
const debouncedFlush = debounce(flushWrites, 100);

export const batchSaveToLocalStorage = (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    const dataToStore = {
        value,
        timestamp: Date.now()
    };
    queuedWrites[key] = JSON.stringify(dataToStore);
    if (!isFlushScheduled) {
        isFlushScheduled = true;
        debouncedFlush();
    }
};

export const batchRemoveFromLocalStorage = (key: string) => {
    if (typeof window === 'undefined') return;
    queuedWrites[key] = null; // Use null as a sentinel for removal
    if (!isFlushScheduled) {
        isFlushScheduled = true;
        debouncedFlush();
    }
};

// --- NEW LOCALSTORAGE READ/CLEANUP UTILITIES ---

export const readFromLocalStorage = (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    const item = localStorage.getItem(key);
    if (!item) return null;
    try {
        const data = JSON.parse(item);
        // Check for new format with timestamp
        if (data && typeof data.value === 'string' && typeof data.timestamp === 'number') {
            return data.value;
        }
        // It's a JSON but not our format, so ignore it
        return null;
    } catch (e) {
        // If parsing fails, it's the old plain string format. Return for backward compatibility.
        // The next save will convert it to the new format.
        return item;
    }
};

export const cleanupExpiredLocalStorage = () => {
    if (typeof window === 'undefined') return;

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cart_')) {
            try {
                const item = localStorage.getItem(key);
                if (item) {
                    const data = JSON.parse(item);
                    if (data.timestamp) {
                        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                        if (data.timestamp < sevenDaysAgo) {
                            keysToRemove.push(key);
                        }
                    }
                }
            } catch (e) {
                // Ignore items not in the new format or unparseable
            }
        }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
    if (keysToRemove.length > 0) {
        // Removed console.log for production
    }
};


interface DeliveryDetails {
    eventDate: string;
    eventTime: string;
    addressId: string | null; // Null for guests
    addressData: Partial<CakeGenieAddress>;
    deliveryInstructions: string;
}

// --- NEW SPLIT CONTEXT TYPES ---

interface CartDataType {
    cartItems: (CakeGenieCartItem & { merchant?: CakeGenieMerchant })[];
    addresses: CakeGenieAddress[];
    cartTotal: number;
    itemCount: number;
    isLoading: boolean;
    sessionId: string | null;
    deliveryDetails: DeliveryDetails | null;
    eventDate: string;
    eventTime: string;
    deliveryInstructions: string;
    selectedAddressId: string;
    authError: string | null;
}

interface CartActionsType {
    setDeliveryDetails: (details: DeliveryDetails | null) => void;
    setEventDate: (date: string) => void;
    setEventTime: (time: string) => void;
    setDeliveryInstructions: (instructions: string) => void;
    setSelectedAddressId: (id: string) => void;
    refreshCart: () => Promise<void>;
    addToCartOptimistic: (
        item: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>,
        options?: { skipOptimistic?: boolean }
    ) => Promise<void>;
    updateQuantityOptimistic: (cartItemId: string, quantity: number) => Promise<void>;
    removeItemOptimistic: (cartItemId: string) => Promise<void>;
    clearCart: () => void;
    addToCartWithBackgroundUpload: (
        initialItem: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>,
        uploadTask: Promise<{ originalImageUrl: string; finalImageUrl: string }>
    ) => Promise<void>;
}

interface CartContextType extends CartDataType, CartActionsType { }

// --- NEW SPLIT CONTEXTS ---

const CartDataContext = createContext<CartDataType | undefined>(undefined);
const CartActionsContext = createContext<CartActionsType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const supabase = createClient();

    // INSTANT LOAD: Initialize cart from localStorage immediately (0ms)
    const [cartItems, setCartItems] = useState<(CakeGenieCartItem & { merchant?: CakeGenieMerchant })[]>(() => {
        const cached = readFromLocalStorage('cart_items_cache');
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                // Silently ignore cache parsing errors
            }
        }
        return [];
    });

    const [addresses, setAddresses] = useState<CakeGenieAddress[]>(() => {
        const cached = readFromLocalStorage('addresses_cache');
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch (e) {
                console.warn('[CartContext] Failed to parse cached addresses');
            }
        }
        return [];
    });

    const [isLoading, setIsLoading] = useState<boolean>(true); // Start as true until auth resolves
    // Removed local currentUser state, rely on useAuth
    // Derived sessionId below
    const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);

    const { user, isLoading: authLoading } = useAuth();

    // Derive sessionId from user
    const sessionId = useMemo(() => {
        return user?.is_anonymous ? user.id : null;
    }, [user]);

    const prevUserIdRef = useRef<string | null>(null);
    const cartItemsRef = useRef(cartItems);

    useEffect(() => {
        cartItemsRef.current = cartItems;
    }, [cartItems]);

    const [eventDate, setEventDateState] = useState<string>(() => {
        return readFromLocalStorage('cart_event_date') || '';
    });

    const [eventTime, setEventTimeState] = useState<string>(() => {
        return readFromLocalStorage('cart_event_time') || '';
    });

    const [deliveryInstructions, setDeliveryInstructionsState] = useState<string>(() => {
        return readFromLocalStorage('cart_delivery_instructions') || '';
    });

    const [selectedAddressId, setSelectedAddressIdState] = useState<string>(() => {
        return readFromLocalStorage('cart_selected_address_id') || '';
    });

    const setEventDate = useCallback((date: string) => {
        batchSaveToLocalStorage('cart_event_date', date);
        setEventDateState(date);
    }, []);

    const setEventTime = useCallback((time: string) => {
        batchSaveToLocalStorage('cart_event_time', time);
        setEventTimeState(time);
    }, []);

    const setDeliveryInstructions = useCallback((instructions: string) => {
        batchSaveToLocalStorage('cart_delivery_instructions', instructions);
        setDeliveryInstructionsState(instructions);
    }, []);

    const setSelectedAddressId = useCallback((id: string) => {
        batchSaveToLocalStorage('cart_selected_address_id', id);
        setSelectedAddressIdState(id);
    }, []);

    const loadCartData = useCallback(async (user: User | null) => {
        setIsLoading(true);
        try {
            const isAnonymous = user?.is_anonymous ?? false;
            const userIdForQuery = isAnonymous ? null : user?.id;
            const sessionIdForQuery = isAnonymous ? user?.id : null;

            // Add timeout to database query - if it hangs, just load empty cart
            let cartData: { data: (CakeGenieCartItem & { merchant?: CakeGenieMerchant })[] | null; error: Error | PostgrestError | null };
            let addressesData: { data: CakeGenieAddress[] | null; error: Error | PostgrestError | null };

            try {
                const cartPromise = getCartPageData(
                    userIdForQuery !== undefined ? userIdForQuery : null,
                    sessionIdForQuery !== undefined ? sessionIdForQuery : null
                );
                const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Database query timed out after 2000ms')), 2000)
                );

                const result = await Promise.race([cartPromise, timeoutPromise]);
                cartData = result.cartData;
                addressesData = result.addressesData;
            } catch (timeoutError) {
                console.warn('Cart query timed out, keeping cached data');
                // Don't clear the cart - just keep the cached data we already have
                // The user already sees their cart from cache, no need to replace it
                return; // Exit early, don't update state
            }

            const { data: cartItemsData, error: cartError } = cartData;
            if (cartError) throw cartError;
            setCartItems(cartItemsData || []);

            // Cache cart items for instant load next time
            if (cartItemsData && cartItemsData.length > 0) {
                batchSaveToLocalStorage('cart_items_cache', JSON.stringify(cartItemsData));
            } else {
                batchRemoveFromLocalStorage('cart_items_cache');
            }

            const { data: userAddressesData, error: addressesError } = addressesData;
            if (addressesError) {
                console.error('Failed to load addresses:', addressesError);
                // Don't throw, allow cart to load without addresses
            }
            setAddresses(userAddressesData || []);

            // Cache addresses for instant load next time
            if (userAddressesData && userAddressesData.length > 0) {
                batchSaveToLocalStorage('addresses_cache', JSON.stringify(userAddressesData));
            }

        } catch (error) {
            console.error('Failed to load cart data:', error);
            setCartItems([]);
            setAddresses([]);
            // Clear cache on error
            batchRemoveFromLocalStorage('cart_items_cache');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Unified Effect for Auth Changes and Cart Loading
    useEffect(() => {
        // Cleanup old storage on mount
        cleanupExpiredLocalStorage();
    }, []);

    useEffect(() => {
        const handleAuthChange = async () => {
            if (authLoading) return;

            // Update prevUserIdRef if it's the first run (initialization)
            // preventing logic from thinking it's a "change" from null
            if (prevUserIdRef.current === null && user?.id) {
                prevUserIdRef.current = user.id;
                await loadCartData(user);
                return;
            }

            const currentUserId = user?.id ?? null;

            // User changed (e.g. Guest -> Real User)
            if (currentUserId !== prevUserIdRef.current && prevUserIdRef.current !== null) {
                const isUpgrade = !prevUserIdRef.current && currentUserId; // Note: prevUserIdRef might be initialized to null, so this check logic needs to be robust. 
                // Actually, simplified: if we had a user (guest) and now have a different user (real), we sync.
                // But simplified sync logic: If we have local items and user changes, try to sync.
                const localItems = cartItemsRef.current;

                if (localItems.length > 0) {
                    console.log("Syncing items...", localItems.length);
                    try {
                        const syncPromise = Promise.all(localItems.map(async (item) => {
                            const { cart_item_id, created_at, updated_at, expires_at, ...itemParams } = item;
                            const result = await addToCartService({
                                ...itemParams,
                                user_id: user?.is_anonymous ? null : (user?.id ?? null),
                                session_id: user?.is_anonymous ? user?.id : null
                            });
                            return result;
                        }));
                        await syncPromise;
                        setCartItems([]);
                        batchRemoveFromLocalStorage('cart_items_cache');
                    } catch (e) {
                        console.error("Sync failed", e);
                    }
                }
            }

            if (currentUserId !== prevUserIdRef.current || !cartItems.length) {
                prevUserIdRef.current = currentUserId;
                // Load cart for the (new) user
                await loadCartData(user);
            }
        };

        handleAuthChange();
    }, [user, authLoading, loadCartData]);

    // Auto-cache cart items whenever they change (for instant load on next visit)
    useEffect(() => {
        if (cartItems.length > 0) {
            batchSaveToLocalStorage('cart_items_cache', JSON.stringify(cartItems));
        } else {
            batchRemoveFromLocalStorage('cart_items_cache');
        }
    }, [cartItems]);

    // Auto-cache addresses whenever they change
    useEffect(() => {
        if (addresses.length > 0) {
            batchSaveToLocalStorage('addresses_cache', JSON.stringify(addresses));
        }
    }, [addresses]);

    const addToCartOptimistic = useCallback(async (
        itemParams: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>,
        options?: { skipOptimistic?: boolean }
    ) => {
        const tempId = `temp-${Date.now()}`;
        const now = new Date().toISOString();

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const tempItem: CakeGenieCartItem = {
            ...itemParams,
            cart_item_id: tempId,
            created_at: now,
            updated_at: now,
            expires_at: expiresAt.toISOString(),
        };

        if (!options?.skipOptimistic) {
            setCartItems(prevItems => [tempItem, ...prevItems]);
        }

        try {
            // FIX: Fetch the user directly before the operation to avoid race conditions
            // with the state update, which was causing RLS violations.
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error("Could not verify user session. Please try again.");
            }

            const isAnonymous = user.is_anonymous;
            const itemToSend = {
                ...itemParams,
                user_id: isAnonymous ? null : user.id,
                session_id: isAnonymous ? user.id : null,
            };

            const { data: realItem, error } = await addToCartService(itemToSend);

            if (error || !realItem) {
                if (error) {
                    const supabaseError = error as PostgrestError;
                    console.error('🔴 Supabase error adding to cart:', JSON.stringify(supabaseError, null, 2));
                }
                throw error || new Error('Failed to add item to cart. No data returned from service.');
            }

            if (options?.skipOptimistic) {
                setCartItems(prev => [realItem, ...prev]);
            } else {
                setCartItems(prev => prev.map(item => item.cart_item_id === tempId ? realItem : item));
            }

        } catch (error: any) {
            console.error('🔴 Error in addToCartOptimistic, rolling back:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            if (!options?.skipOptimistic) {
                setCartItems(prev => prev.filter(item => item.cart_item_id !== tempId));
            }
            throw error;
        }
    }, []);

    const addToCartWithBackgroundUpload = useCallback(async (
        initialItem: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>,
        uploadTask: Promise<{ originalImageUrl: string; finalImageUrl: string }>
    ) => {
        const tempId = `temp-${Date.now()}`;
        const now = new Date().toISOString();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // 1. Optimistic Update with Initial Item (Base64)
        const tempItem: CakeGenieCartItem = {
            ...initialItem,
            cart_item_id: tempId,
            created_at: now,
            updated_at: now,
            expires_at: expiresAt.toISOString(),
        };

        setCartItems(prevItems => [tempItem, ...prevItems]);

        // 2. Background Process
        (async () => {
            try {
                // Wait for upload
                const { originalImageUrl, finalImageUrl } = await uploadTask;

                // Prepare real item for DB
                const finalItemParams = {
                    ...initialItem,
                    original_image_url: originalImageUrl,
                    customized_image_url: finalImageUrl
                };

                const { data: { user } } = await supabase.auth.getUser();
                // If no user, we might be in trouble if we need a session, but let's try to proceed 
                // (service handles anonymous session creation if passed, but here we assume context already inited)
                // The context initializes user on mount, so user should exist (anon or real).

                const isAnonymous = user?.is_anonymous ?? false;
                // If user is null (auth error?), we can't really save to DB properly.
                if (!user) {
                    throw new Error("User session not found during background save");
                }

                const itemToSend = {
                    ...finalItemParams,
                    user_id: isAnonymous ? null : user.id,
                    session_id: isAnonymous ? user.id : null,
                };

                const { data: realItem, error } = await addToCartService(itemToSend);

                if (error || !realItem) throw error;

                // Replace temp item with real item
                setCartItems(prev => prev.map(item => item.cart_item_id === tempId ? realItem : item));

            } catch (error) {
                console.error("Background upload/add failed", error);
                // Rollback
                setCartItems(prev => prev.filter(item => item.cart_item_id !== tempId));
                showError("Failed to save item to cart. Please try again.");
            }
        })();
    }, [supabase]);

    const removeItemOptimistic = useCallback(async (cartItemId: string) => {
        // Use ref to avoid stale closure over cartItems — prevents this callback
        // from being re-created on every cart change, which would cascade re-renders
        // through the actions context and break React.memo on child components.
        const originalCart = [...cartItemsRef.current];

        setCartItems(prev => prev.filter(item => item.cart_item_id !== cartItemId));

        try {
            const { error } = await removeItemService(cartItemId);
            if (error) throw error;
        } catch (error) {
            console.error('Error removing item, rolling back:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            setCartItems(originalCart);
            throw error;
        }
    }, []);

    const debouncedUpdateQuantity = useMemo(
        () => debounce(async (cartItemId: string, quantity: number, originalCart: (CakeGenieCartItem & { merchant?: CakeGenieMerchant })[]) => {
            try {
                const { error } = await updateQuantityService(cartItemId, quantity);
                if (error) {
                    console.error('Error updating quantity:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
                    setCartItems(originalCart);
                    throw error;
                }
            } catch (error) {
                throw error;
            }
        }, 500),
        []
    );

    const updateQuantityOptimistic = useCallback(async (cartItemId: string, quantity: number) => {
        if (quantity <= 0) {
            await removeItemOptimistic(cartItemId);
            return;
        }

        const originalCart = [...cartItemsRef.current];
        const itemToUpdate = cartItemsRef.current.find(item => item.cart_item_id === cartItemId);
        if (!itemToUpdate) return;

        setCartItems(prev =>
            prev.map(item => item.cart_item_id === cartItemId ? { ...item, quantity } : item)
        );

        try {
            await debouncedUpdateQuantity(cartItemId, quantity, originalCart);
        } catch (error) {
            throw error;
        }
    }, [removeItemOptimistic, debouncedUpdateQuantity]);

    const refreshCart = useCallback(async () => {
        await loadCartData(user);
    }, [loadCartData, user]);

    const clearCart = useCallback(() => {
        setCartItems([]);
        setDeliveryDetails(null);
        if (typeof window !== 'undefined') {
            batchRemoveFromLocalStorage('cart_event_date');
            batchRemoveFromLocalStorage('cart_event_time');
            batchRemoveFromLocalStorage('cart_delivery_instructions');
            batchRemoveFromLocalStorage('cart_selected_address_id');
            batchRemoveFromLocalStorage('cart_discount_code');
            batchRemoveFromLocalStorage('cart_applied_discount');
        }
        setEventDateState('');
        setEventTimeState('');
        setDeliveryInstructionsState('');
        setSelectedAddressIdState('');
    }, []);

    const itemCount = useMemo(() => {
        return cartItems.reduce((total, item) => total + item.quantity, 0);
    }, [cartItems]);

    const cartTotal = useMemo(() => {
        return cartItems.reduce((total, item) => total + item.final_price * item.quantity, 0);
    }, [cartItems]);

    const actionsValue = useMemo(() => ({
        refreshCart,
        addToCartOptimistic,
        updateQuantityOptimistic,
        removeItemOptimistic,
        clearCart,
        setDeliveryDetails,
        setEventDate,
        setEventTime,
        setDeliveryInstructions,
        setSelectedAddressId,
        addToCartWithBackgroundUpload,
    }), [
        refreshCart,
        addToCartOptimistic,
        updateQuantityOptimistic,
        removeItemOptimistic,
        clearCart,
        setEventDate,
        setEventTime,
        setDeliveryInstructions,
        setSelectedAddressId,
        addToCartWithBackgroundUpload,
    ]);

    const dataValue = useMemo(() => ({
        cartItems,
        addresses,
        cartTotal,
        itemCount,
        isLoading,
        sessionId,
        deliveryDetails,
        eventDate,
        eventTime,
        deliveryInstructions,
        selectedAddressId,
        authError,
    }), [
        cartItems,
        addresses,
        cartTotal,
        itemCount,
        isLoading,
        sessionId,
        deliveryDetails,
        eventDate,
        eventTime,
        deliveryInstructions,
        selectedAddressId,
        authError,
    ]);

    return (
        <CartActionsContext.Provider value={actionsValue}>
            <CartDataContext.Provider value={dataValue}>
                {children}
            </CartDataContext.Provider>
        </CartActionsContext.Provider>
    );
};

// --- NEW SPLIT HOOKS ---

/**
 * Custom hook to access only the cart data.
 * This hook will re-render when cart data (items, totals, loading state) changes.
 */
export const useCartData = (): CartDataType => {
    const context = useContext(CartDataContext);
    if (context === undefined) {
        throw new Error('useCartData must be used within a CartProvider');
    }
    return context;
};

/**
 * Custom hook to access only the cart actions.
 * This hook will NOT re-render when cart data changes, improving performance.
 */
export const useCartActions = (): CartActionsType => {
    const context = useContext(CartActionsContext);
    if (context === undefined) {
        throw new Error('useCartActions must be used within a CartProvider');
    }
    return context;
};

/**
 * Custom hook to access the full cart context (data and actions).
 * Kept for backward compatibility and convenience.
 * This hook will re-render on any cart data change.
 */
export const useCart = (): CartContextType => {
    return {
        ...useCartData(),
        ...useCartActions(),
    };
};
