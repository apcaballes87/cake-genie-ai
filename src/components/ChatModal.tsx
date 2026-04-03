'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CloseIcon, MessageCircle, Loader2, SendIcon, ImageIcon } from './icons';
import { createClient } from '@/lib/supabase/client';
import { fileToBase64, analyzeCakeFeaturesOnly, enrichAnalysisWithRoboflow } from '@/services/geminiService';
import { findSimilarAnalysisByHash, cacheAnalysisResult } from '@/services/supabaseService';
import { HybridAnalysisResult } from '@/types';
import { compressImage, dataURItoBlob } from '@/lib/utils/imageOptimization';
import { hasBoundingBoxData } from '@/lib/utils/analysisUtils';
import Link from 'next/link';

interface ChatMessage {
    id: string;
    content: string;
    image_url: string | null;
    sender_type: string;
    created_at: string;
    is_read: boolean;
}

interface ProductLink {
    slug: string;
    title: string;
    imageUrl: string;
    price: string;
}

interface Message {
    id: string;
    text: string;
    imageUrl?: string;
    productLink?: ProductLink;
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

function extractProductLink(text: string): string | null {
    const match = text.match(/customizing\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
}

async function fetchProductBySlug(slug: string, supabase: ReturnType<typeof createClient>): Promise<{ title: string; imageUrl: string; price: string } | null> {
    try {
        const { data, error } = await supabase
            .from('cakegenie_analysis_cache')
            .select('seo_title, original_image_url, price')
            .eq('slug', slug)
            .single();
        
        if (error || !data) return null;
        
        return {
            title: data.seo_title || 'Your cake design',
            imageUrl: data.original_image_url || '',
            price: data.price ? `₱${Math.round(data.price).toLocaleString()}` : 'Check price'
        };
    } catch {
        return null;
    }
}

const ProductLinkCard: React.FC<{ slug: string; supabase: ReturnType<typeof createClient> }> = ({ slug, supabase }) => {
    const [productData, setProductData] = useState<{ title: string; imageUrl: string } | null>(null);

    useEffect(() => {
        fetchProductBySlug(slug, supabase).then(setProductData);
    }, [slug, supabase]);

    return (
        <Link 
            href={`/customizing/${slug}`}
            className="mt-2 block bg-white border border-purple-200 rounded-lg p-2 hover:bg-purple-50 transition-colors"
        >
            <div className="flex items-center gap-2">
                {productData?.imageUrl ? (
                    <img 
                        src={productData.imageUrl} 
                        alt={productData.title}
                        className="w-12 h-12 rounded-lg object-cover"
                    />
                ) : (
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                        <span className="text-lg">🎂</span>
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{productData?.title || 'View & Customize'}</p>
                    <p className="text-[10px] text-slate-500">genie.ph/customizing/{slug}</p>
                </div>
            </div>
        </Link>
    );
};

async function saveSystemMessage(conversationId: string, content: string, supabase: ReturnType<typeof createClient>): Promise<string | null> {
    try {
        console.log('💾 Saving system message:', { conversationId, content: content.substring(0, 50) });
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'send_system_message',
                conversationId,
                content,
            }),
        });

        const result = await response.json();
        console.log('💾 Save result:', result);
        
        if (result.success && result.data) {
            return result.data.id;
        }
        console.error('Error saving system message:', result.error);
        return null;
    } catch (err) {
        console.error('Error saving system message:', err);
        return null;
    }
}

