'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CloseIcon, MessageCircle, Loader2, SendIcon, ImageIcon } from './icons';
import { createClient } from '@/lib/supabase/client';
import { fileToBase64, analyzeCakeFeaturesOnly, enrichAnalysisWithRoboflow, validateCakeImage } from '@/services/geminiService';
import { findAnalysisByExactHash, findSimilarAnalysisByHash, cacheAnalysisResult } from '@/services/supabaseService';
import { HybridAnalysisResult } from '@/types';
import { compressImage, dataURItoBlob } from '@/lib/utils/imageOptimization';
import { hasBoundingBoxData } from '@/lib/utils/analysisUtils';
import { ChatMessageText } from './ChatMessageText';
import { getCustomerChatImageExtension, prepareCustomerChatImage } from './customerChatImage';
import {
    generateServerImageFingerprint,
    toFingerprintLookup,
} from '@/lib/utils/serverFingerprint.client';
import Link from 'next/link';
import { getBrowserChatPageContext } from '@/lib/chatbot/pageContext';
import { getChatImageObjectPath } from '@/lib/chatbot/attachments';

interface ChatMessage {
    id: string;
    content: string;
    image_url: string | null;
    sender_type: 'customer' | 'merchant' | 'system' | 'assistant';
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
    sender_type: 'customer' | 'merchant' | 'system' | 'assistant';
    timestamp: string;
    is_read: boolean;
    is_sent?: boolean;
}

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId?: string;
    userEmail?: string;
    userName?: string;
}

const CHAT_IMAGE_CLASSIFICATION_MESSAGES: Record<string, string> = {
    payment_receipt: "Thanks for sending your payment screenshot. We received it and will confirm your payment shortly.",
    edible_photo_reference: "Thanks for sending your edible photo image. We saved it and our team will check it for printing suitability.",
    not_a_cake: "Thanks for sending the image. If this is for cake pricing, please upload a single cake design. If it's for an edible photo or payment proof, you can send that too.",
    non_food: "Thanks for sending the image. If this is for cake pricing, please upload a single cake design. If it's for an edible photo or payment proof, you can send that too.",
    multiple_cakes: "Please send one cake image at a time for price analysis so we can generate the correct customization link.",
    only_cupcakes: "We can’t run price analysis on cupcake-only images in chat yet. Please send a full cake design instead.",
    complex_sculpture: "Thanks for sending the cake design. This one is too complex for automatic chat analysis, so our team will review it manually.",
    large_wedding_cake: "Thanks for sending the cake design. Large wedding cakes need manual review, so our team will check it and get back to you.",
};

const CHAT_IMAGE_MANUAL_REVIEW_MESSAGE = "Thanks for sharing your cake image! Our team will review it and get back to you with pricing shortly.";
const CHAT_IMAGE_FINALIZING_MESSAGE = "⏳ I've analyzed your cake image! I'm finalizing the customization link and will send it here shortly.";
const CHAT_IMAGE_VALIDATION_FALLBACK_MESSAGE = "Thanks for sending the image. We couldn't automatically identify it yet. If this is for cake pricing, please upload a single cake design. If it's for an edible photo or payment proof, you can send that too.";

type ImageAnalysisNoticeType = keyof typeof CHAT_IMAGE_CLASSIFICATION_MESSAGES
    | 'validation_fallback'
    | 'manual_review'
    | 'finalizing'
    | 'analyzed';

function formatChatCustomizationLinkMessage(title: string | null, price: number | null, slug: string): string {
    const priceDisplay = price ? `₱${Math.round(price).toLocaleString()}` : 'Check price';
    const safeTitle = title || 'Your cake design';
    return `🎂 I analyzed your cake image! Here's what I found:\n\n**${safeTitle}**\n\n💰 Starting at: ${priceDisplay}\n\n🔗 View and customize: https://genie.ph/customizing/${slug}`;
}

function getChatImageAnalysisErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        if (error.message.startsWith('AI_REJECTION:')) {
            return error.message.replace('AI_REJECTION: ', '');
        }

        if (error.message.includes('failed to validate the image') || error.message.includes('Failed to validate image')) {
            return CHAT_IMAGE_VALIDATION_FALLBACK_MESSAGE;
        }
    }

    return CHAT_IMAGE_MANUAL_REVIEW_MESSAGE;
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

