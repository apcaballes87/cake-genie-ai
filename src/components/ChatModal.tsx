'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CloseIcon, MessageCircle, Loader2, SendIcon } from './icons';
import { createClient } from '@/lib/supabase/client';

interface Message {
    id: string;
    text: string;
    isUser: boolean;
    sender_type: 'customer' | 'merchant' | 'system';
    timestamp: string;
    is_read: boolean;
}

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId?: string;
    userEmail?: string;
    userName?: string;
}

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, userId, userEmail, userName }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string>('');
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    useEffect(() => {
        let storedSession = localStorage.getItem('chat_session_id');
        if (!storedSession) {
            storedSession = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
            localStorage.setItem('chat_session_id', storedSession);
        }
        setSessionId(storedSession);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen && sessionId) {
            loadOrCreateConversation();
        } else if (!isOpen) {
            setMessages([]);
            setConversationId(null);
            setIsLoading(true);
        }
    }, [isOpen, sessionId, userId]);

    const loadOrCreateConversation = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start_conversation',
                    sessionId: userId ? undefined : sessionId,
                    userId: userId || undefined,
                    email: userEmail || email || undefined,
                    name: userName || name || undefined,
                }),
            });

            const result = await response.json();
            if (result.success && result.data) {
                setConversationId(result.data.id);
                await loadMessages(result.data.id);
            }
        } catch (err) {
            console.error('Error starting conversation:', err);
            setMessages([{
                id: '1',
                text: 'Hi! How can we help you today?',
                isUser: false,
                sender_type: 'system',
                timestamp: new Date().toISOString(),
                is_read: true,
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const loadMessages = async (convoId: string) => {
        try {
            const response = await fetch(`/api/chat?conversation_id=${convoId}`);
            const result = await response.json();
            if (result.success && result.data) {
                setMessages(result.data.map((msg: any) => ({
                    id: msg.id,
                    text: msg.content,
                    isUser: msg.sender_type === 'customer',
                    sender_type: msg.sender_type,
                    timestamp: msg.created_at,
                    is_read: msg.is_read,
                })));
            }
        } catch (err) {
            console.error('Error loading messages:', err);
        }
    };

    const handleSend = async () => {
        if (!inputValue.trim() || !conversationId) return;

        const userMessage: Message = {
            id: `temp_${Date.now()}`,
            text: inputValue,
            isUser: true,
            sender_type: 'customer',
            timestamp: new Date().toISOString(),
            is_read: true,
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsTyping(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send_message',
                    conversationId,
                    content: inputValue,
                    sessionId: userId ? undefined : sessionId,
                    userId: userId || undefined,
                }),
            });

            const result = await response.json();
            if (result.success && result.data) {
                setMessages(prev => prev.map(msg => 
                    msg.id === userMessage.id ? { ...msg, id: result.data.id } : msg
                ));
            }

            setTimeout(() => {
                const responses = [
                    "Thanks for reaching out! Our team will get back to you shortly.",
                    "We appreciate your message. We'll respond as soon as possible!",
                    "Got it! Someone from our team will be with you soon.",
                    "Thank you! Is there anything else we can help you with?"
                ];
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                
                const botMessage: Message = {
                    id: `sys_${Date.now()}`,
                    text: randomResponse,
                    isUser: false,
                    sender_type: 'system',
                    timestamp: new Date().toISOString(),
                    is_read: true,
                };
                
                setMessages(prev => [...prev, botMessage]);
                setIsTyping(false);
            }, 1500);
        } catch (err) {
            console.error('Error sending message:', err);
            setIsTyping(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleGuestDetailsSubmit = async () => {
        if (!email.trim()) return;
        
        setShowEmailForm(false);
        await loadOrCreateConversation();
    };

    if (!isOpen) return null;

    if (showEmailForm) {
        return (
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity duration-200 animate-fade-in"
                onClick={onClose}
                aria-modal="true"
                role="dialog"
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in"
                    onClick={(e) => e.stopPropagation()}
                >
                    <h2 className="text-lg font-bold text-slate-800 mb-4">Before we continue...</h2>
                    <p className="text-sm text-slate-600 mb-4">Please share your contact details so we can follow up with you.</p>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Name (optional)</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                className="w-full px-4 py-2 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                className="w-full px-4 py-2 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                required
                            />
                        </div>
                    </div>
                    
                    <div className="flex gap-2 mt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-full hover:bg-slate-50 transition-colors"
                        >
                            Skip
                        </button>
                        <button
                            onClick={handleGuestDetailsSubmit}
                            disabled={!email.trim()}
                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors disabled:opacity-50"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-opacity duration-200 animate-fade-in"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-[500px] flex flex-col overflow-hidden animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 flex justify-between items-center border-b border-slate-200 bg-purple-50 shrink-0">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-purple-600" />
                        <h2 className="text-lg font-bold text-slate-800">Chat with Us</h2>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" 
                        aria-label="Close"
                    >
                        <CloseIcon />
                    </button>
                </div>
                
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                        </div>
                    ) : (
                        <>
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div
                                        className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                                            message.isUser
                                                ? 'bg-purple-600 text-white rounded-br-md'
                                                : message.sender_type === 'system'
                                                ? 'bg-purple-100 text-purple-800 border border-purple-200 rounded-bl-md'
                                                : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
                                        }`}
                                    >
                                        <p className="text-sm">{message.text}</p>
                                        <p className={`text-[10px] mt-1 ${message.isUser ? 'text-purple-200' : 'text-slate-400'}`}>
                                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-md">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>
                
                {/* Input */}
                <div className="p-3 border-t border-slate-200 bg-white shrink-0">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Type a message..."
                            className="flex-1 px-4 py-2 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!inputValue.trim()}
                            className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <SendIcon className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 text-center mt-2">
                        Available Mon-Sat, 9AM-6PM
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatModal;
