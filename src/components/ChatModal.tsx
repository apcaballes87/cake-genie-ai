'use client';

import React, { useState } from 'react';
import { CloseIcon, MessageCircle, Loader2, SendIcon } from './icons';

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose }) => {
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        setIsSubmitting(true);
        
        // Simulate sending - in production, you'd send to your backend/email
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setSubmitted(true);
        setIsSubmitting(false);
    };

    const handleClose = () => {
        setMessage('');
        setSubmitted(false);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity duration-200 animate-fade-in"
            onClick={handleClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 flex justify-between items-center border-b border-slate-200 bg-purple-50">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-purple-600" />
                        <h2 className="text-lg font-bold text-slate-800">Chat with Us</h2>
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" 
                        aria-label="Close"
                    >
                        <CloseIcon />
                    </button>
                </div>
                
                <div className="p-5">
                    {submitted ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">Message Sent!</h3>
                            <p className="text-sm text-slate-600">We'll get back to you as soon as possible.</p>
                            <button
                                onClick={handleClose}
                                className="mt-4 px-6 py-2 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-slate-600 mb-4">
                                Have a question about your cake design? Send us a message and we'll respond as soon as we're online.
                            </p>
                            
                            <form onSubmit={handleSubmit}>
                                <textarea
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type your message here..."
                                    className="w-full p-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    rows={4}
                                    disabled={isSubmitting}
                                />
                                
                                <button
                                    type="submit"
                                    disabled={!message.trim() || isSubmitting}
                                    className="mt-3 w-full flex items-center justify-center gap-2 bg-purple-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <SendIcon className="w-5 h-5" />
                                            Send Message
                                        </>
                                    )}
                                </button>
                            </form>
                            
                            <p className="text-xs text-slate-500 text-center mt-4">
                                Available Mon-Sat, 9AM-6PM
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatModal;
