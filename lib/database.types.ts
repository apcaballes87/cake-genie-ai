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
  total_amount: number;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string | null;
  payment_proof_url: string | null;
  discount_code_id?: string | null; // Added for discount code support
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  confirmed_at: string | null; // ISO 8601 timestamp
  delivered_at: string | null; // ISO 8601 timestamp
  cakegenie_order_items?: CakeGenieOrderItem[]; // Optional for joined queries
}

/**
 * Represents a line item within an order in the `cakegenie_order_items` table.
 */
export interface CakeGenieOrderItem {
  item_id: string; // UUID
  order_id: string; // UUID
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