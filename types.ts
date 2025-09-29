// types.ts

export type CakeFlavor = 'Chocolate Cake' | 'Ube Cake' | 'Vanilla Cake';

export interface Color {
  name: string;
  hex: string;
}

export type CakeType = '1 Tier' | '2 Tier' | '3 Tier' | '1 Tier Fondant' | '2 Tier Fondant' | '3 Tier Fondant' | 'Square' | 'Rectangle' | 'Bento';
export type CakeThickness = '2 in' | '3 in' | '4 in' | '5 in' | '6 in';
export type CakeSize = string;

export type MainTopperType = 'edible_3d' | 'printout' | 'toy' | 'figurine' | 'cardstock' | 'edible_photo' | 'edible_2d_gumpaste';
export type SupportElementType = 'gumpaste_panel' | 'chocolates' | 'sprinkles' | 'support_printout' | 'isomalt' | 'small_gumpaste';
export type CakeMessagePosition = 'top' | 'side' | 'base_board';
export type IcingBase = 'soft_icing' | 'fondant';
export type IcingColorType = 'single' | 'gradient_2' | 'gradient_3' | 'abstract';
export type Size = 'small' | 'medium' | 'large' | 'partial';
export type Coverage = 'light' | 'medium' | 'heavy' | 'none';

// --- Analysis Result from AI ---
export interface MainTopper {
  type: MainTopperType;
  description: string;
  size: Size;
  quantity: number;
  group_id: string;
  classification: 'hero' | 'support';
}

export interface SupportElement {
  type: SupportElementType;
  description: string;
  coverage: Coverage;
  group_id: string;
}

export interface CakeMessage {
  type: 'gumpaste_letters' | 'icing_script' | 'printout' | 'cardstock';
  text: string;
  position: CakeMessagePosition;
  color: string; // hex
}

export interface IcingColorDetails {
  side?: string; // hex
  top?: string; // hex
  borderTop?: string; // hex
  borderBase?: string; // hex
  drip?: string; // hex
  gumpasteBaseBoardColor?: string; // hex
}

export interface IcingDesign {
  base: IcingBase;
  color_type: IcingColorType;
  colors: IcingColorDetails;
  border_top: boolean;
  border_base: boolean;
  drip: boolean;
  gumpasteBaseBoard: boolean;
}

export interface HybridAnalysisResult {
  main_toppers: MainTopper[];
  support_elements: SupportElement[];
  cake_messages: CakeMessage[];
  icing_design: IcingDesign;
  cakeType: CakeType;
  cakeThickness: CakeThickness;
}

// --- UI State Interfaces ---
export interface MainTopperUI extends MainTopper {
    id: string;
    isEnabled: boolean;
    price: number;
    original_type: MainTopperType;
    replacementImage?: { data: string; mimeType: string; };
}

export interface SupportElementUI extends SupportElement {
    id:string;
    isEnabled: boolean;
    price: number;
}

export interface CakeMessageUI extends CakeMessage {
    id: string;
    isEnabled: boolean;
    price: number;
}

export interface IcingDesignUI extends IcingDesign {
    dripPrice: number;
}

export interface CakeInfoUI {
  type: CakeType;
  thickness: CakeThickness;
  size: CakeSize;
  flavors: CakeFlavor[];
}


// For pricing display - now represents only add-on costs
export interface AddOnPricing {
    addOnPrice: number;
    breakdown: { item: string; price: number; }[];
}

// For Supabase result
export interface BasePriceInfo {
    size: string;
    price: number;
}

// --- Cart Interfaces ---
export interface CartItemDetails {
  cakeInfo: {
    type: string;
    thickness: string;
    size: string;
    flavors: string[];
  };
  mainToppers: string[];
  supportElements: string[];
  cakeMessages: { 
    text: string; 
    color: string; // Color name
  }[];
  icingDesign: {
    drip: boolean;
    gumpasteBaseBoard: boolean;
    colors: Record<string, string>; // Location -> Color name
  };
  additionalInstructions: string;
}

export interface CartItem {
  id: string;
  image: string | null; // Null when pending generation
  status: 'pending' | 'complete' | 'error';
  errorMessage?: string;
  cakeSize: string;
  totalPrice: number;
  details: CartItemDetails;
}

// --- Reporting Interface ---
export interface ReportPayload {
  original_image: string;
  customized_image: string;
  prompt_sent_gemini: string;
  maintoppers: string; // JSON string
  supportelements: string; // JSON string
  cakemessages: string; // JSON string
  icingdesign: string; // JSON string
  addon_price: number;
}