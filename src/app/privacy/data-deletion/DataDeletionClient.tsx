'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2, Mail, ExternalLink, ShieldCheck } from 'lucide-react';
import { Footer } from '@/components/Footer';

const Step: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
    <div className="flex items-start gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100 group hover:border-purple-200 hover:bg-white hover:shadow-sm transition-all">
        <div className="p-2 bg-white rounded-lg shadow-sm text-purple-600 group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <p className="text-slate-600 leading-relaxed font-normal">{text}</p>
    </div>
);

const DataDeletionClient: React.FC = () => {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-linear-to-br from-pink-50 via-purple-50 to-indigo-100 font-sans">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header with Back Button */}
                <div className="mb-8">
                    <button
                        onClick={() => router.push('/privacy')}
                        className="flex items-center gap-2 text-slate-600 hover:text-purple-600 transition-colors mb-4 group"
                        tabIndex={0}
                        aria-label="Back to Privacy Policy"
                    >
                        <div className="p-2 bg-white rounded-full shadow-sm group-hover:shadow-md transition-all">
                            <ArrowLeft size={20} />
                        </div>
                        <span className="font-medium">Back to Privacy Policy</span>
                    </button>
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
                        Data Deletion <span className="text-purple-400">Instructions</span>
                    </h1>
                </div>

                {/* Content Card */}
                <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-200 p-6 md:p-10 mb-12">
                    <div className="flex items-center gap-3 mb-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
                        <ShieldCheck className="text-purple-600" size={24} />
                        <p className="text-slate-700 font-medium">
                            Your privacy and data control are important to us. Follow these steps to request the deletion of your account and associated data.
                        </p>
                    </div>

                    <div className="space-y-8">
                        <section>
                            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <Trash2 size={24} className="text-purple-500" />
                                How to Request Data Deletion
                            </h2>
                            <div className="grid gap-4">
                                <Step 
                                    icon={<Mail size={20} />} 
                                    text="Send an email to support@genie.ph with the subject line 'Data Deletion Request'." 
                                />
                                <Step 
                                    icon={<ExternalLink size={20} />} 
                                    text="Clearly state the email address associated with your Genie.ph account that you wish to be deleted." 
                                />
                                <Step 
                                    icon={<ShieldCheck size={20} />} 
                                    text="Our support team will verify your identity before proceeding with the deletion to ensure account security." 
                                />
                            </div>
                        </section>

                        <div className="pt-8 border-t border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800 mb-4">What Data will be Deleted?</h2>
                            <p className="text-slate-600 mb-4 leading-relaxed">
                                Upon successful verification and processing of your request, we will permanently remove all personal information associated with your account, including:
                            </p>
                            <ul className="list-disc pl-5 space-y-2 text-slate-600">
                                <li>Your profile information (name, email, phone number).</li>
                                <li>Linked social media account information (e.g., from Facebook Login).</li>
                                <li>Your saved designs and cake analysis history.</li>
                                <li>Communications with our support team.</li>
                            </ul>
                        </div>

                        <div className="pt-8 border-t border-slate-100">
                            <h2 className="text-xl font-bold text-slate-800 mb-4">Data Retention for Compliance</h2>
                            <p className="text-slate-600 leading-relaxed italic">
                                Please note that we may retain certain information as required by Philippine law (e.g., transaction records for accounting and tax purposes) even after an account deletion request. These records are kept for a minimum of 3 years and are not used for any other purpose.
                            </p>
                        </div>

                        <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h3 className="font-bold text-slate-800 mb-1">Still have questions?</h3>
                                <p className="text-slate-600">We're here to help you with any privacy concerns.</p>
                            </div>
                            <a 
                                href="mailto:support@genie.ph"
                                className="inline-flex items-center justify-center px-6 py-3 genie-btn-primary font-bold rounded-xl shadow-md hover:shadow-lg transition-all text-center"
                            >
                                Contact Support
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
};

export default DataDeletionClient;
