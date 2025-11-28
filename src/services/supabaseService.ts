// services/supabaseService.ts
import { getSupabaseClient } from '../lib/supabase/client';
import { CakeType, BasePriceInfo, CakeThickness, ReportPayload, CartItemDetails, HybridAnalysisResult, AiPrompt, PricingRule, PricingFeedback, AvailabilitySettings, CartItem } from '../types';
import type { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { CakeGenieCartItem, CakeGenieAddress, CakeGenieOrder, CakeGenieOrderItem, OrderContribution } from '../lib/database.types';
import { compressImage, validateImageFile } from '../lib/utils/imageOptimization';

const supabase: SupabaseClient = getSupabaseClient();

// Type for service responses
type SupabaseServiceResponse<T> = {
  data: T | null;
  error: Error | PostgrestError | null;
};


// --- New Types for Delivery Date RPCs ---
export interface AvailableDate {
  available_date: string;
  day_of_week: string;
  is_rush_available: boolean;
  is_same_day_available: boolean;
  is_standard_available: boolean;
}

export interface BlockedDateInfo {
  closure_reason: string | null;
  is_all_day: boolean;
  blocked_time_start: string | null;
  blocked_time_end: string | null;
}

// --- Dynamic Config Fetchers ---

export const savePricingFeedback = async (feedback: PricingFeedback): Promise<void> => {
  try {
    const { error } = await supabase
      .from('pricing_feedback')
      .insert([feedback]);

    if (error) {
      throw new Error(error.message);
    }
  } catch (err) {
    console.error("Error saving pricing feedback:", err);
    throw new Error("Could not save feedback to the database.");
  }
};


export const getCakeBasePriceOptions = async (
  type: CakeType,
  thickness: CakeThickness
): Promise<BasePriceInfo[]> => {
  try {
    const { data, error } = await supabase
      .from('productsizes_cakegenie')
      .select('cakesize, price, display_order')
      .eq('type', type)
      .eq('thickness', thickness)
      .order('display_order', { ascending: true })
      .order('cakesize', { ascending: true });

    if (error) {
      console.error("Supabase error:", error.message);
      throw new Error(error.message);
    }

    if (data && data.length > 0) {
      return data.map(item => ({ size: item.cakesize, price: item.price }));
    }

    // Return empty array instead of throwing error if no options are found
    return [];

  } catch (err) {
    // FIX: Serialize error object to prevent '[object Object]' in logs.
    console.error("Error fetching cake base price options:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    if (err instanceof Error && err.message.includes('not available')) {
      throw err;
    }
    throw new Error("Could not connect to the pricing database.");
  }
};

/**
 * Uploads a base64 image to Supabase storage for report purposes.
 * @param base64Data The base64 image data (with or without data URL prefix)
 * @param imageType 'original' or 'customized'
 * @returns The public URL of the uploaded image
 */
export const uploadReportImage = async (base64Data: string, imageType: 'original' | 'customized'): Promise<string> => {
  try {
    // Remove data URL prefix if present
    const base64String = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

    // Convert base64 to blob
    const byteCharacters = atob(base64String);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/webp' });

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = uuidv4().substring(0, 8);
    const fileName = `${imageType}_${timestamp}_${randomId}.webp`;
    const filePath = `reported_cakes/${fileName}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('cakegenie')
      .upload(filePath, blob, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload ${imageType} image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('cakegenie')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error(`Error uploading ${imageType} report image:`, err);
    throw new Error(`Could not upload ${imageType} image to storage.`);
  }
};

export const reportCustomization = async (payload: ReportPayload): Promise<void> => {
  try {
    const { error } = await supabase
      .from('cakegenie_reports')
      .insert([payload]);

    if (error) {
      console.error("Supabase report error:", error.message);
      throw new Error(error.message);
    }
  } catch (err) {
    // FIX: Serialize error object to prevent '[object Object]' in logs.
    console.error("Error reporting customization:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    throw new Error("Could not submit the report to the database.");
  }
};

/**
 * Tracks a search term by calling a Supabase RPC function.
 * This is a "fire-and-forget" operation for analytics.
 * @param term The search term to track.
 */
export async function trackSearchTerm(term: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('track_search', {
      p_term: term.toLowerCase().trim(),
    });

    if (error) {
      // Log the error but don't throw, as this is a non-critical background task.
      console.warn("Supabase search tracking error:", error.message);
    }
  } catch (err) {
    // Also catch network or other unexpected errors.
    console.warn("Error tracking search term:", err);
  }
}

// --- Analysis Cache Functions ---

/**
 * Searches for a similar analysis result in the cache using a perceptual hash.
 * @param pHash The perceptual hash of the new image.
 * @returns The cached analysis JSON if a similar one is found, otherwise null.
 */
export async function findSimilarAnalysisByHash(pHash: string): Promise<HybridAnalysisResult | null> {
  try {
    console.log('🔍 Calling find_similar_analysis RPC with pHash:', pHash);
    const { data, error } = await supabase.rpc('find_similar_analysis', {
      new_hash: pHash,
    });

    if (error) {
      console.error('❌ Analysis cache lookup error:', error);
      console.error('Error details:', { code: error.code, message: error.message, hint: error.hint });
      return null;
    }

    if (data) {
      console.log('✅ Cache HIT! Found matching analysis for pHash:', pHash);
    } else {
      console.log('⚫️ Cache MISS. No matching pHash found in database.');
    }
    return data; // Returns the JSONB object or null
  } catch (err) {
    console.error('❌ Exception during analysis cache lookup:', err);
    return null;
  }
}

/**
 * Saves a new AI analysis result to the cache table. This is a fire-and-forget operation.
 * @param pHash The perceptual hash of the image.
 * @param analysisResult The JSON result from the AI analysis.
 * @param imageUrl The public URL of the original image being cached.
 */
export function cacheAnalysisResult(pHash: string, analysisResult: HybridAnalysisResult, imageUrl?: string): void {
  // FIX: Converted to an async IIFE to use try/catch for error handling,
  // as the Supabase query builder is a 'thenable' but may not have a .catch method.
  (async () => {
    try {
      console.log('💾 Attempting to cache analysis result with pHash:', pHash);
      const { error } = await supabase
        .from('cakegenie_analysis_cache')
        .insert({
          p_hash: pHash,
          analysis_json: analysisResult,
          original_image_url: imageUrl,
        });

      if (error) {
        // Log error but don't interrupt the user. A unique constraint violation is expected and fine.
        if (error.code !== '23505') { // 23505 is unique_violation
          console.error('❌ Failed to cache analysis result:', error);
          console.error('Error details:', { code: error.code, message: error.message, hint: error.hint });
        } else {
          console.log('ℹ️ Analysis already cached (duplicate pHash - this is fine).');
        }
      } else {
        console.log('✅ Analysis result cached successfully with pHash:', pHash);
      }
    } catch (err) {
      console.error('❌ Exception during fire-and-forget cache write:', err);
    }
  })();
}


// --- Cart Functions ---

/**
 * Fetches active cart items for a logged-in user or a guest session.
 * @param userId - The UUID of the logged-in user.
 * @param sessionId - The session ID for a guest user.
 * @returns An object containing an array of cart items or an error.
 */
export async function getCartItems(
  userId: string | null,
  sessionId: string | null
): Promise<SupabaseServiceResponse<CakeGenieCartItem[]>> {
  if (!userId && !sessionId) {
    return { data: [], error: null };
  }

  try {
    let query = supabase
      .from('cakegenie_cart')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Adds a new item to the shopping cart.
 * @param params - The details of the cart item to add.
 * @returns An object containing the newly added cart item or an error.
 */
export async function addToCart(
  params: Omit<CakeGenieCartItem, 'cart_item_id' | 'created_at' | 'updated_at' | 'expires_at'>
): Promise<SupabaseServiceResponse<CakeGenieCartItem>> {
  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Item expires in 7 days

    const { data, error } = await supabase
      .from('cakegenie_cart')
      .insert({ ...params, expires_at: expiresAt.toISOString() })
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Updates the quantity of an existing item in the cart.
 * @param cartItemId - The UUID of the cart item to update.
 * @param quantity - The new quantity for the item.
 * @returns An object containing the updated cart item or an error.
 */
export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number
): Promise<SupabaseServiceResponse<CakeGenieCartItem>> {
  try {
    if (quantity <= 0) {
      // Let removeCartItem handle deletion
      return { data: null, error: new Error("Quantity must be positive.") };
    }

    const { data, error } = await supabase
      .from('cakegenie_cart')
      .update({ quantity: quantity, updated_at: new Date().toISOString() })
      .eq('cart_item_id', cartItemId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Removes an item from the shopping cart.
 * @param cartItemId - The UUID of the cart item to remove.
 * @returns An object containing an error if the operation failed.
 */
export async function removeCartItem(
  cartItemId: string
): Promise<SupabaseServiceResponse<null>> {
  try {
    const { error } = await supabase
      .from('cakegenie_cart')
      .delete()
      .eq('cart_item_id', cartItemId);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// --- Address Functions ---

/**
 * Fetches all addresses for a given user.
 * @param userId The UUID of the user.
 */
export async function getUserAddresses(
  userId: string
): Promise<SupabaseServiceResponse<CakeGenieAddress[]>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Adds a new address for a user. If setting as default, it will also handle
 * un-setting other addresses for that user.
 * @param userId The UUID of the user.
 * @param addressData The address data to insert.
 */
export async function addAddress(
  userId: string,
  addressData: Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'>
): Promise<SupabaseServiceResponse<CakeGenieAddress>> {
  try {
    // If this new address is the default, unset other defaults first
    if (addressData.is_default) {
      const { error: unsetError } = await supabase
        .from('cakegenie_addresses')
        .update({ is_default: false })
        .eq('user_id', userId);

      if (unsetError) {
        return { data: null, error: unsetError };
      }
    }

    const { data, error } = await supabase
      .from('cakegenie_addresses')
      .insert({ ...addressData, user_id: userId })
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Updates an existing address for a user.
 * @param userId The UUID of the user (needed to unset other defaults).
 * @param addressId The UUID of the address to update.
 * @param addressData The new data for the address.
 */
export async function updateAddress(
  userId: string,
  addressId: string,
  addressData: Partial<Omit<CakeGenieAddress, 'address_id' | 'created_at' | 'updated_at' | 'user_id'>>
): Promise<SupabaseServiceResponse<CakeGenieAddress>> {
  try {
    // If updating to be the default, unset other defaults for this user first
    if (addressData.is_default) {
      const { error: unsetError } = await supabase
        .from('cakegenie_addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .neq('address_id', addressId); // Don't unset the one we're about to set

      if (unsetError) {
        return { data: null, error: unsetError };
      }
    }

    const { data, error } = await supabase
      .from('cakegenie_addresses')
      .update({ ...addressData, updated_at: new Date().toISOString() })
      .eq('address_id', addressId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}


/**
 * Deletes a user's address.
 * @param addressId The UUID of the address to delete.
 */
export async function deleteAddress(
  addressId: string
): Promise<SupabaseServiceResponse<null>> {
  try {
    const { error } = await supabase
      .from('cakegenie_addresses')
      .delete()
      .eq('address_id', addressId);

    if (error) {
      return { data: null, error };
    }
    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Sets a specific address as the default for a user using atomic RPC function.
 * @param addressId The UUID of the address to set as default.
 * @param userId The UUID of the user.
 */
export async function setDefaultAddress(
  addressId: string,
  userId: string
): Promise<SupabaseServiceResponse<null>> {
  try {
    const { error } = await supabase.rpc('set_default_address', {
      p_user_id: userId,
      p_address_id: addressId
    });

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// --- Order Functions ---

export async function createOrderFromCart(
  params: {
    cartItems: CakeGenieCartItem[];
    eventDate: string;
    eventTime: string;
    deliveryAddressId: string | null;
    deliveryInstructions?: string;
    deliveryFee?: number;
    discountAmount?: number;
    discountCodeId?: string;
    guestAddress?: {
      recipientName: string;
      recipientPhone: string;
      streetAddress: string;
      city?: string;
    };
  }
): Promise<{ success: boolean, order?: any, error?: Error }> {
  const { cartItems, eventDate, eventTime, deliveryAddressId, deliveryInstructions, deliveryFee = 0, discountAmount, discountCodeId, guestAddress } = params;

  try {
    if (!cartItems || cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    // FIX: Fetch the user directly before the operation to ensure the most
    // up-to-date session is used, preventing RLS violations.
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    let activeUser = user;

    if (userError || !activeUser) {
      console.warn("getUser failed, falling back to getSession:", userError);
      const { data: { session } } = await supabase.auth.getSession();
      activeUser = session?.user || null;
    }

    if (!activeUser) {
      throw new Error("Authentication error: User session not found.");
    }

    const subtotal = cartItems.reduce((sum, item) => sum + (item.final_price * item.quantity), 0);

    // Call the atomic RPC function
    const { data, error } = await supabase.rpc('create_order_from_cart', {
      p_user_id: activeUser.id,
      p_delivery_address_id: deliveryAddressId,
      p_delivery_date: eventDate,
      p_delivery_time_slot: eventTime,
      p_subtotal: subtotal,
      p_delivery_fee: deliveryFee,
      p_delivery_instructions: deliveryInstructions || null,
      p_discount_amount: discountAmount || 0,
      p_discount_code_id: discountCodeId || null,
      // Guest address params
      p_recipient_name: guestAddress?.recipientName || null,
      p_recipient_phone: guestAddress?.recipientPhone || null,
      p_delivery_address: guestAddress?.streetAddress || null,
      p_delivery_city: guestAddress?.city || 'Cebu City', // Default to Cebu City if not provided
    });

    if (error) throw error;

    // The RPC returns an array with one row
    const orderResult = data[0];

    // Fetch the complete order with items for return
    const { data: fullOrder, error: fetchError } = await supabase
      .from('cakegenie_orders')
      .select(`
        *,
        cakegenie_order_items(*),
        cakegenie_addresses(*)
      `)
      .eq('order_id', orderResult.order_id)
      .single();

    if (fetchError) throw fetchError;

    return { success: true, order: fullOrder };
  } catch (error: any) {
    // FIX: Serialize error object to prevent '[object Object]' in logs.
    console.error('Error creating order:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    const message = (error && error.message) || 'An unknown error occurred during order creation.';
    return { success: false, error: new Error(message) };
  }
}

export async function createSplitOrderFromCart(params: {
  cartItems: CakeGenieCartItem[];
  eventDate: string;
  eventTime: string;
  deliveryAddressId: string | null;
  deliveryInstructions: string;
  deliveryFee: number;
  discountAmount?: number;
  discountCodeId?: string;
  guestAddress?: {
    recipientName: string;
    recipientPhone: string;
    streetAddress: string;
    city: string;
  };
  isSplitOrder: boolean;
  splitMessage: string;
  splitCount: number;
}): Promise<{ success: boolean; order?: CakeGenieOrder; error?: Error }> {
  try {
    const {
      cartItems,
      eventDate,
      eventTime,
      deliveryAddressId,
      deliveryInstructions,
      deliveryFee,
      discountAmount = 0,
      discountCodeId = null,
      guestAddress,
      isSplitOrder,
      splitMessage,
      splitCount
    } = params;

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // Calculate subtotal
    const subtotal = cartItems.reduce((sum, item) => sum + (item.final_price * item.quantity), 0);

    // Call the RPC function
    const { data, error } = await supabase.rpc('create_split_order_from_cart', {
      p_user_id: userId,
      p_delivery_address_id: deliveryAddressId,
      p_delivery_date: eventDate,
      p_delivery_time_slot: eventTime,
      p_subtotal: subtotal,
      p_delivery_fee: deliveryFee,
      p_delivery_instructions: deliveryInstructions,
      p_discount_amount: discountAmount,
      p_discount_code_id: discountCodeId,
      p_recipient_name: guestAddress?.recipientName || null,
      p_recipient_phone: guestAddress?.recipientPhone || null,
      p_delivery_address: guestAddress?.streetAddress || null,
      p_delivery_city: guestAddress?.city || null,
      p_is_split_order: isSplitOrder,
      p_split_message: splitMessage,
      p_split_count: splitCount
    });

    if (error) throw error;

    // The RPC returns an array with one row
    const orderResult = data[0];

    // Fetch the complete order with items for return
    const { data: fullOrder, error: fetchError } = await supabase
      .from('cakegenie_orders')
      .select(`
        *,
        cakegenie_order_items(*),
        cakegenie_addresses(*)
      `)
      .eq('order_id', orderResult.order_id)
      .single();

    if (fetchError) throw fetchError;

    return { success: true, order: fullOrder };
  } catch (error: any) {
    console.error('Error creating split order:', error);
    return { success: false, error };
  }
}

/**
 * Create a user record in cakegenie_users for an anonymous user
 * This is called when a guest places their first order
 */
export async function createGuestUser(params: {
  userId: string;
  email: string;
  firstName?: string;
  phoneNumber?: string;
}): Promise<{ success: boolean; error?: Error; emailAlreadyExists?: boolean }> {
  try {
    const { userId, email, firstName, phoneNumber } = params;

    // Check if email is already registered to A DIFFERENT user
    const { data: emailExists } = await supabase
      .from('cakegenie_users')
      .select('user_id')
      .eq('email', email)
      .neq('user_id', userId) // Exclude current user from check
      .maybeSingle();

    if (emailExists) {
      // Email is already registered with another account
      return {
        success: false,
        error: new Error('This email is already registered. Please sign in to continue.'),
        emailAlreadyExists: true
      };
    }

    // Check if user already exists to decide between insert and update
    const { data: existing } = await supabase
      .from('cakegenie_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    let error;

    if (existing) {
      // Update existing user
      const { error: updateError } = await supabase
        .from('cakegenie_users')
        .update({
          email: email,
          first_name: firstName || 'Guest',
          phone_number: phoneNumber || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      error = updateError;
    } else {
      // Create new user
      const { error: insertError } = await supabase
        .from('cakegenie_users')
        .insert({
          user_id: userId,
          email: email,
          first_name: firstName || 'Guest',
          phone_number: phoneNumber || null,
          created_at: new Date().toISOString(),
        });
      error = insertError;
    }

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Error creating/updating guest user:', error);
    return { success: false, error };
  }
}

export async function getUserOrders(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    includeItems?: boolean;
  }
): Promise<SupabaseServiceResponse<{
  orders: (CakeGenieOrder & { cakegenie_order_items?: any[]; cakegenie_addresses?: any })[];
  totalCount: number;
}>> {
  try {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const includeItems = options?.includeItems ?? true;

    // Build the select query. If not including items, fetch item count for efficiency.
    const selectQuery = includeItems
      ? `*, cakegenie_order_items(*), cakegenie_addresses(*)`
      : `*, cakegenie_order_items(count), cakegenie_addresses(*)`;

    const { data, error, count } = await supabase
      .from('cakegenie_orders')
      .select(selectQuery, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return { data: null, error };
    }

    return {
      data: {
        orders: data || [],
        totalCount: count || 0
      },
      error: null
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function getSingleOrder(
  orderId: string,
  userId: string
): Promise<SupabaseServiceResponse<CakeGenieOrder & { cakegenie_order_items: CakeGenieOrderItem[], cakegenie_addresses: any }>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_orders')
      .select(`
        *,
        cakegenie_order_items(*),
        cakegenie_addresses(*)
      `)
      .eq('order_id', orderId)
      .eq('user_id', userId) // Security check to ensure user owns the order
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}


export async function uploadPaymentProof(
  orderId: string,
  userId: string,
  file: File
): Promise<SupabaseServiceResponse<CakeGenieOrder>> {
  try {
    // Validate file
    const validation = validateImageFile(file, { maxSizeMB: 10 });
    if (!validation.valid && validation.error) {
      throw new Error(validation.error);
    }

    // Compress image before upload, forcing JPEG format
    console.log('Compressing payment proof image to JPEG...');
    const compressedFile = await compressImage(file, {
      maxSizeMB: 2,
      maxWidthOrHeight: 1920,
      fileType: 'image/jpeg',
    });

    const originalFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const filePath = `${userId}/${orderId}/${uuidv4()}-${originalFileName}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('payments')
      .upload(filePath, compressedFile, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('payments')
      .getPublicUrl(filePath);

    const { data, error: updateError } = await supabase
      .from('cakegenie_orders')
      .update({ payment_proof_url: publicUrl, payment_status: 'verifying' })
      .eq('order_id', orderId)
      .select().single();

    if (updateError) throw updateError;

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Merges anonymous user's cart into authenticated user's cart
 * Called after successful login to preserve items
 */
export async function mergeAnonymousCartToUser(
  anonymousUserId: string,
  realUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('merge_anonymous_cart_to_user', {
      p_anonymous_user_id: anonymousUserId,
      p_real_user_id: realUserId
    });

    if (error) {
      console.error('Error merging cart:', error);
      return { success: false, error: error.message };
    }

    console.log('Cart merge result:', data);
    return { success: true };
  } catch (error: any) {
    console.error('Exception merging cart:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancels a pending order for a user.
 * @param orderId The UUID of the order to cancel.
 * @param userId The UUID of the user who owns the order.
 */
export async function cancelOrder(
  orderId: string,
  userId: string
): Promise<SupabaseServiceResponse<CakeGenieOrder>> {
  try {
    // FIX: The original rpc(...).select().single() chain is unreliable if the RPC
    // does not return a SETOF table record. A more robust pattern, consistent
    // with createOrderFromCart, is to perform the action and then fetch the result.
    const { error: rpcError } = await supabase.rpc('cancel_order', {
      p_order_id: orderId,
      p_user_id: userId,
    });

    if (rpcError) {
      return { data: null, error: rpcError };
    }

    // After a successful cancellation, fetch the updated order to return the full object.
    const { data, error } = await supabase
      .from('cakegenie_orders')
      .select('*')
      .eq('order_id', orderId)
      .eq('user_id', userId)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}



/**
 * Fetches a list of suggested search keywords from the database.
 * @returns An array of suggested search terms.
 */
export async function getSuggestedKeywords(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_search_analytics')
      .select('search_term')
      .eq('is_suggested', true)
      .limit(8); // A sensible limit for suggestions

    if (error) {
      console.warn("Supabase suggested keywords error:", error.message);
      return []; // Return empty on error, not critical
    }

    // The data is an array of objects like [{ search_term: '...' }], so we map it
    if (Array.isArray(data)) {
      return data.map(item => item.search_term);
    }

    return [];
  } catch (err) {
    console.warn("Error fetching suggested keywords:", err);
    return [];
  }
}

/**
 * Fetches a list of popular search keywords from the database.
 * @returns An array of the most searched terms.
 */
export async function getPopularKeywords(): Promise<string[]> {
  try {
    const { data, error } = await supabase.rpc('get_popular_keywords');

    if (error) {
      console.warn("Supabase popular keywords error:", error.message);
      return []; // Return empty on error, not critical
    }

    // The RPC returns an array of objects like [{ search_term: '...' }], so we map it
    if (Array.isArray(data)) {
      return data.map(item => item.search_term);
    }

    return [];
  } catch (err) {
    console.warn("Error fetching popular keywords:", err);
    return [];
  }
}

/**
 * Fetches all necessary data for the cart page in parallel.
 * @param userId - The UUID of the logged-in user.
 * @param sessionId - The session ID for a guest user.
 * @returns An object containing cart items and user addresses, or an error.
 */
export async function getCartPageData(
  userId: string | null,
  sessionId: string | null
): Promise<{
  cartData: SupabaseServiceResponse<CakeGenieCartItem[]>,
  addressesData: SupabaseServiceResponse<CakeGenieAddress[]>
}> {
  const isAnonymous = !userId && !!sessionId;

  // Use Promise.all to run queries in parallel
  const [cartResult, addressesResult] = await Promise.all([
    getCartItems(userId, sessionId),
    // Only fetch addresses for authenticated (non-anonymous) users
    isAnonymous ? Promise.resolve({ data: [], error: null }) : getUserAddresses(userId!),
  ]);

  return {
    cartData: cartResult,
    addressesData: addressesResult,
  };
}

// --- New Functions for Delivery Date ---
export async function getAvailableDeliveryDates(startDate: string, numDays: number): Promise<AvailableDate[]> {
  const { data, error } = await supabase.rpc('get_available_delivery_dates', {
    start_date: startDate,
    num_days: numDays,
  });
  if (error) {
    console.error("Error fetching available dates:", error);
    throw new Error("Could not fetch available delivery dates.");
  }
  return data || [];
}

export async function getBlockedDatesInRange(startDate: string, endDate: string): Promise<Record<string, BlockedDateInfo[]>> {
  try {
    const { data, error } = await supabase
      .from('blocked_dates')
      .select('blocked_date, closure_reason, is_all_day, blocked_time_start, blocked_time_end')
      .gte('blocked_date', startDate)
      .lte('blocked_date', endDate)
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    const groupedByDate: Record<string, BlockedDateInfo[]> = {};
    (data || []).forEach(row => {
      const date = row.blocked_date;
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push({
        closure_reason: row.closure_reason,
        is_all_day: row.is_all_day,
        blocked_time_start: row.blocked_time_start,
        blocked_time_end: row.blocked_time_end,
      });
    });

    return groupedByDate;

  } catch (err) {
    const error = err as PostgrestError;
    console.error("Error in getBlockedDatesInRange:", error);
    throw new Error("Could not verify date availability.");
  }
}


export async function getAvailabilitySettings(): Promise<SupabaseServiceResponse<AvailabilitySettings>> {
  try {
    const { data, error } = await supabase
      .from('availability_settings')
      .select('*')
      .eq('setting_id', '00000000-0000-0000-0000-000000000001')
      .single();
    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches all bill-sharing designs created by a user.
 * @param userId The UUID of the user.
 */
export async function getBillSharingCreations(userId: string): Promise<SupabaseServiceResponse<any[]>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_shared_designs')
      .select('*, contributions:bill_contributions(amount, status)')
      .eq('created_by_user_id', userId)
      .eq('bill_sharing_enabled', true)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetches a single order by ID for public access (e.g., for split contributions).
 * Includes order items and contributions to calculate progress.
 */
export async function getSingleOrderPublic(orderId: string): Promise<SupabaseServiceResponse<CakeGenieOrder & { cakegenie_order_items: CakeGenieOrderItem[], order_contributions: OrderContribution[], organizer?: { first_name: string | null, email: string } }>> {
  try {
    const { data, error } = await supabase
      .from('cakegenie_orders')
      .select(`
        *,
        cakegenie_order_items(*),
        order_contributions(*),
        organizer:cakegenie_users!organizer_user_id(first_name, email)
      `)
      .eq('order_id', orderId)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Creates a contribution for a split order via the Edge Function.
 */
export async function createOrderContribution(params: {
  orderId: string;
  amount: number;
  contributorName: string;
  contributorEmail?: string;
}): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
  try {
    const domain = window.location.origin;
    const paymentMode = (typeof window !== 'undefined' && localStorage.getItem('xendit_payment_mode')) || 'live';

    const { data, error } = await supabase.functions.invoke('create-order-contribution', {
      body: {
        ...params,
        payment_mode: paymentMode,
        success_redirect_url: `${domain}/#/contribute/${params.orderId}?payment=success`,
        failure_redirect_url: `${domain}/#/contribute/${params.orderId}?payment=failed`
      }
    });

    if (error) throw error;
    if (!data.success) throw new Error(data.error || 'Failed to create contribution');

    return { success: true, paymentUrl: data.paymentUrl };
  } catch (err: any) {
    console.error('Error creating contribution:', err);
    return { success: false, error: err.message || 'An unexpected error occurred' };
  }
}