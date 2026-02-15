'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Footer } from '@/components/Footer';

const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
    <div className={`pt-6 border-t border-slate-200 ${className}`}>
        <h2 className="text-xl font-bold text-slate-800 mb-4">{title}</h2>
        <div className="space-y-4 text-slate-600 leading-relaxed">
            {children}
        </div>
    </div>
);

const ReturnPolicyClient: React.FC = () => {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100 font-sans">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header with Back Button */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-slate-600 hover:text-purple-600 transition-colors mb-4 group"
                    >
                        <div className="p-2 bg-white rounded-full shadow-sm group-hover:shadow-md transition-all">
                            <ArrowLeft size={20} />
                        </div>
                        <span className="font-medium">Back to Home</span>
                    </button>
                    <h1 className="text-3xl md:text-4xl font-bold bg-linear-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">
                        Return & Refund Policy
                    </h1>
                </div>

                {/* Content Card */}
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200 p-6 md:p-10 mb-12">
                    <p className="text-slate-600 mb-8 leading-relaxed">
                        At Genie.ph, we are committed to providing you with the highest quality custom cakes from Cebu's best artisans.
                        Due to the perishable and customized nature of our products, our return policy differs from standard retail items.
                        Please review our policies below.
                    </p>

                    <div className="space-y-8">
                        <Section title="Perishable Goods & Custom Orders">
                            <p>
                                All cakes and baked goods sold on Genie.ph are perishable and made-to-order. Therefore, we generally <strong>do not accept returns or offer refunds</strong> once the order has been accepted by the customer (via pickup or delivery).
                            </p>
                            <p>
                                Once the cake leaves the bakery or is handed over to the delivery courier, the responsibility for its condition transfers to the customer/courier.
                            </p>
                        </Section>

                        <Section title="Reporting Issues">
                            <p>
                                If your order does not meet your expectations due to a confirmed error on the baker's part (e.g., incorrect flavor, wrong design, or significant quality issue), please contact us immediately.
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>You must report the issue within <strong>24 hours</strong> of receiving your order.</li>
                                <li>Please provide clear photos of the issue as proof.</li>
                                <li>Do not discard the cake until the issue has been resolved, as we may settle it with the baker.</li>
                            </ul>
                            <p className="mt-2">
                                Contact our support team at <a href="mailto:support@genie.ph" className="text-purple-600 hover:underline">support@genie.ph</a> or call/text +63 908 940 8747.
                            </p>
                        </Section>

                        <Section title="Taste & Texture">
                            <p>
                                Flavor and texture are subjective. We verify our bakers to ensure high quality, but we cannot offer refunds based on personal preference if the product meets our quality standards.
                            </p>
                        </Section>

                        <Section title="Cancellations">
                            <p>
                                Custom cakes require significant time and ingredients to prepare.
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>More than 48 hours notice:</strong> Eligible for a full refund or store credit.</li>
                                <li><strong>Less than 48 hours notice:</strong> Refunds may not be possible as preparations may have already begun.</li>
                                <li><strong>Same-day cancellations:</strong> Not eligible for refund.</li>
                            </ul>
                        </Section>

                        <Section title="Refund Processing">
                            <p>
                                Approved refunds will be processed via the original payment method (Maya, GCash, or bank transfer) within 5-7 business days.
                            </p>
                        </Section>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
};

export default ReturnPolicyClient;
