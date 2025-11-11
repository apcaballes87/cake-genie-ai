import { getSupabaseClient } from '../lib/supabase/client';
import { showSuccess, showError } from '../lib/utils/toast';
import { v4 as uuidv4 } from 'uuid';
import { generateUrlSlug } from '../lib/utils/urlHelpers';
import { generateContributorDiscountCode } from './incentiveService';
import { CartItemDetails } from '../types';

const supabase = getSupabaseClient();

/**
 * Convert data URI to Blob
 */
function dataURItoBlob(dataURI: string): Blob {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}

/**
 * Upload image to Supabase Storage and return public URL
 */
async function uploadImageToStorage(imageDataUri: string, designId: string): Promise<string> {
  try {
    // Convert data URI to blob
    const blob = dataURItoBlob(imageDataUri);

    // Generate filename with design ID
    const fileName = `${designId}.jpg`;
    const filePath = fileName;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('shared-cake-images')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true, // Allow overwriting if exists
      });

    if (error) {
      console.error('Error uploading image to storage:', error);
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('shared-cake-images')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Failed to upload image:', error);
    throw error;
  }
}

export interface ShareDesignData {
  customizedImageUrl: string;
  originalImageUrl?: string;
  cakeType: string;
  cakeSize: string;
  cakeFlavor: string;
  cakeThickness?: string;
  icingColors?: Array<{name: string, hex: string}>;
  accessories?: string[];
  basePrice: number;
  finalPrice: number;
  creatorName?: string;
  title: string;
  description: string;
  altText: string;
  availabilityType: 'rush' | 'same-day' | 'normal';
  billSharingEnabled?: boolean;
  billSharingMessage?: string;
  suggestedSplitCount?: number;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryPhone?: string;
  eventDate?: string;
  eventTime?: string;
  recipientName?: string;
  customization_details: CartItemDetails;
}

export interface BillContribution {
  contribution_id: string;
  design_id: string;
  contributor_name: string;
  contributor_email: string | null;
  contributor_phone: string | null;
  amount: number;
  xendit_invoice_id: string | null;
  payment_url: string | null;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  paid_at: string | null;
  created_at: string;
}

export interface ShareResult {
  designId: string;
  shareUrl: string;
  botShareUrl: string;
  urlSlug: string;
}

/**
 * Save a cake design for sharing
 */
