// lib/database.types.ts

/**
 * The status of a customer's order in the fulfillment process.
 */
export type OrderStatus = 'pending' | 'confirmed' | 'in_progress' | 'ready_for_delivery' | 'out_for_delivery' | 'delivered' | 'cancelled';

/**
 * The payment status of an order.
 */
export type PaymentStatus = 'pending' | 'verifying' | 'partial' | 'paid' | 'refunded' | 'failed';

/**
 * Detailed breakdown of a cake's customizations.
 * Stored as JSONB in the database.
 * This should ONLY contain decorative/flavor info, not the base cake properties.
 */
export interface CustomizationDetails {
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

/**
 * Represents a user in the `cakegenie_users` table.
 */
export interface CakeGenieUser {
  user_id: string; // UUID
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  email_verified: boolean;
  is_active: boolean;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  last_login: string | null; // ISO 8601 timestamp
}

/**
 * Represents a delivery address in the `cakegenie_addresses` table.
 */
export interface CakeGenieAddress {
  address_id: string; // UUID
  user_id: string; // UUID
  address_label: string; // e.g., "Home", "Work"
  recipient_name: string;
  recipient_phone: string;
  street_address: string;
  barangay: string;
  city: string;
  province: string;
  postal_code: string;
  landmark: string | null;
  country: string;
  is_default: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Represents an item in a user's shopping cart in the `cakegenie_cart` table.
 */
export interface CakeGenieCartItem {
  cart_item_id: string; // UUID
  user_id: string | null; // UUID, nullable for guest carts
  session_id: string | null; // For guest carts
  merchant_id: string | null; // UUID - merchant/shop this item belongs to
  cake_type: string;
  cake_thickness: string;
  cake_size: string;
  base_price: number;
  addon_price: number;
  final_price: number;
  quantity: number;
  original_image_url: string;
  customized_image_url: string;
  customization_details: CustomizationDetails;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  expires_at: string; // ISO 8601 timestamp
}

/**
 * Represents a customer order in the `cakegenie_orders` table.
 */
export interface CakeGenieOrder {
  order_id: string; // UUID
  order_number: string;
  user_id: string | null; // UUID, nullable for guest orders
  merchant_id: string | null; // UUID - merchant/shop this order belongs to
  guest_email: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  delivery_address_id: string | null; // UUID, nullable for guest orders
  delivery_date: string; // YYYY-MM-DD
  delivery_time_slot: string;
  delivery_instructions: string | null;
  customer_notes: string | null;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  discount_code_id: string | null; // UUID, tracks which discount code was used
  total_amount: number;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  payment_proof_url: string | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  confirmed_at: string | null; // ISO 8601 timestamp
  delivered_at: string | null; // ISO 8601 timestamp
  cakegenie_order_items?: CakeGenieOrderItem[]; // Optional for joined queries
  // Split with Friends fields
  is_split_order?: boolean;
  split_message?: string | null;
  split_count?: number | null;
  amount_collected?: number | null;
  organizer_user_id?: string | null;
  split_share_url?: string | null;
  // Delivery coordinates (for guest orders)
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
}

/**
 * Represents a contribution to a split order in the `order_contributions` table.
 */
export interface OrderContribution {
  contribution_id: string; // UUID
  order_id: string; // UUID
  user_id: string | null; // UUID, nullable
  contributor_name: string | null;
  contributor_email: string | null;
  amount: number;
  xendit_invoice_id: string | null;
  payment_url: string | null;
  status: string; // 'pending', 'paid', etc.
  paid_at: string | null; // ISO 8601 timestamp
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Represents a line item within an order in the `cakegenie_order_items` table.
 */
export interface CakeGenieOrderItem {
  item_id: string; // UUID
  order_id: string; // UUID
  merchant_id: string | null; // UUID - merchant/shop this item belongs to (denormalized)
  cake_type: string;
  cake_thickness: string;
  cake_size: string;
  base_price: number;
  addon_price: number;
  final_price: number;
  quantity: number;
  original_image_url: string;
  customized_image_url: string;
  customization_details: CustomizationDetails;
  item_notes: string | null;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Represents a saved item (wishlist/favorites) in the `cakegenie_saved_items` table.
 */
export interface CakeGenieSavedItem {
  saved_item_id: string; // UUID
  user_id: string; // UUID
  // For catalog products
  product_id: string | null;
  product_name: string | null;
  product_price: number | null;
  product_image: string | null;
  // For custom designs
  analysis_p_hash: string | null;
  customization_snapshot: CustomizationDetails | null;
  customized_image_url: string | null;
  // Common fields
  item_type: 'product' | 'custom_design';
  created_at: string; // ISO 8601 timestamp
}

/**
 * Represents a merchant/bakeshop partner in the `cakegenie_merchants` table.
 */
export interface CakeGenieMerchant {
  merchant_id: string; // UUID
  user_id: string | null; // UUID - optional link to auth user
  business_name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  profile_image_url: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  rating: number;
  review_count: number;
  is_verified: boolean;
  is_active: boolean;
  min_order_lead_days: number;
  delivery_fee: number;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Availability status for merchant products.
 */
export type ProductAvailability = 'in_stock' | 'out_of_stock' | 'preorder' | 'made_to_order';

/**
 * Represents a curated cake product in a merchant's catalog.
 * References cakegenie_analysis_cache via p_hash for AI analysis data.
 */
export interface CakeGenieMerchantProduct {
  product_id: string; // UUID
  merchant_id: string; // UUID
  p_hash: string | null; // Link to analysis_cache

