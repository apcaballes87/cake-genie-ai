import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { LoadingSpinner } from './components/LoadingSpinner';
import { FeatureList } from './components/FeatureList';
import { MagicSparkleIcon, ErrorIcon, ImageIcon, ResetIcon, SearchIcon, CameraIcon, CloseIcon, SaveIcon, CartIcon, TrashIcon, BackIcon, ReportIcon } from './components/icons';
import { EDIT_CAKE_PROMPT_TEMPLATE, editCakeImage, fileToBase64, analyzeCakeImage } from './services/geminiService';
import { calculatePrice } from './services/pricingService';
import { reportCustomization, getCakeBasePriceOptions } from './services/supabaseService';
import { AddOnPricing, HybridAnalysisResult, MainTopperUI, SupportElementUI, CakeMessageUI, IcingDesignUI, CakeInfoUI, BasePriceInfo, CakeType, CartItem, CakeFlavor, CartItemDetails, ReportPayload } from './types';
import { ImageUploader } from './components/ImageUploader';
import { FloatingImagePreview } from './components/FloatingImagePreview';
import { ImageZoomModal } from './components/ImageZoomModal';
import { DEFAULT_THICKNESS_MAP, THICKNESS_OPTIONS_MAP, COLORS, CITIES_AND_BARANGAYS, DEFAULT_SIZE_MAP } from './constants';

declare global {
  interface Window {
    __gcse?: {
      parsetags: string;
      callback: () => void;
    };
    google?: any;
  }
}

type AppState = 'landing' | 'searching' | 'customizing' | 'cart';
type ImageTab = 'original' | 'customized';

const AnimatedBlobs = () => (
    <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute w-96 h-96 bg-pink-200/50 rounded-full blur-3xl opacity-70 top-1/4 left-1/4 blob-animation-1"></div>
        <div className="absolute w-80 h-80 bg-purple-200/50 rounded-full blur-3xl opacity-70 bottom-1/4 right-1/4 blob-animation-2"></div>
        <div className="absolute w-72 h-72 bg-indigo-200/50 rounded-full blur-3xl opacity-70 bottom-1/2 left-1/3 blob-animation-3"></div>
    </div>
);

const cakeTypeDisplayMap: Record<CakeType, string> = {
    '1 Tier': '1 Tier (Soft icing)',
    '2 Tier': '2 Tier (Soft icing)',
    '3 Tier': '3 Tier (Soft icing)',
    '1 Tier Fondant': '1 Tier Fondant',
    '2 Tier Fondant': '2 Tier Fondant',
    '3 Tier Fondant': '3 Tier Fondant',
    'Square': 'Square',
    'Rectangle': 'Rectangle',
    'Bento': 'Bento',
};

// --- Cart View Component ---
interface CartViewProps {
  items: CartItem[];
  onRemoveItem: (id: string) => void;
  onClose: () => void;
  onContinueShopping: () => void;
}

const DetailItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-700 font-medium text-right">{value}</span>
    </div>
);

