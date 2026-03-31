'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CloseIcon, MessageCircle, Loader2, SendIcon } from './icons';

interface Message {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
}

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            text: 'Hi! How can we help you today?',
            isUser: false,
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!isOpen) {
            setMessages([
                {
                    id: '1',
                    text: 'Hi! How can we help you today?',
                    isUser: false,
                    timestamp: new Date()
                }
            ]);
            setInputValue('');
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputValue,
            isUser: true,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsTyping(true);

        // Simulate response after a delay
        setTimeout(() => {
            const responses = [
                "Thanks for reaching out! Our team will get back to you shortly.",
                "We appreciate your message. We'll respond as soon as possible!",
                "Got it! Someone from our team will be with you soon.",
                "Thank you! Is there anything else we can help you with?"
            ];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            
            const botMessage: Message = {
                id: (Date.now() + 1).toString(),
                text: randomResponse,
                isUser: false,
                timestamp: new Date()
            };
            
            setMessages(prev => [...prev, botMessage]);
            setIsTyping(false);
        }, 1500);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

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
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                                    message.isUser
                                        ? 'bg-purple-600 text-white rounded-br-md'
                                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
                                }`}
                            >
                                <p className="text-sm">{message.text}</p>
                                <p className={`text-[10px] mt-1 ${message.isUser ? 'text-purple-200' : 'text-slate-400'}`}>
                                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
