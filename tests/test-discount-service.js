// Test the discount service directly
import { validateDiscountCode } from '../services/discountService';

async function testDiscountService() {
  console.log('Testing discount service with NEW100 code...');
  
  try {
    // Test with a valid order amount
    const result = await validateDiscountCode('NEW100', 1000);
    console.log('Result:', result);
  } catch (error) {
    console.error('Error testing discount service:', error);
  }
}

testDiscountService();