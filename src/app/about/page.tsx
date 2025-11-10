import React, { useState } from 'react';
import { ArrowLeft, Award, Target, Rocket, Users, Handshake, Search, Upload, Edit, Wand2, ShoppingCart, CheckCircle, X } from 'lucide-react';
import LazyImage from '../../components/LazyImage';

interface AboutPageProps {
  onClose: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`pt-6 border-t border-slate-200 ${className}`}>
    <h2 className="text-2xl font-bold text-slate-800 mb-4">{title}</h2>
    <div className="space-y-4 text-slate-600 leading-relaxed">
      {children}
    </div>
  </div>
);

const InfoCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 mb-2">
            <div className="text-pink-500">{icon}</div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        </div>
        <p className="text-slate-600">{children}</p>
    </div>
);

const ListItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="flex items-start gap-3">
        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
        <span>{children}</span>
    </li>
);

const PermitThumbnail: React.FC<{ src: string; alt: string; onClick: () => void }> = ({ src, alt, onClick }) => (
    <button onClick={onClick} className="group text-center focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 rounded-lg">
        <div className="aspect-w-3 aspect-h-4 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
            <LazyImage 
                src={src} 
                alt={alt} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
            />
        </div>
        <p className="mt-2 text-sm font-medium text-slate-700 group-hover:text-pink-600 transition-colors">{alt}</p>
    </button>
);


const AboutPage: React.FC<AboutPageProps> = ({ onClose }) => {
  const [zoomedPermit, setZoomedPermit] = useState<string | null>(null);

  const permits = [
    { name: 'BIR Certificate of Registration', url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/BIR%20Certificate%20of%20Registration%202303.jpg' },
    { name: 'BIR Receipt Permit', url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/20250808_145451.jpg' },
    { name: 'DTI Permit', url: 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/business%20permits/DTI%20Alalai%20ITS.jpg' },
  ];

  return (
    <>
      <div className="w-full max-w-4xl mx-auto bg-white/80 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200 animate-fade-in">
        <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
            <ArrowLeft />
          </button>
          <div className="flex-grow">
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">About Us</h1>
            <p className="text-slate-500 font-medium mt-1">Your Cake Wish, Granted.</p>
          </div>
        </div>

        <div className="space-y-8">
          <Section title="Our Story">
            <p>Genie was founded by Alan Paris Caballes with a vision to revolutionize the made-to-order economy. What began as a solution to the frustrations of ordering custom cakes—the long waits for replies, tedious back-and-forth conversations, and unclear pricing—has evolved into a cutting-edge platform that bridges the gap between artisans and their customers through innovative AI-powered technology.</p>
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-200">
            <InfoCard icon={<Rocket className="w-6 h-6"/>} title="Our Vision">
              To become the leading platform for customizing made-to-order products, transforming the way people create and purchase personalized items by bringing the made-to-order economy into the modern digital age.
            </InfoCard>
            <InfoCard icon={<Target className="w-6 h-6"/>} title="Our Mission">
              To empower both customers and artisans with intuitive AI-driven customization tools that provide instant visualization, transparent pricing, and seamless transactions—making the process of ordering custom products as delightful as receiving them.
            </InfoCard>
          </div>

          <Section title="What We Do">
            <p>Genie is an online cakeshop with true customization features powered by AI. Our platform transforms the custom cake ordering experience.</p>
            <div className="mt-6">
                <div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2"><Users className="w-5 h-5 text-pink-500" /> For Customers</h3>
                    <ul className="space-y-3">
                        <ListItem><strong>Infinite Design Possibilities</strong> - Access unlimited cake designs with just one click, all fully customizable.</ListItem>
                        <ListItem><strong>Real-Time Visualization</strong> - See your custom creation come to life instantly as you personalize every detail.</ListItem>
                        <ListItem><strong>Instant Price Feedback</strong> - Know exactly what your design will cost with transparent, immediate pricing.</ListItem>
                        <ListItem><strong>Seamless Purchasing</strong> - Complete your order directly through our web and mobile platform.</ListItem>
                    </ul>
                </div>
            </div>
          </Section>

          <Section title="The Problem We're Solving">
            <p>While we can order almost anything online today—from band-aids to cars to houses—highly customizable products like decorated cakes remain stuck in Web 1.0. Customers still rely on messaging apps, food delivery platforms, and lengthy conversations with unclear outcomes.</p>
            <p>Not all custom cakes are created equal. Simple, minimalist designs can be prepared in 5-10 minutes, competing directly with mass-market cakes from large chains. Yet the industry treats all custom orders the same way—through slow, manual processes. <strong>Genie changes that.</strong></p>
          </Section>

          <Section title="Recognition & Achievement">
            <div className="bg-gradient-to-br from-yellow-50 to-amber-100 p-6 rounded-xl border-2 border-yellow-200">
                <h3 className="text-lg font-bold text-amber-800 mb-2 flex items-center gap-2"><Award className="w-5 h-5" /> 1st Place Winner - Startup Innovation Summit, Mandaue City</h3>
                <p className="text-amber-700">We are proud to have won first place at the Startup Innovation Summit – Innovative Business Start-Up Prototype Competition held during the Mandaue City Charter Anniversary Celebration. This prestigious recognition validates our commitment to innovation and our mission to provide technology solutions that make life better for communities.</p>
                <p className="text-amber-700 mt-2">Organized by the Mandaue Investment Promotions and Tourism Action Center (MIPTAC) in partnership with the Mandaue Chamber of Commerce and Industry (MCCI), the competition brought together the region's most promising innovators and entrepreneurs. Our victory demonstrates the value and potential of Genie in transforming not just the custom cake industry, but the entire made-to-order economy.</p>
            </div>
          </Section>

          <Section title="Business Permits">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {permits.map((permit) => (
                    <PermitThumbnail 
                        key={permit.name}
                        src={permit.url} 
                        alt={permit.name}
                        onClick={() => setZoomedPermit(permit.url)}
                    />
                ))}
            </div>
          </Section>

        </div>
      </div>

      {/* Permit Zoom Modal */}
      {zoomedPermit && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setZoomedPermit(null)}
        >
          <button 
            className="absolute top-4 right-4 text-white p-2 bg-black/30 rounded-full hover:bg-black/50 transition-colors z-10"
            onClick={() => setZoomedPermit(null)}
          >
            <X size={24} />
          </button>
          <div className="relative" onClick={e => e.stopPropagation()}>
            <LazyImage 
              src={zoomedPermit} 
              alt="Permit document"
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AboutPage;