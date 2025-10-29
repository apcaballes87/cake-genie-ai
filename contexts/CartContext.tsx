// contexts/CartContext.tsx

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
import { debounce } from 'lodash';

import { getSupabaseClient } from '../lib/supabase/client';
import { CakeGenieCartItem, CakeGenieAddress } from '../lib/database.types';
import {
  getCartItems,
  addToCart as addToCartService,
  updateCartItemQuantity as updateQuantityService,
  removeCartItem as removeItemService,
} from '../services/supabaseService';

// Utility to save to localStorage without blocking the main thread
const saveToLocalStorage = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  
  // Use requestIdleCallback to save during idle time, or fallback to setTimeout
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      localStorage.setItem(key, value);
    });
  } else {
    setTimeout(() => {
      localStorage.setItem(key, value);
    }, 0);
  }
};

// Utility to remove from localStorage without blocking
const removeFromLocalStorage = (key: string) => {
  if (typeof window === 'undefined') return;
  
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      localStorage.removeItem(key);
    });
  } else {
    setTimeout(() => {
      localStorage.removeItem(key);
    }, 0);
  }
};

interface DeliveryDetails {
    eventDate: string;
    eventTime: string;
    addressId: string | null; // Null for guests
    addressData: Partial<CakeGenieAddress>;
    deliveryInstructions: string;
}

