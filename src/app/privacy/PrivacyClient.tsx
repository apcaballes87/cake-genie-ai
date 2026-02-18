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

const PrivacyClient: React.FC = () => {
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
                        Privacy Policy
                    </h1>
                </div>

                {/* Content Card */}
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200 p-6 md:p-10 mb-12">
                    <p className="text-slate-600 mb-8 leading-relaxed">
                        At Genie.ph, your privacy matters. This Privacy Policy explains how we collect, use, and protect your personal
                        information when you use our AI-powered cake marketplace.
                    </p>

                    <div className="space-y-8">
                        <Section title="1. Information We Collect">
                            <p>We collect information that you provide directly and information collected automatically:</p>
                            <p><strong>Information you provide:</strong></p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Account details (name, email address, phone number).</li>
                                <li>Delivery addresses and order information.</li>
                                <li>Cake design images you upload for AI analysis.</li>
                                <li>Messages and communications with our support team.</li>
                            </ul>
                            <p><strong>Information collected automatically:</strong></p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Device information (browser type, operating system).</li>
                                <li>Usage data (pages visited, features used, time spent).</li>
                                <li>IP address and general location information.</li>
                            </ul>
                        </Section>

                        <Section title="2. How We Use Your Information">
                            <p>We use your information to:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Process and fulfill your cake orders.</li>
                                <li>Provide AI-powered cake design analysis and pricing.</li>
                                <li>Communicate with you about your orders and account.</li>
                                <li>Improve our platform, AI models, and user experience.</li>
                                <li>Send promotional offers and updates (with your consent).</li>
                                <li>Prevent fraud and ensure platform security.</li>
                            </ul>
                        </Section>

                        <Section title="3. Information Sharing">
                            <p>We share your information only in the following circumstances:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Baker partners:</strong> We share order details (name, delivery address, design specifications) with the baker fulfilling your order.</li>
                                <li><strong>Payment processors:</strong> Payment information is shared with Maya, GCash, and our banking partners to process transactions securely.</li>
                                <li><strong>Service providers:</strong> We use third-party services for hosting, analytics, and AI processing (e.g., Google Cloud, Supabase).</li>
                                <li><strong>Legal requirements:</strong> We may disclose information when required by Philippine law or to protect our rights.</li>
                            </ul>
                            <p>We do <strong>not</strong> sell your personal information to third parties.</p>
                        </Section>

                        <Section title="4. Uploaded Images">
                            <p>
                                When you upload cake design images for AI analysis, these images are processed by our AI system
                                to provide pricing and customization options. Uploaded images may be:
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Stored securely to improve our AI analysis accuracy.</li>
                                <li>Used to generate design pages visible to other users (without your personal information).</li>
                                <li>Retained for order processing and customer support purposes.</li>
                            </ul>
                        </Section>

                        <Section title="5. Data Security">
                            <p>
                                We implement appropriate technical and organizational measures to protect your personal information,
                                including encrypted data transmission (SSL/TLS), secure cloud storage, and access controls.
                                However, no method of transmission over the internet is 100% secure.
                            </p>
                        </Section>

                        <Section title="6. Cookies & Tracking">
                            <p>
                                We use cookies and similar technologies to enhance your experience, remember your preferences,
                                and analyze platform usage. You can manage cookie preferences through your browser settings.
                            </p>
                        </Section>

                        <Section title="7. Your Rights">
                            <p>Under the Philippine Data Privacy Act of 2012 (Republic Act No. 10173), you have the right to:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Access your personal information we hold.</li>
                                <li>Request correction of inaccurate data.</li>
                                <li>Request deletion of your data (subject to legal retention requirements).</li>
                                <li>Withdraw consent for marketing communications.</li>
                                <li>Lodge a complaint with the National Privacy Commission.</li>
                            </ul>
                        </Section>

                        <Section title="8. Data Retention">
                            <p>
                                We retain your personal information for as long as your account is active or as needed to provide
                                our services. Order records are kept for a minimum of 3 years for legal and accounting purposes.
                                You may request account deletion by contacting our support team.
                            </p>
                        </Section>

                        <Section title="9. Changes to This Policy">
                            <p>
                                We may update this Privacy Policy from time to time. We will notify you of significant changes
                                via email or a notice on our website. Continued use of the platform after changes constitutes
                                acceptance of the updated policy.
                            </p>
                        </Section>

                        <Section title="10. Contact Us">
                            <p>
                                For privacy-related inquiries or to exercise your data rights, please contact us:
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Email: <a href="mailto:support@genie.ph" className="text-purple-600 hover:underline">support@genie.ph</a></li>
                                <li>Phone: +63 908 940 8747</li>
                            </ul>
                        </Section>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
};

export default PrivacyClient;
