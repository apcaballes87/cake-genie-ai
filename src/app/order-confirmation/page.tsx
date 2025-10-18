

import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabase/client';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import type { CakeGenieOrder } from '../../lib/database.types';

interface OrderConfirmationPageProps {
  orderId: string;
  onContinueShopping: () => void;
  onGoToOrders: () => void;
}

const OrderConfirmationPage: React.FC<OrderConfirmationPageProps> = ({
  orderId,
  onContinueShopping,
  onGoToOrders,
}) => {
  const [order, setOrder] = useState<CakeGenieOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'gcash'>('bank');
  const supabase = getSupabaseClient();

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        setLoading(false);
        return;
      };
      
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('cakegenie_orders')
          .select('*')
          .eq('order_id', orderId)
          .single();

        if (error) throw error;
        setOrder(data);
      } catch (error) {
        console.error('Error fetching order:', error);
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, supabase]);
  
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

  const choiceChipBaseStyle = "flex-1 text-center font-semibold py-2 px-4 rounded-lg border-2 transition-all duration-200 text-sm";
  const activeChipStyle = "bg-pink-500 border-pink-500 text-white shadow-md";
  const inactiveChipStyle = "bg-white border-slate-300 text-slate-600 hover:bg-slate-50";

  const displayId = order.order_number || (typeof order.order_id === 'string' ? order.order_id.split('-')[0].toUpperCase() : 'N/A');

  return (
    <div className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 text-center animate-fade-in">
      <div className="mx-auto w-16 h-16 flex items-center justify-center bg-green-100 rounded-full">
        <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
      </div>
      <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text mt-4">Order Placed Successfully!</h1>
      <p className="text-slate-600 mt-2">Your order is now pending payment.</p>
      
      <div className="mt-4 bg-slate-100 p-3 rounded-lg">
        <p className="text-sm text-slate-500">Your Order Number is:</p>
        <p className="text-lg font-mono font-bold text-slate-800 tracking-wider">{displayId}</p>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-200 text-left">
        <h2 className="text-lg font-semibold text-slate-800">Payment Instructions</h2>
        <p className="text-xs text-slate-500 mt-1">
          To confirm your order, please pay the total amount of <strong className="text-pink-600">₱{order.total_amount.toLocaleString()}</strong> and upload your proof of payment in your account's order history.
        </p>

        <div className="mt-4 flex gap-3">
          <button 
            onClick={() => setPaymentMethod('bank')} 
            className={`${choiceChipBaseStyle} ${paymentMethod === 'bank' ? activeChipStyle : inactiveChipStyle}`}>
            Bank Transfer
          </button>
          <button 
            onClick={() => setPaymentMethod('gcash')} 
            className={`${choiceChipBaseStyle} ${paymentMethod === 'gcash' ? activeChipStyle : inactiveChipStyle}`}>
            GCash
          </button>
        </div>

        <div className="mt-4 p-4 bg-slate-100 rounded-lg text-sm space-y-1 animate-fade-in">
          {paymentMethod === 'bank' ? (
            <div>
              <p className="text-slate-500">Bank Name:</p>
              <p className="font-semibold text-slate-800">[Your Bank Name Here]</p>
              <p className="text-slate-500 mt-2">Account Name:</p>
              <p className="font-semibold text-slate-800">[Your Account Name Here]</p>
              <p className="text-slate-500 mt-2">Account Number:</p>
              <p className="font-semibold text-slate-800">[Your Account Number Here]</p>
            </div>
          ) : (
            <div>
              <p className="text-slate-500">GCash Name:</p>
              <p className="font-semibold text-slate-800">[Your GCash Name Here]</p>
              <p className="text-slate-500 mt-2">GCash Number:</p>
              <p className="font-semibold text-slate-800">[Your GCash Number Here]</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row-reverse gap-3 mt-8">
        <button onClick={onGoToOrders} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base">
          Upload Payment Proof
        </button>
        <button onClick={onContinueShopping} className="w-full text-center bg-white border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-slate-50 transition-all text-base">
          Shop for More Cakes
        </button>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;