export async function saveDesignToShare(data: ShareDesignData): Promise<ShareResult | null> {
  try {
    // Get current user (can be anonymous)
    const { data: { user } } = await supabase.auth.getUser();

    // Require authenticated user for bill sharing
    if (data.billSharingEnabled) {
      if (!user || user.is_anonymous) {
        showError('You must be signed in to enable bill sharing');
        return null;
      }
    }
    
    const designId = uuidv4();
    const urlSlug = generateUrlSlug(data.title, designId);

    // Upload image to storage if it's a data URI
    let imageUrl = data.customizedImageUrl;
    if (data.customizedImageUrl.startsWith('data:')) {
      console.log('📤 Uploading image to Supabase Storage...');
      imageUrl = await uploadImageToStorage(data.customizedImageUrl, designId);
      console.log('✅ Image uploaded successfully:', imageUrl);
    }
    
    // Upload original image if it's a data URI
    let originalImageUrl = data.originalImageUrl;
    if (originalImageUrl && originalImageUrl.startsWith('data:')) {
      console.log('📤 Uploading original image to Supabase Storage...');
      originalImageUrl = await uploadImageToStorage(originalImageUrl, `${designId}-original`);
      console.log('✅ Original image uploaded successfully:', originalImageUrl);
    }

    const { error } = await supabase
      .from('cakegenie_shared_designs')
      .insert({
        design_id: designId,
        url_slug: urlSlug,
        customized_image_url: imageUrl,
        original_image_url: originalImageUrl,
        cake_type: data.cakeType,
        cake_size: data.cakeSize,
        cake_flavor: data.cakeFlavor,
        cake_thickness: data.cakeThickness,
        icing_colors: data.icingColors || [],
        accessories: data.accessories || [],
        base_price: data.basePrice,
        final_price: data.finalPrice,
        created_by_user_id: data.billSharingEnabled ? user!.id : (user && !user.is_anonymous ? user.id : null),
        creator_name: data.creatorName,
        title: data.title,
        description: data.description,
        alt_text: data.altText,
        availability_type: data.availabilityType,
        bill_sharing_enabled: data.billSharingEnabled || false,
        bill_sharing_message: data.billSharingMessage || null,
        suggested_split_count: data.suggestedSplitCount || null,
        delivery_address: data.deliveryAddress || null,
        delivery_city: data.deliveryCity || null,
        delivery_phone: data.deliveryPhone || null,
        event_date: data.eventDate || null,
        event_time: data.eventTime || null,
        recipient_name: data.recipientName || null,
        auto_order_enabled: data.billSharingEnabled || false, // Enable auto-order when bill sharing is enabled
        customization_details: data.customization_details,
      });

    if (error) {
      console.error('Supabase error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      throw error;
    }

    const clientDomain = window.location.origin;
    const shareUrl = `${clientDomain}/#/designs/${urlSlug}`;
    const botShareUrl = `https://genie.ph/designs/${urlSlug}`;
    
    showSuccess('Share link created!');
    
    return {
      designId: designId,
      shareUrl,
      botShareUrl,
      urlSlug
    };
  } catch (error) {
    console.error('Error saving design:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    showError('Failed to create shareable link');
    return null;
  }
}

/**
 * Updates an existing shared design with AI-generated text.
 * This function now throws on failure.
 */
export async function updateSharedDesignTexts(
  designId: string,
  title: string,
  description: string,
  altText: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('cakegenie_shared_designs')
      .update({
        title,
        description,
        alt_text: altText,
      })
      .eq('design_id', designId);

    if (error) {
      console.error('❌ Supabase RLS error updating shared design texts:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      // CRITICAL: Throw the error so the caller knows it failed
      throw new Error(`Failed to update shared design: ${error.message}`);
    }
    
    console.log('✅ Successfully enriched shared design:', designId);
  } catch (error) {
    console.error('❌ Exception updating shared design texts:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    // Re-throw so the background task knows it failed
    throw error;
  }
}

/**
 * Retry enrichment with exponential backoff
 */
export async function updateSharedDesignTextsWithRetry(
  designId: string,
  title: string,
  description: string,
  altText: string,
  maxRetries: number = 3
): Promise<void> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await updateSharedDesignTexts(designId, title, description, altText);
      console.log(`✅ Enrichment succeeded on attempt ${attempt}`);
      return; // Success!
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Enrichment attempt ${attempt}/${maxRetries} failed:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        console.log(`⏳ Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  // All retries failed
  throw new Error(`Failed to enrich design after ${maxRetries} attempts: ${lastError?.message}`);
}


/**
 * Get a shared design by ID or slug - WITH DETAILED LOGGING
 */
export async function getSharedDesign(identifier: string) {
  console.log('🔍 [getSharedDesign] Starting fetch for identifier:', identifier);
  console.log('🔍 [getSharedDesign] Supabase client initialized:', !!supabase);
  
  try {
    console.log('📡 [getSharedDesign] Calling Supabase query...');
    
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    const query = supabase
      .from('cakegenie_shared_designs')
      .select('*, organizer:profiles(full_name, email, phone)');

    if (isUuid) {
        query.eq('design_id', identifier);
    } else {
        query.eq('url_slug', identifier);
    }
    
    const { data, error } = await query.single();

    console.log('📊 [getSharedDesign] Query response:', { 
      hasData: !!data, 
      hasError: !!error,
      errorDetails: error ? JSON.stringify(error, null, 2) : null
    });

    if (error) {
      console.error('❌ [getSharedDesign] Supabase error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      throw error;
    }

    if (!data) {
      console.warn('⚠️ [getSharedDesign] No data returned for identifier:', identifier);
      return null;
    }

    console.log('✅ [getSharedDesign] Successfully fetched design:', data.title);

    // Increment view count but don't wait for it to finish (fire-and-forget).
    // This prevents the main data fetch from hanging if the RPC call is slow or fails.
    if (data) {
      // FIX: Converted to an async IIFE to use try/catch for error handling,
      // as the Supabase query builder is a 'thenable' but may not have a .catch method.
      (async () => {
        try {
          const { error: rpcError } = await supabase.rpc('increment_design_view', { p_design_id: data.design_id });
          if (rpcError) {
            console.warn('Failed to increment view count:', rpcError);
          }
        } catch (err) {
            console.warn('Exception during fire-and-forget view count increment:', err);
        }
      })();
    }

    return data;
  } catch (error) {
    console.error('❌ [getSharedDesign] Exception caught:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return null;
  }
}


/**
 * Increment share count when user shares. This is a non-blocking call.
 */
export function incrementShareCount(designId: string) {
  // FIX: Converted to an async IIFE to use try/catch for error handling,
  // as the Supabase query builder is a 'thenable' but may not have a .catch method.
  (async () => {
    try {
      const { error } = await supabase.rpc('increment_design_share', { p_design_id: designId });
      if (error) {
        console.warn('Error incrementing share count:', error);
      }
    } catch (err) {
        console.warn('Exception during fire-and-forget share count increment:', err);
    }
  })();
}

/**
 * Generate social media share URLs
 */
export function generateSocialShareUrl(
  platform: 'facebook' | 'messenger' | 'twitter',
  shareUrl: string,
  text?: string
): string {
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(text || '');

  switch (platform) {
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    
    case 'messenger':
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        return `fb-messenger://share/?link=${encodedUrl}`;
      }
      // The 'dialog/send' endpoint is deprecated but can work with a valid app_id.
      // We use a generic Facebook app_id here to make it more reliable on desktop.
      const facebookAppId = '966242223397117'; // A common public app_id for sharing
      return `https://www.facebook.com/dialog/send?app_id=${facebookAppId}&link=${encodedUrl}&redirect_uri=${encodedUrl}`;
    
    case 'twitter':
      return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
    
    default:
      return shareUrl;
  }
}

/**
 * Get all contributions for a design
 */
export async function getDesignContributions(designId: string): Promise<BillContribution[]> {
  try {
    const { data, error } = await supabase
      .from('bill_contributions')
      .select('*')
      .eq('design_id', designId)
      .eq('status', 'paid')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contributions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching contributions:', error);
    return [];
  }
}

/**
 * Create a contribution and Xendit payment
 */
export async function createContribution(
  designId: string,
  contributorName: string,
  contributorEmail: string,
  amount: number,
  userId: string
): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
  try {
    // 1. Get design details
    const design = await getSharedDesign(designId);
    if (!design) {
      return { success: false, error: 'Design not found' };
    }

    if (!design.bill_sharing_enabled) {
      return { success: false, error: 'Bill sharing is not enabled for this design' };
    }
    
    console.log('🎯 Creating contribution:', {
      designId,
      contributorName,
      amount,
      design_bill_sharing: design.bill_sharing_enabled
    });

    // 2. Check remaining amount
    const remaining = design.final_price - (design.amount_collected || 0);
    if (amount > remaining) {
      return { success: false, error: `Amount exceeds remaining ₱${remaining.toFixed(2)}` };
    }

    if (amount <= 0) {
      return { success: false, error: 'Amount must be greater than 0' };
    }

    // 3. Create contribution record
    const { data: contribution, error: insertError } = await supabase
      .from('bill_contributions')
      .insert({
        design_id: designId,
        contributor_name: contributorName,
        contributor_email: contributorEmail,
        amount: amount,
        status: 'pending',
        user_id: userId
      })
      .select()
      .single();

    if (insertError || !contribution) {
      console.error('Error creating contribution:', insertError);
      return { success: false, error: 'Failed to create contribution record' };
    }

    // Track referral if this is a new user being referred
    if (userId && design.created_by_user_id && userId !== design.created_by_user_id) {
      await trackReferral(userId, design.created_by_user_id, design.design_id, contribution.contribution_id);
    }

    // Generate discount code for contributor
    const discountCode = await generateContributorDiscountCode(userId, amount);

    // 4. Create Xendit invoice using existing Edge Function
    const domain = window.location.origin;
    const successUrl = `${domain}/#/designs/${design.url_slug || design.design_id}?contribution=success&contribution_id=${contribution.contribution_id}&amount=${amount}&code=${discountCode || 'FRIEND100'}`;
    const failureUrl = `${domain}/#/designs/${design.url_slug || design.design_id}?contribution=failed`;

    const { data: paymentData, error: paymentError } = await supabase.functions.invoke(
      'create-xendit-payment',
      {
        body: {
          orderId: contribution.contribution_id, // Use contribution_id as external_id
          amount: amount,
          customerEmail: contributorEmail,
          customerName: contributorName,
          items: [{
            name: `Contribution for: ${design.title || 'Custom Cake'}`,
            quantity: 1,
            price: amount
          }],
          success_redirect_url: successUrl,
          failure_redirect_url: failureUrl,
          isContribution: true // Flag to identify this as a contribution
        }
      }
    );

    console.log('💳 Xendit response:', {
      success: paymentData.success,
      hasPaymentUrl: !!paymentData.paymentUrl,
      invoiceId: paymentData.invoiceId
    });

    if (paymentError || !paymentData.success) {
      console.error('Error creating Xendit payment:', paymentError);
      // Clean up contribution record
      await supabase.from('bill_contributions').delete().eq('contribution_id', contribution.contribution_id);
      return { success: false, error: 'Failed to create payment link' };
    }

    // 5. Update contribution with Xendit details
    await supabase
      .from('bill_contributions')
      .update({
        xendit_invoice_id: paymentData.invoiceId,
        xendit_external_id: contribution.contribution_id,
        payment_url: paymentData.paymentUrl
      })
      .eq('contribution_id', contribution.contribution_id);

    return {
      success: true,
      paymentUrl: paymentData.paymentUrl
    };
  } catch (error) {
    console.error('Exception in createContribution:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

/**
 * Track that a user was referred through a bill share
 */
export async function trackReferral(
  referredUserId: string,
  referringUserId: string,
  designId: string,
  contributionId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_referrals')
      .insert({
        referring_user_id: referringUserId,
        referred_user_id: referredUserId,
        referral_source: 'bill_sharing',
        design_id: designId,
        contribution_id: contributionId
      });
    
    if (error && error.code !== '23505') { // Ignore duplicate key errors
      console.error('Error tracking referral:', error);
    }
  } catch (error) {
    console.error('Exception tracking referral:', error);
  }
}

/**
 * Pre-written social media messages
 */
export const SOCIAL_MESSAGES = {
  facebook: "🎂 Check out this AMAZING custom cake I just designed!\nWhat do you think? Should I order it? 😍\n\nDesign yours at CakeGenie!",
  
  messenger: "Hey! 👋 What do you think of this cake design I made?\nBe honest! 😅🎂",
  
  twitter: "Just designed the perfect cake using AI! 🎂✨\nCheck it out 👇\n\n#CakeDesign #CustomCake #CakeGenie",
  
  instagram: "🎂 Designed my dream cake using AI!\nWhat do you think? 😍\n\n🔗 Link in bio to see the full design!\nTag someone who needs to see this! 👇\n\n#CakeGenie #CustomCake #DreamCake #BirthdayCake"
};