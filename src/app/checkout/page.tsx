import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCart } from '../../contexts/CartContext';
import { useAddresses } from '../../hooks/useAddresses';
import { BackIcon, Loader2 } from '../../components/icons';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { showSuccess, showError } from '../../lib/utils/toast';
import { createOrderFromCart } from '../../services/supabaseService';

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
  
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!eventDate || !eventTime || !selectedAddressId || !user) {
      showError('Missing delivery details or user session. Please go back to the cart to complete your delivery information.');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderResult = await createOrderFromCart({
        cartItems,
        eventDate,
        eventTime,
        deliveryInstructions,
        deliveryAddressId: selectedAddressId,
      });

      if (orderResult.error) throw orderResult.error;
      if (!orderResult.success || !orderResult.order) throw new Error('Order creation failed to return an order.');
      
      showSuccess('Order placed successfully!');
      clearCart();
      onOrderPlaced(orderResult.order.order_id);

    } catch (error: any) {
      console.error('Error creating order:', error);
      showError(error.message || 'Failed to create order. Please try again.');
    } finally {
        setIsSubmitting(false);
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
                After placing your order, you will be shown instructions for manual payment via Bank Transfer or GCash. You will need to upload your proof of payment in your order history to confirm the order.
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
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-3 rounded-full font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  'Place Order'
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