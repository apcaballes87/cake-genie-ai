import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface HowToOrderPageProps {
  onClose: () => void;
}

const HowToOrderPage: React.FC<HowToOrderPageProps> = ({ onClose }) => {
  return (
    <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
      <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
          <ArrowLeft />
        </button>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">How to Order</h1>
      </div>
      
      <div className="space-y-8 text-slate-700">
        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-800 border-l-4 border-pink-500 pl-3">Step 1: Find Your Inspiration</h2>
          <p className="mb-4">Your journey begins with a cake design. You have two easy options:</p>
          
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-200">
              <h3 className="font-bold text-lg text-slate-800 mb-2">Search the Web</h3>
              <p>Type any idea into the search bar (e.g., "blue dinosaur cake," "elegant floral wedding cake") to find designs from across the internet.</p>
            </div>
            
            <div className="bg-purple-50 p-5 rounded-xl border border-purple-200">
              <h3 className="font-bold text-lg text-slate-800 mb-2">Upload Your Own</h3>
              <p>Have a photo ready? Click the camera icon to upload an image directly from your device.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-800 border-l-4 border-purple-500 pl-3">Step 2: Let the Genie Work Its Magic</h2>
          <p className="mb-4">Once you select an image, our smart AI gets to work! In just a few seconds, it will analyze the entire design to identify:</p>
          
          <ul className="list-disc pl-6 space-y-2 mt-4">
            <li>The cake's structure (tiers, shape, height)</li>
            <li>All decorations, like toppers, flowers, and sprinkles</li>
            <li>Icing colors, borders, and effects like drips</li>
            <li>An initial price estimate based on the design's complexity</li>
          </ul>
          
          <p className="mt-4 italic">These details will automatically appear in the customization panel, ready for you to edit.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-800 border-l-4 border-indigo-500 pl-3">Step 3: Customize Your Masterpiece</h2>
          <p className="mb-4">This is where you make the cake truly yours! Adjust any of the details identified by the AI:</p>
          
          <div className="space-y-4 mt-6">
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-500 flex items-center justify-center text-white text-sm font-bold mr-3 mt-1">1</div>
              <div>
                <h3 className="font-bold text-slate-800">Change Flavors, Size, & Shape</h3>
                <p className="mt-1">Pick your desired cake base, height, and flavor for each tier.</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-500 flex items-center justify-center text-white text-sm font-bold mr-3 mt-1">2</div>
              <div>
                <h3 className="font-bold text-slate-800">Modify Decorations</h3>
                <p className="mt-1">Toggle toppers on or off, change a 3D figure to a more affordable printout, or even upload a new image for a photo topper.</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-500 flex items-center justify-center text-white text-sm font-bold mr-3 mt-1">3</div>
              <div>
                <h3 className="font-bold text-slate-800">Recolor Anything</h3>
                <p className="mt-1">Use the color palette to change the icing, drip, borders, and even the color of gumpaste decorations.</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0 h-6 w-6 rounded-full bg-pink-500 flex items-center justify-center text-white text-sm font-bold mr-3 mt-1">4</div>
              <div>
                <h3 className="font-bold text-slate-800">Update Messages</h3>
                <p className="mt-1">Edit the text or color of any message on the cake.</p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
            <p className="font-semibold">Click "Update Design": After making your changes, click the big "Update Design" button. The AI will generate a new image preview reflecting your edits in just a few moments!</p>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-800 border-l-4 border-green-500 pl-3">Step 4: Add to Cart & Checkout</h2>
          <p className="mb-4">The price in the sticky bar at the bottom of the screen updates in real-time as you make changes.</p>
          
          <div className="space-y-4">
            <p>Once you're happy with your design and price, click "Add to Cart."</p>
            <p>In your cart, you'll set the event date, time, and delivery address.</p>
            <p>Proceed to checkout to finalize your order. You'll receive payment instructions upon completion.</p>
          </div>
        </section>

        <section className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-xl border border-amber-200">
          <h2 className="text-2xl font-bold mb-4 text-amber-800">Coming from a partner Cakeshop?</h2>
          <p>If you started on our partner online cakeshop, the process is even simpler! Your cake's base options (like size and flavor) are already set. Just use our editor to customize the decorations, colors, and messages. When you click "Add to Cart," you'll be taken directly back to our partner cakeshop cart to complete your purchase.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-800 border-l-4 border-teal-500 pl-3">Tips for the Best Results</h2>
          
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 h-5 w-5 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold mr-3 mt-1">✓</div>
              <div>
                <h3 className="font-bold text-slate-800">Use Clear Images</h3>
                <p className="mt-1">For best results, start with a high-quality, well-lit photo where the cake is the main focus.</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0 h-5 w-5 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold mr-3 mt-1">✓</div>
              <div>
                <h3 className="font-bold text-slate-800">One Change at a Time</h3>
                <p className="mt-1">For complex edits, try making one or two changes and clicking "Update Design" to see the result before making more.</p>
              </div>
            </div>
            
            <div className="flex items-start">
              <div className="flex-shrink-0 h-5 w-5 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold mr-3 mt-1">✓</div>
              <div>
                <h3 className="font-bold text-slate-800">Use "Additional Instructions" for Clarifications</h3>
                <p className="mt-1">This box is perfect for telling the AI specific details, like "make the drip gold" or "put the message on the front." <span className="italic">(Note: You cannot use this to add completely new items)</span>.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HowToOrderPage;