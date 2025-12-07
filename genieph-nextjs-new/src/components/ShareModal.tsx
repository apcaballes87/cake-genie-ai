'use client';

import React, { useState, useEffect } from 'react';
import { CloseIcon, CopyIcon, CheckCircleIcon, Loader2 } from './icons';
import {
  ShareResult,
  generateSocialShareUrl,
  incrementShareCount,
  SOCIAL_MESSAGES,
} from '@/services/shareService';
import { showSuccess } from '@/lib/utils/toast';
import LazyImage from './LazyImage';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  shareData: ShareResult | null;
  onCreateLink: () => void;
  isSaving: boolean;
  finalPrice: number | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  shareData,
  onCreateLink,
  isSaving,
  finalPrice,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const urlToShare = shareData?.botShareUrl || shareData?.shareUrl;

  const handleCopyLink = async () => {
    if (!urlToShare || !shareData) return;
    try {
      await navigator.clipboard.writeText(urlToShare);
      setCopied(true);
      showSuccess('Link copied to clipboard!');
      incrementShareCount(shareData.designId);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleSocialShare = (platform: 'facebook' | 'messenger' | 'twitter') => {
    if (!urlToShare || !shareData) return;
    const message = SOCIAL_MESSAGES[platform];
    const url = generateSocialShareUrl(platform, urlToShare, message);
    incrementShareCount(shareData.designId);
    window.open(url, '_blank', 'width=600,height=400');
  };

  const handleInstagramCopy = async () => {
    if (!urlToShare || !shareData) return;
    try {
      const instagramText = `${SOCIAL_MESSAGES.instagram}\n\n${urlToShare}`;
      await navigator.clipboard.writeText(instagramText);
      showSuccess('Caption and link copied! Paste in Instagram.');
      incrementShareCount(shareData.designId);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Helper for toast notifications since we removed the import to avoid circular dependencies if any, 
  // but actually we should import it. 
  // Re-adding import { showSuccess } from '../lib/utils/toast';

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
          <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-bold text-slate-800">
              {shareData ? '🎉 Share Your Cake!' : 'Share Design'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors" type="button">
              <CloseIcon className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {shareData ? (
            // VIEW 2: Display Link
            <div className="p-6 space-y-4">
              <LazyImage src={imageUrl} alt="Your cake design" className="w-full aspect-square object-cover rounded-xl border-2 border-slate-200" />
              {shareData.botShareUrl && (
                <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-900 mb-1">✨ Enhanced Social Sharing Active!</p>
                  <p className="text-xs text-blue-700">Your design will show rich previews on Facebook, Twitter & WhatsApp.</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Share this link:</p>
                <div className="flex gap-2">
                  <input value={urlToShare} readOnly className="flex-1 w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none" />
                  <button onClick={handleCopyLink} className="p-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors">
                    {copied ? <CheckCircleIcon className="w-5 h-5 text-green-600" /> : <CopyIcon className="w-5 h-5 text-slate-600" />}
                  </button>
                </div>
              </div>
              <button onClick={() => handleSocialShare('facebook')} type="button" className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 border-2 border-blue-200 rounded-xl transition-colors group">
                <div className="text-left"><p className="font-semibold text-blue-900">Share on Facebook</p><p className="text-xs text-blue-700">"Check out my custom cake! 🎂"</p></div><span className="text-2xl group-hover:scale-110 transition-transform">📘</span>
              </button>
              <button onClick={() => handleSocialShare('messenger')} type="button" className="w-full flex items-center justify-between p-4 bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 rounded-xl transition-colors group">
                <div className="text-left"><p className="font-semibold text-indigo-900">Share on Messenger</p><p className="text-xs text-indigo-700">"What do you think? 😍"</p></div><span className="text-2xl group-hover:scale-110 transition-transform">💬</span>
              </button>
              <button onClick={() => handleSocialShare('twitter')} type="button" className="w-full flex items-center justify-between p-4 bg-sky-50 hover:bg-sky-100 border-2 border-sky-200 rounded-xl transition-colors group">
                <div className="text-left"><p className="font-semibold text-sky-900">Share on Twitter/X</p><p className="text-xs text-sky-700">"I designed the perfect cake! 🎂✨"</p></div><span className="text-2xl group-hover:scale-110 transition-transform">🐦</span>
              </button>
              <button onClick={handleInstagramCopy} type="button" className="w-full flex items-center justify-between p-4 bg-gradient-to-br from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-2 border-pink-200 rounded-xl transition-colors group">
                <div className="text-left"><p className="font-semibold text-pink-900">Copy for Instagram</p><p className="text-xs text-pink-700">Link for bio + caption</p></div><span className="text-2xl group-hover:scale-110 transition-transform">📸</span>
              </button>
            </div>
          ) : (
            // VIEW 1: Simple Create Link
            <div className="p-6 space-y-4">
              <LazyImage src={imageUrl} alt="Your cake design" className="w-full aspect-square object-cover rounded-xl border-2 border-slate-200" />
              <p className="text-sm text-slate-600 text-center">
                Create a shareable link for your custom cake design to show your friends and family!
              </p>
              <button
                onClick={onCreateLink}
                disabled={isSaving}
                className="w-full flex items-center justify-center bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Share Link'}
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s ease-out; }
      `}</style>
    </>
  );
};



export default ShareModal;
