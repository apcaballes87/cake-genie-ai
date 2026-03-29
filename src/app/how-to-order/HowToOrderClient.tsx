'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Upload, Edit, Wand2, ShoppingCart, CheckCircle, HelpCircle } from 'lucide-react';

const Step: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 flex items-center justify-center bg-pink-100 text-pink-600 rounded-full border-2 border-pink-200">
            {icon}
        </div>
        <div>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <div className="text-slate-600 mt-1 space-y-2">{children}</div>
        </div>
    </div>
);

const HowToOrderClient: React.FC = () => {
    const router = useRouter();

    return (
        <div className="w-full max-w-3xl mx-auto bg-white/70 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
            <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => router.push('/')} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                    <ArrowLeft />
                </button>
                <h1 className="text-2xl sm:text-3xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">How to Order</h1>
            </div>

            <div className="space-y-8">
                <Step icon={<Search className="w-6 h-6" />} title="Step 1: Find Your Inspiration">
                    <p>Your journey begins with a cake design. You have two easy options:</p>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                        <li><strong>Search the Web:</strong> Type any idea into the search bar (e.g., "blue dinosaur cake," "elegant floral wedding cake") to find designs from across the internet.</li>
                        <li><strong>Upload Your Own:</strong> Have a photo saved from Pinterest or Instagram? Click the camera icon to upload an image directly from your device. This is the fastest way to get an accurate quote on a specific design you already love.</li>
                    </ul>
                    <p className="text-sm bg-pink-50 border border-pink-100 rounded-lg px-3 py-2">
                        <strong>Pro tip:</strong> Use a well-lit photo with a plain background for the most accurate AI pricing. Busy backgrounds can sometimes cause the AI to pick up extra decorations that aren&apos;t actually part of the design.
                    </p>
                </Step>

                <Step icon={<Wand2 className="w-6 h-6" />} title="Step 2: Let the Genie Work Its Magic">
                    <p>Once you select an image, our smart AI gets to work! In just a few seconds, it will analyze the entire design to identify:</p>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                        <li>The cake&apos;s structure — number of tiers, shape (round, square, heart), and height.</li>
                        <li>All decorations, like toppers, flowers, macarons, and sprinkles.</li>
                        <li>Icing type, colors, borders, and effects like drips or ruffles.</li>
                        <li>An initial price estimate based on the design&apos;s overall complexity.</li>
                    </ul>
                    <p>These details will automatically appear in the customization panel, ready for you to edit. For a typical 1-tier, 6-inch round cake with buttercream icing and simple floral decorations, the AI usually returns a starting price range of <strong>₱700–₱1,200</strong>. More elaborate designs with multiple tiers, fondant work, or 3D toppers will price higher.</p>
                    <p className="text-sm bg-pink-50 border border-pink-100 rounded-lg px-3 py-2">
                        <strong>Note:</strong> If your reference photo shows a multi-tier cake, the AI will detect and price each tier separately — so a 3-tier cake will show three tier entries in your customization panel.
                    </p>
                </Step>

                <Step icon={<Edit className="w-6 h-6" />} title="Step 3: Customize Your Masterpiece">
                    <p>This is where you make the cake truly yours! Adjust any of the details identified by the AI:</p>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                        <li><strong>Change Flavors, Size, & Shape:</strong> Pick your desired cake base, height, and flavor for each tier. Popular choices include vanilla, chocolate, ube, and mango. Switching from a 6-inch to an 8-inch round increases servings from about 12 to 20 slices — and the price updates live the moment you change it.</li>
                        <li><strong>Modify Decorations:</strong> Toggle toppers on or off, swap a 3D gumpaste figure for a more affordable printed topper, or upload a new image for a custom photo topper.</li>
                        <li><strong>Recolor Anything:</strong> Use the color palette to change the icing, drip, borders, and even the color of gumpaste decorations.</li>
                        <li><strong>Update Messages:</strong> Edit the text or color of any message written on the cake — perfect for birthdays, anniversaries, or graduations.</li>
                        <li><strong>Click &quot;Update Design&quot;:</strong> After making your changes, click the big <strong>&quot;Update Design&quot;</strong> button. The AI will generate a new preview image reflecting your edits in just a few seconds.</li>
                    </ul>
                    <p className="text-sm bg-pink-50 border border-pink-100 rounded-lg px-3 py-2">
                        <strong>Pro tip:</strong> For complex edits, make one or two changes at a time before clicking &quot;Update Design.&quot; This keeps the preview accurate. Use the <strong>&quot;Additional Instructions&quot;</strong> box for specific details the palette can&apos;t handle, like &quot;make the drip gold&quot; or &quot;put the message on the front tier.&quot;
                    </p>
                </Step>

                <Step icon={<ShoppingCart className="w-6 h-6" />} title="Step 4: Add to Cart & Checkout">
                    <p>The price shown in the sticky bar at the bottom of the screen updates in real-time as you make changes.</p>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                        <li>Once you&apos;re happy with your design and price, click <strong>&quot;Add to Cart.&quot;</strong></li>
                        <li>In your cart, set the event date, time, and delivery address. Delivery is available across Metro Cebu — Cebu City, Mandaue, Lapu-Lapu, Talisay, and surrounding areas.</li>
                        <li><strong>Same-day delivery:</strong> Place your order by 4PM for same-day delivery. Rush orders (ready in as little as 1–4 hours) are available with select bakers.</li>
                        <li>Proceed to checkout to finalize. Accepted payment methods include <strong>GCash, Maya, and credit/debit cards</strong>.</li>
                    </ul>
                </Step>

                {/* Real Order Example */}
                <div className="pt-4 border-t border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800 mb-3">See It in Action: A Real Order Example</h2>
                    <p className="text-slate-600 mb-3">Here&apos;s what a typical order looks like from start to finish:</p>
                    <ol className="list-decimal list-inside space-y-3 pl-2 text-slate-600">
                        <li>A customer screenshots a single-tier floral buttercream cake from Pinterest and uploads it on Genie.ph.</li>
                        <li>The AI identifies: <strong>1 tier, round shape, buttercream icing, pink floral decorations, no toppers.</strong> It returns an initial price range of <strong>₱700–₱1,200</strong> for a 6-inch round.</li>
                        <li>The customer decides they want chocolate flavor instead of vanilla — price stays the same. Then they upgrade the size to <strong>8-inch</strong> to serve more guests at the party. The price updates live to <strong>₱1,400–₱1,800</strong>.</li>
                        <li>They add a message — <strong>&quot;Happy Birthday Jana&quot;</strong> in pink — and click &quot;Update Design.&quot; A new preview appears in seconds showing the updated cake.</li>
                        <li>Happy with the result, they click &quot;Add to Cart,&quot; set the delivery for next Saturday afternoon, and enter a Cebu City address.</li>
                        <li>They complete checkout via GCash and receive a confirmation. Done — a fully custom cake ordered in under 5 minutes.</li>
                    </ol>
                </div>

                {/* Troubleshooting */}
                <div className="pt-4 border-t border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800 mb-3">Troubleshooting Common Issues</h2>
                    <ul className="space-y-3 text-slate-600">
                        <li>
                            <strong className="text-slate-800">The AI priced my cake too high.</strong>{' '}
                            Try simplifying the design — remove expensive elements like 3D toppers or switch from fondant to buttercream. You can also reduce the size (e.g., from 8-inch to 6-inch) to bring the price down. Every change reflects instantly in the price bar.
                        </li>
                        <li>
                            <strong className="text-slate-800">I can&apos;t find the exact design I want in search results.</strong>{' '}
                            Skip the search and go straight to uploading. Save a reference photo from Pinterest or Instagram, then tap the camera icon. The AI will price it directly from your image.
                        </li>
                        <li>
                            <strong className="text-slate-800">Can I order for same-day delivery in Cebu?</strong>{' '}
                            Yes — place your order by 4PM for same-day delivery. For truly urgent needs, rush orders (ready in as little as 1–4 hours) are available with select bakers, subject to availability.
                        </li>
                        <li>
                            <strong className="text-slate-800">What payment methods are accepted?</strong>{' '}
                            GCash, Maya, and credit/debit cards are all accepted at checkout. No cash on delivery at the moment.
                        </li>
                        <li>
                            <strong className="text-slate-800">The AI misidentified part of my design.</strong>{' '}
                            Use the &quot;Additional Instructions&quot; box to override it — for example, &quot;this is a 2-tier cake, not 1-tier&quot; or &quot;the drip should be chocolate, not caramel.&quot; You can also manually adjust the tier count and decoration toggles in the customization panel.
                        </li>
                    </ul>
                </div>

                {/* Tips */}
                <div className="pt-4 border-t border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Tips for the Best Results</h2>
                    <ul className="list-disc list-inside space-y-2 pl-2 text-slate-600">
                        <li><strong>Use Clear Images:</strong> Start with a high-quality, well-lit photo where the cake is the main focus and the background is plain or neutral.</li>
                        <li><strong>One Change at a Time:</strong> For complex edits, make one or two changes and click &quot;Update Design&quot; before continuing. This helps the AI keep the preview accurate.</li>
                        <li><strong>Use &quot;Additional Instructions&quot; for Clarifications:</strong> This box is perfect for specific details, like &quot;make the drip gold&quot; or &quot;put the message on the front.&quot; Note: it can&apos;t add completely new items — use the decoration panel for that.</li>
                    </ul>
                </div>

                {/* FAQ */}
                <div className="pt-4 border-t border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Frequently Asked Questions</h2>
                    <div className="space-y-5 text-slate-600">
                        <div>
                            <h3 className="font-semibold text-slate-800 mb-1">How much does a custom cake cost on Genie.ph?</h3>
                            <p>Prices depend on size, tier count, and decoration complexity. A simple 6-inch single-tier buttercream cake typically starts at <strong>₱700–₱1,200</strong>. Multi-tier cakes, fondant designs, or cakes with 3D toppers can range from <strong>₱1,800 up to ₱5,000+</strong>. You&apos;ll always see the exact price range before you checkout — no surprises.</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 mb-1">How far in advance should I order?</h3>
                            <p>Most bakers need at least 1–2 days&apos; notice. That said, same-day orders are available if you place them by 4PM, and rush orders (1–4 hours) are possible with select bakers. For weddings or large events, we recommend ordering at least 1–2 weeks ahead.</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 mb-1">Do you deliver anywhere in Cebu?</h3>
                            <p>Yes — delivery is available across Metro Cebu, including Cebu City, Mandaue, Lapu-Lapu, Talisay, and nearby areas. Delivery fees vary based on distance from the baker to your address.</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 mb-1">What cake flavors are available?</h3>
                            <p>Common flavors include vanilla, chocolate, ube, and mango — but availability depends on which baker you&apos;re matched with. You&apos;ll see the flavor options for each tier in the customization panel once a baker is assigned to your order.</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 mb-1">Can I order a cake as a gift with delivery to someone else&apos;s address?</h3>
                            <p>Absolutely. Just enter the recipient&apos;s address in the delivery field at checkout. You can also add a note for the baker in the &quot;Additional Instructions&quot; box — for example, &quot;please don&apos;t include a receipt, this is a surprise.&quot;</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 mb-1">What if I&apos;m not satisfied with the AI-generated preview?</h3>
                            <p>The AI preview is a visual guide — the final cake is handcrafted by a real baker and may look slightly different. If you have very specific requirements, use the &quot;Additional Instructions&quot; box to detail them clearly. You can also message the baker directly after your order is confirmed.</p>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 mb-1">Is Genie.ph available outside of Cebu?</h3>
                            <p>We&apos;re currently focused on Metro Cebu. Expansion to other cities in the Philippines is in progress — follow us on social media for updates on when we&apos;re coming to your city.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HowToOrderClient;
