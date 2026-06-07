'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Globe, Mail, Phone, MapPin, Clock, Send, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '@/lib/utils/toast';
import { genieBusinessProfile } from '@/lib/seo/genieBusinessProfile';
import { TurnstileWidget } from '@/components/TurnstileWidget';

const ContactInfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string; href?: string }> = ({ icon, label, value, href }) => (
    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
        <div className="shrink-0 text-purple-600">{icon}</div>
        <div>
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-slate-700 font-medium hover:text-purple-600 transition-colors wrap-break-word">{value}</a>
            ) : (
                <p className="text-slate-700 font-medium wrap-break-word">{value}</p>
            )}
        </div>
    </div>
);

const ContactClient: React.FC = () => {
    const router = useRouter();
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState('');
    const [turnstileKey, setTurnstileKey] = useState(0);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !contact.trim() || !email.trim() || !message.trim()) {
            showError("Please fill in all required fields.");
            return;
        }

        const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
        if (siteKey && !turnstileToken) {
            showError("Please complete the security verification.");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    phone: contact,
                    email,
                    message,
                    turnstileToken,
                }),
            });

            const payload = await response.json();
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || 'Something went wrong while sending your message.');
            }

            showSuccess("Thank you for your message! We'll get back to you soon.");
            setName('');
            setContact('');
            setEmail('');
            setMessage('');
            setTurnstileToken('');
            setTurnstileKey(prev => prev + 1);
        } catch (error) {
            showError(error instanceof Error ? error.message : 'Failed to send your message.');
            setTurnstileKey(prev => prev + 1);
            setTurnstileToken('');
        } finally {
            setIsSubmitting(false);
        }
    };

    const inputStyle = "w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors";

    return (
        <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
            <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => router.push('/')} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                    <ArrowLeft />
                </button>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Contact <span className="text-purple-400">Us</span></h1>
                    <p className="mt-1 text-sm text-slate-500">Ask a question, request help with an order, or confirm what kind of cake service fits your event.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                {/* Left side: Contact Info */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-800">Get In Touch</h2>
                    <div className="space-y-4">
                        <ContactInfoItem icon={<Globe size={20} />} label="Website" value="genie.ph" href="https://genie.ph" />
                        <ContactInfoItem icon={<Mail size={20} />} label="Email" value={genieBusinessProfile.supportEmail} href={`mailto:${genieBusinessProfile.supportEmail}`} />
                        <ContactInfoItem icon={<Phone size={20} />} label="Contact" value={genieBusinessProfile.phoneDisplay} href={genieBusinessProfile.phoneHref} />
                        <ContactInfoItem icon={<MapPin size={20} />} label="Address" value={genieBusinessProfile.addressLine} href={genieBusinessProfile.mapUrl} />
                        <ContactInfoItem icon={<Clock size={20} />} label="Business Hours" value={genieBusinessProfile.hoursDisplay} />
                    </div>

                    <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-5">
                        <h3 className="text-base font-bold text-slate-900">New customer? Here&apos;s the fastest path.</h3>
                        <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-650 text-slate-600">
                            <li>Upload a cake peg on Genie.ph to get a starting price.</li>
                            <li>Use this form if you need help with rush viability, service area, or order support.</li>
                            <li>For faster same-day questions, call during business hours.</li>
                        </ol>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <Link href="/customizing" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                                Upload a design
                            </Link>
                            <Link href="/services" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800">
                                View services
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Right side: Form */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-800">Leave Your Details</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-600 mb-1">Name <span className="text-red-500">*</span></label>
                            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} className={inputStyle} required />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="contact" className="block text-sm font-medium text-slate-600 mb-1">Contact Number <span className="text-red-500">*</span></label>
                                <input id="contact" type="tel" value={contact} onChange={e => setContact(e.target.value)} className={inputStyle} required />
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-slate-600 mb-1">Email <span className="text-red-500">*</span></label>
                                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputStyle} required />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-slate-600 mb-1">Comment/Message <span className="text-red-500">*</span></label>
                            <textarea id="message" value={message} onChange={e => setMessage(e.target.value)} className={inputStyle} rows={4} required />
                        </div>
                        <TurnstileWidget
                            key={turnstileKey}
                            onVerify={setTurnstileToken}
                            onExpire={() => setTurnstileToken('')}
                            onError={() => setTurnstileToken('')}
                        />
                        <button type="submit" disabled={isSubmitting} className="genie-btn-primary w-full py-3.5 px-4 rounded-lg active:scale-[0.99] transition-transform">
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5 mr-2" />
                            )}
                            {isSubmitting ? 'Sending...' : 'Send Message'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ContactClient;
