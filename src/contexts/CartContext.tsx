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
import { usePathname } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient, User, PostgrestError } from '@supabase/supabase-js';
import { debounce } from 'lodash-es';
import { showError } from '@/lib/utils/toast';
import { trackAddToCart } from '@/lib/analytics';

import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { CakeGenieCartItem, CakeGenieAddress, CakeGenieMerchant } from '@/lib/database.types';
import {
    getCartPageData,
    addToCart as addToCartService,
    addManyToCart as addManyToCartService,
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
            showError("Could not save session. Browser storage might be full.");
        }
    } finally {
        isFlushScheduled = false;
    }
};

// Debounce the flush operation to batch multiple writes within 100ms
const debouncedFlush = debounce(flushWrites, 100);

// Helper to strip base64 image data from cart items before caching
// This prevents localStorage quota exceeded errors on mobile
const stripBase64FromCartItems = (items: any[]): any[] => {
    return items.map(item => ({
        ...item,
        // Replace base64 data URIs with a placeholder
        // The cart will still show the item, but images will need to be re-fetched
        original_image_url: item.original_image_url?.startsWith('data:')
            ? '' // Empty string - cart will show placeholder
            : item.original_image_url,
        customized_image_url: item.customized_image_url?.startsWith('data:')
            ? '' // Empty string - cart will show placeholder
            : item.customized_image_url,
    }));
};

// Helper to estimate localStorage usage
const estimateLocalStorageSize = (): number => {
    if (typeof window === 'undefined') return 0;
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            const value = localStorage.getItem(key);
            if (value) {
                total += key.length + value.length;
            }
        }
    }
    return total;
};

// Helper to clear old cart items from localStorage to free up space
const clearOldCartItems = (): void => {
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
                        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                        if (data.timestamp < oneDayAgo) {
                            keysToRemove.push(key);
                        }
                    }
                }
            } catch (e) {
                // Ignore items not in the new format
            }
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
};

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
    cartItems: (CakeGenieCartItem & { merchant?: CakeGenieMerchant; isPending?: boolean })[];
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
        uploadTask: (ownerId: string) => Promise<{ originalImageUrl: string; finalImageUrl: string }>
    ) => void;
}

interface CartContextType extends CartDataType, CartActionsType { }

// --- NEW SPLIT CONTEXTS ---