async function generatePerceptualHash(imageSrc: string): Promise<string | null> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = async () => {
            try {
                const MAX_DIMENSION = 1024;
                let width = img.naturalWidth;
                let height = img.naturalHeight;
                if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                    if (width > height) {
                        height = Math.floor((height / width) * MAX_DIMENSION);
                        width = MAX_DIMENSION;
                    } else {
                        width = Math.floor((width / height) * MAX_DIMENSION);
                        height = MAX_DIMENSION;
                    }
                }
                const canvas = document.createElement('canvas');
                const size = 8;
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(null);
                ctx.drawImage(img, 0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, size, size);
                const pixels = imageData.data;
                const numPixels = size * size;
                const grayscale = new Array(numPixels);
                let totalLuminance = 0;
                let allZero = true;
                for (let i = 0; i < pixels.length; i += 4) {
                    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
                    if (r !== 0 || g !== 0 || b !== 0 || a !== 0) allZero = false;
                    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                    grayscale[i / 4] = luminance;
                    totalLuminance += luminance;
                }
                if (allZero) return resolve(null);
                const avgLuminance = totalLuminance / numPixels;
                let minLum = Infinity, maxLum = -Infinity;
                for (let i = 0; i < numPixels; i++) {
                    if (grayscale[i] < minLum) minLum = grayscale[i];
                    if (grayscale[i] > maxLum) maxLum = grayscale[i];
                }
                if (maxLum - minLum < 1) return resolve(null);
                let hash = 0n;
                for (let i = 0; i < grayscale.length; i++) {
                    if (grayscale[i] > avgLuminance) hash |= 1n << BigInt(i);
                }
                const hashStr = hash.toString(16).padStart(16, '0');
                if (hashStr === '0000000000000000') return resolve(null);
                resolve(hashStr);
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = imageSrc;
    });
}

