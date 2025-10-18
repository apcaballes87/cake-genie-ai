import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface HowToOrderPageProps {
  onClose: () => void;
}

const HowToOrderPage: React.FC<HowToOrderPageProps> = ({ onClose }) => {
  return (
    <div className="w-full max-w-3xl mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
      <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
          <ArrowLeft />
        </button>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">How to Order</h1>
      </div>
      <div className="space-y-4 text-slate-600">
        <p>Detailed instructions on how to search, customize, and place an order will be available here shortly.</p>
        <ol className="list-decimal list-inside space-y-2">
          <li>Search for a cake design or upload your own image.</li>
          <li>Customize the details like flavors, toppers, and colors.</li>
          <li>Add the finalized design to your cart.</li>
          <li>Proceed to checkout and fill in your delivery details.</li>
        </ol>
        <p className="italic text-slate-500 mt-6">(Content for this page is coming soon.)</p>
      </div>
    </div>
  );
};

export default HowToOrderPage;
