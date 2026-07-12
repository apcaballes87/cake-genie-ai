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
import type { User, PostgrestError } from '@supabase/supabase-js';
import { debounce } from 'lodash-es';
import { showError } from '@/lib/utils/toast';
import { trackAddToCart, trackEvent } from '@/lib/analytics';
import { logErrorToSupabase } from '@/components/ErrorLogger';
import { compressImage, dataURItoBlob } from '@/lib/utils/imageOptimization';
import { getCartOutbox, putCartOutbox, reassignCartOutboxOwner, removeCartOutbox, type CartOutboxRecord, type CartOutboxStage } from '@/lib/cartOutbox';
import { CART_RETENTION_DAYS, claimCartAuthTransfer, clearPendingCartAuthTransfer, getPendingCartAuthTransfer } from '@/lib/cartAuthTransfer';

import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { CakeGenieCartItem, CakeGenieAddress, CakeGenieMerchant } from '@/lib/database.types';
import {
    getCartPageData,
    addToCart as addToCartService,
    addToCartIdempotent,
    updateCartItemImages,
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
const stripBase64FromCartItems = (items: CakeGenieCartItem[]): CakeGenieCartItem[] => {
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

const CART_OUTBOX_MAX_RETRY_DELAY_MS = 60_000;

function getCartOutboxRetryDelayMs(attempts: number): number {
    return Math.min(CART_OUTBOX_MAX_RETRY_DELAY_MS, 1_000 * (2 ** Math.min(attempts, 6)));
}

function getCartOutboxErrorDetails(error: unknown, stage: CartOutboxStage): {
    message: string;
    errorCode?: string;
    authFailure: boolean;
} {
    const errorCode = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : undefined;
    const rawMessage = error instanceof Error ? error.message : String(error || 'Unknown cart persistence error');
    const authFailure = stage === 'auth_owner' || errorCode === '42501' || /session|auth|permission|row-level security/i.test(rawMessage);
    const message = errorCode === '42501' || authFailure
        ? 'Cart owner session or policy check failed'
        : rawMessage.replace(/https?:\/\/[^\s]+/g, '[redacted-url]').slice(0, 500);
    return { message, errorCode, authFailure };
}

const isPermanentCartImageUrl = (value: string | null | undefined): value is string =>
    Boolean(value && value.startsWith('http'));

type CartItemWithUiMetadata = CakeGenieCartItem & {
    merchant?: CakeGenieMerchant;
    isPending?: boolean;
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
                        const cartRetentionCutoff = Date.now() - CART_RETENTION_DAYS * 24 * 60 * 60 * 1000;
                        if (data.timestamp < cartRetentionCutoff) {
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
                        const cartRetentionCutoff = Date.now() - CART_RETENTION_DAYS * 24 * 60 * 60 * 1000;
                        if (data.timestamp < cartRetentionCutoff) {
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

type BackgroundUploadResult = {
    originalImageUrl: string;
    finalImageUrl: string;
};

type BackgroundUploadTask =
    | Promise<BackgroundUploadResult>
    | ((ownerId: string) => Promise<BackgroundUploadResult>);

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
        uploadTask: BackgroundUploadTask
    ) => Promise<void>;
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

    // `CartProvider` lives above route changes, so this ref lets us identify
    // the anonymous user that owned the cart before OAuth replaced the auth
    // session with the registered Google user.
    const previousUserRef = useRef<User | null | undefined>(undefined);
    const cartItemsRef = useRef(cartItems);
    const outboxInFlightRef = useRef(new Set<string>());

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

    const loadCartData = useCallback(async (
        user: User | null,
        preservedItems: CartItemWithUiMetadata[] = [],
    ): Promise<boolean> => {
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
                return false;
            }

            const { data: cartItemsData, error: cartError } = cartData;
            if (cartError) throw cartError;
            // Never let an authoritative-but-still-empty fetch erase a locally
            // durable cart save that is uploading its preview in the background.
            const serverItems = cartItemsData || [];
            const serverIds = new Set(serverItems.map(item => item.cart_item_id));
            const preserved = preservedItems.filter(item => !serverIds.has(item.cart_item_id));

            setCartItems(previous => {
                const pending = previous.filter(item => item.isPending && !serverIds.has(item.cart_item_id));
                const pendingIds = new Set(pending.map(item => item.cart_item_id));
                return [
                    ...pending,
                    ...preserved.filter(item => !pendingIds.has(item.cart_item_id)),
                    ...serverItems,
                ];
            });

            // Cache cart items for instant load next time
            if (cartItemsData && cartItemsData.length > 0) {
                batchSaveToLocalStorage('cart_items_cache', JSON.stringify(cartItemsData));
            } else if (!preservedItems.length && !cartItemsRef.current.some(item => item.isPending)) {
                // An empty authenticated fetch is only allowed to clear the
                // cache when there is no in-flight transition preserving it.
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

            return true;
        } catch (error) {
            // Keep cached and outbox-backed items visible; a failed refresh is
            // not evidence that the customer deliberately removed their cart.
            setAddresses([]);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const claimPendingCartForAuthenticatedUser = useCallback(async (
        authenticatedUser: User,
    ): Promise<boolean> => {
        const pendingTransfer = getPendingCartAuthTransfer();
        if (!pendingTransfer) return true;

        const { data: claimedTransfer, error } = await claimCartAuthTransfer(supabase, pendingTransfer.token);
        if (error || !claimedTransfer) {
            trackEvent('cart_auth_transfer', { state: 'failed', stage: 'claim' });
            showError('We kept your cakes in the cart, but could not restore them after sign-in. Please try again.');
            return false;
        }

        const reassignedOutboxCount = await reassignCartOutboxOwner(
            claimedTransfer.sourceAnonymousUserId,
            authenticatedUser.id,
        );
        if (reassignedOutboxCount > 0) {
            trackEvent('cart_outbox_reowned', { had_pending_records: true });
        }
        trackEvent('cart_auth_transfer', {
            state: 'claimed',
            replayed: claimedTransfer.alreadyClaimed,
        });

        return true;
    }, [supabase]);

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

            // Wait for the browser cache before the first authenticated read.
            // A full-page OAuth return starts with the registered user, so this
            // is the only chance to claim the anonymous cart before an empty
            // server response could replace its cached view.
            if (authLoading || !hasLoadedStorageCache) return;

            const loadAuthenticatedCart = async (authenticatedUser: User): Promise<void> => {
                const hasPendingTransfer = Boolean(getPendingCartAuthTransfer());
                if (hasPendingTransfer) {
                    const claimed = await claimPendingCartForAuthenticatedUser(authenticatedUser);
                    if (!claimed) {
                        setIsLoading(false);
                        return;
                    }
                }

                const loaded = await loadCartData(authenticatedUser);
                if (hasPendingTransfer && loaded) {
                    clearPendingCartAuthTransfer();
                }
            };

            // The first resolved auth state can be a registered OAuth return.
            // Restore its claim before loading the registered owner's cart.
            if (previousUserRef.current === undefined) {
                previousUserRef.current = user;
                if (user && !user.is_anonymous) {
                    await loadAuthenticatedCart(user);
                } else {
                    await loadCartData(user);
                }
                return;
            }

            const previousUser = previousUserRef.current;
            const userChanged = previousUser?.id !== user?.id;

            if (userChanged && previousUser?.is_anonymous && user && !user.is_anonymous) {
                previousUserRef.current = user;

                if (!getPendingCartAuthTransfer() && cartItemsRef.current.length > 0) {
                    setIsLoading(false);
                    showError('We kept your cakes in the cart, but could not safely restore them after sign-in. Please try again.');
                    return;
                }

                await loadAuthenticatedCart(user);
                return;
            }

            if (userChanged) {
                previousUserRef.current = user;
                await loadCartData(user);
            }
        };

        void handleAuthChange();
    }, [user, authLoading, hasLoadedStorageCache, claimPendingCartForAuthenticatedUser, loadCartData, shouldDeferCartSync]);

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
        expiresAt.setDate(expiresAt.getDate() + CART_RETENTION_DAYS);

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

        } catch (error: unknown) {
            if (!options?.skipOptimistic) {
                setCartItems(prev => prev.filter(item => item.cart_item_id !== tempId));
            }
            throw error;
        }
    }, []);

    const uploadOutboxImages = useCallback(async (
        item: CakeGenieCartItem,
        ownerId: string,
    ): Promise<BackgroundUploadResult> => {
        const uploadImage = async (value: string | null, suffix: 'original' | 'edited'): Promise<string | null> => {
            if (!value || isPermanentCartImageUrl(value)) return value;

            const blob = dataURItoBlob(value);
            const file = new File([blob], `${suffix}.webp`, { type: 'image/webp' });
            const compressed = suffix === 'edited'
                ? await compressImage(file, { maxSizeMB: 1, fileType: 'image/webp' })
                : file;
            const path = `customizations/${ownerId}/cart/${item.cart_item_id}-${suffix}.webp`;
            const { error } = await supabase.storage.from('cakegenie').upload(path, compressed, {
                contentType: 'image/webp',
                upsert: true,
            });
            if (error) throw new Error(`Failed to upload ${suffix} image: ${error.message}`);
            return supabase.storage.from('cakegenie').getPublicUrl(path).data.publicUrl;
        };

        const originalImageUrl = await uploadImage(item.original_image_url, 'original');
        const finalImageUrl = await uploadImage(item.customized_image_url, 'edited');
        return { originalImageUrl: originalImageUrl || '', finalImageUrl: finalImageUrl || originalImageUrl || '' };
    }, [supabase]);

    const processCartOutboxRecord = useCallback(async (
        record: CartOutboxRecord,
        uploadTask?: BackgroundUploadTask,
    ) => {
        const requestId = record.cartItem.cart_item_id;
        if (record.nextAttemptAt && new Date(record.nextAttemptAt).getTime() > Date.now()) return;
        if (outboxInFlightRef.current.has(requestId)) return;
        outboxInFlightRef.current.add(requestId);

        let stage: CartOutboxStage = record.stage;
        try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) throw new Error('User session not found while saving cart');

            // A pending anonymous record may resume after Google returns to a
            // fresh page. The current authenticated owner is authoritative;
            // never retry an old anonymous owner ID against the new session.
            const owner = {
                user_id: currentUser.is_anonymous ? null : currentUser.id,
                session_id: currentUser.is_anonymous ? currentUser.id : null,
                ownerId: currentUser.id,
            };

            // UI-only fields are intentionally excluded from the database row.
            const { isPending: _isPending, merchant: _merchant, ...cartItemForInsert } = record.cartItem as CakeGenieCartItem & {
                isPending?: boolean;
                merchant?: CakeGenieMerchant;
            };
            void _isPending;
            void _merchant;
            const durableItem: CakeGenieCartItem = {
                ...cartItemForInsert,
                user_id: owner.user_id,
                session_id: owner.session_id,
                original_image_url: isPermanentCartImageUrl(record.cartItem.original_image_url)
                    ? record.cartItem.original_image_url
                    : null,
                customized_image_url: isPermanentCartImageUrl(record.cartItem.customized_image_url)
                    ? record.cartItem.customized_image_url
                    : null,
            };

            stage = 'cart_insert';
            const { data: persisted, error: insertError } = await addToCartIdempotent(durableItem);
            if (insertError || !persisted) throw insertError || new Error('Cart row was not created');

            setCartItems(previous => previous.map(item => item.cart_item_id === requestId
                ? { ...persisted, isPending: true }
                : item));

            stage = 'image_upload';
            const uploaded = uploadTask
                ? await (typeof uploadTask === 'function' ? uploadTask(owner.ownerId) : uploadTask)
                : await uploadOutboxImages(record.cartItem, owner.ownerId);

            stage = 'image_update';
            const { data: completed, error: updateError } = await updateCartItemImages(
                persisted.cart_item_id,
                uploaded.originalImageUrl || null,
                uploaded.finalImageUrl || null,
            );
            if (updateError || !completed) throw updateError || new Error('Cart preview was not updated');

            setCartItems(previous => previous.map(item => item.cart_item_id === requestId ? completed : item));
            await removeCartOutbox(requestId);
        } catch (error) {
            const errorDetails = getCartOutboxErrorDetails(error, stage);
            const nextAttemptAt = new Date(Date.now() + getCartOutboxRetryDelayMs(record.attempts + 1)).toISOString();
            const failedRecord: CartOutboxRecord = {
                ...record,
                attempts: record.attempts + 1,
                stage,
                lastError: errorDetails.message,
                nextAttemptAt,
            };
            await putCartOutbox(failedRecord);
            setCartItems(previous => previous.map(item => item.cart_item_id === requestId
                ? { ...item, isPending: true }
                : item));
            void logErrorToSupabase({
                error_message: `Cart outbox ${stage} failed: ${errorDetails.message}`.slice(0, 1000),
                error_type: errorDetails.authFailure ? 'error' : 'network',
                page_url: typeof window === 'undefined' ? '' : window.location.href,
                page_path: typeof window === 'undefined' ? '' : window.location.pathname,
                user_agent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
                viewport_width: typeof window === 'undefined' ? 0 : window.innerWidth,
                viewport_height: typeof window === 'undefined' ? 0 : window.innerHeight,
                session_id: requestId,
                metadata: {
                    cartRequestId: requestId,
                    stage,
                    attempts: failedRecord.attempts,
                    nextAttemptAt,
                    errorCode: errorDetails.errorCode,
                    authFailure: errorDetails.authFailure,
                },
            });
            showError("We're keeping your cake in the cart and will retry its preview.");
        } finally {
            outboxInFlightRef.current.delete(requestId);
        }
    }, [supabase, uploadOutboxImages]);

    const addToCartWithBackgroundUpload = useCallback(async (
        initialItem: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>,
        uploadTask: BackgroundUploadTask
    ) => {
        const tempId = uuidv4();
        const now = new Date().toISOString();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + CART_RETENTION_DAYS);

        // 1. Optimistic Update with Initial Item (Base64) - INSTANT
        const tempItem: CakeGenieCartItem & { merchant?: CakeGenieMerchant; isPending?: boolean } = {
            ...initialItem,
            cart_item_id: tempId,
            client_request_id: tempId,
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

        // The durable browser outbox is written before this promise resolves
        // (and before CustomizingClient redirects), but the optimistic state is
        // rendered immediately rather than waiting for IndexedDB.
        await putCartOutbox({
            cartItem: tempItem,
            createdAt: now,
            attempts: 0,
            stage: 'auth_owner',
        });

        void processCartOutboxRecord({
            cartItem: tempItem,
            createdAt: now,
            attempts: 0,
            stage: 'auth_owner',
        }, uploadTask);
    }, [processCartOutboxRecord]);

    useEffect(() => {
        if (authLoading || typeof window === 'undefined') return;

        let disposed = false;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;
        const restoreAndRetry = async () => {
            const records = await getCartOutbox();
            if (disposed || records.length === 0) return;

            setCartItems(previous => {
                const existing = new Set(previous.map(item => item.cart_item_id));
                const restored = records
                    .filter(record => !existing.has(record.cartItem.cart_item_id))
                    .map(record => ({ ...record.cartItem, isPending: true }));
                return [...restored, ...previous];
            });

            const now = Date.now();
            let nextRetryAt: number | null = null;
            for (const record of records) {
                const scheduledAt = record.nextAttemptAt ? new Date(record.nextAttemptAt).getTime() : now;
                if (scheduledAt > now) {
                    nextRetryAt = nextRetryAt === null ? scheduledAt : Math.min(nextRetryAt, scheduledAt);
                    continue;
                }
                void processCartOutboxRecord(record);
            }
            if (nextRetryAt !== null && !disposed) {
                if (retryTimer) clearTimeout(retryTimer);
                retryTimer = setTimeout(() => void restoreAndRetry(), Math.max(250, nextRetryAt - Date.now()));
            }
        };

        void restoreAndRetry();
        window.addEventListener('online', restoreAndRetry);
        window.addEventListener('focus', restoreAndRetry);
        return () => {
            disposed = true;
            if (retryTimer) clearTimeout(retryTimer);
            window.removeEventListener('online', restoreAndRetry);
            window.removeEventListener('focus', restoreAndRetry);
        };
    }, [authLoading, processCartOutboxRecord]);

    const removeItemOptimistic = useCallback(async (cartItemId: string) => {
        // Use ref to avoid stale closure over cartItems — prevents this callback
        // from being re-created on every cart change, which would cascade re-renders
        // through the actions context and break React.memo on child components.
        const originalCart = [...cartItemsRef.current];

        setCartItems(prev => prev.filter(item => item.cart_item_id !== cartItemId));
        await removeCartOutbox(cartItemId);

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
        if (user && !user.is_anonymous && getPendingCartAuthTransfer()) {
            const claimed = await claimPendingCartForAuthenticatedUser(user);
            if (!claimed) return;

            const loaded = await loadCartData(user);
            if (loaded) clearPendingCartAuthTransfer();
            return;
        }

        await loadCartData(user);
    }, [claimPendingCartForAuthenticatedUser, loadCartData, user]);

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
