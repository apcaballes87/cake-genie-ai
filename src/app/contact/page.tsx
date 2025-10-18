import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface ContactPageProps {
  onClose: () => void;
}

const ContactPage: React.FC<ContactPageProps> = ({ onClose }) => {
  return (
    <div className="w-full max-w-3xl mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
      <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
          <ArrowLeft />
        </button>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">Contact Us</h1>
      </div>
      <div className="space-y-4 text-slate-600">
        <p>We'd love to hear from you! Our contact information will be listed here soon.</p>
        <p>For inquiries, custom quotes, or feedback, please reach out to us through the channels that will be provided.</p>
        <p className="italic text-slate-500 mt-6">(Content for this page is coming soon.)</p>
      </div>
    </div>
  );
};

export default ContactPage;
