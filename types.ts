// types.ts

// --- Base Types from Gemini Analysis ---
export type CakeType = '1 Tier' | '2 Tier' | '3 Tier' | '1 Tier Fondant' | '2 Tier Fondant' | '3 Tier Fondant' | 'Square' | 'Rectangle' | 'Bento';
export type CakeThickness = '2 in' | '3 in' | '4 in' | '5 in' | '6 in';
export type CakeSize = string; // e.g., '6" Round', '6"/8" Round'
export type CakeFlavor = 'Chocolate Cake' | 'Ube Cake' | 'Vanilla Cake' | 'Mocha Cake';

export type MainTopperType = 'edible_3d_complex' | 'edible_3d_ordinary' | 'printout' | 'toy' | 'figurine' | 'cardstock' | 'edible_photo' | 'candle' | 'icing_doodle' | 'icing_palette_knife' | 'icing_brush_stroke' | 'icing_splatter' | 'icing_minimalist_spread' | 'meringue_pop' | 'plastic_ball';
export type SupportElementType = 'edible_3d_support' | 'edible_2d_support' | 'chocolates' | 'sprinkles' | 'support_printout' | 'isomalt' | 'dragees' | 'edible_flowers' | 'edible_photo_side' | 'icing_doodle' | 'icing_palette_knife' | 'icing_brush_stroke' | 'icing_splatter' | 'icing_minimalist_spread';
export type CakeMessageType = 'gumpaste_letters' | 'icing_script' | 'printout' | 'cardstock';

export type Size = 'small' | 'medium' | 'large' | 'tiny' | 'mixed';
export type Coverage = 'large' | 'medium' | 'small' | 'tiny';

export interface Color {
  name: string;
  hex: string;
}

export interface MainTopper {
    type: MainTopperType;
    description: string;
    size: Size;
    quantity: number;
    group_id: string;
    classification: 'hero' | 'support' | 'hero + support';
    color?: string;
    colors?: (string | null)[];
    x?: number;
    y?: number;
}

export interface SupportElement {
    type: SupportElementType;
    description: string;
    coverage: Coverage;
    group_id: string;
    color?: string;
    colors?: (string | null)[];
    x?: number;
    y?: number;
}

export interface CakeMessage {
    type: CakeMessageType;
    text: string;
    position: 'top' | 'side' | 'base_board';
    color: string;
    x?: number;
    y?: number;
}

export interface IcingColorDetails {
    side?: string;
    top?: string;
    borderTop?: string;
    borderBase?: string;
    drip?: string;
    gumpasteBaseBoardColor?: string;
}

export interface IcingDesign {
    base: 'soft_icing' | 'fondant';
    color_type: 'single' | 'gradient_2' | 'gradient_3' | 'abstract';
    colors: IcingColorDetails;
    border_top: boolean;
    border_base: boolean;
    drip: boolean;
    gumpasteBaseBoard: boolean;
}

export interface DripEffect {
    description: string;
    x: number;
    y: number;
}

export interface IcingSurface {
    description: string;
    tier: number;
    position: 'top' | 'side';
    x: number;
    y: number;
}

export interface IcingBorder {
    description: string;
    tier: number;
    position: 'top' | 'base';
    x: number;
    y: number;
}

export interface BaseBoard {
    description: string;
    x: number;
    y: number;
}

export interface HybridAnalysisResult {
    cakeType: CakeType;
    cakeThickness: CakeThickness;
    main_toppers: MainTopper[];
    support_elements: SupportElement[];
    cake_messages: CakeMessage[];
    icing_design: IcingDesign;
    rejection?: {
        isRejected: boolean;
        message: string;
    };
    drip_effects?: DripEffect[];
    icing_surfaces?: IcingSurface[];
    icing_borders?: IcingBorder[];
    base_board?: BaseBoard[];
}

// --- UI-specific types (extended from base types) ---

export interface MainTopperUI extends MainTopper {
    id: string;
    isEnabled: boolean;
    price: number;
    original_type: MainTopperType;
    replacementImage?: { data: string; mimeType: string };
    original_color?: string;
    original_colors?: (string | null)[];
}

export interface SupportElementUI extends SupportElement {
    id: string;
    isEnabled: boolean;
    price: number;
    original_type: SupportElementType;
    replacementImage?: { data: string; mimeType: string };
    original_color?: string;
    original_colors?: (string | null)[];
}

export interface CakeMessageUI extends CakeMessage {
    id: string;
    isEnabled: boolean;
    price: number;
    originalMessage?: CakeMessage; // To track changes
    useDefaultColor?: boolean; // For Shopify flow
}

export interface IcingDesignUI extends IcingDesign {
    dripPrice: number;
    gumpasteBaseBoardPrice: number;
}

export interface CakeInfoUI {
    type: CakeType;
    thickness: CakeThickness;
    size: CakeSize;
    flavors: CakeFlavor[];
}


// --- Pricing & Cart Types ---

export interface CartItemDetails {
  flavors: string[];
  mainToppers: {
    description: string;
    type: string;
    size?: string;
  }[];
  supportElements: {
    description: string;
    type: string;
    coverage?: string;
  }[];
  cakeMessages: {
    text: string;
    color: string;
  }[];
  icingDesign: {
    drip: boolean;
    gumpasteBaseBoard: boolean;
    colors: Record<string, string>;
  };
  additionalInstructions: string;
}

export interface CartItem {
    id: string;
    image: string | null;
    status: 'pending' | 'complete' | 'error';
    type: string;
    thickness: string;
    size: string;
    totalPrice: number;
    details: CartItemDetails;
    errorMessage?: string;
}

export interface AddOnPricing {
    addOnPrice: number;
    breakdown: { item: string; price: number }[];
}

export interface BasePriceInfo {
    size: CakeSize;
    price: number;
}

export interface PricingRule {
  // This seems unused, but let's define a placeholder
  id: string;
  rule: string;
}

// --- Service Payloads ---

export interface ReportPayload {
    original_image: string;
    customized_image: string;
    prompt_sent_gemini: string;
    maintoppers: string;
    supportelements: string;
    cakemessages: string;
    icingdesign: string;
    addon_price: number;
    user_report?: string;
}

export interface AiPrompt {
  // This seems unused, define a placeholder
  id: string;
  prompt: string;
}

export interface PricingFeedback {
  original_image_url: string;
  ai_analysis: HybridAnalysisResult;
  corrections: Record<string, { ai_price: number, expert_price: number }>;
  ai_total_price: number;
  expert_total_price: number;
  notes?: string;
}

export interface AvailabilitySettings {
  setting_id: string;
  created_at: string;
  rush_to_same_day_enabled: boolean;
  rush_same_to_standard_enabled: boolean;
  minimum_lead_time_days: number;
}