const CartDataContext = createContext<CartDataType | undefined>(undefined);
const CartActionsContext = createContext<CartActionsType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const supabase = createClient();
    const pathname = usePathname();
    const shouldDeferCartSync = pathname === '/';

    // Keep the first client render identical to SSR. Browser cache hydration
    // happens after mount so cart badges cannot trigger React hydration #418.
    const [cartItems, setCartItems] = useState<(CakeGenieCartItem & { merchant?: CakeGenieMerchant; isPending?: boolean })[]>([]);
    const [addresses, setAddresses] = useState<CakeGenieAddress[]>([]);
    const [hasLoadedStorageCache, setHasLoadedStorageCache] = useState(false);

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

    const [eventDate, setEventDateState] = useState<string>('');
    const [eventTime, setEventTimeState] = useState<string>('');
    const [deliveryInstructions, setDeliveryInstructionsState] = useState<string>('');
    const [selectedAddressId, setSelectedAddressIdState] = useState<string>('');

    useEffect(() => {
        const cachedCartItems = readFromLocalStorage('cart_items_cache');
        if (cachedCartItems) {
            try {
                setCartItems(JSON.parse(cachedCartItems));
            } catch (e) {
                // Silently ignore cache parsing errors
            }
        }

        const cachedAddresses = readFromLocalStorage('addresses_cache');
        if (cachedAddresses) {
            try {
                setAddresses(JSON.parse(cachedAddresses));
            } catch (e) {
                // Silently ignore cache parsing errors
            }
        }

        setEventDateState(readFromLocalStorage('cart_event_date') || '');
        setEventTimeState(readFromLocalStorage('cart_event_time') || '');
        setDeliveryInstructionsState(readFromLocalStorage('cart_delivery_instructions') || '');
        setSelectedAddressIdState(readFromLocalStorage('cart_selected_address_id') || '');
        setHasLoadedStorageCache(true);
    }, []);

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
                // Return early on timeout, keep cached data
                return;
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
                // Silently allow cart to load without addresses
            }
            setAddresses(userAddressesData || []);

            // Cache addresses for instant load next time
            if (userAddressesData && userAddressesData.length > 0) {
                batchSaveToLocalStorage('addresses_cache', JSON.stringify(userAddressesData));
            }

        } catch (error) {
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
        if (shouldDeferCartSync) return;
        // Cleanup old storage on mount
        cleanupExpiredLocalStorage();
    }, [shouldDeferCartSync]);

    useEffect(() => {
        const handleAuthChange = async () => {
            if (shouldDeferCartSync) {
                setIsLoading(false);
                return;
            }

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
                    try {
                        const len = localItems.length;
                        const itemsToSync = new Array(len);

                        const isAnon = user?.is_anonymous;
                        const userId = isAnon ? null : (user?.id ?? null);
                        const sessionId = isAnon ? user?.id : null;

                        for (let i = 0; i < len; i++) {
                            const { cart_item_id, created_at, updated_at, expires_at, ...itemParams } = localItems[i];
                            // Re-assign explicitly without object spread
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (itemParams as any).user_id = userId;
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            (itemParams as any).session_id = sessionId;

                            itemsToSync[i] = itemParams;
                        }

                        const { data: syncedItems, error: syncError } = await addManyToCartService(itemsToSync);

                        // Handle partial or full success
                        if (syncedItems && syncedItems.length > 0) {
                            if (syncedItems.length === len) {
                                // Full success
                                setCartItems([]);
                                batchRemoveFromLocalStorage('cart_items_cache');
                            } else {
                                // Partial success: keep the failed ones in local state to try again later.
                                // The backend uses the frontend-generated `cart_item_id` from the original `localItems[i]`
                                // but since `itemsToSync` omitted `cart_item_id`, the backend creates new UUIDs.
                                // To know exactly what failed, we must compare the request payloads against the successful responses
                                // or simply refresh the cart and let the user re-add failed items.
                                // Given the edge case, refreshing from backend is safest.
                                setCartItems([]);
                                batchRemoveFromLocalStorage('cart_items_cache');
                                console.warn("Partial sync success. Some items failed to save.", syncError);
                            }
                        } else if (!syncError) {
                             // Empty sync but no error
                             setCartItems([]);
                             batchRemoveFromLocalStorage('cart_items_cache');
                        } else {
                            // Full failure, keep local cache intact
                            console.error("Failed to sync cart items:", syncError);
                        }
                    } catch (e) {
                        // Silently handle sync failure
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
    }, [user, authLoading, loadCartData, shouldDeferCartSync]);

    // Auto-cache cart items whenever they change (for instant load on next visit)
    // Strip base64 image data to prevent localStorage quota exceeded errors
    useEffect(() => {
        if (!hasLoadedStorageCache) return;

        if (cartItems.length > 0) {
            // Strip base64 data before caching to save space
            const cacheableItems = stripBase64FromCartItems(cartItems);
            const dataStr = JSON.stringify(cacheableItems);
            
            // Check if we're approaching localStorage quota (5MB typical limit)
            const currentSize = estimateLocalStorageSize();
            const newSize = dataStr.length;
            
            if (currentSize + newSize > 4.5 * 1024 * 1024) {
                // Approaching quota limit - clear old cart items first
                clearOldCartItems();
            }
            
            batchSaveToLocalStorage('cart_items_cache', dataStr);
        } else {
            batchRemoveFromLocalStorage('cart_items_cache');
        }
    }, [cartItems, hasLoadedStorageCache]);

    // Auto-cache addresses whenever they change
    useEffect(() => {
        if (!hasLoadedStorageCache) return;

        if (addresses.length > 0) {
            batchSaveToLocalStorage('addresses_cache', JSON.stringify(addresses));
        }
    }, [addresses, hasLoadedStorageCache]);

    const addToCartOptimistic = useCallback(async (
        itemParams: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>,
        options?: { skipOptimistic?: boolean }
    ) => {
        const tempId = uuidv4();
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

        // GA4: fire add_to_cart once per optimistic add.
        trackAddToCart({
            item_id: tempItem.product_id || tempItem.cart_item_id,
            item_name: tempItem.cake_type || 'custom-cake',
            price: tempItem.final_price,
            quantity: tempItem.quantity,
        });

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
                throw error || new Error('Failed to add item to cart. No data returned from service.');
            }

            if (options?.skipOptimistic) {
                setCartItems(prev => [realItem, ...prev]);
            } else {
                setCartItems(prev => prev.map(item => item.cart_item_id === tempId ? realItem : item));
            }

        } catch (error: any) {
            if (!options?.skipOptimistic) {
                setCartItems(prev => prev.filter(item => item.cart_item_id !== tempId));
            }
            throw error;
        }
    }, []);

    const addToCartWithBackgroundUpload = useCallback((
        initialItem: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>,
        uploadTask: (ownerId: string) => Promise<{ originalImageUrl: string; finalImageUrl: string }>
    ) => {
        const tempId = uuidv4();
        const now = new Date().toISOString();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // 1. Optimistic Update with Initial Item (Base64) - INSTANT
        const tempItem: CakeGenieCartItem & { merchant?: CakeGenieMerchant; isPending?: boolean } = {
            ...initialItem,
            cart_item_id: tempId,
            created_at: now,
            updated_at: now,
            expires_at: expiresAt.toISOString(),
            isPending: true,
        };

        setCartItems(prevItems => [tempItem, ...prevItems]);

        // GA4: fire add_to_cart for the background-upload path too.
        trackAddToCart({
            item_id: tempItem.product_id || tempItem.cart_item_id,
            item_name: tempItem.cake_type || 'custom-cake',
            price: tempItem.final_price,
            quantity: tempItem.quantity,
        });

        const ownerPromise: Promise<Pick<CakeGenieCartItem, 'user_id' | 'session_id'> & { ownerId: string }> =
            Promise.resolve().then(() => {
                if (initialItem.user_id || initialItem.session_id) {
                    return {
                        user_id: initialItem.user_id,
                        session_id: initialItem.session_id,
                        ownerId: initialItem.user_id || initialItem.session_id || '',
                    };
                }

                return supabase.auth.getUser().then(({ data: { user } }) => {
                    const isAnonymous = user?.is_anonymous ?? false;

                    if (!user) {
                        console.error('❌ Cart: User session lost during background save');
                        throw new Error("User session not found during background save");
                    }

                    return {
                        user_id: isAnonymous ? null : user.id,
                        session_id: isAnonymous ? user.id : null,
                        ownerId: user.id,
                    };
                });
            });

        // 2. Fire-and-forget Background Process (runs without blocking navigation)
        // We DON'T await this - it runs in the background while user is navigated to cart
        console.log('🔄 Cart: Background upload started...');
        ownerPromise
            .then(async (owner) => {
                const uploadedImages = await uploadTask(owner.ownerId);
                return { owner, ...uploadedImages };
            })
            .then(async ({ owner, originalImageUrl, finalImageUrl }) => {
                console.log('✅ Cart: Background upload complete. Saving to database...', { originalImageUrl, finalImageUrl });
                
                // Prepare real item for DB
                const finalItemParams = {
                    ...initialItem,
                    original_image_url: originalImageUrl,
                    customized_image_url: finalImageUrl
                };

                const itemToSend = {
                    ...finalItemParams,
                    user_id: owner.user_id,
                    session_id: owner.session_id,
                };

                const { data: realItem, error } = await addToCartService(itemToSend);

                if (error || !realItem) {
                    console.error('❌ Cart: Failed to save real item to database:', error);
                    throw error;
                }

                console.log('✅ Cart: Item successfully persisted to database.');

                // Replace temp item with real item once upload/DB is complete
                setCartItems(prev => prev.map(item => item.cart_item_id === tempId ? realItem : item));
            })
            .catch((error) => {
                console.error('❌ Cart: Background process failed:', error);
                // Rollback on failure - remove the temp item
                setCartItems(prev => prev.filter(item => item.cart_item_id !== tempId));
                showError("Failed to save item to cart. Please try again.");
            });

        // Function returns immediately - navigation can happen right away!
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
            setCartItems(originalCart);
            throw error;
        }
    }, []);

    const debouncedUpdateQuantity = useMemo(
        () => debounce(async (cartItemId: string, quantity: number, originalCart: (CakeGenieCartItem & { merchant?: CakeGenieMerchant })[]) => {
            try {
                const { error } = await updateQuantityService(cartItemId, quantity);
                if (error) {
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