async function requestImageAnalysisNotice(
    conversationId: string,
    noticeType: ImageAnalysisNoticeType,
    slug?: string | null,
): Promise<string | null> {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get_image_analysis_notice',
                conversationId,
                noticeType,
                slug: slug || undefined,
            }),
        });

        const result = await response.json();
        if (result.success && typeof result.data?.content === 'string') {
            return result.data.content;
        }
        console.error('Error getting image-analysis notice:', result.error);
        return null;
    } catch (err) {
        console.error('Error getting image-analysis notice:', err);
        return null;
    }
}

async function generateStableFallbackHash(base64Data: string): Promise<string | null> {
    try {
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest))
            .slice(0, 8)
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    } catch (error) {
        console.warn('⚠️ Chat: failed to generate fallback image hash', error);
        return null;
    }
}

async function analyzeImageWithCache(
    imageData: { data: string; mimeType: string },
    imageUrl?: string,
    preparedFile?: File,
): Promise<{ analysis: HybridAnalysisResult | null; slug: string | null; title: string | null; price: number | null; imageUrl: string | null; cacheKey: string | null; pipeline?: string | null }> {
    const file = preparedFile || new File([
        dataURItoBlob(`data:${imageData.mimeType};base64,${imageData.data}`),
    ], 'chat-image.webp', { type: imageData.mimeType });
    const compressedFile = preparedFile || await compressImage(file, { maxSizeMB: 0.5, maxWidthOrHeight: 1024, fileType: 'image/webp' });
    const compressedData = preparedFile
        ? imageData
        : await fileToBase64(new File([compressedFile], 'chat-image.webp', { type: 'image/webp' }));
    const fingerprint = await generateServerImageFingerprint(compressedFile);
    const cacheKey = fingerprint.pHash
        ?? await generateStableFallbackHash(imageData.data);
    console.log(
        `🖼️ Chat hash result: ${
            fingerprint.pHash
                ? `${fingerprint.pHash} (server)`
                : cacheKey
                    ? `${cacheKey} (stable fallback)`
                    : 'FAILED (null)'
        }`
    );

    if (fingerprint.pHash) {
        const cacheHit = await findSimilarAnalysisByHash(toFingerprintLookup(fingerprint), imageUrl);
        if (cacheHit) {
            console.log('⚡ Chat: pHash Cache Hit! Using cached analysis.');
            return {
                analysis: cacheHit.analysisResult,
                slug: cacheHit.seoMetadata.slug,
                title: cacheHit.seoMetadata.seo_title,
                price: cacheHit.seoMetadata.price,
                imageUrl: cacheHit.seoMetadata.original_image_url,
                cacheKey,
                pipeline: fingerprint.pipeline,
            };
        }
    } else {
        console.log('ℹ️ Chat: skipping similarity cache lookup because no fingerprint candidate was available.');
    }

    console.log('🔄 Chat: Cache miss, running AI analysis...');
    const fastResult = await analyzeCakeFeaturesOnly(compressedData.data, compressedData.mimeType);
    if (!fastResult) return { analysis: null, slug: null, title: null, price: null, imageUrl: null, cacheKey, pipeline: fingerprint.pipeline };
    let finalResult = fastResult;
    const hasBbox = hasBoundingBoxData(fastResult);
    if (!hasBbox) {
        try {
            finalResult = await enrichAnalysisWithRoboflow(compressedData.data, compressedData.mimeType, fastResult);
        } catch {
            console.warn('Chat: enrichment failed, using fast result');
        }
    }
    if (fingerprint.pHash && finalResult) {
        const cached = await cacheAnalysisResult(fingerprint.pHash, finalResult, imageUrl, compressedFile, {
            fingerprintPipeline: fingerprint.pipeline,
        });
        if (cached) {
            return {
                analysis: finalResult,
                slug: cached.slug,
                title: cached.seo_title,
                price: cached.price,
                imageUrl: cached.original_image_url,
                cacheKey,
                pipeline: fingerprint.pipeline,
            };
        }
    }

    return { analysis: finalResult, slug: null, title: null, price: null, imageUrl: null, cacheKey, pipeline: fingerprint.pipeline };
}

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isLocalStorageLoaded, setIsLocalStorageLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const pendingImageHashRef = useRef<string | null>(null);
    const activeImageAnalysisIdRef = useRef(0);
    const pendingFollowUpTimeoutsRef = useRef<number[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const supabase = createClient();

    const clearPendingImageFollowUps = () => {
        pendingFollowUpTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
        pendingFollowUpTimeoutsRef.current = [];
        pendingImageHashRef.current = null;
    };

    useEffect(() => {
        setIsLocalStorageLoaded(true);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!conversationId || !supabase) return;

        const channel = supabase
            .channel('chat-messages-realtime')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                async (payload) => {
                    const newMessage = payload.new as ChatMessage;
                    if (newMessage.sender_type !== 'customer') {
                        let resolvedImageUrl = newMessage.image_url;
                        const attachmentReference = getChatImageObjectPath(resolvedImageUrl);
                        if (attachmentReference) {
                            try {
                                const response = await fetch(`/api/chat/attachments?conversationId=${encodeURIComponent(conversationId)}&path=${encodeURIComponent(attachmentReference)}`);
                                const result = await response.json();
                                resolvedImageUrl = result.data?.signedUrl || null;
                            } catch {
                                resolvedImageUrl = null;
                            }
                        }
                        setMessages((prev) => {
                            if (prev.some((m) => m.id === newMessage.id)) return prev;
                            const newMsg: Message = {
                                id: newMessage.id,
                                text: newMessage.content,
                                imageUrl: resolvedImageUrl || undefined,
                                isUser: false,
                                sender_type: newMessage.sender_type as 'merchant' | 'system' | 'assistant',
                                timestamp: newMessage.created_at,
                                is_read: newMessage.is_read,
                                is_sent: true,
                            };
                            return [...prev, newMsg];
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => {
                    const updatedMessage = payload.new as ChatMessage;
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === updatedMessage.id ? { ...m, is_read: updatedMessage.is_read } : m
                        )
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId, supabase]);

    useEffect(() => {
        if (isOpen && isLocalStorageLoaded) {
            loadOrCreateConversation();
        } else if (!isOpen) {
            clearPendingImageFollowUps();
            setMessages([]);
            setConversationId(null);
            setIsLoading(true);
        }
    }, [isOpen, isLocalStorageLoaded]);

    useEffect(() => {
        return () => {
            clearPendingImageFollowUps();
        };
    }, []);

    const loadOrCreateConversation = async () => {
        setIsLoading(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) {
                const { error: anonymousAuthError } = await supabase.auth.signInAnonymously();
                if (anonymousAuthError) throw anonymousAuthError;
            }
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start_conversation',
                    pageContext: getBrowserChatPageContext(),
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
                is_sent: true,
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
                    is_sent: true,
                })));

                await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'mark_read',
                        conversationId: convoId,
                    }),
                });
            }
        } catch (err) {
            console.error('Error loading messages:', err);
        }
    };

    const uploadImage = async (file: File): Promise<{ reference: string; signedUrl: string } | null> => {
        if (!conversationId) return null;
        const formData = new FormData();
        formData.set('conversationId', conversationId);
        formData.set('file', file, `customer-chat.${getCustomerChatImageExtension(file)}`);
        const response = await fetch('/api/chat/attachments', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok || !result.success || !result.data?.reference || !result.data?.signedUrl) {
            console.error('Error uploading image:', result.error);
            return null;
        }
        return result.data;
    };

    const queueImageLinkFollowUp = (analysisId: number, cacheKey: string, pipeline?: string | null) => {
        pendingImageHashRef.current = cacheKey;

        const followUpTimeout = window.setTimeout(async () => {
            if (analysisId !== activeImageAnalysisIdRef.current || pendingImageHashRef.current !== cacheKey) {
                return;
            }

            const recheck = pipeline
                ? await findSimilarAnalysisByHash({ pHash: cacheKey, pipeline })
                : await findAnalysisByExactHash(cacheKey);

            if (analysisId !== activeImageAnalysisIdRef.current || pendingImageHashRef.current !== cacheKey) {
                return;
            }

            const followUpText = recheck?.seoMetadata.slug
                ? formatChatCustomizationLinkMessage(
                    recheck.seoMetadata.seo_title,
                    recheck.seoMetadata.price,
                    recheck.seoMetadata.slug
                )
                : CHAT_IMAGE_MANUAL_REVIEW_MESSAGE;

            const followUpMessage: Message = {
                id: `followup_${Date.now()}`,
                text: followUpText,
                isUser: false,
                sender_type: 'system',
                timestamp: new Date().toISOString(),
                is_read: true,
            };

            setMessages((prev) => [...prev, followUpMessage]);

            if (conversationId) {
                requestImageAnalysisNotice(
                    conversationId,
                    recheck?.seoMetadata.slug ? 'analyzed' : 'manual_review',
                    recheck?.seoMetadata.slug,
                );
            }

            pendingImageHashRef.current = null;
            pendingFollowUpTimeoutsRef.current = pendingFollowUpTimeoutsRef.current.filter(
                (timeoutId) => timeoutId !== followUpTimeout
            );
        }, 4000);

        pendingFollowUpTimeoutsRef.current.push(followUpTimeout);
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !conversationId) return;

        clearPendingImageFollowUps();
        const analysisId = ++activeImageAnalysisIdRef.current;
        setIsUploading(true);

        try {
            const preparedFile = await prepareCustomerChatImage(file);
            const uploadedImage = await uploadImage(preparedFile);
            if (uploadedImage) {
                const imageUrl = uploadedImage.signedUrl;
                const userMessage: Message = {
                    id: `temp_${Date.now()}`,
                    text: inputValue || '',
                    imageUrl,
                    isUser: true,
                    sender_type: 'customer',
                    timestamp: new Date().toISOString(),
                    is_read: false,
                    is_sent: false,
                };

                setMessages(prev => [...prev, userMessage]);

                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'send_message',
                        conversationId,
                        content: inputValue || '',
                        attachmentReference: uploadedImage.reference,
                        clientMessageId: crypto.randomUUID(),
                        pageContext: getBrowserChatPageContext(),
                    }),
                });

                const result = await response.json();
                if (result.success && result.data) {
                    setMessages(prev => prev.map(msg =>
                        msg.id === userMessage.id ? { ...msg, id: result.data.id, is_sent: true } : msg
                    ));
                }

                setIsTyping(true);
                try {
                    const fileData = await fileToBase64(preparedFile);
                    let imageClassification: string;
                    try {
                        imageClassification = await validateCakeImage(fileData.data, fileData.mimeType, 'chat');
                    } catch (validationErr) {
                        console.error('Error validating image before analysis:', validationErr);
                        if (analysisId !== activeImageAnalysisIdRef.current) return;

                        const validationFallbackMessage: Message = {
                            id: `ai_${Date.now()}`,
                            text: CHAT_IMAGE_VALIDATION_FALLBACK_MESSAGE,
                            isUser: false,
                            sender_type: 'system',
                            timestamp: new Date().toISOString(),
                            is_read: true,
                        };

                        setMessages(prev => [...prev, validationFallbackMessage]);
                        if (conversationId) {
                            requestImageAnalysisNotice(conversationId, 'validation_fallback');
                        }
                        return;
                    }

                    if (analysisId !== activeImageAnalysisIdRef.current) return;

                    if (imageClassification !== 'valid_single_cake') {
                        const nonCakeReply = CHAT_IMAGE_CLASSIFICATION_MESSAGES[imageClassification]
                            ?? "Thanks for sending the image. Our team received it and will review it shortly.";

                        const botMessage: Message = {
                            id: `ai_${Date.now()}`,
                            text: nonCakeReply,
                            isUser: false,
                            sender_type: 'system',
                            timestamp: new Date().toISOString(),
                            is_read: true,
                        };
                        setMessages(prev => [...prev, botMessage]);

                        if (conversationId) {
                            const noticeType = Object.hasOwn(CHAT_IMAGE_CLASSIFICATION_MESSAGES, imageClassification)
                                ? imageClassification as keyof typeof CHAT_IMAGE_CLASSIFICATION_MESSAGES
                                : 'manual_review';
                            requestImageAnalysisNotice(conversationId, noticeType);
                        }
                        return;
                    }

                    const analysisResult = await analyzeImageWithCache(fileData, imageUrl, preparedFile);
                    if (analysisId !== activeImageAnalysisIdRef.current) return;

                    let botResponse = '';
                    if (analysisResult.analysis && analysisResult.slug) {
                        botResponse = formatChatCustomizationLinkMessage(
                            analysisResult.title,
                            analysisResult.price,
                            analysisResult.slug
                        );
                    } else if (analysisResult.analysis) {
                        botResponse = CHAT_IMAGE_FINALIZING_MESSAGE;
                    } else {
                        botResponse = CHAT_IMAGE_MANUAL_REVIEW_MESSAGE;
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
                        requestImageAnalysisNotice(
                            conversationId,
                            analysisResult.analysis && analysisResult.slug
                                ? 'analyzed'
                                : analysisResult.analysis
                                    ? 'finalizing'
                                    : 'manual_review',
                            analysisResult.slug,
                        );
                    }

                    if (analysisResult.analysis && !analysisResult.slug && analysisResult.cacheKey) {
                        queueImageLinkFollowUp(analysisId, analysisResult.cacheKey, analysisResult.pipeline);
                    }
                } catch (analysisErr) {
                    console.error('Error analyzing image:', analysisErr);
                    if (analysisId !== activeImageAnalysisIdRef.current) return;
                    const errorMessage = getChatImageAnalysisErrorMessage(analysisErr);
                    const fallbackMessage: Message = {
                        id: `ai_${Date.now()}`,
                        text: errorMessage,
                        isUser: false,
                        sender_type: 'system',
                        timestamp: new Date().toISOString(),
                        is_read: true,
                    };
                    setMessages(prev => [...prev, fallbackMessage]);
                    if (conversationId) {
                        requestImageAnalysisNotice(
                            conversationId,
                            errorMessage === CHAT_IMAGE_VALIDATION_FALLBACK_MESSAGE ? 'validation_fallback' : 'manual_review',
                        );
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
            is_read: false,
            is_sent: false,
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
                    clientMessageId: crypto.randomUUID(),
                    pageContext: getBrowserChatPageContext(),
                }),
            });

            const result = await response.json();
            if (result.success && result.data) {
                setMessages(prev => prev.map(msg =>
                    msg.id === userMessage.id ? { ...msg, id: result.data.id, is_sent: true } : msg
                ));
            }

            setIsTyping(false);
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

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 transition-opacity duration-200 animate-fade-in"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-[575px] flex flex-col overflow-hidden animate-fade-in"
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
                                            className={`max-w-[80%] px-4 py-2 rounded-2xl ${message.isUser
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
                                            {message.text && (
                                                <ChatMessageText
                                                    text={message.text}
                                                    linkClassName={message.isUser
                                                        ? 'text-white underline decoration-white/70 hover:text-purple-100'
                                                        : 'text-purple-700 underline hover:text-purple-900'}
                                                />
                                            )}
                                            {message.sender_type === 'assistant' && (
                                                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-purple-600">
                                                    Genie Assistant
                                                </p>
                                            )}
                                            {productSlug && (
                                                <ProductLinkCard slug={productSlug} supabase={supabase} />
                                            )}
                                            <p className={`text-[10px] mt-1 flex items-center gap-1 ${message.isUser ? 'text-purple-200' : 'text-slate-400'}`}>
                                                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {message.isUser && (
                                                    <span className="flex items-center">
                                                        {message.is_sent ? (
                                                            message.is_read ? (
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                </svg>
                                                            ) : (
                                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )
                                                        ) : (
                                                            <svg className="w-3 h-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                            </svg>
                                                        )}
                                                    </span>
                                                )}
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
                    <button
                        type="button"
                        onClick={async () => {
                            if (!conversationId) return;
                            await fetch('/api/chat', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'request_human', conversationId }),
                            });
                        }}
                        className="mt-1 w-full text-center text-xs font-medium text-purple-700 hover:underline"
                    >
                        Talk to a person
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatModal;
