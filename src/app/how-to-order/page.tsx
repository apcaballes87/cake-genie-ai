import React from 'react';
import { ArrowLeft, Search, Upload, Edit, Wand2, ShoppingCart, CheckCircle } from 'lucide-react';
import { useCanonicalUrl } from '../../hooks';

interface HowToOrderPageProps {
  onClose: () => void;
}

const Step: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="flex items-start gap-4">
    <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-pink-100 text-pink-600 rounded-full border-2 border-pink-200">
      {icon}
    </div>
    <div>
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      <div className="text-slate-600 mt-1 space-y-2">{children}</div>
    </div>
  </div>
);

const HowToOrderPage: React.FC<HowToOrderPageProps> = ({ onClose }) => {
  // Add canonical URL for SEO
  useCanonicalUrl('/how-to-order');
  
  return (
    <div className="w-full max-w-3xl mx-auto bg-white/70 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
      <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
          <ArrowLeft />
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">How to Order</h1>
      </div>

      <div className="space-y-8">
        <Step icon={<Search className="w-6 h-6" />} title="Step 1: Find Your Inspiration">
          <p>Your journey begins with a cake design. You have two easy options:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Search the Web:</strong> Type any idea into the search bar (e.g., "blue dinosaur cake," "elegant floral wedding cake") to find designs from across the internet.</li>
            <li><strong>Upload Your Own:</strong> Have a photo ready? Click the camera icon to upload an image directly from your device.</li>
          </ul>
        </Step>

        <Step icon={<Wand2 className="w-6 h-6" />} title="Step 2: Let the Genie Work Its Magic">
          <p>Once you select an image, our smart AI gets to work! In just a few seconds, it will analyze the entire design to identify:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>The cake's structure (tiers, shape, height).</li>
            <li>All decorations, like toppers, flowers, and sprinkles.</li>
            <li>Icing colors, borders, and effects like drips.</li>
            <li>An initial price estimate based on the design's complexity.</li>
          </ul>
          <p>These details will automatically appear in the customization panel, ready for you to edit.</p>
        </Step>

        <Step icon={<Edit className="w-6 h-6" />} title="Step 3: Customize Your Masterpiece">
          <p>This is where you make the cake truly yours! Adjust any of the details identified by the AI:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Change Flavors, Size, & Shape:</strong> Pick your desired cake base, height, and flavor for each tier.</li>
            <li><strong>Modify Decorations:</strong> Toggle toppers on or off, change a 3D figure to a more affordable printout, or even upload a new image for a photo topper.</li>
            <li><strong>Recolor Anything:</strong> Use the color palette to change the icing, drip, borders, and even the color of gumpaste decorations.</li>
            <li><strong>Update Messages:</strong> Edit the text or color of any message on the cake.</li>
            <li><strong>Click "Update Design":</strong> After making your changes, click the big <strong>"Update Design"</strong> button. The AI will generate a new image preview reflecting your edits in just a few moments!</li>
          </ul>
        </Step>

        <Step icon={<ShoppingCart className="w-6 h-6" />} title="Step 4: Add to Cart & Checkout">
          <p>The price in the sticky bar at the bottom of the screen updates in real-time as you make changes.</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Once you're happy with your design and price, click <strong>"Add to Cart."</strong></li>
            <li>In your cart, you'll set the event date, time, and delivery address.</li>
            <li>Proceed to checkout to finalize your order. You'll receive payment instructions upon completion.</li>
          </ul>
        </Step>
        
        <div className="pt-4 border-t border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Tips for the Best Results</h2>
            <ul className="list-disc list-inside space-y-2 pl-2 text-slate-600">
                <li><strong>Use Clear Images:</strong> For best results, start with a high-quality, well-lit photo where the cake is the main focus.</li>
                <li><strong>One Change at a Time:</strong> For complex edits, try making one or two changes and clicking "Update Design" to see the result before making more.</li>
                <li><strong>Use "Additional Instructions" for Clarifications:</strong> This box is perfect for telling the AI specific details, like "make the drip gold" or "put the message on the front." (Note: You cannot use this to add completely new items).</li>
            </ul>
        </div>
      </div>
    </div>
  );
};

export default HowToOrderPage;