const CartView: React.FC<CartViewProps> = ({ items, onRemoveItem, onClose, onContinueShopping }) => {
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const subtotal = items.reduce((acc, item) => item.status === 'complete' ? acc + item.totalPrice : acc, 0);

    // Customer information state
    const [customerName, setCustomerName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [deliveryInstructions, setDeliveryInstructions] = useState('');
    
    // Form validation and submission state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null);
    
    // Launch notification state
    const [showLaunchNotification, setShowLaunchNotification] = useState(false);
    const [launchEmail, setLaunchEmail] = useState('');
    const [isSavingEmail, setIsSavingEmail] = useState(false);
    const [emailSaveStatus, setEmailSaveStatus] = useState<'success' | 'error' | null>(null);
    
    const inputStyle = "w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 disabled:bg-slate-50 disabled:cursor-not-allowed";
    const EVENT_TIME_SLOTS = ["10AM - 12NN", "12NN - 2PM", "2PM - 4PM", "4PM - 6PM", "6PM - 8PM"];
    
    // Import the saveCheckoutOrder function
    const handleCheckout = async () => {
        // Simple validation
        if (!customerName || !customerEmail || !customerPhone || !deliveryAddress || !eventDate || !eventTime) {
            setSubmitStatus('error');
            return;
        }
        
        setIsSubmitting(true);
        setSubmitStatus(null);
        
        try {
            const { saveCheckoutOrder } = await import('./services/supabaseService');
            
            await saveCheckoutOrder({
                name: customerName,
                email: customerEmail,
                phone: customerPhone,
                deliveryAddress: deliveryAddress,
                eventDate: eventDate,
                eventTime: eventTime,
                deliveryInstructions: deliveryInstructions
            }, items);
            
            setSubmitStatus('success');
            // Show the launch notification message after successful checkout
            setShowLaunchNotification(true);
            // Optionally, you could clear the cart here
            // setCartItems([]); // This would clear the cart
        } catch (err) {
            console.error("Checkout error:", err);
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleSaveEmail = async () => {
        if (!launchEmail || !/\S+@\S+\.\S+/.test(launchEmail)) {
            setEmailSaveStatus('error');
            return;
        }
        
        setIsSavingEmail(true);
        setEmailSaveStatus(null);
        
        try {
            const { saveLaunchNotificationEmail } = await import('./services/supabaseService');
            await saveLaunchNotificationEmail(launchEmail);
            setEmailSaveStatus('success');
            // Clear the email input after successful submission
            setLaunchEmail('');
        } catch (err) {
            console.error("Error saving email:", err);
            setEmailSaveStatus('error');
        } finally {
            setIsSavingEmail(false);
        }
    };
    
    return (
        <div className="w-full max-w-4xl mx-auto bg-white/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-slate-200 animate-fade-in">
             <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in-fast { animation: fadeInFast 0.2s ease-out; } @keyframes fadeInFast { from { opacity: 0; } to { opacity: 1; } }`}</style>

            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
                <h1 className="text-2xl font-bold text-slate-800">Your Cart</h1>
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Close cart">
                    <CloseIcon />
                </button>
            </div>

            {items.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-slate-500">Your cart is empty.</p>
                    <button onClick={onContinueShopping} className="mt-4 text-purple-600 font-semibold hover:underline">
                        Continue Shopping
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    {!showLaunchNotification ? (
                        <>
                            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                                {items.map(item => {
                                    if (item.status === 'pending') {
                                        return (
                                            <div key={item.id} className="flex flex-col gap-4 p-4 bg-white rounded-lg border border-slate-200">
                                                <div className="flex gap-4 w-full">
                                                     <div className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-md bg-slate-100 flex flex-col items-center justify-center p-2">
                                                        <LoadingSpinner />
                                                        <p className="text-xs text-slate-500 mt-2 text-center">Updating design...</p>
                                                    </div>
                                                    <div className="flex-grow">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <h3 className="font-semibold text-slate-800">Custom Cake</h3>
                                                                <p className="text-sm text-slate-600">{item.cakeSize}</p>
                                                            </div>
                                                            <button 
                                                                onClick={() => onRemoveItem(item.id)}
                                                                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                                                aria-label="Remove item"
                                                            >
                                                                <TrashIcon />
                                                            </button>
                                                        </div>
                                                        <div className="mt-2 text-right">
                                                            <p className="font-semibold text-slate-800">₱{item.totalPrice.toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    
                                    return (
                                        <div key={item.id} className="flex flex-col gap-4 p-4 bg-white rounded-lg border border-slate-200">
                                            <div className="flex gap-4 w-full">
                                                {item.image && (
                                                    <button 
                                                        onClick={() => setZoomedImage(item.image)} 
                                                        className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-md overflow-hidden hover:opacity-90 transition-opacity"
                                                        aria-label="Zoom image"
                                                    >
                                                        <img src={item.image} alt="Cake design" className="w-full h-full object-cover" />
                                                    </button>
                                                )}
                                                <div className="flex-grow">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h3 className="font-semibold text-slate-800">Custom Cake</h3>
                                                            <p className="text-sm text-slate-600">{item.cakeSize}</p>
                                                            <div className="mt-1 text-xs text-slate-500">
                                                                {item.details.cakeInfo.type} • {item.details.cakeInfo.thickness}
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => onRemoveItem(item.id)}
                                                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                                            aria-label="Remove item"
                                                        >
                                                            <TrashIcon />
                                                        </button>
                                                    </div>
                                                    <div className="mt-2 text-right">
                                                        <p className="font-semibold text-slate-800">₱{item.totalPrice.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Item details */}
                                            <div className="text-xs bg-slate-50 p-3 rounded-md border border-slate-200">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    <div>
                                                        <span className="font-medium text-slate-700">Flavors:</span> {item.details.cakeInfo.flavors.join(', ')}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-slate-700">Main Toppers:</span> {item.details.mainToppers.join(', ') || 'None'}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-slate-700">Support Elements:</span> {item.details.supportElements.join(', ') || 'None'}
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-slate-700">Messages:</span> {item.details.cakeMessages.map(m => m.text).join(', ') || 'None'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Customer Information Form */}
                            <div className="bg-white rounded-lg border border-slate-200 p-4">
                                <h2 className="text-lg font-semibold text-slate-800 mb-4">Customer Information</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="customerName" className="block text-sm font-medium text-slate-600 mb-1">Full Name *</label>
                                        <input 
                                            type="text" 
                                            id="customerName" 
                                            value={customerName} 
                                            onChange={(e) => setCustomerName(e.target.value)} 
                                            className={inputStyle} 
                                            placeholder="Enter your full name"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="customerEmail" className="block text-sm font-medium text-slate-600 mb-1">Email Address *</label>
                                        <input 
                                            type="email" 
                                            id="customerEmail" 
                                            value={customerEmail} 
                                            onChange={(e) => setCustomerEmail(e.target.value)} 
                                            className={inputStyle} 
                                            placeholder="Enter your email"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="customerPhone" className="block text-sm font-medium text-slate-600 mb-1">Phone Number *</label>
                                        <input 
                                            type="tel" 
                                            id="customerPhone" 
                                            value={customerPhone} 
                                            onChange={(e) => setCustomerPhone(e.target.value)} 
                                            className={inputStyle} 
                                            placeholder="Enter your phone number"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="eventDate" className="block text-sm font-medium text-slate-600 mb-1">Event Date *</label>
                                        <input 
                                            type="date" 
                                            id="eventDate" 
                                            value={eventDate} 
                                            onChange={(e) => setEventDate(e.target.value)} 
                                            className={inputStyle} 
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="eventTime" className="block text-sm font-medium text-slate-600 mb-1">Preferred Time *</label>
                                        <select 
                                            id="eventTime" 
                                            value={eventTime} 
                                            onChange={(e) => setEventTime(e.target.value)} 
                                            className={inputStyle}
                                        >
                                            <option value="">Select a time slot</option>
                                            {EVENT_TIME_SLOTS.map(slot => (
                                                <option key={slot} value={slot}>{slot}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="mt-4">
                                    <label htmlFor="deliveryAddress" className="block text-sm font-medium text-slate-600 mb-1">Delivery Address *</label>
                                    <textarea 
                                        id="deliveryAddress" 
                                        value={deliveryAddress} 
                                        onChange={(e) => setDeliveryAddress(e.target.value)} 
                                        className={inputStyle} 
                                        placeholder="Enter your complete delivery address"
                                        rows={2}
                                    ></textarea>
                                </div>
                                
                                <div className="mt-4">
                                    <label htmlFor="deliveryInstructions" className="block text-sm font-medium text-slate-600 mb-1">Delivery Instructions</label>
                                    <textarea 
                                        id="deliveryInstructions" 
                                        value={deliveryInstructions} 
                                        onChange={(e) => setDeliveryInstructions(e.target.value)} 
                                        className={inputStyle} 
                                        placeholder="e.g., landmark, contact person, special instructions"
                                        rows={2}
                                    ></textarea>
                                </div>
                            </div>

                            {/* Order Summary and Checkout */}
                            <div className="bg-white rounded-lg border border-slate-200 p-4">
                                <h2 className="text-lg font-semibold text-slate-800 mb-4">Order Summary</h2>
                                <div className="pt-2 border-t border-slate-200 space-y-4">
                                    <div className="flex justify-between font-semibold">
                                        <span className="text-slate-600">Subtotal</span>
                                        <span className="text-slate-800 text-xl">₱{subtotal.toLocaleString()}</span>
                                    </div>
                                    
                                    {/* Submit status messages */}
                                    {submitStatus === 'success' && (
                                        <div className="p-3 bg-green-100 text-green-700 rounded-md text-center">
                                            Order submitted successfully! We'll contact you shortly.
                                        </div>
                                    )}
                                    {submitStatus === 'error' && (
                                        <div className="p-3 bg-red-100 text-red-700 rounded-md text-center">
                                            There was an error submitting your order. Please check your information and try again.
                                        </div>
                                    )}
                                    
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button 
                                            onClick={onContinueShopping} 
                                            className="w-full text-center bg-white border border-slate-300 text-slate-700 font-bold py-3 px-4 rounded-xl shadow-sm hover:bg-slate-50 transition-all text-base"
                                            disabled={isSubmitting}
                                        >
                                            Continue Shopping
                                        </button>
                                        <button 
                                            onClick={handleCheckout}
                                            disabled={isSubmitting || !customerName || !customerEmail || !customerPhone || !deliveryAddress || !eventDate || !eventTime}
                                            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isSubmitting ? 'Processing...' : 'Proceed to Checkout'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Launch Notification Message */
                        <div className="bg-white rounded-lg border border-slate-200 p-6 text-center">
                            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">Thank you for participating in this demo!</h2>
                            <p className="text-slate-600 mb-6">
                                The ecommerce aspect is not yet finished. If you wish to be informed of our launch date, 
                                please input your email here:
                            </p>
                            
                            <div className="max-w-md mx-auto">
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="email"
                                        value={launchEmail}
                                        onChange={(e) => setLaunchEmail(e.target.value)}
                                        placeholder="Enter your email"
                                        className={inputStyle}
                                    />
                                    <button
                                        onClick={handleSaveEmail}
                                        disabled={isSavingEmail || !launchEmail}
                                        className="bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-2 px-4 rounded-md shadow-lg hover:shadow-xl transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                    >
                                        {isSavingEmail ? 'Saving...' : 'Notify Me'}
                                    </button>
                                </div>
                                
                                {/* Email save status messages */}
                                {emailSaveStatus === 'success' && (
                                    <div className="mt-3 p-3 bg-green-100 text-green-700 rounded-md">
                                        Thank you! We'll notify you when we launch.
                                    </div>
                                )}
                                {emailSaveStatus === 'error' && (
                                    <div className="mt-3 p-3 bg-red-100 text-red-700 rounded-md">
                                        Please enter a valid email address.
                                    </div>
                                )}
                            </div>
                            
                            <div className="mt-6">
                                <button 
                                    onClick={onContinueShopping} 
                                    className="text-purple-600 font-semibold hover:underline"
                                >
                                    Continue Shopping
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {/* Image Zoom Modal */}
                    {zoomedImage && (
                        <div 
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                            onClick={() => setZoomedImage(null)}
                        >
                            <button 
                                onClick={() => setZoomedImage(null)}
                                className="absolute top-4 right-4 text-white p-2 rounded-full bg-black/30 hover:bg-black/50 transition-colors z-10"
                                aria-label="Close zoomed image"
                            >
                                <CloseIcon />
                            </button>
                            <img
                                src={zoomedImage}
                                alt="Zoomed cake design"
                                className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Sticky Add to Cart Bar ---
interface StickyAddToCartBarProps {
  price: number | null;
  isLoading: boolean;
  error: string | null;
  onAddToCartClick: () => void;
}

const StickyAddToCartBar: React.FC<StickyAddToCartBarProps> = ({ price, isLoading, error, onAddToCartClick }) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (price !== null || error) {
            setShow(true);
        } else {
            setShow(false);
        }
    }, [price, error]);


    const renderPrice = () => {
        if (isLoading) return <span className="text-sm text-slate-500">Calculating...</span>;
        if (error) return <span className="text-sm font-semibold text-red-600">Pricing Error</span>;
        if (price !== null) {
            return (
                <div className="text-left">
                    <span className="text-lg font-bold text-slate-800">₱{price.toLocaleString()}</span>
                    <span className="text-xs text-slate-500 block">Final Price</span>
                </div>
            );
        }
        return null;
    };
    
    return (
        <div className={`fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${show ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="bg-white/80 backdrop-blur-lg p-3 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] border-t border-slate-200">
                <div className="max-w-4xl mx-auto flex justify-between items-center gap-4">
                    <div className="min-w-[100px]">{renderPrice()}</div>
                    <button 
                        onClick={onAddToCartClick}
                        disabled={isLoading || !!error || price === null}
                        className="w-full sm:w-auto flex-grow sm:flex-grow-0 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-md"
                    >
                        Add to Cart
                    </button>
                </div>
            </div>
        </div>
    );
};


export default function App(): React.ReactElement {
  const [appState, _setAppState] = useState<AppState>('landing');
  const appStateRef = useRef(appState);
  const previousAppState = useRef<AppState | null>(null);

  const setAppState = (newState: AppState) => {
    if (appStateRef.current !== newState) {
        previousAppState.current = appStateRef.current;
        appStateRef.current = newState;
        _setAppState(newState);
    }
  };

  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [originalImageData, setOriginalImageData] = useState<{ data: string; mimeType: string } | null>(null);
  const [originalImagePreview, setOriginalImagePreview] = useState<string | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // New Hybrid State
  const [analysisResult, setAnalysisResult] = useState<HybridAnalysisResult | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null); // To track new analyses
  const [cakeInfo, setCakeInfo] = useState<CakeInfoUI | null>(null);
  const [mainToppers, setMainToppers] = useState<MainTopperUI[]>([]);
  const [supportElements, setSupportElements] = useState<SupportElementUI[]>([]);
  const [cakeMessages, setCakeMessages] = useState<CakeMessageUI[]>([]);
  const [icingDesign, setIcingDesign] = useState<IcingDesignUI | null>(null);
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [addOnPricing, setAddOnPricing] = useState<AddOnPricing | null>(null);
  
  // Supabase state
  const [basePriceOptions, setBasePriceOptions] = useState<BasePriceInfo[] | null>(null);
  const [isFetchingBasePrice, setIsFetchingBasePrice] = useState<boolean>(false);
  const [basePriceError, setBasePriceError] = useState<string | null>(null);

  // Dirty state tracking
  const [savedCustomizationState, setSavedCustomizationState] = useState<string | null>(null);

  // Reporting state
  const [isReporting, setIsReporting] = useState(false);
  const [reportStatus, setReportStatus] = useState<'success' | 'error' | null>(null);
  const lastPromptRef = useRef<string | null>(null);


  const [isSearching, setIsSearching] = useState(false);
  const [isCSELoaded, setIsCSELoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [activeTab, setActiveTab] = useState<ImageTab>('original');
  const [isMainZoomModalOpen, setIsMainZoomModalOpen] = useState(false);
  const cseElementRef = useRef<any>(null);

  // State for floating image preview
  const [isMainImageVisible, setIsMainImageVisible] = useState(true);
  const mainImageContainerRef = useRef<HTMLDivElement>(null);
  
  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const HEX_TO_COLOR_NAME_MAP = useMemo(() => COLORS.reduce((acc, color) => {
      acc[color.hex.toLowerCase()] = color.name;
      return acc;
  }, {} as Record<string, string>), []);

  // --- Dirty State Logic ---
  const customizationStateJSON = useMemo(() => {
    if (!analysisResult) return null; // Don't track state before analysis is complete
    return JSON.stringify({ cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions });
  }, [cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions, analysisResult]);

  const isDirty = useMemo(() => {
      if (!savedCustomizationState || !customizationStateJSON) return false;
      return customizationStateJSON !== savedCustomizationState;
  }, [customizationStateJSON, savedCustomizationState]);
  // --- End Dirty State Logic ---

  const handleCakeInfoChange = useCallback((
    updates: Partial<CakeInfoUI>
  ) => {
    setCakeInfo(prev => {
        if (!prev) return null;
        
        const newState = { ...prev, ...updates };
        
        if (updates.type && updates.type !== prev.type) {
            const newType = updates.type;
            
            // Adjust thickness
            const newDefaultThickness = DEFAULT_THICKNESS_MAP[newType];
            const newThicknessOptions = THICKNESS_OPTIONS_MAP[newType];
            if (!newThicknessOptions.includes(newState.thickness)) {
                newState.thickness = newDefaultThickness;
            }

            // Adjust size to default for the new type
            newState.size = DEFAULT_SIZE_MAP[newType];

            // Adjust flavors array length and reset to default
            const getFlavorCount = (type: CakeType): number => {
                if (type.includes('2 Tier')) return 2;
                if (type.includes('3 Tier')) return 3;
                return 1;
            };
            const newFlavorCount = getFlavorCount(newType);
            const newFlavors: CakeFlavor[] = Array(newFlavorCount).fill('Chocolate Cake');
            newState.flavors = newFlavors;
        }
        
        return newState;
    });
  }, []);

  const clearAllState = (backToLanding: boolean = true) => {
    if (backToLanding) {
      setAppState('landing');
    }
    setOriginalImageData(null);
    setOriginalImagePreview(null);
    setEditedImage(null);
    setError(null);
    setAnalysisResult(null);
    setAnalysisId(null);
    setCakeInfo(null);
    setMainToppers([]);
    setSupportElements([]);
    setCakeMessages([]);
    setIcingDesign(null);
    setAdditionalInstructions('');
    setAnalysisError(null);
    setIsAnalyzing(false);
    setAddOnPricing(null);
    setActiveTab('original');
    setBasePriceOptions(null);
    setIsFetchingBasePrice(false);
    setBasePriceError(null);
    setSavedCustomizationState(null);
  };

  const handleCalculatePrice = useCallback(() => {
    if (!analysisResult || !icingDesign) {
      setAddOnPricing(null);
      return;
    }
    const newPricing = calculatePrice(
        analysisResult,
        { mainToppers, supportElements, cakeMessages, icingDesign }
    );
    setAddOnPricing(newPricing);
  }, [analysisResult, mainToppers, supportElements, cakeMessages, icingDesign]);
  
  const pricingRelevantStateJSON = useMemo(() => {
    return JSON.stringify({ mainToppers, supportElements, cakeMessages, icingDesign });
  }, [mainToppers, supportElements, cakeMessages, icingDesign]);

  useEffect(() => {
      if (appState === 'customizing' && analysisResult) {
          handleCalculatePrice();
      }
  }, [pricingRelevantStateJSON, appState, handleCalculatePrice, analysisResult]);

  // Scroll to top when navigating to the cart
  useEffect(() => {
    if (appState === 'cart') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [appState]);

  // Fetch base price from Supabase when cake info changes
  useEffect(() => {
    if (cakeInfo?.type && cakeInfo?.thickness) {
        const fetchPrice = async () => {
            setIsFetchingBasePrice(true);
            setBasePriceError(null);
            setBasePriceOptions(null);
            try {
                const results = await getCakeBasePriceOptions(cakeInfo.type, cakeInfo.thickness);
                setBasePriceOptions(results);

                // Auto-select a valid size if the current one is not in the new list
                 if (results.length > 0) {
                    const currentSizeIsValid = results.some(r => r.size === cakeInfo.size);
                    if (!currentSizeIsValid) {
                        handleCakeInfoChange({ size: results[0].size });
                    }
                }
            } catch (err) {
                setBasePriceError(err instanceof Error ? err.message : 'Could not fetch size options.');
            } finally {
                setIsFetchingBasePrice(false);
            }
        };
        fetchPrice();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cakeInfo?.type, cakeInfo?.thickness]);

  // Observer for floating image
  useEffect(() => {
    if (appState !== 'customizing') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMainImageVisible(entry.isIntersecting);
      },
      {
        root: null, // viewport
        rootMargin: '0px',
        threshold: 0.1, // considered "out of view" if less than 10% is visible
      }
    );

    const currentRef = mainImageContainerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [appState]);


  const handleImageUpload = useCallback(async (file: File) => {
    clearAllState(false);
    setAppState('customizing');
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAddOnPricing(null);
    
    try {
        const imageData = await fileToBase64(file);
        setOriginalImageData(imageData);
        setOriginalImagePreview(`data:${imageData.mimeType};base64,${imageData.data}`);

        const result = await analyzeCakeImage(imageData.data, imageData.mimeType);
        
        setAnalysisId(crypto.randomUUID());
        setAnalysisResult(result);

        // --- VALIDATION & CORRECTION LOGIC ---
        let finalCakeType = result.cakeType;
        let finalCakeThickness = result.cakeThickness;
        
        const validThicknessOptions = THICKNESS_OPTIONS_MAP[finalCakeType];
        if (!validThicknessOptions.includes(finalCakeThickness)) {
            finalCakeThickness = DEFAULT_THICKNESS_MAP[finalCakeType];
        }
        // --- END VALIDATION ---

        const getFlavorCount = (type: CakeType): number => {
            if (type.includes('2 Tier')) return 2;
            if (type.includes('3 Tier')) return 3;
            return 1;
        };
        const flavorCount = getFlavorCount(finalCakeType);
        const initialFlavors: CakeFlavor[] = Array(flavorCount).fill('Chocolate Cake');

        // Populate UI state from analysis using validated/corrected values
        const newCakeInfo = { 
            type: finalCakeType, 
            thickness: finalCakeThickness, 
            flavors: initialFlavors,
            size: DEFAULT_SIZE_MAP[finalCakeType]
        };
        setCakeInfo(newCakeInfo);

        const newMainToppers = result.main_toppers.map((t): MainTopperUI => ({
            ...t,
            id: crypto.randomUUID(),
            isEnabled: true,
            price: 0, // Will be calculated
            original_type: t.type,
            replacementImage: undefined
        }));
        setMainToppers(newMainToppers);

        const newSupportElements = result.support_elements.map(s => ({
            ...s,
            id: crypto.randomUUID(),
            isEnabled: true,
            price: 0 // Will be calculated
        }));
        setSupportElements(newSupportElements);

        const newCakeMessages = result.cake_messages.map((msg): CakeMessageUI => ({
            ...msg,
            id: crypto.randomUUID(),
            isEnabled: true,
            price: 0,
        }));
        setCakeMessages(newCakeMessages);

        const newIcingDesign = {
            ...result.icing_design,
            dripPrice: 100,
        };
        setIcingDesign(newIcingDesign);
        
        // Set initial state for dirty checking
        setSavedCustomizationState(JSON.stringify({ 
            cakeInfo: newCakeInfo, 
            mainToppers: newMainToppers, 
            supportElements: newSupportElements, 
            cakeMessages: newCakeMessages, 
            icingDesign: newIcingDesign, 
            additionalInstructions: '' 
        }));

    } catch (err) {
        setAnalysisError(err instanceof Error ? err.message : "Failed to analyze image.");
    } finally {
        setIsAnalyzing(false);
    }
  }, []);
  
  const handleTopperImageReplace = useCallback(async (topperId: string, file: File) => {
    try {
        const replacementData = await fileToBase64(file);
        setMainToppers(prevToppers =>
            prevToppers.map(t =>
                t.id === topperId ? { ...t, replacementImage: replacementData } : t
            )
        );
    } catch (err) {
        console.error("Failed to process replacement image:", err);
        setError("Could not process the replacement image. Please try another file.");
    }
  }, []);

  useEffect(() => {
    if (window.__gcse) return;
    const SEARCH_ENGINE_ID = '825ca1503c1bd4d00';
    window.__gcse = {
        parsetags: 'explicit',
        callback: () => {
            if (window.google?.search?.cse) {
                setIsCSELoaded(true);
            }
        }
    };
    const script = document.createElement('script');
    script.id = 'google-cse-script';
    script.async = true;
    script.src = `https://cse.google.com/cse.js?cx=${SEARCH_ENGINE_ID}`;
    document.head.appendChild(script);
    return () => { script.remove(); delete window.__gcse; };
  }, []);
  
  useEffect(() => {
    if (appState !== 'searching' || !isCSELoaded || !searchQuery) return;
    let element = cseElementRef.current;
    if (!element) {
        const container = document.getElementById('google-search-container');
        if (container) {
            element = window.google.search.cse.element.render({
                div: 'google-search-container',
                tag: 'searchresults-only',
                gname: 'image-search',
                attributes: { searchType: 'image', disableWebSearch: true },
            });
            cseElementRef.current = element;
        } else return;
    }
    element.execute(searchQuery);
    setIsSearching(false);
  }, [appState, isCSELoaded, searchQuery]);

  useEffect(() => { if (appState !== 'searching' && cseElementRef.current) cseElementRef.current = null; }, [appState]);

  const handleImageFromUrl = useCallback(async (imageUrl: string, clickedElement: HTMLElement) => {
    const allResultImages = document.querySelectorAll('#google-search-container img');
    allResultImages.forEach(img => ((img as HTMLElement).style.border = 'none'));
    clickedElement.style.border = '3px solid #EC4899';
    clickedElement.style.opacity = '0.7';

    setIsLoading(true);
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(imageUrl)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Failed to fetch image. Status: ${response.status}`);
      const blob = await response.blob();
      const file = new File([blob], 'cake-design.jpg', { type: blob.type || 'image/jpeg' });
      await handleImageUpload(file);
    } catch (err) {
      setError("Could not load image. It may be protected or unavailable.");
      clickedElement.style.border = '3px solid #EF4444';
      setAppState('searching');
    } finally {
      setIsLoading(false);
    }
  }, [handleImageUpload]);
  
  useEffect(() => {
    if (appState !== 'searching') return;
    const handleClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        const img = target.tagName === 'IMG' ? target : target.closest('a')?.querySelector('img');
        if (img instanceof HTMLImageElement && img.src && document.getElementById('google-search-container')?.contains(img)) {
            event.preventDefault();
            handleImageFromUrl(img.src, img);
        }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [appState, handleImageFromUrl]);

  useEffect(() => {
    if (appState !== 'searching') return;
    const container = document.getElementById('google-search-container');
    if (!container) return;
    const observer = new MutationObserver(() => {
        const selectors = '.gcse-result-tabs, .gsc-tabsArea, .gsc-above-wrapper-area, .gsc-adBlock';
        container.querySelectorAll(selectors).forEach(el => (el as HTMLElement).style.display = 'none');
        
        const imageResultContainers = container.querySelectorAll('.gs-image-box:not(.customize-btn-added)');
        imageResultContainers.forEach(resultContainer => {
            const containerEl = resultContainer as HTMLElement;
            const img = containerEl.querySelector('img');

            if (img && img.src) {
                containerEl.style.position = 'relative'; // Ensure parent is positioned for absolute child

                const button = document.createElement('button');
                const sparkleIconSVG = `<svg class="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>`;
                button.innerHTML = `${sparkleIconSVG}<span>Customize</span>`;

                button.className = 'absolute bottom-2 right-2 flex items-center bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-bold py-1.5 px-3 rounded-full shadow-lg hover:shadow-xl transition-all opacity-90 hover:opacity-100 transform hover:scale-105 z-10';
                
                button.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent document click listener from firing
                    handleImageFromUrl(img.src, img);
                });

                containerEl.appendChild(button);
                containerEl.classList.add('customize-btn-added');
            }
        });
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [appState, handleImageFromUrl]);

  const handleSearch = useCallback(() => {
      const query = searchInput.trim();
      if (!query) return;
      setIsSearching(true);
      setError(null);
      setAppState('searching');
      setSearchQuery(query);
  }, [searchInput]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape' && appState === 'searching') {
        originalImageData ? setAppState('customizing') : setAppState('landing');
    }
  };

  const handleUpdateDesign = useCallback(async () => {
    if (!originalImageData || !analysisResult || !icingDesign || !cakeInfo || !customizationStateJSON) return;

    const forbiddenKeywords = ['add', 'extra', 'another', 'include', 'new topper', 'new figure', 'create', 'put a new'];
    const instructionsLower = additionalInstructions.toLowerCase();
    const foundKeyword = forbiddenKeywords.find(keyword => instructionsLower.includes(keyword));

    if (foundKeyword) {
        setError(`Instructions cannot be used to add new items (found: "${foundKeyword}"). Please use this field only to clarify changes like color or position.`);
        return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setIsLoading(true);
    setError(null);

    const prompt = EDIT_CAKE_PROMPT_TEMPLATE(
        { type: analysisResult.cakeType, thickness: analysisResult.cakeThickness, icing_design: analysisResult.icing_design },
        cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions
    );
    lastPromptRef.current = prompt;

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out after 60 seconds.")), 60000)
    );

    try {
        const editedImageResult = await Promise.race([
            editCakeImage(
                prompt,
                originalImageData,
                mainToppers
            ),
            timeoutPromise
        ]) as string;

        setEditedImage(editedImageResult);
        setActiveTab('customized');
        setSavedCustomizationState(customizationStateJSON); // Mark state as clean
        handleCalculatePrice();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while updating the design.');
    } finally {
      setIsLoading(false);
    }
  }, [originalImageData, analysisResult, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions, handleCalculatePrice, cakeInfo, customizationStateJSON]);

  const handleSave = useCallback(() => {
    if (!editedImage) return;
    const link = document.createElement('a');
    link.href = editedImage;
    link.download = `cake-genie-design-${new Date().toISOString()}.png`;
    link.click();
  }, [editedImage]);

  const handleReport = useCallback(async () => {
    if (!editedImage || !originalImageData?.data || !lastPromptRef.current || !addOnPricing) {
        setReportStatus('error');
        setTimeout(() => setReportStatus(null), 5000);
        console.error("Missing data for report.", {
            hasEdited: !!editedImage,
            hasOrig: !!originalImageData?.data,
            hasPrompt: !!lastPromptRef.current,
            hasPricing: !!addOnPricing,
        });
        return;
    }

    setIsReporting(true);
    setReportStatus(null);

    const base64CustomizedImage = editedImage.split(',')[1];

    const payload: ReportPayload = {
        original_image: originalImageData.data,
        customized_image: base64CustomizedImage,
        prompt_sent_gemini: lastPromptRef.current,
        maintoppers: JSON.stringify(mainToppers.filter(t => t.isEnabled)),
        supportelements: JSON.stringify(supportElements.filter(s => s.isEnabled)),
        cakemessages: JSON.stringify(cakeMessages.filter(m => m.isEnabled)),
        icingdesign: JSON.stringify(icingDesign),
        addon_price: addOnPricing.addOnPrice,
    };
    
    try {
        await reportCustomization(payload);
        setReportStatus('success');
    } catch (err) {
        setReportStatus('error');
    } finally {
        setIsReporting(false);
        setTimeout(() => setReportStatus(null), 5000);
    }
  }, [editedImage, originalImageData, mainToppers, supportElements, cakeMessages, icingDesign, addOnPricing]);
  
  const buildCartItemDetails = useCallback((): CartItemDetails => {
    if (!cakeInfo || !icingDesign) throw new Error("Missing data for cart item.");

    const hexToName = (hex: string) => HEX_TO_COLOR_NAME_MAP[hex.toLowerCase()] || hex;

    return {
        cakeInfo: {
            type: cakeTypeDisplayMap[cakeInfo.type],
            thickness: cakeInfo.thickness,
            size: cakeInfo.size,
            flavors: cakeInfo.flavors,
        },
        mainToppers: mainToppers.filter(t => t.isEnabled).map(t => `${t.description} (${t.size})`),
        supportElements: supportElements.filter(s => s.isEnabled).map(s => `${s.description} (${s.coverage})`),
        cakeMessages: cakeMessages.filter(m => m.isEnabled).map(m => ({ text: m.text, color: hexToName(m.color) })),
        icingDesign: {
            drip: icingDesign.drip,
            gumpasteBaseBoard: icingDesign.gumpasteBaseBoard,
            colors: Object.entries(icingDesign.colors).reduce((acc, [key, value]) => {
                if (typeof value === 'string' && value) {
                    acc[key] = hexToName(value);
                }
                return acc;
            }, {} as Record<string, string>),
        },
        additionalInstructions: additionalInstructions.trim(),
    };
  }, [cakeInfo, icingDesign, mainToppers, supportElements, cakeMessages, additionalInstructions, HEX_TO_COLOR_NAME_MAP]);
  
  const selectedPriceOption = useMemo(() => basePriceOptions?.find(opt => opt.size === cakeInfo?.size), [basePriceOptions, cakeInfo?.size]);
  const basePrice = selectedPriceOption?.price;

  const handleAddToCart = useCallback(async () => {
    if (!originalImageData || !originalImagePreview || !cakeInfo || !icingDesign || !analysisResult || !customizationStateJSON || basePrice === undefined) return;

    const cartItemDetails = buildCartItemDetails();
    const finalPrice = basePrice + (addOnPricing?.addOnPrice ?? 0);

    if (!isDirty) {
        const newItem: CartItem = {
            id: crypto.randomUUID(),
            image: editedImage || originalImagePreview,
            cakeSize: cakeInfo.size,
            totalPrice: finalPrice,
            details: cartItemDetails,
            status: 'complete',
        };
        setCartItems(prev => [...prev, newItem]);
        setAppState('cart');
    } else {
        const pendingId = crypto.randomUUID();
        const pendingItem: CartItem = {
            id: pendingId,
            image: null,
            cakeSize: cakeInfo.size,
            totalPrice: finalPrice,
            details: cartItemDetails,
            status: 'pending',
        };
        
        setCartItems(prev => [...prev, pendingItem]);
        setAppState('cart');
        
        try {
            const prompt = EDIT_CAKE_PROMPT_TEMPLATE(
                { type: analysisResult.cakeType, thickness: analysisResult.cakeThickness, icing_design: analysisResult.icing_design },
                cakeInfo, mainToppers, supportElements, cakeMessages, icingDesign, additionalInstructions
            );
            lastPromptRef.current = prompt;

            const newEditedImage = await editCakeImage(
                prompt,
                originalImageData,
                mainToppers
            );

            setEditedImage(newEditedImage);
            setActiveTab('customized');
            setSavedCustomizationState(customizationStateJSON);

            setCartItems(prev => prev.map(item => 
                item.id === pendingId 
                ? { ...item, status: 'complete', image: newEditedImage } 
                : item
            ));
        } catch (err) {
            setCartItems(prev => prev.map(item => 
                item.id === pendingId 
                ? { ...item, status: 'error', errorMessage: err instanceof Error ? err.message : 'Design update failed.' } 
                : item
            ));
        }
    }
  }, [
      isDirty, originalImageData, originalImagePreview, editedImage, cakeInfo, icingDesign, analysisResult, mainToppers, supportElements, cakeMessages, additionalInstructions,
      customizationStateJSON, buildCartItemDetails, basePrice, addOnPricing?.addOnPrice
  ]);

  const handleRemoveFromCart = useCallback((itemId: string) => {
      setCartItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const handleGoBack = () => {
    setAppState(previousAppState.current || 'landing');
  };

  const renderLanding = () => (
    <div className="text-center">
      <div className="relative inline-block">
        <h1 className="text-5xl md:text-6xl font-extrabold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text pb-2">
          Cake Genie
        </h1>
        <span className="absolute top-0 -right-5 transform -translate-y-1/2 translate-x-1/2 rotate-12 bg-yellow-300 text-yellow-800 text-xs font-bold px-2.5 py-1 rounded-full shadow-md">ALPHA</span>
      </div>
      <p className="text-slate-600 mt-2 mb-8 text-lg">Your wish, delivered.</p>
      <div className="relative max-w-2xl mx-auto">
        <input type="text" className="w-full pl-5 pr-28 md:pr-24 py-4 text-sm border-slate-200 border rounded-full shadow-lg focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow" placeholder="Search for cake designs (e.g., 'blue unicorn cake')" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleKeyDown}/>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          <button type="button" onClick={() => setIsUploaderOpen(true)} className="p-3 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-100 transition-colors" aria-label="Upload an image"><CameraIcon /></button>
          <button type="button" onClick={handleSearch} className="p-3 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-100 transition-colors" aria-label="Search"><SearchIcon /></button>
        </div>
      </div>
      <p className="text-slate-500 text-sm mt-4">Upload or search any cake design, customize your cake and get instant pricing.</p>
    </div>
  );

  const renderSearching = () => (
    <div className="w-full max-w-6xl mx-auto h-full flex flex-col">
      <div className="relative max-w-2xl mx-auto mb-6 w-full">
        <input type="text" className="w-full pl-5 pr-28 md:pr-24 py-3 text-base border-slate-200 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow" placeholder="Search for cake designs..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} onKeyDown={handleKeyDown}/>
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          <button type="button" onClick={() => originalImageData ? setAppState('customizing') : setAppState('landing')} className="p-3 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-100 transition-colors" aria-label="Close search"><CloseIcon /></button>
          <button type="button" onClick={handleSearch} className="p-3 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-100 transition-colors" aria-label="Search"><SearchIcon /></button>
        </div>
      </div>
      <p className="text-center text-slate-500 mb-4">Search results for: <span className="font-semibold text-slate-700">"{searchQuery}"</span></p>
      {error && <div className="text-center p-4 my-4 bg-red-50 rounded-lg max-w-md mx-auto"><p className="font-semibold text-red-600">Error</p><p className="text-sm text-red-500">{error}</p></div>}
      {isSearching && <div className="flex flex-col items-center justify-center min-h-[300px]"><LoadingSpinner /><p className="mt-4 text-slate-500">Searching for cakes...</p></div>}
      <div className="relative flex-grow">
        {isLoading && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-lg"><LoadingSpinner /><p className="mt-4 text-slate-600 font-semibold">Preparing Image for Analysis...</p></div>}
        <div id="google-search-container" className="flex-grow min-h-[400px]"></div>
      </div>
    </div>
  );

  const renderCustomizing = () => {
    const finalPrice = basePrice !== undefined && addOnPricing ? basePrice + addOnPricing.addOnPrice : null;

    return (
     <div className="flex flex-col items-center gap-3 w-full max-w-6xl mx-auto pb-28"> {/* Added padding-bottom */}
        <div className="w-full flex items-center gap-4 sticky top-4 z-30">
            <button onClick={handleGoBack} className="p-2 text-slate-600 hover:text-purple-700 transition-colors flex-shrink-0" aria-label="Go back">
                <BackIcon />
            </button>
            <div className="relative flex-grow">
                <input
                    type="text"
                    className="w-full pl-5 pr-12 py-3 text-sm bg-white border-slate-200 border rounded-full shadow-md focus:ring-2 focus:ring-purple-400 focus:outline-none transition-shadow"
                    placeholder="Search for other designs..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                 <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                    <button type="button" onClick={handleSearch} className="p-3 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-100 transition-colors" aria-label="Search">
                        <SearchIcon />
                    </button>
                </div>
            </div>
            <button onClick={() => setAppState('cart')} className="relative p-2 text-slate-600 hover:text-purple-700 transition-colors flex-shrink-0" aria-label={`View cart with ${cartItems.length} items`}>
                <CartIcon />
                {cartItems.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold">
                        {cartItems.length}
                    </span>
                )}
            </button>
        </div>

        <div className="w-full max-w-4xl text-center bg-yellow-100 border border-yellow-200 text-yellow-800 text-sm font-semibold px-4 py-2 rounded-xl shadow-sm mt-[18px]">
            ALPHA TEST: Features are experimental. Please report any issues.
        </div>
        <div ref={mainImageContainerRef} className="w-full max-w-4xl aspect-[7/6] bg-white/70 backdrop-blur-lg rounded-2xl shadow-lg border border-slate-200 flex flex-col">
            <div className="p-2 flex-shrink-0">
                <div className="bg-slate-100 p-1 rounded-lg flex space-x-1">
                    <button onClick={() => setActiveTab('original')} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'original' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50'}`}>Original</button>
                    <button onClick={() => setActiveTab('customized')} disabled={!editedImage} className={`w-1/2 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out ${activeTab === 'customized' ? 'bg-white shadow text-purple-700' : 'text-slate-600 hover:bg-white/50 disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed'}`}>Customized</button>
                </div>
            </div>
            <div className="relative flex-grow flex items-center justify-center p-2 pt-0 min-h-0">
                {isLoading && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20"><LoadingSpinner /><p className="mt-4 text-slate-500 font-semibold">Working magic...</p></div>}
                {error && <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center rounded-b-2xl z-20 p-4"><ErrorIcon /><p className="mt-4 font-semibold text-red-600">Update Failed</p><p className="text-sm text-red-500 text-center">{error}</p></div>}
                {!originalImagePreview && !isAnalyzing && <div className="text-center text-slate-400"><ImageIcon /><p className="mt-2 font-semibold">Your creation will appear here</p></div>}
                {(originalImagePreview) && (
                  <button
                    type="button"
                    onClick={() => setIsMainZoomModalOpen(true)}
                    className="w-full h-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 rounded-lg"
                    aria-label="Enlarge image"
                  >
                    <img key={activeTab} src={activeTab === 'customized' ? (editedImage || originalImagePreview) : originalImagePreview} alt={activeTab === 'customized' && editedImage ? "Edited Cake" : "Original Cake"} className="max-w-full max-h-full object-contain rounded-lg"/>
                  </button>
                )}
            </div>
        </div>

        {originalImageData && (
            <div className="w-full max-w-4xl">
                <button onClick={handleUpdateDesign} disabled={isLoading || isAnalyzing || !analysisResult} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-4 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center text-lg">
                    <MagicSparkleIcon />Update Design
                </button>
            </div>
        )}

        <div className="w-full max-w-4xl bg-white/70 backdrop-blur-lg p-6 rounded-2xl shadow-lg border border-slate-200">
            {analysisResult || isAnalyzing || analysisError ? (
                 <FeatureList
                    isAnalyzing={isAnalyzing}
                    analysisError={analysisError}
                    analysisId={analysisId}
                    cakeInfo={cakeInfo}
                    basePriceOptions={basePriceOptions}
                    mainToppers={mainToppers}
                    supportElements={supportElements}
                    cakeMessages={cakeMessages}
                    icingDesign={icingDesign}
                    additionalInstructions={additionalInstructions}
                    onCakeInfoChange={handleCakeInfoChange}
                    onMainTopperChange={setMainToppers}
                    onSupportElementChange={setSupportElements}
                    onCakeMessageChange={setCakeMessages}
                    onIcingDesignChange={setIcingDesign}
                    onAdditionalInstructionsChange={setAdditionalInstructions}
                    onTopperImageReplace={handleTopperImageReplace}
                />
            ) : <div className="text-center p-8 text-slate-500"><p>Upload an image to get started.</p></div>}
        </div>

        {originalImageData && (
          <div className="w-full max-w-4xl flex flex-col items-center gap-3">
            <div className="w-full flex items-center justify-end gap-4">
              <button onClick={handleReport} disabled={!editedImage || isLoading || isReporting} className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Report an issue with this image">
                  <ReportIcon />
                  <span className="ml-2">{isReporting ? 'Submitting...' : 'Report Issue'}</span>
              </button>
              <button onClick={handleSave} disabled={!editedImage || isLoading} className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Save customized image"><SaveIcon /><span className="ml-2">Save</span></button>
              <button onClick={() => clearAllState()} className="flex items-center justify-center text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-200 py-2 px-4 rounded-lg transition-colors" aria-label="Reset everything"><ResetIcon /><span className="ml-2">Reset Everything</span></button>
            </div>
             {reportStatus && (
                <div className={`w-full text-center text-sm font-semibold p-2 rounded-md transition-opacity duration-300 ${reportStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {reportStatus === 'success' ? 'Report submitted successfully. Thank you for your feedback!' : 'Failed to submit report. Please try again.'}
                </div>
            )}
          </div>
        )}
     </div>
    );
  };
  
  return (
    <main className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-x-hidden">
        <AnimatedBlobs />
        {appState === 'landing' && (
            <button
                onClick={() => setAppState('cart')}
                className="fixed top-4 right-4 z-20 p-2 text-slate-600 hover:text-purple-700 transition-colors"
                aria-label={`View cart with ${cartItems.length} items`}>
                <CartIcon />
                {cartItems.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold">
                        {cartItems.length}
                    </span>
                )}
            </button>
        )}
        {appState === 'customizing' && (
            <>
                <ImageZoomModal
                    isOpen={isMainZoomModalOpen}
                    onClose={() => setIsMainZoomModalOpen(false)}
                    originalImage={originalImagePreview}
                    customizedImage={editedImage}
                    initialTab={activeTab}
                />
                <FloatingImagePreview
                    isVisible={!isMainImageVisible}
                    originalImage={originalImagePreview}
                    customizedImage={editedImage}
                    isLoading={isLoading}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    onUpdateDesign={handleUpdateDesign}
                    isAnalyzing={isAnalyzing}
                    analysisResult={analysisResult}
                />
                <StickyAddToCartBar
                    price={basePrice === undefined ? null : basePrice + (addOnPricing?.addOnPrice ?? 0)}
                    isLoading={isFetchingBasePrice}
                    error={basePriceError}
                    onAddToCartClick={handleAddToCart}
                />
            </>
        )}
        <ImageUploader isOpen={isUploaderOpen} onClose={() => setIsUploaderOpen(false)} onImageSelect={(file) => { handleImageUpload(file); setIsUploaderOpen(false); }} />
        
        {appState === 'landing' && renderLanding()}
        {appState === 'searching' && renderSearching()}
        {appState === 'customizing' && renderCustomizing()}
        {appState === 'cart' && <CartView items={cartItems} onRemoveItem={handleRemoveFromCart} onClose={() => originalImageData ? setAppState('customizing') : setAppState('landing')} onContinueShopping={() => setAppState('landing')} />}

    </main>
  );
}