async function analyzeImageWithCache(imageData: { data: string; mimeType: string }, imageUrl?: string): Promise<{ analysis: HybridAnalysisResult | null; slug: string | null; title: string | null; price: number | null; imageUrl: string | null }> {
    const imageSrc = `data:${imageData.mimeType};base64,${imageData.data}`;
    const pHash = await generatePerceptualHash(imageSrc);
    console.log(`🖼️ Chat pHash result: ${pHash ?? 'FAILED (null)'}`);
    if (!pHash) {
        return { analysis: null, slug: null, title: null, price: null, imageUrl: null };
    }
    const cacheHit = await findSimilarAnalysisByHash(pHash, imageUrl);
    if (cacheHit) {
        console.log('⚡ Chat: pHash Cache Hit! Using cached analysis.');
        return {
            analysis: cacheHit.analysisResult,
            slug: cacheHit.seoMetadata.slug,
            title: cacheHit.seoMetadata.seo_title,
            price: cacheHit.seoMetadata.price,
            imageUrl: cacheHit.seoMetadata.original_image_url
        };
    }
    console.log('🔄 Chat: Cache miss, running AI analysis...');
    const imageBlob = dataURItoBlob(imageSrc);
    const file = new File([imageBlob], 'chat-image.webp', { type: imageData.mimeType });
    const compressedFile = await compressImage(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1024, fileType: 'image/webp' });
    const compressedData = await fileToBase64(new File([compressedFile], 'chat-image.webp', { type: 'image/webp' }));
    const fastResult = await analyzeCakeFeaturesOnly(compressedData.data, compressedData.mimeType);
    if (!fastResult) return { analysis: null, slug: null, title: null, price: null, imageUrl: null };
    let finalResult = fastResult;
    const hasBbox = hasBoundingBoxData(fastResult);
    if (!hasBbox) {
        try {
            finalResult = await enrichAnalysisWithRoboflow(compressedData.data, compressedData.mimeType, fastResult);
        } catch {
            console.warn('Chat: enrichment failed, using fast result');
        }
    }
    if (pHash && finalResult) {
        const compressedBlob = await compressImage(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1024, fileType: 'image/webp' });
        cacheAnalysisResult(pHash, finalResult, undefined, compressedBlob);
    }
    return { analysis: finalResult, slug: null, title: null, price: null, imageUrl: null };
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
    const [isUploading, setIsUploading] = useState(false);
    const pendingImageHashRef = useRef<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
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
                setMessages(result.data.map((msg: ChatMessage) => ({
                    id: msg.id,
                    text: msg.content,
                    imageUrl: msg.image_url,
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

    const uploadImage = async (file: File): Promise<string | null> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${conversationId}_${Date.now()}.${fileExt}`;
        const filePath = `messages/${fileName}`;

        const { error } = await supabase.storage
            .from('chat-images')
            .upload(filePath, file);

        if (error) {
            console.error('Error uploading image:', error);
            return null;
        }

        const { data: urlData } = supabase.storage
            .from('chat-images')
            .getPublicUrl(filePath);

        return urlData.publicUrl;
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !conversationId) return;

        setIsUploading(true);

        try {
            const imageUrl = await uploadImage(file);
            if (imageUrl) {
                const userMessage: Message = {
                    id: `temp_${Date.now()}`,
                    text: inputValue || '',
                    imageUrl,
                    isUser: true,
                    sender_type: 'customer',
                    timestamp: new Date().toISOString(),
                    is_read: true,
                };

                setMessages(prev => [...prev, userMessage]);

                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'send_message',
                        conversationId,
                        content: inputValue || '',
                        imageUrl,
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

                setIsTyping(true);
                try {
                    const fileData = await fileToBase64(file);
                    const analysisResult = await analyzeImageWithCache(fileData, imageUrl);
                    
                    let botResponse = '';
                    if (analysisResult.analysis && analysisResult.slug) {
                        const priceDisplay = analysisResult.price ? `₱${Math.round(analysisResult.price).toLocaleString()}` : 'Check price';
                        const title = analysisResult.title || 'Your cake design';
                        botResponse = `🎂 I analyzed your cake image! Here's what I found:\n\n**${title}**\n\n💰 Starting at: ${priceDisplay}\n\n🔗 View and customize: https://genie.ph/customizing/${analysisResult.slug}`;
                    } else if (analysisResult.analysis) {
                        botResponse = "⏳ I've analyzed your cake image! Our team is finalizing the price and will send you the customization link shortly. Please give us a few moments!";
                    } else {
                        botResponse = "Thanks for sharing your cake image! Our team will review it and get back to you with pricing shortly.";
                    }

                    const botMessage: Message = {
                        id: `ai_${Date.now()}`,
                        text: botResponse,
                        isUser: false,
                        sender_type: 'system',
                        timestamp: new Date().toISOString(),
                        is_read: true,
                    };
                    setMessages(prev => [...prev, botMessage]);

                    if (conversationId) {
                        saveSystemMessage(conversationId, botResponse, supabase);
                    }

                    if (!analysisResult.slug && analysisResult.analysis) {
                        const imageSrcForHash = `data:${fileData.mimeType};base64,${fileData.data}`;
                        const pHash = await generatePerceptualHash(imageSrcForHash);
                        if (pHash) {
                            pendingImageHashRef.current = pHash;
                            setTimeout(async () => {
                                const recheck = await findSimilarAnalysisByHash(pHash);
                                if (recheck && recheck.seoMetadata.slug) {
                                    const priceDisplay = recheck.seoMetadata.price ? `₱${Math.round(recheck.seoMetadata.price).toLocaleString()}` : 'Check price';
                                    const title = recheck.seoMetadata.seo_title || 'Your cake design';
                                    const followUpMessage: Message = {
                                        id: `followup_${Date.now()}`,
                                        text: `🎉 Your customization link is ready!\n\n**${title}**\n\n💰 Starting at: ${priceDisplay}\n\n🔗 View and customize: https://genie.ph/customizing/${recheck.seoMetadata.slug}`,
                                        isUser: false,
                                        sender_type: 'system',
                                        timestamp: new Date().toISOString(),
                                        is_read: true,
                                    };
                                    setMessages(prev => [...prev, followUpMessage]);
                                    if (conversationId) {
                                        saveSystemMessage(conversationId, followUpMessage.text, supabase);
                                    }
                                } else {
                                    const noLinkMessage: Message = {
                                        id: `followup_${Date.now()}`,
                                        text: "Hi! I've checked on your cake image and we're still finalizing the details. We'll send you the customization link as soon as it's ready!",
                                        isUser: false,
                                        sender_type: 'system',
                                        timestamp: new Date().toISOString(),
                                        is_read: true,
                                    };
                                    setMessages(prev => [...prev, noLinkMessage]);
                                    if (conversationId) {
                                        saveSystemMessage(conversationId, noLinkMessage.text, supabase);
                                    }

                                    setTimeout(async () => {
                                        const recheck2 = await findSimilarAnalysisByHash(pHash);
                                        if (recheck2 && recheck2.seoMetadata.slug) {
                                            const priceDisplay = recheck2.seoMetadata.price ? `₱${Math.round(recheck2.seoMetadata.price).toLocaleString()}` : 'Check price';
                                            const title = recheck2.seoMetadata.seo_title || 'Your cake design';
                                            const followUp2: Message = {
                                                id: `followup2_${Date.now()}`,
                                                text: `🎉 Your customization link is ready!\n\n**${title}**\n\n💰 Starting at: ${priceDisplay}\n\n🔗 View and customize: https://genie.ph/customizing/${recheck2.seoMetadata.slug}`,
                                                isUser: false,
                                                sender_type: 'system',
                                                timestamp: new Date().toISOString(),
                                                is_read: true,
                                            };
                                            setMessages(prev => [...prev, followUp2]);
                                            if (conversationId) {
                                                saveSystemMessage(conversationId, followUp2.text, supabase);
                                            }
                                        } else {
                                            const sorryMessage: Message = {
                                                id: `sorry_${Date.now()}`,
                                                text: "Sorry it's taking too long! We'll send you the customization link as soon as it's ready!",
                                                isUser: false,
                                                sender_type: 'system',
                                                timestamp: new Date().toISOString(),
                                                is_read: true,
                                            };
                                            setMessages(prev => [...prev, sorryMessage]);
                                            if (conversationId) {
                                                saveSystemMessage(conversationId, sorryMessage.text, supabase);
                                            }
                                        }
                                        pendingImageHashRef.current = null;
                                    }, 6000);
                                }
                                pendingImageHashRef.current = null;
                            }, 11000);
                        }
                    }
                } catch (analysisErr) {
                    console.error('Error analyzing image:', analysisErr);
                    const fallbackMessage: Message = {
                        id: `ai_${Date.now()}`,
                        text: "Thanks for sharing your cake image! Our team will review it and get back to you with pricing shortly.",
                        isUser: false,
                        sender_type: 'system',
                        timestamp: new Date().toISOString(),
                        is_read: true,
                    };
                    setMessages(prev => [...prev, fallbackMessage]);
                    if (conversationId) {
                        saveSystemMessage(conversationId, fallbackMessage.text, supabase);
                    }
                } finally {
                    setIsTyping(false);
                }
            }
        } catch (err) {
            console.error('Error sending image:', err);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
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
                if (conversationId) {
                    saveSystemMessage(conversationId, randomResponse, supabase);
                }
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
                            {messages.map((message) => {
                                const productSlug = !message.isUser && message.text ? extractProductLink(message.text) : null;
                                
                                return (
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
                                        {message.imageUrl && (
                                            <img
                                                src={message.imageUrl}
                                                alt="Image"
                                                className="rounded-lg max-w-full mb-2"
                                            />
                                        )}
                                        {message.text && <p className="text-sm whitespace-pre-wrap">{message.text}</p>}
                                        {productSlug && (
                                            <ProductLinkCard slug={productSlug} supabase={supabase} />
                                        )}
                                        <p className={`text-[10px] mt-1 ${message.isUser ? 'text-purple-200' : 'text-slate-400'}`}>
                                            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                                );
                            })}

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
                    <div className="flex gap-2 items-center">
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                            disabled={isUploading || !conversationId}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading || !conversationId}
                            className="p-2 text-slate-500 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Send image"
                        >
                            {isUploading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <ImageIcon className="w-5 h-5" />
                            )}
                        </button>
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
