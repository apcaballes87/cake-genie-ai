import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getSharedDesign, createContribution, getDesignContributions, BillContribution } from '../../services/shareService';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { ArrowLeft, Edit, ShoppingCart, Share2, CopyIcon as Copy, CheckCircle, Users, CreditCard, Loader2, Heart, MessageCircle, Calendar, MapPin, User as UserIcon } from 'lucide-react';
import { showSuccess, showError, showInfo } from '../../lib/utils/toast';
import LazyImage from '../../components/LazyImage';
import { AvailabilityType } from '../../lib/utils/availability';

interface SharedDesign {
  design_id: string;
  customized_image_url: string;
  title: string;
  description: string;
  alt_text: string;
  cake_type: string;
  cake_size: string;
  cake_flavor: string;
  cake_thickness: string;
  icing_colors: { name: string; hex: string }[];
  accessories: string[];
  base_price: number;
  final_price: number;
  availability_type: AvailabilityType;
  creator_name: string | null;
  bill_sharing_enabled?: boolean;
  bill_sharing_message?: string;
  suggested_split_count?: number;
  amount_collected?: number;
  url_slug?: string;
  payment_status?: string;
  auto_order_enabled: boolean;
  order_placed: boolean;
  order_id: string | null;
  delivery_address: string | null;
  delivery_city: string | null;
  event_date: string | null;
  event_time: string | null;
  recipient_name: string | null;
}

interface SharedDesignPageProps {
  designId: string;
  onStartWithDesign: (design: SharedDesign) => void;
  onNavigateHome: () => void;
  onPurchaseDesign: (design: SharedDesign) => void;
  user: any | null;
  onAuthRequired: () => void;
}

