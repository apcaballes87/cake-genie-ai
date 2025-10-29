'use client';

import React, { useState } from 'react';
import { CloseIcon, CopyIcon, CheckCircleIcon } from './icons';
import { 
  generateSocialShareUrl, 
  incrementShareCount, 
  SOCIAL_MESSAGES 
} from '../services/shareService';
import { showSuccess } from '../lib/utils/toast';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  designId: string;
  imageUrl: string;
  shareCount?: number;
  botShareUrl?: string; // NEW: Optimized URL for bots
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  shareUrl,
  designId,
  imageUrl,
  shareCount = 0,
  botShareUrl, // NEW
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showSuccess('Link copied to clipboard!');
      incrementShareCount(designId);
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleCopyBotLink = async () => {
  if (!botShareUrl) return;
  try {
    await navigator.clipboard.writeText(botShareUrl);
    setCopied(true);
    showSuccess('SEO-optimized link copied!');
    incrementShareCount(designId);
    setTimeout(() => setCopied(false), 2000);
  } catch (error) {
    console.error('Failed to copy:', error);
  }
};

  const handleSocialShare = (platform: 'facebook' | 'messenger' | 'twitter') => {
    const message = SOCIAL_MESSAGES[platform];
    // Use bot-optimized URL for social sharing if available
    const urlToShare = botShareUrl || shareUrl;
    const url = generateSocialShareUrl(platform, urlToShare, message);
    
    incrementShareCount(designId);
    window.open(url, '_blank', 'width=600,height=400');
  };

  const handleInstagramCopy = async () => {
    try {
      const instagramText = `${SOCIAL_MESSAGES.instagram}\n\n${shareUrl}`;
      await navigator.clipboard.writeText(instagramText);
      showSuccess('Caption and link copied! Paste in Instagram.');
      incrementShareCount(designId);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between rounded-t-2xl">
            <h2 className="text-xl font-bold text-slate-800">
              🎉 Share Your Cake Design!
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              aria-label="Close"
              type="button"
            >
              <CloseIcon className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Preview Image */}
            <div className="relative w-full aspect-square rounded-xl overflow-hidden border-2 border-slate-200">
              <img 
                src={imageUrl} 
                alt="Your cake design" 
                className="w-full h-full object-cover"
              />
            </div>

            {/* SEO Info Banner */}
            {botShareUrl && (
              <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-semibold text-blue-900 mb-1">
                  ✨ Enhanced Social Sharing Active!
                </p>
                <p className="text-xs text-blue-700">
                  Your design will show rich previews on Facebook, Twitter & WhatsApp
                </p>
              </div>
            )}

            {/* Share Count */}
            {shareCount > 0 && (
              <p className="text-center text-sm text-slate-500">
                📊 This design has been shared {shareCount} times!
              </p>
            )}

            {/* Copy Link Button */}
            <button
              onClick={handleCopyLink}
              type="button"
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 rounded-xl transition-colors group"
            >
              <div className="flex items-center gap-3">
                {copied ? (
                  <CheckCircleIcon className="w-6 h-6 text-green-600" />
                ) : (
                  <CopyIcon className="w-6 h-6 text-slate-600" />
                )}
                <div className="text-left">
                  <p className="font-semibold text-slate-800">
                    {copied ? 'Link Copied!' : 'Copy Link'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Perfect for: Anywhere!
                  </p>
                </div>
              </div>
              <span className="text-2xl group-hover:scale-110 transition-transform">
                📋
              </span>
            </button>

            {/* Facebook */}
            <button
              onClick={() => handleSocialShare('facebook')}
              type="button"
              className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-xl transition-colors group"
            >
              <div className="text-left">
                <p className="font-semibold text-blue-900">Share on Facebook</p>
                <p className="text-xs text-blue-700">
                  "Check out my custom cake! 🎂"
                </p>
              </div>
              <span className="text-2xl group-hover:scale-110 transition-transform">
                📘
              </span>
            </button>

            {/* Messenger */}
            <button
              onClick={() => handleSocialShare('messenger')}
              type="button"
              className="w-full flex items-center justify-between p-4 bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 rounded-xl transition-colors group"
            >
              <div className="text-left">
                <p className="font-semibold text-indigo-900">Share on Messenger</p>
                <p className="text-xs text-indigo-700">
                  "What do you think? 😍"
                </p>
              </div>
              <span className="text-2xl group-hover:scale-110 transition-transform">
                💬
              </span>
            </button>

            {/* Twitter */}
            <button
              onClick={() => handleSocialShare('twitter')}
              type="button"
              className="w-full flex items-center justify-between p-4 bg-sky-50 hover:bg-sky-100 border-2 border-sky-200 rounded-xl transition-colors group"
            >
              <div className="text-left">
                <p className="font-semibold text-sky-900">Share on Twitter/X</p>
                <p className="text-xs text-sky-700">
                  "I designed the perfect cake! 🎂✨"
                </p>
              </div>
              <span className="text-2xl group-hover:scale-110 transition-transform">
                🐦
              </span>
            </button>

            {/* Instagram */}
            <button
              onClick={handleInstagramCopy}
              type="button"
              className="w-full flex items-center justify-between p-4 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-2 border-pink-200 rounded-xl transition-colors group"
            >
              <div className="text-left">
                <p className="font-semibold text-pink-900">Copy for Instagram</p>
                <p className="text-xs text-pink-700">
                  Link for bio + caption
                </p>
              </div>
              <span className="text-2xl group-hover:scale-110 transition-transform">
                📸
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-in {
          from { 
            opacity: 0;
            transform: scale(0.9);
          }
          to { 
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </>
  );
};