interface CartContextType {
  cartItems: CakeGenieCartItem[];
  cartTotal: number;
  itemCount: number;
  isLoading: boolean;
  sessionId: string | null;
  deliveryDetails: DeliveryDetails | null;
  setDeliveryDetails: (details: DeliveryDetails | null) => void;
  eventDate: string;
  setEventDate: (date: string) => void;
  eventTime: string;
  setEventTime: (time: string) => void;
  deliveryInstructions: string;
  setDeliveryInstructions: (instructions: string) => void;
  selectedAddressId: string;
  setSelectedAddressId: (id: string) => void;
  refreshCart: () => Promise<void>;
  addToCartOptimistic: (
    item: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>,
    options?: { skipOptimistic?: boolean }
  ) => Promise<void>;
  updateQuantityOptimistic: (cartItemId: string, quantity: number) => Promise<void>;
  removeItemOptimistic: (cartItemId: string) => Promise<void>;
  clearCart: () => void;
  authError: string | null;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const supabase: SupabaseClient = getSupabaseClient();

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CakeGenieCartItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deliveryDetails, setDeliveryDetails] = useState<DeliveryDetails | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const prevUserIdRef = useRef<string | null>(null);

  const [eventDate, setEventDateState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cart_event_date') || '';
    }
    return '';
  });

  const [eventTime, setEventTimeState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('cart_event_time') || '';
    }
    return '';
  });
  
  const [deliveryInstructions, setDeliveryInstructionsState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('cart_delivery_instructions') || '';
    }
    return '';
  });

  const [selectedAddressId, setSelectedAddressIdState] = useState<string>(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('cart_selected_address_id') || '';
      }
      return '';
  });

  const setEventDate = useCallback((date: string) => {
    saveToLocalStorage('cart_event_date', date);
    setEventDateState(date);
  }, []);

  const setEventTime = useCallback((time: string) => {
    saveToLocalStorage('cart_event_time', time);
    setEventTimeState(time);
  }, []);

  const setDeliveryInstructions = useCallback((instructions: string) => {
    saveToLocalStorage('cart_delivery_instructions', instructions);
    setDeliveryInstructionsState(instructions);
  }, []);

  const setSelectedAddressId = useCallback((id: string) => {
    saveToLocalStorage('cart_selected_address_id', id);
    setSelectedAddressIdState(id);
  }, []);

  const loadCart = useCallback(async (user: User | null) => {
    // Prevent multiple simultaneous cart loads
    if (loadingRef.current) {
      console.log('🛒 Cart load already in progress, skipping...');
      return;
    }
    
    loadingRef.current = true;
    setIsLoading(true);
    
    try {
      console.log('🛒 Loading cart items for user:', user?.id);
      
      const isAnonymous = user?.is_anonymous ?? false;
      const userIdForQuery = isAnonymous ? null : user?.id;
      const sessionIdForQuery = isAnonymous ? user?.id : null;

      // Add timeout to prevent hanging
      const getCartItemsWithTimeout = async () => {
        return new Promise<any>(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Cart loading timeout - took longer than 10 seconds'));
            }, 10000); // 10 second timeout
            
            try {
                const result = await getCartItems(userIdForQuery, sessionIdForQuery);
                clearTimeout(timeout);
                resolve(result);
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
      };
      
      const { data, error } = await getCartItemsWithTimeout() as any;
      if (error) throw error;
      setCartItems(data || []);
      console.log('✅ Cart items loaded:', data?.length || 0);
    } catch (error: any) {
      console.error('Failed to load cart:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      if (error.message.includes("timeout")) {
        console.error("Cart loading timed out");
      }
      setCartItems([]);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, []);
  
  // Add a ref to track loading state
  const loadingRef = useRef(false);

  useEffect(() => {
    // Add a ref to track if initialization has already started
    const initStartedRef = { current: false };

    const initialize = async () => {
        // Prevent multiple initializations
        if (initStartedRef.current) {
            console.log('🔄 Initialization already started, skipping...');
            return;
        }

        initStartedRef.current = true;

        try {
            console.log('🔄 Initializing cart context...');

            // Get session without waiting - let it resolve in background
            const sessionPromise = supabase.auth.getSession();

            sessionPromise.then(async ({ data: { session }, error: sessionError }) => {
                if (sessionError) {
                    console.error('❌ Error getting session:', sessionError);
                    throw sessionError;
                }

                let userToLoad: User | null = session?.user || null;
                console.log('📋 Session check result:', { hasSession: !!session, userId: userToLoad?.id });

                if (!session) {
                    console.log('🔵 No session, creating anonymous session...');
                    const { data, error } = await supabase.auth.signInAnonymously();
                    console.log('🔄 Anonymous sign in result:', { data, error });

                    if (error) {
                        console.error('❌ Error creating anonymous session:', error);
                        throw error;
                    }
                    userToLoad = data.user;
                    console.log('✅ Anonymous session created:', userToLoad?.id);
                } else {
                    console.log('✅ Existing session found:', userToLoad.id, 'Is anonymous:', userToLoad.is_anonymous);
                }

                setCurrentUser(userToLoad);
                if (userToLoad?.is_anonymous) {
                    setSessionId(userToLoad.id);
                } else {
                    setSessionId(null);
                }
                prevUserIdRef.current = userToLoad?.id ?? null;

                console.log('🛒 Loading cart for user:', userToLoad?.id);
                // Load cart in background without blocking UI
                loadCart(userToLoad).catch(error => {
                    console.error('Background cart loading failed:', error);
                });
                setAuthError(null);
                console.log('✅ Cart context initialization complete');
            }).catch((error: any) => {
                console.error('❌ Failed to initialize user session:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
                if (error.message.includes("disabled")) {
                    setAuthError("Guest sessions are currently disabled. Please ask the site administrator to enable Anonymous Sign-ins in the Supabase project's authentication settings.");
                } else if (error.message.includes("timeout")) {
                    setAuthError("Authentication service is taking too long to respond. Please check your internet connection and try again.");
                } else {
                    setAuthError(`Could not connect to the service. Please check your internet connection and try again.`);
                }
            });

        } catch (error: any) {
            console.error('❌ Failed to initialize cart context:', error);
        }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        const user = session?.user ?? null;
        const currentUserId = user?.id ?? null;
        
        const isAnonymous = user?.is_anonymous;
        console.log('🔄 Auth state changed:', event, currentUserId, 'Is anonymous:', isAnonymous);
        
        // Only reload the cart if the user has actually changed.
        if (currentUserId !== prevUserIdRef.current) {
            console.log('👤 User changed from', prevUserIdRef.current, 'to', currentUserId);
            prevUserIdRef.current = currentUserId;
            setCurrentUser(user);
            
            if (user?.is_anonymous) {
                setSessionId(user.id);
            } else {
                setSessionId(null);
            }
            
            // If there's no auth error, load the cart for the new user.
            // This handles login/logout scenarios.
            if (!authError) {
                console.log('🛒 Reloading cart for user change...');
                await loadCart(user);
                console.log('✅ Cart reloaded');
            }
        } else {
             // If user hasn't changed (e.g., token refresh), just update the user object.
            console.log('🔄 User unchanged, updating user object');
            setCurrentUser(user);
        }
    });
        
    return () => {
        console.log('🧹 Cleaning up cart context subscription');
        subscription?.unsubscribe();
    };
  }, [loadCart, authError]);

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

      console.log('🔵 Attempting to add to cart:', {
        userId: itemToSend.user_id,
        sessionId: itemToSend.session_id,
        skipOptimistic: options?.skipOptimistic,
        item: {
          cake_type: itemToSend.cake_type,
          cake_size: itemToSend.cake_size,
        }
      });

      const { data: realItem, error } = await addToCartService(itemToSend);

      if (error || !realItem) {
        if (error) {
          const supabaseError = error as PostgrestError;
          console.error('🔴 Supabase error adding to cart:', JSON.stringify(supabaseError, null, 2));
        }
        throw error || new Error('Failed to add item to cart. No data returned from service.');
      }
      
      console.log('🟢 Successfully added to cart:', realItem);

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

  const removeItemOptimistic = useCallback(async (cartItemId: string) => {
    const originalCart = [...cartItems];

    setCartItems(prev => prev.filter(item => item.cart_item_id !== cartItemId));

    try {
        const { error } = await removeItemService(cartItemId);
        if (error) throw error;
    } catch (error) {
        console.error('Error removing item, rolling back:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        setCartItems(originalCart);
        throw error;
    }
  }, [cartItems]);

  const debouncedUpdateQuantity = useMemo(
    () => debounce(async (cartItemId: string, quantity: number, originalCart: CakeGenieCartItem[]) => {
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
    
    const originalCart = [...cartItems];
    const itemToUpdate = cartItems.find(item => item.cart_item_id === cartItemId);
    if (!itemToUpdate) return;
        
    setCartItems(prev =>
        prev.map(item => item.cart_item_id === cartItemId ? { ...item, quantity } : item)
    );
    
    try {
      await debouncedUpdateQuantity(cartItemId, quantity, originalCart);
    } catch (error) {
      throw error;
    }
  }, [cartItems, removeItemOptimistic, debouncedUpdateQuantity]);

  const refreshCart = useCallback(async () => {
    await loadCart(currentUser);
  }, [loadCart, currentUser]);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setDeliveryDetails(null);
    if (typeof window !== 'undefined') {
      removeFromLocalStorage('cart_event_date');
      removeFromLocalStorage('cart_event_time');
      removeFromLocalStorage('cart_delivery_instructions');
      removeFromLocalStorage('cart_selected_address_id');
      removeFromLocalStorage('guestFirstName');
      removeFromLocalStorage('guestLastName');
      removeFromLocalStorage('guestEmail');
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

  const value = useMemo(() => ({
    cartItems,
    cartTotal,
    itemCount,
    isLoading,
    sessionId,
    deliveryDetails,
    setDeliveryDetails,
    eventDate,
    setEventDate,
    eventTime,
    setEventTime,
    deliveryInstructions,
    setDeliveryInstructions,
    selectedAddressId,
    setSelectedAddressId,
    refreshCart,
    addToCartOptimistic,
    updateQuantityOptimistic,
    removeItemOptimistic,
    clearCart,
    authError,
  }), [
    cartItems,
    cartTotal,
    itemCount,
    isLoading,
    sessionId,
    deliveryDetails,
    eventDate,
    setEventDate,
    eventTime,
    setEventTime,
    deliveryInstructions,
    setDeliveryInstructions,
    selectedAddressId,
    setSelectedAddressId,
    refreshCart,
    addToCartOptimistic,
    updateQuantityOptimistic,
    removeItemOptimistic,
    clearCart,
    authError,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

/**
 * Custom hook to access the cart context.
 * Throws an error if used outside of a CartProvider.
 */
export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};