  // Core Content
  title: string;
  slug: string;
  short_description: string | null;
  long_description: string | null;

  // Image SEO
  image_url: string | null;
  alt_text: string | null;
  image_caption: string | null;

  // SEO Meta
  meta_keywords: string | null;
  og_title: string | null;
  og_description: string | null;

  // Structured Data (Schema.org)
  brand: string | null;
  sku: string | null;
  gtin: string | null;

  // Categorization
  tags: string[] | null;
  category: string | null;
  cake_type: string | null;

  // Pricing & Availability
  custom_price: number | null;
  availability: ProductAvailability;

  // Display & Management
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Role types for merchant staff members.
 */
export type MerchantStaffRole = 'owner' | 'admin' | 'staff';

/**
 * Represents a staff member associated with a merchant.
 */
export interface MerchantStaff {
  staff_id: string; // UUID
  merchant_id: string; // UUID
  user_id: string; // UUID - references auth.users
  role: MerchantStaffRole;
  permissions: {
    manage_products?: boolean;
    view_orders?: boolean;
    manage_orders?: boolean;
    view_analytics?: boolean;
    [key: string]: boolean | undefined;
  };
  is_active: boolean;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Payment status for merchant payouts.
 */
export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Represents a payout to a merchant from order revenue.
 */
export interface MerchantPayout {
  payout_id: string; // UUID
  merchant_id: string; // UUID
  order_id: string | null; // UUID - order this payout relates to
  gross_amount: number; // Total order amount
  commission_rate: number; // Platform commission rate (e.g., 0.10 = 10%)
  commission_amount: number; // Amount taken as commission
  net_amount: number; // Amount paid to merchant
  status: PayoutStatus;
  payout_method: string | null; // 'bank_transfer', 'gcash', 'maya', etc.
  payout_reference: string | null; // External reference from payment provider
  notes: string | null;
  created_at: string; // ISO 8601 timestamp
  processed_at: string | null; // When payout was processed
  updated_at: string; // ISO 8601 timestamp
}

/**
 * Dashboard statistics for a merchant (from view).
 */
export interface MerchantDashboardStats {
  merchant_id: string;
  business_name: string;
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  total_revenue: number;
  revenue_30d: number;
  active_products: number;
}