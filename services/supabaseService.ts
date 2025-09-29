import { createClient } from '@supabase/supabase-js';
import { CakeType, BasePriceInfo, CakeThickness, ReportPayload } from '../types';

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