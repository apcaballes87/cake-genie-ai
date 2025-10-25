

import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase/client';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import type { CakeGenieOrder, CakeGenieOrderItem } from '../../lib/database.types';
import { getPaymentStatus, verifyXenditPayment } from '../../services/xenditService';

interface OrderConfirmationPageProps {
  orderId: string;
  onContinueShopping: () => void;
  onGoToOrders: () => void;
}

// Declare gtag for Google Analytics event tracking
declare const gtag: (...args: any[]) => void;

const OrderConfirmationPage: React.FC<OrderConfirmationPageProps> = ({
  orderId,
  onContinueShopping,
  onGoToOrders,
}) => {
  console.log('[OrderConfirmationPage] Rendering with orderId:', orderId);

  const [order, setOrder] = useState<(CakeGenieOrder & { cakegenie_order_items: CakeGenieOrderItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseClient();
  
  const [paymentStatus, setPaymentStatus] = useState<'loading' | 'paid' | 'pending' | 'expired' | 'failed'>('loading');
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      console.log('[OrderConfirmationPage] fetchOrder effect triggered.');
      if (!orderId) {
        console.warn('[OrderConfirmationPage] No orderId provided to fetchOrder.');
        setLoading(false);
        return;
      };
      
      console.log(`[OrderConfirmationPage] Fetching order data for ID: ${orderId}`);
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('cakegenie_orders')
          .select('*, cakegenie_order_items(*)')
          .eq('order_id', orderId)
          .single();

        if (error) throw error;
        console.log('[OrderConfirmationPage] Successfully fetched order data:', data);
        setOrder(data);

        // Analytics: Track purchase event for the funnel
        if (typeof gtag === 'function' && data) {
            const orderItems = (data.cakegenie_order_items || []).map(item => ({
                item_id: `${item.cake_type}_${item.cake_size}`,
                item_name: `Custom Cake - ${item.cake_type}`,
                price: item.final_price,
                quantity: item.quantity
            }));

            gtag('event', 'purchase', {
                transaction_id: data.order_number,
                value: data.total_amount,
                currency: 'PHP',
                items: orderItems
            });
        }
      } catch (error) {
        console.error('[OrderConfirmationPage] Error fetching order:', error);
        setOrder(null);
      } finally {
        console.log('[OrderConfirmationPage] fetchOrder finished, setting loading to false.');
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, supabase]);

  // Proactive verification on page load
  useEffect(() => {
    const verifyOnLoad = async () => {
        if (!orderId) return;

        console.log(`[OrderConfirmationPage] Proactively verifying payment for orderId: ${orderId}`);
        const result = await verifyXenditPayment(orderId);

        if (result.success && result.status) {
            console.log(`[OrderConfirmationPage] Verification successful, status: ${result.status}`);
            setPaymentStatus(result.status.toLowerCase() as any);
        } else {
            console.warn('[OrderConfirmationPage] Proactive verification failed. Falling back to polling.', result.error);
            // If verification fails, the polling mechanism below will take over.
        }
    };

    verifyOnLoad();
  }, [orderId]);

  // Polling mechanism as a fallback
  useEffect(() => {
    const checkPayment = async () => {
      if (!orderId) return;
      
      try {
        const paymentData = await getPaymentStatus(orderId);
        
        if (paymentData) {
          setPaymentStatus(paymentData.status.toLowerCase() as any);
          setPaymentMethod(paymentData.payment_method);
        } else {
          setPaymentStatus('pending');
        }
      } catch (error) {
        console.error('Error checking payment status during poll:', error);
        setPaymentStatus('pending');
      }
    };
    
    // Don't start polling immediately; wait for the initial verification to attempt first.
    // The interval will start after a short delay.
    const intervalId = setInterval(() => {
        if (paymentStatus === 'pending' || paymentStatus === 'loading') {
            checkPayment();
        }
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [orderId, paymentStatus]);
  
  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto flex justify-center items-center p-10 min-h-[400px]">
          <LoadingSpinner />
      </div>
    );
  }
  
  if (!order) {
     return (
      <div className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 text-center animate-fade-in">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Order Not Found</h2>
        <p className="text-gray-600 mb-6">We couldn't find the requested order. It may have been cancelled or there was an issue.</p>
        <button
          onClick={onGoToOrders}
          className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-lg transition-all"
        >
          Back to My Orders
        </button>
      </div>
    );
  }

  const displayId = order.order_number || (typeof order.order_id === 'string' ? order.order_id.split('-')[0].toUpperCase() : 'N/A');

  return (
    <div className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 text-center animate-fade-in">
      <div className="mx-auto w-16 h-16 flex items-center justify-center bg-green-100 rounded-full">
        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      </div>
      <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text mt-4">Order Placed Successfully!</h1>
      <p className="text-slate-600 mt-2">Your order is now being processed.</p>
      
      <div className="mt-4 bg-slate-100 p-3 rounded-lg">
        <p className="text-sm text-slate-500">Your Order Number is:</p>
        <p className="text-lg font-mono font-bold text-slate-800 tracking-wider">{displayId}</p>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200 text-left">
        <h3 className="text-lg font-semibold mb-4 text-slate-800">Payment Status</h3>
        
        {paymentStatus === 'loading' && (
          <div className="flex items-center gap-3 text-slate-600">
            <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
            <div>
              <p className="font-medium">Verifying payment...</p>
              <p className="text-sm text-slate-500">Please wait</p>
            </div>
          </div>
        )}
        
        {paymentStatus === 'paid' && (
          <div className="flex items-center gap-3 text-green-600 bg-green-50 p-4 rounded-lg">
            <svg className="w-8 h-8 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="font-semibold text-lg">Payment Confirmed! 🎉</p>
              <p className="text-sm text-green-700">
                Your payment has been successfully processed
                {paymentMethod && ` via ${paymentMethod}`}.
              </p>
              <p className="text-sm text-green-700 mt-1">
                We'll start preparing your custom cake right away!
              </p>
            </div>
          </div>
        )}
        
        {paymentStatus === 'pending' && (
          <div className="flex items-center gap-3 text-yellow-600 bg-yellow-50 p-4 rounded-lg">
            <svg className="w-8 h-8 flex-shrink-0 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="font-semibold text-lg">Awaiting Payment</p>
              <p className="text-sm text-yellow-700">
                We're waiting for confirmation from the payment provider.
              </p>
              <p className="text-sm text-yellow-700 mt-1">
                This page will update automatically.
              </p>
            </div>
          </div>
        )}
        
        {paymentStatus === 'expired' && (
          <div className="flex items-center gap-3 text-orange-600 bg-orange-50 p-4 rounded-lg">
            <svg className="w-8 h-8 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="font-semibold text-lg">Payment Link Expired</p>
              <p className="text-sm text-orange-700">
                Your payment link has expired.
              </p>
              <p className="text-sm text-orange-700 mt-1">
                Please go to "My Orders" to try paying again or contact support.
              </p>
            </div>
          </div>
        )}
        
        {paymentStatus === 'failed' && (
          <div className="flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-lg">
            <svg className="w-8 h-8 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
            </svg>
            <div>
              <p className="font-semibold text-lg">Payment Failed</p>
              <p className="text-sm text-red-700">
                There was an issue processing your payment.
              </p>
              <p className="text-sm text-red-700 mt-1">
                Please try again from "My Orders" or contact support.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row-reverse gap-3 mt-8">
        <button onClick={onGoToOrders} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base">
          Check My Orders
        </button>
        <button onClick={onContinueShopping} className="w-full text-center bg-white border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-slate-50 transition-all text-base">
          Shop for More Cakes
        </button>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;