const AVAILABILITY_INFO: Record<AvailabilityType, { label: string; time: string; icon: string; bgColor: string; textColor: string }> = {
    rush: { label: 'Rush Order', time: 'Ready in 30 minutes', icon: '⚡', bgColor: 'bg-green-100', textColor: 'text-green-800' },
    'same-day': { label: 'Same-Day', time: 'Ready in 3 hours', icon: '🕐', bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
    normal: { label: 'Standard Order', time: '1-day lead time', icon: '📅', bgColor: 'bg-slate-100', textColor: 'text-slate-800' },
};

const SharedDesignPage: React.FC<SharedDesignPageProps> = ({
  designId,
  onStartWithDesign,
  onNavigateHome,
  onPurchaseDesign,
  user,
  onAuthRequired,
}) => {
  const [design, setDesign] = useState<SharedDesign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  // State for bill sharing
  const [contributorName, setContributorName] = useState('');
  const [contributorEmail, setContributorEmail] = useState('');
  const [contributionAmount, setContributionAmount] = useState('');
  const [isSubmittingContribution, setIsSubmittingContribution] = useState(false);
  const [contributions, setContributions] = useState<BillContribution[]>([]);
  const [isLoadingContributions, setIsLoadingContributions] = useState(true);
  const [showContributionForm, setShowContributionForm] = useState(false);

  useEffect(() => {
    const fetchDesign = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getSharedDesign(designId);
        if (!data) {
          throw new Error("Design not found or it may have been removed.");
        }
        setDesign(data as SharedDesign);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load the design.");
        showError(err instanceof Error ? err.message : "Could not load the design.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDesign();
  }, [designId]);

  useEffect(() => {
    const fetchContributions = async () => {
      if (design?.bill_sharing_enabled) {
        setIsLoadingContributions(true);
        const contribs = await getDesignContributions(design.design_id);
        setContributions(contribs);
        setIsLoadingContributions(false);
      }
    };
    if (design) {
      fetchContributions();
    }
  }, [design]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    if (params.get('contribution') === 'success') {
      showSuccess('Your contribution was successful! Thank you!');
      
      // Reload contributions to show the updated total
      if (design?.bill_sharing_enabled) {
        (async () => {
          const contribs = await getDesignContributions(design.design_id);
          setContributions(contribs);
        })();
      }
      
      if(design?.url_slug || design?.design_id) {
        window.history.replaceState(null, '', `#/designs/${design.url_slug || design.design_id}`);
      }
    } else if (params.get('contribution') === 'failed') {
      showError('Your contribution failed. Please try again.');
      if(design?.url_slug || design?.design_id) {
        window.history.replaceState(null, '', `#/designs/${design.url_slug || design.design_id}`);
      }
    }
  }, [design]);

  useEffect(() => {
    if (showContributionForm && user && !user.is_anonymous) {
      // Pre-fill user details if they are logged in
      const name = user.user_metadata?.full_name || 
                   `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || 
                   user.email?.split('@')[0] ||
                   '';
      setContributorName(name);
      setContributorEmail(user.email || '');
    }
  }, [showContributionForm, user]);

  const handleCopyLink = () => {
    setIsCopying(true);
    navigator.clipboard.writeText(window.location.href).then(() => {
      showSuccess("Link copied to clipboard!");
      setTimeout(() => setIsCopying(false), 2000);
    }).catch(err => {
      showError("Failed to copy link.");
      setIsCopying(false);
    });
  };

  const handleContribute = async () => {
    if (!design) return;

    const isLoggedIn = user && !user.is_anonymous;
    
    const nameToUse = isLoggedIn ? (user.user_metadata?.full_name || `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || user.email?.split('@')[0]) : contributorName.trim();
    const emailToUse = isLoggedIn ? user.email : contributorEmail.trim();

    // Validation
    if (!nameToUse) {
        showError('Please enter your name');
        return;
    }
    if (!emailToUse || !emailToUse.includes('@')) {
        showError('Please enter a valid email');
        return;
    }
    
    const amount = parseFloat(contributionAmount);
    if (isNaN(amount)) {
      showError('Please enter a valid amount');
      return;
    }

    // Minimum contribution check
    if (amount < 1) {
      showError('Minimum contribution is ₱1');
      return;
    }

    const remaining = design.final_price - (amountCollected || 0);
    if (amount > remaining) {
      showError(`Amount cannot exceed remaining ₱${remaining.toFixed(2)}`);
      return;
    }

    // Check if bill sharing is still enabled (in case it changed)
    if (!design.bill_sharing_enabled) {
      showError('Bill sharing is no longer available for this design');
      return;
    }

    setIsSubmittingContribution(true);

    const result = await createContribution(
      design.design_id,
      nameToUse,
      emailToUse,
      amount
    );

    setIsSubmittingContribution(false);

    if (result.success && result.paymentUrl) {
      // Redirect to Xendit payment page
      window.location.href = result.paymentUrl;
    } else {
      showError(result.error || 'Failed to create contribution');
    }
  };

  const handlePurchaseClick = () => {
      if (!user || user.is_anonymous) {
          showInfo("Please sign in to purchase a design.");
          onAuthRequired();
      } else if (design) {
          onPurchaseDesign(design);
      }
  };

  const handleContributeClick = () => {
      if (!user || user.is_anonymous) {
          showInfo("Please sign in to contribute.");
          onAuthRequired();
      } else {
          setShowContributionForm(true);
      }
  };

  const amountCollected = useMemo(() => {
    const paidContributionsTotal = contributions.reduce((sum, c) => sum + c.amount, 0);
    return Math.max(design?.amount_collected || 0, paidContributionsTotal);
  }, [contributions, design?.amount_collected]);

  const remainingAmount = (design?.final_price || 0) - amountCollected;
  const progress = design ? Math.min(100, (amountCollected / design.final_price) * 100) : 0;
  
  const suggestedSplits = useMemo(() => {
    if (!design || !design.suggested_split_count || remainingAmount <= 0) return [];
    const splits = [];
    for (let i = 2; i <= design.suggested_split_count; i++) {
        if (remainingAmount / i > 1) {
            splits.push({ count: i, amount: Math.ceil(remainingAmount / i) });
        }
    }
    return splits;
  }, [design, remainingAmount]);


  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><LoadingSpinner /></div>;
  }

  if (error || !design) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Oops!</h2>
        <p className="text-slate-600 mb-6">{error || "This design could not be loaded."}</p>
        <button onClick={onNavigateHome} className="text-pink-600 font-semibold hover:underline">Return Home</button>
      </div>
    );
  }

  const availability = AVAILABILITY_INFO[design.availability_type] || AVAILABILITY_INFO.normal;
  const isFullyFunded = remainingAmount <= 0;

  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">
          Genie
        </h1>
        <p className="text-slate-500 text-sm mt-1">Your Cake Wish, Granted.</p>
      </div>
      <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-6 sm:p-8 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onNavigateHome} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
            <ArrowLeft />
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text truncate">
            {design.title}
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left: Image */}
          <div className="relative">
            <LazyImage src={design.customized_image_url} alt={design.alt_text} className="w-full aspect-square object-cover rounded-xl shadow-lg border border-slate-200" />
            <div className="absolute top-3 right-3 flex gap-2">
              <button onClick={handleCopyLink} className="p-2.5 bg-white/80 backdrop-blur-md rounded-full shadow-md hover:bg-white transition-colors">
                {isCopying ? <CheckCircle className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-slate-600" />}
              </button>
            </div>
          </div>

          {/* Right: Details */}
          <div className="flex flex-col">
            <p className="text-slate-600 leading-relaxed">{design.description}</p>
            
            {design.bill_sharing_enabled && design.event_date ? (
              <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200 space-y-3">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      Delivery Details
                  </h3>
                  <div className="space-y-1 text-sm text-slate-700 pl-6">
                      <p className="flex items-center"><UserIcon className="w-3.5 h-3.5 mr-2 text-slate-500" /><strong>For:</strong>&nbsp;{design.recipient_name}</p>
                      <p className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-2 text-slate-500" /><strong>On:</strong>&nbsp;{new Date(design.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {design.event_time}</p>
                      <p className="flex items-start"><MapPin className="w-3.5 h-3.5 mr-2 text-slate-500 mt-0.5" /><strong>To:</strong>&nbsp;{design.delivery_address}, {design.delivery_city}</p>
                  </div>
              </div>
            ) : (
              <div className={`mt-4 p-3 rounded-lg flex items-center gap-3 ${availability.bgColor} border border-transparent`}>
                <span className="text-2xl">{availability.icon}</span>
                <div>
                  <p className={`font-bold text-sm ${availability.textColor}`}>{availability.label}</p>
                  <p className={`text-xs ${availability.textColor.replace('800', '700')}`}>{availability.time}</p>
                </div>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Type:</span>
                <span className="text-slate-800 font-semibold">{design.cake_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Size:</span>
                <span className="text-slate-800 font-semibold">{design.cake_size}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Flavor:</span>
                <span className="text-slate-800 font-semibold">{design.cake_flavor}</span>
              </div>
              <div className="flex justify-between items-center mt-4">
                <span className="text-slate-500 font-medium">Price:</span>
                <span className="text-3xl font-bold text-pink-600">₱{design.final_price.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-auto pt-6 space-y-3">
              {/* Bill Sharing Section */}
              {design.bill_sharing_enabled && (
                <div className="mb-4 p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Heart className="w-5 h-5 text-pink-500" />
                    <h3 className="font-bold text-slate-800">Split the Bill!</h3>
                  </div>
                  
                  {/* Creator's Message */}
                  {design.bill_sharing_message && (
                    <div className="mb-3 p-3 bg-white rounded-lg border border-pink-100">
                      <div className="flex items-start gap-2">
                        <MessageCircle className="w-4 h-4 text-pink-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-slate-700 italic">{design.bill_sharing_message}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Collected</span>
                      <span className="font-bold text-pink-600">
                        ₱{amountCollected.toLocaleString()} / ₱{design.final_price.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Contributors List */}
                  {contributions.length > 0 && (
                    <div className="mb-3 flex items-center gap-2 text-sm text-slate-600">
                      <Users className="w-4 h-4" />
                      <span>{contributions.length} contributor{contributions.length !== 1 ? 's' : ''} • Thank you! 🎉</span>
                    </div>
                  )}

                  {/* Show "Fully Paid & Order Placed" message */}
                  {isFullyFunded && design.order_placed && (
                    <div className="text-center py-3 px-4 bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-400 rounded-xl mb-3">
                      <div className="text-3xl mb-2">✅</div>
                      <p className="font-bold text-green-800 mb-1">Fully Paid & Order Placed!</p>
                      <p className="text-sm text-green-700">
                        This cake has been automatically ordered and will be delivered on{' '}
                        {design.event_date && new Date(design.event_date + 'T00:00:00').toLocaleDateString('en-US', { 
                          month: 'long', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                        {design.event_time && ` at ${design.event_time}`}
                      </p>
                      {design.recipient_name && (
                        <p className="text-sm text-green-600 mt-1">
                          🎂 For: {design.recipient_name}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Show "Fully Paid - Order Processing" message */}
                  {isFullyFunded && !design.order_placed && design.auto_order_enabled && (
                    <div className="text-center py-3 px-4 bg-gradient-to-r from-blue-100 to-indigo-100 border-2 border-blue-400 rounded-xl mb-3">
                      <div className="text-3xl mb-2">⏳</div>
                      <p className="font-bold text-blue-800 mb-1">Fully Paid!</p>
                      <p className="text-sm text-blue-700">
                        Your order is being processed automatically. You'll receive confirmation shortly!
                      </p>
                    </div>
                  )}
                  
                  {/* Hide contribution form if order is placed */}
                  {!design.order_placed && !isFullyFunded ? (
                    <>
                      {!showContributionForm ? (
                        <button
                          onClick={handleContributeClick}
                          className="w-full bg-white border-2 border-pink-400 text-pink-600 font-bold py-2 px-4 rounded-lg hover:bg-pink-50 transition-colors"
                        >
                          Contribute Now
                        </button>
                      ) : (
                        <div className="space-y-3 mt-3">
                          {/* Suggested Amounts */}
                          {design.suggested_split_count && design.suggested_split_count > 0 && (
                            <div>
                              <p className="text-xs text-slate-600 mb-2">
                                Suggested amount (split between {design.suggested_split_count} people):
                              </p>
                              <div className="flex gap-2 flex-wrap">
                                {(() => {
                                  const remaining = remainingAmount;
                                  const suggestedAmount = Math.ceil(design.final_price / design.suggested_split_count!);
                                  const halfAmount = Math.ceil(suggestedAmount / 2);
                                  
                                  return (
                                    <>
                                      {halfAmount > 0 && halfAmount <= remaining && (
                                        <button
                                          onClick={() => setContributionAmount(halfAmount.toString())}
                                          className="px-3 py-1.5 text-sm bg-white border-2 border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50 font-medium"
                                        >
                                          ₱{halfAmount.toLocaleString()} (Half)
                                        </button>
                                      )}
                                      {suggestedAmount > 0 && suggestedAmount <= remaining && (
                                        <button
                                          onClick={() => setContributionAmount(suggestedAmount.toString())}
                                          className="px-3 py-1.5 text-sm bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg hover:shadow-md font-medium"
                                        >
                                          ₱{suggestedAmount.toLocaleString()} (Equal)
                                        </button>
                                      )}
                                      {remaining > 0 && remaining <= suggestedAmount * 1.5 && (
                                        <button
                                          onClick={() => setContributionAmount(remaining.toString())}
                                          className="px-3 py-1.5 text-sm bg-white border-2 border-green-300 text-green-600 rounded-lg hover:bg-green-50 font-medium"
                                        >
                                          ₱{remaining.toLocaleString()} (All)
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}
                          
                          {user && !user.is_anonymous ? (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm space-y-1">
                              <p className="font-semibold text-blue-800 flex items-center gap-2">
                                <UserIcon className="w-4 h-4" />
                                Contributing as:
                              </p>
                              <div className="pl-6">
                                  <p className="text-blue-700 font-medium">{contributorName}</p>
                                  <p className="text-blue-700 text-xs">{contributorEmail}</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <input
                                type="text"
                                placeholder="Your name"
                                value={contributorName}
                                onChange={(e) => setContributorName(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                required
                              />
                              <input
                                type="email"
                                placeholder="Your email"
                                value={contributorEmail}
                                onChange={(e) => setContributorEmail(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                                required
                              />
                            </>
                          )}

                          <input
                            type="number"
                            placeholder={`Custom amount (max ₱${remainingAmount.toFixed(2)})`}
                            value={contributionAmount}
                            onChange={(e) => setContributionAmount(e.target.value)}
                            min="1"
                            max={remainingAmount}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleContribute}
                              disabled={isSubmittingContribution}
                              className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold py-2 px-4 rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                            >
                              {isSubmittingContribution ? 'Processing...' : `Pay ₱${parseFloat(contributionAmount || '0').toLocaleString()}`}
                            </button>
                            <button
                              onClick={() => setShowContributionForm(false)}
                              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}

                </div>
              )}

              {/* Only show purchase buttons if order not placed from bill sharing */}
              {!design.order_placed && (
                <>
                  <button
                    onClick={handlePurchaseClick}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Purchase This Design
                  </button>
                  <button
                    onClick={() => onStartWithDesign(design)}
                    className="w-full flex items-center justify-center gap-2 text-center bg-white border-2 border-purple-500 text-purple-600 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-purple-50 transition-all text-base"
                  >
                    <Edit className="w-5 h-5" />
                    Customize This Design
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SharedDesignPage;