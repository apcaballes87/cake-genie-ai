import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface AboutPageProps {
  onClose: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ onClose }) => {
  return (
    <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
      <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
          <ArrowLeft />
        </button>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">About Us</h1>
      </div>
      
      <div className="space-y-8 text-slate-700">
        <section className="text-center py-6">
          <h2 className="text-4xl font-bold mb-4">Genie PH</h2>
          <p className="text-2xl italic text-slate-600">Your Cake Wish, Granted.</p>
        </section>

        <section>
          <h3 className="text-2xl font-bold mb-4 text-slate-800 border-l-4 border-pink-500 pl-3">Our Story</h3>
          <p className="mb-4">
            Genie PH was founded by Alan Paris Caballes with a vision to revolutionize the made-to-order economy. What began as a solution to the frustrations of ordering custom cakes, the long waits for replies, tedious back-and-forth conversations, and unclear pricing. It has evolved into a cutting-edge platform that bridges the gap between artisans and their customers through innovative AI-powered technology.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-2xl font-bold mb-4 text-slate-800 border-l-4 border-purple-500 pl-3">Our Vision</h3>
            <p className="mb-6">
              To become the leading platform for customizing made-to-order products, transforming the way people create and purchase personalized items by bringing the made-to-order economy into the modern digital age.
            </p>
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-4 text-slate-800 border-l-4 border-indigo-500 pl-3">Our Mission</h3>
            <p className="mb-6">
              To empower both customers and artisans with intuitive AI-driven customization tools that provide instant visualization, transparent pricing, and seamless transactions—making the process of ordering custom products as delightful as receiving them.
            </p>
          </div>
        </section>

        <section>
          <h3 className="text-2xl font-bold mb-4 text-slate-800 border-l-4 border-pink-500 pl-3">What We Do</h3>
          <p className="mb-4">
            Genie is an online cakeshop with true customization features powered by AI. Our platform transforms the custom cake ordering experience through:
          </p>
          
          <div className="mt-6">
            <h4 className="text-xl font-semibold mb-3 text-slate-800">For Customers:</h4>
            <ul className="list-disc pl-6 space-y-2 mb-6">
              <li><strong>Infinite Design Possibilities</strong> - Access unlimited cake designs with just one click, all fully customizable</li>
              <li><strong>Real-Time Visualization</strong> - See your custom creation come to life instantly as you personalize every detail</li>
              <li><strong>Instant Price Feedback</strong> - Know exactly what your design will cost with transparent, immediate pricing</li>
              <li><strong>Seamless Purchasing</strong> - Complete your order directly through our web and mobile platform</li>
            </ul>
          </div>
        </section>

        <section>
          <h3 className="text-2xl font-bold mb-4 text-slate-800 border-l-4 border-purple-500 pl-3">The Problem We're Solving</h3>
          <p className="mb-4">
            While we can order almost anything online today—from band-aids to cars to houses—highly customizable products like decorated cakes remain stuck in Web 1.0. Customers still rely on messaging apps, food delivery platforms, and lengthy conversations with unclear outcomes.
          </p>
          <p>
            Not all custom cakes are created equal. Simple, minimalist designs can be prepared in 5-10 minutes, competing directly with mass-market cakes from large chains. Yet the industry treats all custom orders the same way—through slow, manual processes. Genie changes that.
          </p>
        </section>

        <section>
          <h3 className="text-2xl font-bold mb-4 text-slate-800 border-l-4 border-indigo-500 pl-3">Recognition & Achievement</h3>
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-6 rounded-xl border border-amber-200">
            <h4 className="text-xl font-bold mb-3 text-amber-800">1st Place Winner - Startup Innovation Summit, Mandaue City</h4>
            <p className="mb-4">
              We are proud to have won first place at the Startup Innovation Summit – Innovative Business Start-Up Prototype Competition held during the Mandaue City Charter Anniversary Celebration. This prestigious recognition validates our commitment to innovation and our mission to provide technology solutions that make life better for communities.
            </p>
            <p>
              Organized by the Mandaue Investment Promotions and Tourism Action Center (MIPTAC) in partnership with the Mandaue Chamber of Commerce and Industry (MCCI), the competition brought together the region's most promising innovators and entrepreneurs. Our victory demonstrates the value and potential of Genie in transforming not just the custom cake industry, but the entire made-to-order economy.
            </p>
          </div>
        </section>

        <section>
          <h3 className="text-2xl font-bold mb-4 text-slate-800 border-l-4 border-green-500 pl-3">Business Permits</h3>
          <p className="mb-6">We are a legitimate business registered with the proper government authorities. Our permits and certifications are displayed below for transparency:</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-slate-100 p-2 text-center">
                <h4 className="font-semibold text-slate-700">BIR Certificate of Registration</h4>
              </div>
              <div className="p-2 flex justify-center">
                <img 
                  src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/BIR%20Certificate%20of%20Registration%202303.jpg" 
                  alt="BIR Certificate of Registration" 
                  className="w-full h-48 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open("https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/BIR%20Certificate%20of%20Registration%202303.jpg", "_blank")}
                />
              </div>
            </div>
            
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-slate-100 p-2 text-center">
                <h4 className="font-semibold text-slate-700">BIR Receipt Permit</h4>
              </div>
              <div className="p-2 flex justify-center">
                <img 
                  src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/20250808_145451.jpg" 
                  alt="BIR Receipt Permit" 
                  className="w-full h-48 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open("https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/20250808_145451.jpg", "_blank")}
                />
              </div>
            </div>
            
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="bg-slate-100 p-2 text-center">
                <h4 className="font-semibold text-slate-700">DTI Permit</h4>
              </div>
              <div className="p-2 flex justify-center">
                <img 
                  src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/DTI%20Alalai%20ITS.jpg" 
                  alt="DTI Permit" 
                  className="w-full h-48 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open("https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/DTI%20Alalai%20ITS.jpg", "_blank")}
                />
              </div>
            </div>
          </div>
          
          <p className="mt-4 text-sm text-slate-500 italic">Click on any permit to view the full-size document.</p>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;