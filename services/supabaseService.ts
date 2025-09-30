import { createClient } from '@supabase/supabase-js';
import { CakeType, BasePriceInfo, CakeThickness, ReportPayload, CartItem } from '../types';

const supabaseUrl = 'https://congofivupobtfudnhni.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvbmdvZml2dXBvYnRmdWRuaG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODc1NjkyMTQsImV4cCI6MjAwMzE0NTIxNH0.y2jsrPWt7Q_016e1o8PkM-Ayyti9yzxj3jH9hvH4DiM';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getCakeBasePriceOptions = async (
    type: CakeType,
    thickness: CakeThickness
): Promise<BasePriceInfo[]> => {
    try {
        const { data, error } = await supabase
            .from('productsizes_cakegenie')
            .select('cakesize, price')
            .ilike('type', type)
            .eq('thickness', thickness);

        if (error) {
            console.error("Supabase error:", error.message);
            throw new Error(error.message);
        }
        
        if (data && data.length > 0) {
            return data.map(item => ({ size: item.cakesize, price: item.price }));
        }

        throw new Error(`The selected cake size (${type}, ${thickness}) is not available.`);

    } catch (err) {
        console.error("Error fetching cake base price options:", err);
        if (err instanceof Error && err.message.includes('not available')) {
            throw err;
        }
        throw new Error("Could not connect to the pricing database.");
    }
};

export const reportCustomization = async (payload: ReportPayload): Promise<void> => {
  try {
    const { error } = await supabase
      .from('cakegeniecustomcakereports')
      .insert([payload]);

    if (error) {
      console.error("Supabase report error:", error.message);
      throw new Error(error.message);
    }
  } catch (err) {
    console.error("Error reporting customization:", err);
    throw new Error("Could not submit the report to the database.");
  }
};

export const saveCheckoutOrder = async (
  customerInfo: {
    name: string;
    email: string;
    phone: string;
    deliveryAddress: string;
    eventDate: string;
    eventTime: string;
    deliveryInstructions: string;
  },
  cartItems: CartItem[]
): Promise<void> => {
  try {
    // Calculate total amount
    const totalAmount = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);

    // Prepare the order data
    const orderData = {
      customer_name: customerInfo.name,
      customer_email: customerInfo.email,
      customer_phone: customerInfo.phone,
      delivery_address: customerInfo.deliveryAddress,
      order_items: cartItems.map(item => ({
        id: item.id,
        cakeSize: item.cakeSize,
        totalPrice: item.totalPrice,
        details: item.details
      })),
      total_amount: totalAmount,
      order_status: 'pending',
      event_date: customerInfo.eventDate,
      event_time: customerInfo.eventTime,
      delivery_instructions: customerInfo.deliveryInstructions
    };

    const { error } = await supabase
      .from('cakegeniecheckouttest')
      .insert([orderData]);

    if (error) {
      console.error("Supabase checkout error:", error.message);
      throw new Error(error.message);
    }
  } catch (err) {
    console.error("Error saving checkout order:", err);
    throw new Error("Could not save the order to the database.");
  }
};

export const saveLaunchNotificationEmail = async (email: string): Promise<void> => {
  try {
    // Check if email already exists in the table
    const { data, error: selectError } = await supabase
      .from('cakegeniecheckouttest')
      .select('id')
      .eq('launch_notification_email', email)
      .limit(1);

    if (selectError) {
      console.error("Supabase select error:", selectError.message);
      throw new Error(selectError.message);
    }

    // If email doesn't exist, insert a new row with just the email
    if (!data || data.length === 0) {
      const { error: insertError } = await supabase
        .from('cakegeniecheckouttest')
        .insert([{ launch_notification_email: email }]);

      if (insertError) {
        console.error("Supabase insert error:", insertError.message);
        throw new Error(insertError.message);
      }
    }
  } catch (err) {
    console.error("Error saving launch notification email:", err);
    throw new Error("Could not save the email to the database.");
  }
};