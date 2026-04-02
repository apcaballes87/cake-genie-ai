'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, MessageCircle, Send, X, Clock, CheckCircle, Search, User, Mail, ArrowLeft } from 'lucide-react';

interface ChatMessage {
    id: string;
    conversation_id: string;
    content: string;
    sender_type: 'customer' | 'merchant' | 'system';
    is_read: boolean;
    created_at: string;
}

interface ChatConversation {
    id: string;
    user_id: string | null;
    session_id: string | null;
    customer_email: string | null;
    customer_name: string | null;
    status: 'active' | 'closed' | 'archived';
    created_at: string;
    updated_at: string;
    chat_messages?: ChatMessage[];
}

const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const ChatManagementClient: React.FC = () => {
    const [conversations, setConversations] = useState<ChatConversation[]>([]);
    const [selectedConvo, setSelectedConvo] = useState<ChatConversation | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
    const supabase = createClient();

    useEffect(() => {
        loadConversations();
    }, []);

    const loadConversations = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/chat');
            const result = await response.json();
            if (result.success && result.data) {
                setConversations(result.data);
            }
        } catch (err) {
            console.error('Error loading conversations:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadConversation = async (convo: ChatConversation) => {
        setSelectedConvo(convo);
        try {
            const response = await fetch(`/api/chat/${convo.id}`);
            const result = await response.json();
            if (result.success && result.data) {
                setMessages(result.data.messages || []);
            }
        } catch (err) {
            console.error('Error loading conversation:', err);
        }
    };

    const sendReply = async () => {
        if (!newMessage.trim() || !selectedConvo) return;

        setIsSending(true);
        try {
            const response = await fetch(`/api/chat/${selectedConvo.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send_merchant_reply',
                    content: newMessage.trim(),
                }),
            });

            const result = await response.json();
            if (result.success && result.data) {
                setMessages(prev => [...prev, result.data]);
                setNewMessage('');
            }
        } catch (err) {
            console.error('Error sending reply:', err);
        } finally {
            setIsSending(false);
        }
    };

    const updateStatus = async (convoId: string, status: 'active' | 'closed' | 'archived') => {
        try {
            const response = await fetch(`/api/chat/${convoId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_status',
                    status,
                }),
            });

            const result = await response.json();
            if (result.success) {
                setConversations(prev => prev.map(c => 
                    c.id === convoId ? { ...c, status } : c
                ));
                if (selectedConvo?.id === convoId) {
                    setSelectedConvo(prev => prev ? { ...prev, status } : null);
                }
            }
        } catch (err) {
            console.error('Error updating status:', err);
        }
    };

    const filteredConversations = conversations.filter(c => {
        const matchesSearch = !searchQuery || 
            (c.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (c.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getLastMessage = (convo: ChatConversation) => {
        const msgs = convo.chat_messages;
        if (!msgs || msgs.length === 0) return 'No messages';
        return msgs[msgs.length - 1].content.substring(0, 50) + (msgs[msgs.length - 1].content.length > 50 ? '...' : '');
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="flex h-[calc(100vh-64px)]">
                {/* Conversation List */}
                <div className={`w-full md:w-1/3 border-r border-slate-200 bg-white flex flex-col ${selectedConvo ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-200">
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Customer Chats</h2>
                        
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                            
                            <div className="flex gap-2">
                                {(['all', 'active', 'closed'] as const).map(status => (
                                    <button
                                        key={status}
                                        onClick={() => setStatusFilter(status)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                            statusFilter === status
                                                ? 'bg-purple-100 text-purple-700'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-slate-500">
                                <MessageCircle className="w-12 h-12 mb-2 text-slate-300" />
                                <p className="text-sm">No conversations found</p>
                            </div>
                        ) : (
                            filteredConversations.map(convo => (
                                <button
                                    key={convo.id}
                                    onClick={() => loadConversation(convo)}
                                    className={`w-full p-4 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                                        selectedConvo?.id === convo.id ? 'bg-purple-50' : ''
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                                                    {convo.customer_name?.charAt(0).toUpperCase() || convo.customer_email?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-slate-800 truncate">
                                                        {convo.customer_name || convo.customer_email || 'Guest'}
                                                    </p>
                                                    <p className="text-xs text-slate-400">
                                                        {formatTime(convo.updated_at)}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-sm text-slate-500 mt-1 truncate">
                                                {getLastMessage(convo)}
                                            </p>
                                        </div>
                                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                                            convo.status === 'active' 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {convo.status}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Detail */}
                <div className={`w-full md:w-2/3 bg-slate-50 flex flex-col ${!selectedConvo ? 'hidden md:flex' : 'flex'}`}>
                    {selectedConvo ? (
                        <>
                            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setSelectedConvo(null)}
                                        className="md:hidden p-2 hover:bg-slate-100 rounded-lg"
                                    >
                                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                                    </button>
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold">
                                        {selectedConvo.customer_name?.charAt(0).toUpperCase() || selectedConvo.customer_email?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800">
                                            {selectedConvo.customer_name || 'Guest'}
                                        </p>
                                        {selectedConvo.customer_email && (
                                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                                <Mail className="w-3 h-3" />
                                                {selectedConvo.customer_email}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <select
                                        value={selectedConvo.status}
                                        onChange={(e) => updateStatus(selectedConvo.id, e.target.value as any)}
                                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="active">Active</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                {messages.map(msg => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.sender_type === 'merchant' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                                                msg.sender_type === 'merchant'
                                                    ? 'bg-purple-600 text-white rounded-br-md'
                                                    : msg.sender_type === 'system'
                                                    ? 'bg-purple-100 text-purple-800 border border-purple-200 rounded-bl-md'
                                                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
                                            }`}
                                        >
                                            <p className="text-sm">{msg.content}</p>
                                            <p className={`text-[10px] mt-1 ${
                                                msg.sender_type === 'merchant' ? 'text-purple-200' : 'text-slate-400'
                                            }`}>
                                                {new Date(msg.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 border-t border-slate-200 bg-white">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                                        placeholder="Type your reply..."
                                        className="flex-1 px-4 py-2 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                    <button
                                        onClick={sendReply}
                                        disabled={!newMessage.trim() || isSending}
                                        className="px-4 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isSending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Send className="w-4 h-4" />
                                        )}
                                        <span className="text-sm font-medium">Send</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                            <MessageCircle className="w-16 h-16 mb-4 text-slate-300" />
                            <p className="font-medium">Select a conversation to view messages</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChatManagementClient;
