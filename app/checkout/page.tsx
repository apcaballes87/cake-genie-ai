import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../contexts/CartContext';
import { useAddresses } from '../../hooks/useAddresses';
import { BackIcon, Loader2 } from '../../components/icons';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { showSuccess, showError } from '../../lib/utils/toast';
import { createOrderFromCart } from '../../services/supabaseService';
import { createXenditPayment } from '../../services/xenditService';

type AppState = 'landing' | 'searching' | 'customizing' | 'cart' | 'auth' | 'addresses' | 'orders' | 'checkout' | 'order_confirmation';

interface CheckoutPageProps {
  onBackToCart: () => void;
  onOrderPlaced: (orderId: string) => void;
  setAppState: (state: AppState) => void;
}

const CheckoutPage: React.FC<CheckoutPageProps> = ({
  onBackToCart,
  onOrderPlaced,
  setAppState,
}) => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { 
    cartItems, 
    cartTotal, 
    eventDate, 
    eventTime, 
    deliveryInstructions,
    selectedAddressId,
    clearCart,
  } = useCart();
  
  const { data: addresses, isLoading: addressesLoading } = useAddresses(user?.id);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);

  // Redirect if not authenticated or if auth check is pending
  useEffect(() => {
    if (authLoading) {
        return; // Wait for auth status to resolve
    }
    if (!isAuthenticated) {
      setAppState('auth');
    }
  }, [authLoading, isAuthenticated, setAppState]);

  const deliveryFee = 150;
  const total = cartTotal + deliveryFee;

  const selectedAddress = useMemo(() => {
    return addresses?.find(a => a.address_id === selectedAddressId);
  }, [addresses, selectedAddressId]);


  const handleSubmitOrder = async () => {
    try {
      // Validation
      if (!selectedAddress) {
        showError('Please select a delivery address');
        return;
      }
  
      if (!eventDate || !eventTime) {
        showError('Please select delivery date and time');
        return;
      }
  
      // Create the order first
      setIsLoading(true);
      
      const orderResult = await createOrderFromCart({
        cartItems,
        eventDate,
        eventTime,
        deliveryInstructions,
        deliveryAddressId: selectedAddressId,
      });
  
      if (!orderResult.success || !orderResult.order) {
        throw new Error(orderResult.error?.message || 'Failed to create order');
      }
  
      // Order created successfully - now create payment link
      const orderId = orderResult.order.order_id;
      
      showSuccess('Order created! Redirecting to payment...');
      
      // Prepare payment items from cart
      const paymentItems = cartItems.map(item => ({
        name: `${item.cake_type} - ${item.cake_size}`,
        quantity: item.quantity,
        price: item.final_price,
      }));
  
      // Create Xendit payment link
      setIsCreatingPayment(true);
      
      const paymentResult = await createXenditPayment({
        orderId: orderId,
        amount: total,
        customerEmail: user?.email,
        customerName: user?.user_metadata?.first_name || user?.email?.split('@')[0],
        items: paymentItems,
      });
  
      if (paymentResult.success && paymentResult.paymentUrl) {
        // Redirect to Xendit payment page
        window.location.href = paymentResult.paymentUrl;
      } else {
        throw new Error(paymentResult.error || 'Failed to create payment link');
      }
  
    } catch (error: any) {
      console.error('Order/Payment error:', error);
      showError(error.message || 'Failed to process order. Please try again.');
      setIsLoading(false);
      setIsCreatingPayment(false);
    }
  };

  if (authLoading || addressesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={onBackToCart}
            className="p-2 rounded-full bg-white/80 backdrop-blur hover:bg-white transition-colors shadow-md"
            aria-label="Back to cart"
          >
            <BackIcon className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
            Checkout
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Payment Method</h2>
              <p className="text-sm text-gray-600">
                You will be redirected to our secure payment page to complete your purchase using GCash, Maya, GrabPay, or Card.
              </p>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Order Summary</h2>
              
              <div className="space-y-4 mb-6 border-b pb-4">
                 <div className="space-y-3 mb-4">
                    <h3 className="text-sm font-semibold text-gray-500">Items in your order</h3>
                    {cartItems.map(item => (
                        <div key={item.cart_item_id} className="flex items-center gap-3">
                        <img src={item.customized_image_url} alt={item.cake_type} className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                        <div className="flex-grow">
                            <p className="text-xs font-medium text-slate-700">{item.cake_type}</p>
                            <p className="text-xs text-slate-500">{item.cake_size}</p>
                        </div>
                        <p className="text-xs font-semibold text-slate-600">₱{item.final_price.toLocaleString()}</p>
                        </div>
                    ))}
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Delivery Details</h3>
                    <div className="text-sm text-gray-700 space-y-1">
                        <p><span className="font-medium">Date:</span> {eventDate ? new Date(eventDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not set'}</p>
                        <p><span className="font-medium">Time:</span> {eventTime || 'Not set'}</p>
                    </div>
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 mb-2">Delivery Address</h3>
                    {selectedAddress ? (
                         <div className="text-sm text-gray-700">
                            <p className="font-medium">{selectedAddress.recipient_name}</p>
                            <p>{selectedAddress.street_address}</p>
                            <p>{selectedAddress.barangay}, {selectedAddress.city}</p>
                            <p>{selectedAddress.recipient_phone}</p>
                        </div>
                    ) : (
                        <p className="text-sm text-red-600">No address selected. Please go back to the cart.</p>
                    )}
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({cartItems.length} items)</span>
                  <span>₱{cartTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery Fee</span>
                  <span>₱{deliveryFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="border-t pt-3 mt-2">
                  <div className="flex justify-between text-lg font-bold text-gray-800">
                    <span>Total</span>
                    <span className="text-purple-600">₱{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={isLoading || isCreatingPayment || !selectedAddress || !eventDate || !eventTime}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-4 rounded-full font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingPayment ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        fill="none"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Redirecting to Payment...
                  </span>
                ) : isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4" 
                        fill="none"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Creating Order...
                  </span>
                ) : (
                  `Place Order - ₱${total.toFixed(2)}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;