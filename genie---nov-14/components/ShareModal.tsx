// components/ShareModal.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
// FIX: Removed MapPin and Plus from icons import and added Plus from lucide-react.
import { CloseIcon, CopyIcon, CheckCircleIcon, Loader2 } from './icons';
import { Plus } from 'lucide-react';
import {
  ShareResult,
  generateSocialShareUrl,
  incrementShareCount,
  SOCIAL_MESSAGES,
} from '../services/shareService';
// FIX: Moved delivery date related imports from shareService to supabaseService.
import {
  getAvailableDeliveryDates,
  getBlockedDatesInRange,
  AvailableDate,
  BlockedDateInfo,
} from '../services/supabaseService';
import { showSuccess, showError } from '../lib/utils/toast';
import LazyImage from './LazyImage';
import { AvailabilityType } from '../lib/utils/availability';
import { useAddresses } from '../hooks/useAddresses';
import { useAvailabilitySettings } from '../hooks/useAvailabilitySettings';
import { CakeGenieAddress } from '../lib/database.types';
import AddressForm, { StaticMap } from './AddressForm';

const EVENT_TIME_SLOTS_MAP: { slot: string; startHour: number; endHour: number }[] = [
    { slot: "10AM - 12NN", startHour: 10, endHour: 12 },
    { slot: "12NN - 2PM", startHour: 12, endHour: 14 },
    { slot: "2PM - 4PM", startHour: 14, endHour: 16 },
    { slot: "4PM - 6PM", startHour: 16, endHour: 18 },
    { slot: "6PM - 8PM", startHour: 18, endHour: 20 },
];
const EVENT_TIME_SLOTS = EVENT_TIME_SLOTS_MAP.map(item => item.slot);


interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  shareData: ShareResult | null;
  onCreateLink: (config: {
    billSharingEnabled: boolean;
    billSharingMessage?: string;
    suggestedSplitCount?: number;
    deliveryAddress?: string;
    deliveryCity?: string;
    deliveryPhone?: string;
    eventDate?: string;
    eventTime?: string;
    recipientName?: string;
  }) => void;
  isSaving: boolean;
  finalPrice: number | null;
  user: any | null;
  onAuthRequired: () => void;
  availability: AvailabilityType;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  shareData,
  onCreateLink,
  isSaving,
  finalPrice,
  user,
  onAuthRequired,
  availability,
}) => {
  const [copied, setCopied] = useState(false);
  const [billSharingEnabled, setBillSharingEnabled] = useState(false);
  const [billSharingMessage, setBillSharingMessage] = useState('');
  const [suggestedSplitCount, setSuggestedSplitCount] = useState('');
  
  // New state for delivery details, mirroring cart page
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [partiallyBlockedSlots, setPartiallyBlockedSlots] = useState<BlockedDateInfo[]>([]);
  const [tooltip, setTooltip] = useState<{ date: string; reason: string; } | null>(null);

  const isRegisteredUser = user && !user.is_anonymous;
  const { data: savedAddresses = [], isLoading: isAddressesLoading } = useAddresses(user?.id);
  const { settings: availabilitySettings, loading: isLoadingSettings } = useAvailabilitySettings();

  const { data: availableDates = [], isLoading: isLoadingDates } = useQuery<AvailableDate[]>({
      queryKey: ['available-dates', availabilitySettings?.minimum_lead_time_days],
      queryFn: () => {
          const startDate = new Date();
          const year = startDate.getFullYear();
          const month = String(startDate.getMonth() + 1).padStart(2, '0');
          const day = String(startDate.getDate()).padStart(2, '0');
          return getAvailableDeliveryDates(`${year}-${month}-${day}`, 31);
      },
      enabled: !isLoadingSettings && isOpen && billSharingEnabled,
      staleTime: 5 * 60 * 1000,
  });

  const { data: blockedDatesMap, isLoading: isLoadingBlockedDates } = useQuery({
      queryKey: ['blocked-dates-range'],
      queryFn: () => {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(startDate.getDate() + 31);
          const format = (d: Date) => d.toISOString().split('T')[0];
          return getBlockedDatesInRange(format(startDate), format(endDate));
      },
      enabled: isOpen && billSharingEnabled,
      staleTime: 5 * 60 * 1000,
  });
  
  const correctedDates = useMemo(() => {
    if (isLoadingDates || !availabilitySettings) return availableDates;

    if (availability === 'normal') {
        return availableDates;
    }
    
    const leadTimeDays = availabilitySettings.minimum_lead_time_days || 0;
    if (leadTimeDays === 0) {
        return availableDates;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return availableDates.map(dateInfo => {
        const date = new Date(dateInfo.available_date + 'T00:00:00');
        const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays >= 0 && diffDays < leadTimeDays) {
            const isFullyBlockedByBackend = !dateInfo.is_rush_available && !dateInfo.is_same_day_available && !dateInfo.is_standard_available;
            if (isFullyBlockedByBackend && diffDays > 0) {
                return { ...dateInfo, is_rush_available: true, is_same_day_available: true };
            }
        }
        return dateInfo;
    });
  }, [availableDates, isLoadingDates, availability, availabilitySettings]);

  const handleDateSelect = useCallback((date: string) => {
      setEventDate(date);
      const blocks = blockedDatesMap?.[date] || [];
      const partials = blocks.filter(b => !b.is_all_day);
      setPartiallyBlockedSlots(partials);
  }, [setEventDate, blockedDatesMap]);

  const getDateStatus = useCallback((dateInfo: AvailableDate) => {
      const date = dateInfo.available_date;
      const blocksOnDate = blockedDatesMap?.[date];
      const isFullyBlocked = blocksOnDate?.some(block => block.is_all_day) ?? false;

      if (isFullyBlocked) {
          return {
              isDisabled: true,
              reason: blocksOnDate?.find(b => b.is_all_day)?.closure_reason || 'Fully Booked / Holiday'
          };
      }

      let leadTimeDisabled = false;
      if (availability === 'rush') leadTimeDisabled = !dateInfo.is_rush_available;
      else if (availability === 'same-day') leadTimeDisabled = !dateInfo.is_same_day_available;
      else leadTimeDisabled = !dateInfo.is_standard_available;

      if (leadTimeDisabled) {
          let leadTimeReason = "Date unavailable for this order's lead time.";
          if (availabilitySettings && availabilitySettings.minimum_lead_time_days > 0 && availability === 'normal') {
              const plural = availabilitySettings.minimum_lead_time_days > 1 ? 's' : '';
              leadTimeReason = `Requires a ${availabilitySettings.minimum_lead_time_days} day${plural} lead time.`;
          }
          return { isDisabled: true, reason: leadTimeReason };
      }

      return { isDisabled: false, reason: null };
  }, [blockedDatesMap, availability, availabilitySettings]);

  const disabledSlots = useMemo(() => {
    const newDisabledSlots: string[] = [];
    const now = new Date();
    const todayString = now.toISOString().split('T')[0];
    
    if (eventDate === todayString) {
        let readyTime: Date | null = null;
        if (availability === 'same-day') {
            readyTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // +3 hours
        } else if (availability === 'rush') {
            readyTime = new Date(now.getTime() + 30 * 60 * 1000); // +30 mins
        }

        if (readyTime) {
            EVENT_TIME_SLOTS_MAP.forEach(timeSlot => {
                const slotEndDate = new Date(eventDate);
                slotEndDate.setHours(timeSlot.endHour, 0, 0, 0);
                if (slotEndDate < readyTime) {
                    newDisabledSlots.push(timeSlot.slot);
                }
            });
        }
    }

    if (partiallyBlockedSlots.length > 0) {
        const parseTime = (timeStr: string): number => parseInt(timeStr.split(':')[0], 10);
        partiallyBlockedSlots.forEach(blockedSlot => {
            if (blockedSlot.blocked_time_start && blockedSlot.blocked_time_end) {
                const blockStartHour = parseTime(blockedSlot.blocked_time_start);
                const blockEndHour = parseTime(blockedSlot.blocked_time_end);
                EVENT_TIME_SLOTS_MAP.forEach(timeSlot => {
                    if (timeSlot.startHour < blockEndHour && timeSlot.endHour > blockStartHour) {
                        newDisabledSlots.push(timeSlot.slot);
                    }
                });
            }
        });
    }
    
    return [...new Set(newDisabledSlots)];
  }, [availability, eventDate, partiallyBlockedSlots]);

  useEffect(() => {
    if (eventTime && disabledSlots.includes(eventTime)) {
        setEventTime('');
    }
  }, [eventTime, disabledSlots, setEventTime]);

  useEffect(() => {
    if (isRegisteredUser && !isAddressesLoading && savedAddresses.length > 0 && !selectedAddressId) {
        const defaultAddress = savedAddresses.find(addr => addr.is_default);
        setSelectedAddressId(defaultAddress ? defaultAddress.address_id : savedAddresses[0].address_id);
    }
  }, [isRegisteredUser, savedAddresses, isAddressesLoading, selectedAddressId]);
  
  const selectedAddress = useMemo(() => {
    return isRegisteredUser && selectedAddressId ? savedAddresses.find(a => a.address_id === selectedAddressId) : null;
  }, [isRegisteredUser, selectedAddressId, savedAddresses]);
  
  const handleNewAddressSuccess = (newAddress?: CakeGenieAddress) => {
    if (newAddress) {
        setSelectedAddressId(newAddress.address_id);
    }
    setIsAddingAddress(false);
  };
  
  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setBillSharingEnabled(false);
      setBillSharingMessage('');
      setSuggestedSplitCount('');
      setEventDate('');
      setEventTime('');
      setSelectedAddressId('');
      setIsAddingAddress(false);
    }
  }, [isOpen]);

  const handleCreateLinkClick = () => {
    const currentSelectedAddress = savedAddresses.find(a => a.address_id === selectedAddressId);
    
    if (billSharingEnabled) {
      if (!eventDate || !eventTime) {
        showError('Please select a delivery date and time.');
        return;
      }
      if (!currentSelectedAddress) {
        showError('Please select or add a delivery address.');
        return;
      }
    }
  
    onCreateLink({
      billSharingEnabled,
      billSharingMessage: billSharingMessage.trim() || undefined,
      suggestedSplitCount: suggestedSplitCount ? parseInt(suggestedSplitCount) : undefined,
      deliveryAddress: billSharingEnabled ? currentSelectedAddress?.street_address : undefined,
      deliveryCity: billSharingEnabled ? currentSelectedAddress?.city : undefined,
      deliveryPhone: billSharingEnabled ? currentSelectedAddress?.recipient_phone : undefined,
      eventDate: billSharingEnabled ? eventDate : undefined,
      eventTime: billSharingEnabled ? eventTime : undefined,
      recipientName: billSharingEnabled ? currentSelectedAddress?.recipient_name : undefined,
    });
  };

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

  const inputStyle = "w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-slate-50 disabled:cursor-not-allowed";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 animate-fade-in" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
          <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-bold text-slate-800">
              {shareData ? '🎉 Share Your Cake!' : 'Configure & Share'}
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
            // VIEW 1: Configuration
            <div className="p-6 space-y-4">
              <LazyImage src={imageUrl} alt="Your cake design" className="w-full aspect-square object-cover rounded-xl border-2 border-slate-200" />
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billSharingEnabled}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (!user || user.is_anonymous) {
                            e.preventDefault();
                            showError('Please sign in to organize bill sharing');
                            onAuthRequired();
                            return;
                          }
                        }
                        setBillSharingEnabled(e.target.checked);
                      }}
                      className="w-4 h-4"
                    />
                    <span className="font-medium">Enable Bill Sharing</span>
                  </label>

                  {(!user || user.is_anonymous) && !billSharingEnabled && (
                    <div className="pl-6 mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                      ℹ️ <strong>Sign in required</strong> to organize a bill sharing order.
                    </div>
                  )}

                  {billSharingEnabled && user && !user.is_anonymous && (
                    <div className="pl-6 space-y-4 animate-fade-in">
                      <div className="p-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                        ✅ You're organizing this bill share. Your email: <strong>{user.email}</strong>
                      </div>
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                        ⚠️ <strong>Important:</strong> When fully funded, the order will be <strong>automatically placed</strong> with the details below.
                      </div>
                      
                      {/* --- NEW DELIVERY UI --- */}
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Date of Event</label>
                        {isLoadingDates || isLoadingBlockedDates ? <div className="h-16 flex items-center"><Loader2 className="animate-spin text-slate-400"/></div> : (
                            <div className="relative">
                              <div className="flex gap-2 overflow-x-auto overflow-y-visible pt-12 -mt-12 pb-2 -mb-2 scrollbar-hide">
                                  {correctedDates.map(dateInfo => {
                                      const { isDisabled, reason } = getDateStatus(dateInfo);
                                      const isSelected = eventDate === dateInfo.available_date;
                                      const dateObj = new Date(dateInfo.available_date + 'T00:00:00');
                                      return (
                                          <div key={dateInfo.available_date} className="relative flex-shrink-0">
                                              <button type="button" onClick={() => !isDisabled && handleDateSelect(dateInfo.available_date)} onMouseEnter={() => isDisabled && reason && setTooltip({ date: dateInfo.available_date, reason })} onMouseLeave={() => setTooltip(null)}
                                                  className={`w-16 text-center rounded-lg p-2 border-2 transition-all duration-200 ${isSelected ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-200' : 'border-slate-200 bg-white'} ${isDisabled ? 'opacity-50 bg-slate-50 cursor-not-allowed' : 'hover:border-pink-400'}`}>
                                                  <span className="block text-xs font-semibold text-slate-500">{dateObj.toLocaleDateString('en-US', { month: 'short' })}</span>
                                                  <span className="block text-xl font-bold text-slate-800">{dateObj.toLocaleDateString('en-US', { day: 'numeric' })}</span>
                                                  <span className="block text-[10px] font-medium text-slate-500">{dateInfo.day_of_week.substring(0, 3)}</span>
                                              </button>
                                              {tooltip && tooltip.date === dateInfo.available_date && (<div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max max-w-[200px] px-3 py-1.5 bg-slate-800 text-white text-xs text-center font-semibold rounded-md z-10 animate-fade-in shadow-lg">{tooltip.reason}<div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-800"></div></div>)}
                                          </div>
                                      )
                                  })}
                              </div>
                            </div>
                        )}
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-600 mb-1">Time of Event</label>
                          <div className="relative"><div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {EVENT_TIME_SLOTS.map(slot => (<button key={slot} type="button" onClick={() => !disabledSlots.includes(slot) && setEventTime(slot)} disabled={disabledSlots.includes(slot)}
                                className={`flex-shrink-0 text-center rounded-lg p-2 border-2 transition-all duration-200 ${eventTime === slot ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-200' : 'border-slate-200 bg-white'} ${disabledSlots.includes(slot) ? 'opacity-50 bg-slate-50 cursor-not-allowed' : 'hover:border-pink-400'}`}>
                                <span className="block text-xs font-semibold text-slate-800 px-2">{slot}</span></button>))}
                          </div></div>
                      </div>

                      {isAddressesLoading ? <div className="h-24 flex items-center justify-center"><Loader2 className="animate-spin text-slate-400"/></div> : (
                        <>
                          {isAddingAddress ? (
                            <AddressForm userId={user.id} onSuccess={handleNewAddressSuccess} onCancel={() => setIsAddingAddress(false)} />
                          ) : (
                            <div>
                                <label htmlFor="addressSelect" className="block text-sm font-medium text-slate-600 mb-1">Delivery Address</label>
                                {savedAddresses.length > 0 ? (
                                    <select id="addressSelect" value={selectedAddressId} onChange={(e) => setSelectedAddressId(e.target.value)} className={inputStyle}>
                                        <option value="" disabled>-- Select a saved address --</option>
                                        {savedAddresses.map(addr => (<option key={addr.address_id} value={addr.address_id}>{addr.address_label ? `${addr.address_label} (${addr.street_address})` : addr.street_address}</option>))}
                                    </select>
                                ) : <p className="text-xs text-slate-500">No saved addresses. Please add one.</p>}
                                
                                {selectedAddress && (
                                    <div className="mt-2 p-3 bg-slate-100 rounded-lg border border-slate-200 text-xs">
                                        <p className="font-semibold text-slate-700">{selectedAddress.recipient_name}</p>
                                        <p className="text-slate-500">{selectedAddress.recipient_phone}</p>
                                        <p className="text-slate-500 mt-1">{selectedAddress.street_address}</p>
                                        {selectedAddress.latitude && selectedAddress.longitude && <StaticMap latitude={selectedAddress.latitude} longitude={selectedAddress.longitude} />}
                                    </div>
                                )}
                                <button type="button" onClick={() => setIsAddingAddress(true)} className="mt-2 w-full flex items-center justify-center gap-2 text-center text-sm font-semibold text-pink-600 hover:text-pink-700 py-2 rounded-lg hover:bg-pink-50 transition-colors">
                                    <Plus size={16} /> Add a New Address
                                </button>
                            </div>
                          )}
                        </>
                      )}

                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Message to Contributors (optional)</label>
                        <textarea value={billSharingMessage} onChange={(e) => setBillSharingMessage(e.target.value)} placeholder="e.g., Hey everyone! Let's chip in for Sarah's birthday cake 🎂" rows={2} maxLength={200} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none" />
                        <p className="text-xs text-slate-500 mt-1">{billSharingMessage.length}/200 characters</p>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 mb-1">How many people will split this? (optional)</label>
                        <input type="number" value={suggestedSplitCount} onChange={(e) => setSuggestedSplitCount(e.target.value)} placeholder="e.g., 4" min="2" max="20" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
                        {suggestedSplitCount && finalPrice && parseInt(suggestedSplitCount, 10) > 0 && (
                          <p className="text-xs text-purple-600 mt-1 font-medium">≈ ₱{Math.ceil(finalPrice / parseInt(suggestedSplitCount, 10)).toLocaleString()} per person</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={handleCreateLinkClick}
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