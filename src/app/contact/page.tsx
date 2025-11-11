import React, { useState, FormEvent } from 'react';
import { ArrowLeft, Globe, Mail, Phone, MapPin, Clock, Send, Loader2 } from 'lucide-react';
import { showSuccess, showError } from '../../lib/utils/toast';
import { useCanonicalUrl } from '../../hooks';

interface ContactPageProps {
  onClose: () => void;
}

const ContactInfoItem: React.FC<{ icon: React.ReactNode; label: string; value: string; href?: string }> = ({ icon, label, value, href }) => (
    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg">
        <div className="flex-shrink-0 text-pink-500">{icon}</div>
        <div>
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            {href ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-slate-700 font-medium hover:text-pink-600 transition-colors break-words">{value}</a>
            ) : (
                <p className="text-slate-700 font-medium break-words">{value}</p>
            )}
        </div>
    </div>
);

const ContactPage: React.FC<ContactPageProps> = ({ onClose }) => {
    // Add canonical URL for SEO
    useCanonicalUrl('/contact');
    
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !contact.trim() || !email.trim() || !message.trim()) {
            showError("Please fill in all required fields.");
            return;
        }

        setIsSubmitting(true);
        // Simulate a submission since no backend endpoint is specified

        setTimeout(() => {
            setIsSubmitting(false);
            showSuccess("Thank you for your message! We'll get back to you soon.");
            // Reset form
            setName('');
            setContact('');
            setEmail('');
            setMessage('');
        }, 1000);
    };

    const inputStyle = "w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors";

    return (
        <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
            <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            
            <div className="flex items-center gap-4 mb-8">
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                    <ArrowLeft />
                </button>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">Contact Us</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                {/* Left side: Contact Info */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-800">Get In Touch</h2>
                    <div className="space-y-4">
                        <ContactInfoItem icon={<Globe size={20} />} label="Website" value="genie.ph" href="https://genie.ph" />
                        <ContactInfoItem icon={<Mail size={20} />} label="Email" value="support@genie.ph" href="mailto:support@genie.ph" />
                        <ContactInfoItem icon={<Phone size={20} />} label="Contact" value="0908 940 8747" href="tel:09089408747" />
                        <ContactInfoItem icon={<MapPin size={20} />} label="Address" value="Skyview Park, Nivel Hills, Cebu City" />
                        <ContactInfoItem icon={<Clock size={20} />} label="Business Hours" value="Mon - Sat: 9:00 AM - 6:00 PM" />
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
                        <button type="submit" disabled={isSubmitting} className="w-full flex justify-center items-center bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all text-base disabled:opacity-75 disabled:cursor-not-allowed">
                            {isSubmitting ? (
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5 mr-2" />
                            )}
                            {isSubmitting ? 'Submitting...' : 'Submit'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;
