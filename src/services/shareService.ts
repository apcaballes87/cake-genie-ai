import { getSupabaseClient } from '../lib/supabase/client';
import { showSuccess, showError } from '../lib/utils/toast';

const supabase = getSupabaseClient();

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
  title?: string;
  description?: string;
}

export interface ShareResult {
  designId: string;
  shareUrl: string;
}

/**
 * Save a cake design for sharing
 */
export async function saveDesignToShare(data: ShareDesignData): Promise<ShareResult | null> {
  try {
    // Get current user (can be anonymous)
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: design, error } = await supabase
      .from('cakegenie_shared_designs')
      .insert({
        customized_image_url: data.customizedImageUrl,
        original_image_url: data.originalImageUrl,
        cake_type: data.cakeType,
        cake_size: data.cakeSize,
        cake_flavor: data.cakeFlavor,
        cake_thickness: data.cakeThickness,
        icing_colors: data.icingColors || [],
        accessories: data.accessories || [],
        base_price: data.basePrice,
        final_price: data.finalPrice,
        // FIX: Only associate the design with a user if they are NOT anonymous.
        created_by_user_id: user && !user.is_anonymous ? user.id : null,
        creator_name: data.creatorName,
        title: data.title || 'Custom Cake Design',
        description: data.description || 'Check out this amazing custom cake design!',
      })
      .select('design_id')
      .single();

    if (error) {
      // FIX: Serialize error object to prevent '[object Object]' in logs.
      console.error('Supabase error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      throw error;
    }

    const shareUrl = `${window.location.origin}/#/design/${design.design_id}`;
    
    showSuccess('Share link created!');
    
    return {
      designId: design.design_id,
      shareUrl
    };
  } catch (error) {
    // FIX: Serialize error object to prevent '[object Object]' in logs.
    console.error('Error saving design:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    showError('Failed to create shareable link');
    return null;
  }
}

/**
 * Get a shared design by ID - WITH DETAILED LOGGING
 */
export async function getSharedDesign(designId: string) {
  console.log('🔍 [getSharedDesign] Starting fetch for designId:', designId);
  console.log('🔍 [getSharedDesign] Supabase client initialized:', !!supabase);
  
  try {
    console.log('📡 [getSharedDesign] Calling Supabase query...');
    
    const { data, error } = await supabase
      .from('cakegenie_shared_designs')
      .select('*')
      .eq('design_id', designId)
      .single();

    console.log('📊 [getSharedDesign] Query response:', { 
      hasData: !!data, 
      hasError: !!error,
      errorDetails: error ? JSON.stringify(error, null, 2) : null
    });

    if (error) {
      console.error('❌ [getSharedDesign] Supabase error:', error);
      throw error;
    }

    if (!data) {
      console.warn('⚠️ [getSharedDesign] No data returned for designId:', designId);
      return null;
    }

    console.log('✅ [getSharedDesign] Successfully fetched design:', data.title);

    // Increment view count but don't wait for it to finish (fire-and-forget).
    // This prevents the main data fetch from hanging if the RPC call is slow or fails.
    if (data) {
      // FIX: The .rpc() method returns a promise-like object. Use .then() to handle the result.
      supabase.rpc('increment_design_view', { p_design_id: designId })
        .then(({ error: rpcError }) => {
          if (rpcError) {
            console.warn('Failed to increment view count:', rpcError);
          }
        });
    }

    return data;
  } catch (error) {
    console.error('❌ [getSharedDesign] Exception caught:', error);
    console.error('❌ [getSharedDesign] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    return null;
  }
}


/**
 * Increment share count when user shares. This is a non-blocking call.
 */
export function incrementShareCount(designId: string) {
  // FIX: The .rpc() method returns a promise-like object. Use .then() to handle the result.
  supabase.rpc('increment_design_share', { p_design_id: designId })
    .then(({ error }) => {
      if (error) {
        console.warn('Error incrementing share count:', error);
      }
    });
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
 * Pre-written social media messages
 */
export const SOCIAL_MESSAGES = {
  facebook: "🎂 Check out this AMAZING custom cake I just designed!\nWhat do you think? Should I order it? 😍\n\nDesign yours at CakeGenie!",
  
  messenger: "Hey! 👋 What do you think of this cake design I made?\nBe honest! 😅🎂",
  
  twitter: "Just designed the perfect cake using AI! 🎂✨\nCheck it out 👇\n\n#CakeDesign #CustomCake #CakeGenie",
  
  instagram: "🎂 Designed my dream cake using AI!\nWhat do you think? 😍\n\n🔗 Link in bio to see the full design!\nTag someone who needs to see this! 👇\n\n#CakeGenie #CustomCake #DreamCake #BirthdayCake"
};