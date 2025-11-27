'use client';

import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent, useMemo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { showSuccess, showError } from '../../../lib/utils/toast';
import { CakeGenieOrder, CakeGenieOrderItem, PaymentStatus, OrderStatus } from '../../../lib/database.types';
import { useOrders, useUploadPaymentProof, useOrderDetails, useCancelOrder } from '../../../hooks/useOrders';
import { Loader2, ArrowLeft, ChevronDown, Package, Clock, CreditCard, CheckCircle, UploadCloud, Trash2, X, Users } from 'lucide-react';
import { OrdersSkeleton, Skeleton } from '../../../components/LoadingSkeletons';
import { ImageZoomModal } from '../../../components/ImageZoomModal';
import DetailItem from '../../../components/UI/DetailItem';
import LazyImage from '../../../components/LazyImage';
import BillShareCard from '../../../components/BillShareCard';

interface EnrichedOrder extends CakeGenieOrder {
    cakegenie_order_items?: any[]; // Can be items or count object
    cakegenie_addresses?: any;
}

// Combined type for the unified list
type CreationItem = (EnrichedOrder & { type: 'order' }) | (any & { type: 'bill_sharing' });

// --- Status Badge Component ---
const statusStyles: Record<OrderStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    in_progress: "bg-indigo-100 text-indigo-800",
    ready_for_delivery: "bg-purple-100 text-purple-800",
    out_for_delivery: "bg-cyan-100 text-cyan-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
};

const paymentStatusStyles: Record<PaymentStatus, string> = {
    pending: "bg-orange-100 text-orange-800",
    verifying: "bg-purple-100 text-purple-800",
    paid: "bg-green-100 text-green-800",
    partial: "bg-blue-100 text-blue-800",
    refunded: "bg-gray-100 text-gray-800",
    failed: "bg-red-100 text-red-800"
};

const orderStatusTextMap: Partial<Record<OrderStatus, string>> = {
    pending: "Order Pending",
    confirmed: "Order Confirmed",
    in_progress: "In Progress",
    ready_for_delivery: "Ready for Delivery",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
};

const paymentStatusTextMap: Partial<Record<PaymentStatus, string>> = {
    pending: "Payment Pending",
    verifying: "Payment Verifying",
    paid: "Paid",
    partial: "Partial Payment",
    refunded: "Refunded",
    failed: "Payment Failed",
};

const StatusBadge: React.FC<{ status: OrderStatus | PaymentStatus; type: 'order' | 'payment' }> = ({ status, type }) => {
    const styles = type === 'order' ? statusStyles : paymentStatusStyles;
    let text: string;

    if (type === 'order' && orderStatusTextMap[status as OrderStatus]) {
        text = orderStatusTextMap[status as OrderStatus]!;
    } else if (type === 'payment' && paymentStatusTextMap[status as PaymentStatus]) {
        text = paymentStatusTextMap[status as PaymentStatus]!;
    } else {
        text = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles]}`}>
            {text}
        </span>
    );
};

// --- Payment Upload Form ---
const PaymentUploadForm: React.FC<{ order: EnrichedOrder; onUploadSuccess: (updatedOrder: CakeGenieOrder) => void }> = ({ order, onUploadSuccess }) => {
    const { user } = useAuth();
    const uploadMutation = useUploadPaymentProof();
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
                showError("File is too large. Maximum size is 5MB.");
                return;
            }
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!file || !user) {
            showError("Please select a file to upload.");
            return;
        }
        uploadMutation.mutate({ orderId: order.order_id, userId: user.id, file }, {
            onSuccess: (updatedOrder) => {
                showSuccess("Payment proof uploaded successfully!");
                if (updatedOrder) {
                    onUploadSuccess(updatedOrder);
                }
            },
            onError: (err: any) => {
                showError(err.message || "Failed to upload payment proof.");
            }
        });
    };

    return (
        <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <h4 className="text-sm font-semibold text-slate-800">Upload Payment Proof (Manual)</h4>
            <p className="text-xs text-slate-500 mt-1">For manual bank transfers, submit a clear image of your receipt.</p>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
                <div className="flex items-center gap-4">
                    <label htmlFor={`file-upload-${order.order_id}`} className="flex-grow cursor-pointer">
                        <div className="flex items-center justify-center w-full px-4 py-3 text-sm text-slate-600 bg-white border-2 border-dashed border-slate-300 rounded-lg hover:bg-slate-100 transition-colors">
                            <UploadCloud className="w-5 h-5 mr-2 text-slate-400" />
                            <span>{file ? file.name : 'Choose a file...'}</span>
                        </div>
                        <input id={`file-upload-${order.order_id}`} type="file" className="hidden" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleFileChange} />
                    </label>
                    {preview && <LazyImage src={preview} alt="Preview" className="w-12 h-12 object-cover rounded-md" />}
                </div>
                <button type="submit" disabled={!file || uploadMutation.isPending} className="w-full flex justify-center items-center bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-lg shadow-sm transition-all text-sm disabled:opacity-50">
                    {uploadMutation.isPending ? <><Loader2 className="animate-spin mr-2 w-4 h-4" /> Submitting...</> : 'Submit Proof'}
                </button>
            </form>
        </div>
    );
};


// --- Order Details Expansion ---
const OrderDetails: React.FC<{ order: EnrichedOrder; onOrderUpdate: (updatedOrder: EnrichedOrder) => void; }> = ({ order, onOrderUpdate }) => {
    const { user } = useAuth();
    const { data: details, isLoading } = useOrderDetails(order.order_id, user?.id, true);
    const [zoomedItem, setZoomedItem] = useState<CakeGenieOrderItem | null>(null);

    if (isLoading) {
        return <div className="p-4"><Skeleton className="h-24 w-full" /></div>;
    }

    if (!details) {
        return <div className="p-4 text-center text-sm text-red-600">Could not load order details.</div>;
    }

    const deliveryDate = new Date(details.delivery_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const colorLabelMap: Record<string, string> = {
        side: 'Side', top: 'Top', borderTop: 'Top Border', borderBase: 'Base Border', drip: 'Drip', gumpasteBaseBoardColor: 'Base Board'
    };

    return (
        <>
            <div className="space-y-4">
                <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-2">Items</h4>
                    <div className="space-y-4">
                        {details.cakegenie_order_items?.map(item => {
                            const details = item.customization_details;
                            const tierLabels = details.flavors.length === 2
                                ? ['Top Tier', 'Bottom Tier']
                                : details.flavors.length === 3
                                    ? ['Top Tier', 'Middle Tier', 'Bottom Tier']
                                    : ['Flavor'];

                            return (
                                <div key={item.item_id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setZoomedItem(item)}
                                            className="w-24 h-24 flex-shrink-0 rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-transform hover:scale-105"
                                            aria-label="Enlarge cake image"
                                        >
                                            <LazyImage src={item.customized_image_url} alt={item.cake_type} className="w-full h-full object-cover" />
                                        </button>
                                        <div className="flex-grow">
                                            <p className="font-semibold text-slate-800">{item.cake_type}</p>
                                            <p className="text-sm text-slate-500">{item.cake_size}</p>
                                            <p className="text-lg font-bold text-pink-600 mt-1">₱{item.final_price.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    {details && (
                                        <details className="mt-3">
                                            <summary className="text-xs font-semibold text-slate-600 cursor-pointer">View Customization Details</summary>
                                            <div className="mt-2 pl-2 border-l-2 border-slate-200 space-y-1.5 text-xs text-slate-500">
                                                <DetailItem label="Type" value={`${item.cake_type}, ${item.cake_thickness}, ${item.cake_size}`} />
                                                {details.flavors.length <= 1 ? (
                                                    <DetailItem label="Flavor" value={details.flavors[0] || 'N/A'} />
                                                ) : (
                                                    details.flavors.map((flavor, idx) => (
                                                        <DetailItem key={idx} label={`${tierLabels[idx]} Flavor`} value={flavor} />
                                                    ))
                                                )}
                                                {details.mainToppers.length > 0 && <DetailItem label="Main Toppers" value={details.mainToppers.map(t => t.description).join(', ')} />}
                                                {details.supportElements.length > 0 && <DetailItem label="Support" value={details.supportElements.map(s => s.description).join(', ')} />}
                                                {details.cakeMessages.map((msg, idx) => (
                                                    <DetailItem key={idx} label={`Message #${idx + 1}`} value={`'${msg.text}' (${msg.color})`} />
                                                ))}
                                                {details.icingDesign.drip && <DetailItem label="Icing" value="Has Drip Effect" />}
                                                {details.icingDesign.gumpasteBaseBoard && <DetailItem label="Icing" value="Gumpaste Base Board" />}
                                                {Object.entries(details.icingDesign.colors).map(([loc, color]) => (
                                                    <DetailItem key={loc} label={`${colorLabelMap[loc] || loc.charAt(0).toUpperCase() + loc.slice(1)} Color`} value={color} />
                                                ))}
                                                {details.additionalInstructions && <DetailItem label="Instructions" value={details.additionalInstructions} />}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-2">Delivery Details</h4>
                    <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                        <p><span className="font-semibold text-slate-600">Date:</span> {deliveryDate} ({details.delivery_time_slot})</p>
                        {details.cakegenie_addresses && (
                            <>
                                <p><span className="font-semibold text-slate-600">To:</span> {details.cakegenie_addresses.recipient_name}</p>
                                <p className="text-slate-500">{`${details.cakegenie_addresses.street_address}, ${details.cakegenie_addresses.barangay}, ${details.cakegenie_addresses.city}`}</p>
                            </>
                        )}
                    </div>
                </div>

                {details.payment_status === 'pending' && (
                    <PaymentUploadForm order={details} onUploadSuccess={onOrderUpdate} />
                )}

                {details.payment_status === 'verifying' && (
                    <div className="p-3 text-center bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                        <CheckCircle className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                        <p className="font-semibold">Payment proof submitted.</p>
                        <p>We are currently reviewing your payment. Please wait for confirmation.</p>
                    </div>
                )}
                {details.payment_proof_url && details.payment_status !== 'pending' && (
                    <a href={details.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-600 hover:underline text-center block mt-2">View Submitted Proof</a>
                )}
            </div>
            <ImageZoomModal
                isOpen={!!zoomedItem}
                onClose={() => setZoomedItem(null)}
                originalImage={zoomedItem?.original_image_url || null}
                customizedImage={zoomedItem?.customized_image_url || null}
            />
        </>
    );
};


// --- Order Card Component ---
interface OrderCardProps {
    order: EnrichedOrder;
    onOrderUpdate: (updatedOrder: EnrichedOrder) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onOrderUpdate }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { user } = useAuth();
    const cancelMutation = useCancelOrder();
    const [copied, setCopied] = useState(false);

    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // The query now returns the full items array, so we use .length for the count.
    const itemCount = order.cakegenie_order_items?.length ?? 0;

    const handleCancelOrder = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) {
            showError("You must be logged in to cancel orders.");
            return;
        }

        cancelMutation.mutate({ orderId: order.order_id, userId: user.id }, {
            onSuccess: (updatedOrder) => {
                if (updatedOrder) {
                    onOrderUpdate(updatedOrder as EnrichedOrder);
                }
            }
        });
    };

    const handleCopyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        const link = `${window.location.origin}/#/contribute/${order.order_id}`;
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            showSuccess('Link copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // Split Order Calculations
    const isSplitOrder = order.is_split_order;
    const collected = order.amount_collected || 0;
    const total = order.total_amount;
    const progress = Math.min((collected / total) * 100, 100);
    const remaining = Math.max(total - collected, 0);
    const isFullyFunded = remaining <= 0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="font-mono text-sm font-bold text-slate-800">#{order.order_number}</p>
                            {isSplitOrder && (
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                                    Split Order
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Placed on {orderDate}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold text-pink-600">₱{order.total_amount.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">{itemCount} item(s)</p>
                    </div>
                </div>

                {/* Split Order Progress Bar (Visible in collapsed view too) */}
                {isSplitOrder && (
                    <div className="mt-3 mb-1">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-600 font-medium">Collected: ₱{collected.toLocaleString()}</span>
                            <span className="text-slate-500">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${isFullyFunded ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 text-right">
                            {isFullyFunded ? 'Fully Funded' : `₱${remaining.toLocaleString()} remaining`}
                        </p>
                    </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <StatusBadge status={order.order_status} type="order" />
                            <StatusBadge status={order.payment_status} type="payment" />
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Share Button for Split Orders */}
                            {isSplitOrder && !isFullyFunded && (
                                <button
                                    onClick={handleCopyLink}
                                    className="p-2 sm:px-3 sm:py-1.5 text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-2"
                                    title="Copy Contribution Link"
                                >
                                    {copied ? <CheckCircle className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                                    <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
                                </button>
                            )}

                            {order.order_status === 'pending' && (
                                <button
                                    onClick={handleCancelOrder}
                                    disabled={cancelMutation.isPending}
                                    title="Cancel Order"
                                    type="button"
                                    className="p-2 sm:px-3 sm:py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {cancelMutation.isPending && cancelMutation.variables?.orderId === order.order_id ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="hidden sm:inline">Cancelling...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4" />
                                            <span className="hidden sm:inline">Cancel</span>
                                        </>
                                    )}
                                </button>
                            )}
                            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-200 animate-fade-in">
                    <style>{`.animate-fade-in { animation: fadeIn 0.3s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

                    {/* Expanded Split Order Details */}
                    {isSplitOrder && (
                        <div className="mb-6 mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="text-sm font-bold text-purple-900">Split Order Details</h4>
                                    <p className="text-xs text-purple-700 mt-0.5">Share the link below with friends to collect contributions.</p>
                                </div>
                                <button
                                    onClick={handleCopyLink}
                                    className="text-xs font-semibold text-purple-600 hover:text-purple-800 flex items-center gap-1 bg-white px-2 py-1 rounded-md border border-purple-200 shadow-sm"
                                >
                                    {copied ? <CheckCircle className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                                    {copied ? 'Copied!' : 'Copy Link'}
                                </button>
                            </div>

                            <div className="bg-white p-2 rounded-lg border border-purple-100 flex items-center justify-between gap-2">
                                <code className="text-xs text-slate-600 truncate flex-1">
                                    {`${window.location.origin}/#/contribute/${order.order_id}`}
                                </code>
                            </div>
                        </div>
                    )}

                    <OrderDetails order={order} onOrderUpdate={onOrderUpdate} />
                </div>
            )}
        </div>
    );
};


// --- Main Page Component ---
interface OrdersPageProps {
    onClose: () => void;
}

export default function OrdersPage({ onClose }: OrdersPageProps) {
    const { user, loading: authLoading } = useAuth();
    const userId = user?.id;
    const [currentPage, setCurrentPage] = useState(1);
    const [allOrders, setAllOrders] = useState<EnrichedOrder[]>([]);
    const [billShareDesigns, setBillShareDesigns] = useState<any[]>([]);
    const ORDERS_PER_PAGE = 5;

    const { data: pageData, isLoading: pageLoading, isFetching, error } = useOrders(userId, {
        limit: ORDERS_PER_PAGE,
        offset: (currentPage - 1) * ORDERS_PER_PAGE,
        includeItems: true,
    });

    useEffect(() => {
        if (error) {
            showError(error instanceof Error ? error.message : "Could not fetch your orders.");
        }
    }, [error]);

    const totalOrderCount = pageData?.totalOrderCount || 0;
    const totalItemCount = (pageData?.totalOrderCount || 0) + (pageData?.designs?.length || 0);

    useEffect(() => {
        if (pageData) {
            if (currentPage === 1) {
                setAllOrders(pageData.orders);
                setBillShareDesigns(pageData.designs); // Only set designs on first page load
            } else {
                setAllOrders(prevOrders => {
                    const existingOrderIds = new Set(prevOrders.map(o => o.order_id));
                    const newOrders = pageData.orders.filter(o => !existingOrderIds.has(o.order_id));
                    return [...prevOrders, ...newOrders];
                });
            }
        }
    }, [pageData, currentPage]);

    const combinedItems = useMemo<CreationItem[]>(() => {
        const ordersWithType: CreationItem[] = allOrders.map(o => ({ ...o, type: 'order' }));
        const designsWithType: CreationItem[] = billShareDesigns.map(d => ({ ...d, type: 'bill_sharing' }));
        return [...ordersWithType, ...designsWithType].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [allOrders, billShareDesigns]);

    useEffect(() => {
        setCurrentPage(1);
        setAllOrders([]);
        setBillShareDesigns([]);
    }, [userId]);

    const handleLoadMore = () => {
        if (!isFetching && allOrders.length < totalOrderCount) {
            setCurrentPage(p => p + 1);
        }
    };

    const handleOrderUpdate = useCallback((updatedOrder: EnrichedOrder) => {
        setAllOrders(currentOrders =>
            currentOrders.map(order =>
                order.order_id === updatedOrder.order_id ? { ...order, ...updatedOrder } : order
            )
        );
    }, []);

    const handleDesignUpdate = useCallback((updatedDesign: any) => {
        setBillShareDesigns(currentDesigns =>
            currentDesigns.map(design =>
                design.design_id === updatedDesign.design_id ? { ...design, ...updatedDesign } : design
            )
        );
    }, []);

    const initialLoading = authLoading || (pageLoading && combinedItems.length === 0);

    if (initialLoading) {
        return (
            <div className="w-full max-w-3xl mx-auto py-8 px-4">
                <div className="flex items-center gap-4 mb-6">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-8 w-40" />
                </div>
                <OrdersSkeleton count={3} />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="w-full max-w-3xl mx-auto py-8 px-4 text-center">
                <p className="text-slate-600">You must be logged in to view your orders.</p>
                <button onClick={onClose} className="mt-4 text-pink-600 font-semibold hover:underline">Go Back</button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto pb-8 px-4">
            <div className="flex items-center gap-4 mb-6 pt-4">
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                    <ArrowLeft />
                </button>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">My Orders</h1>
            </div>

            <div className="space-y-4">
                {combinedItems.length > 0 ? (
                    combinedItems.map(item => {
                        if (item.type === 'order') {
                            return <OrderCard key={item.order_id} order={item} onOrderUpdate={handleOrderUpdate} />;
                        }
                        if (item.type === 'bill_sharing') {
                            return <BillShareCard key={item.design_id} design={item} onDesignUpdate={handleDesignUpdate} />;
                        }
                        return null;
                    })
                ) : (
                    <div className="text-center py-16 bg-white/50 rounded-2xl">
                        <Package className="w-12 h-12 mx-auto text-slate-400" />
                        <p className="text-slate-500 mt-4">You haven't placed any orders or created any designs yet.</p>
                        <button onClick={onClose} className="mt-4 text-pink-600 font-semibold hover:underline">Start Designing</button>
                    </div>
                )}
            </div>

            <div className="mt-6 text-center">
                <p className="text-sm text-slate-500 mb-4">Showing {combinedItems.length} of {totalItemCount} items.</p>
                {allOrders.length < totalOrderCount && (
                    <button
                        onClick={handleLoadMore}
                        disabled={isFetching}
                        className="flex items-center justify-center mx-auto bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all text-sm disabled:opacity-75"
                    >
                        {isFetching ? (
                            <>
                                <Loader2 className="animate-spin mr-2 w-4 h-4" />
                                Loading...
                            </>
                        ) : (
                            'Load More Orders'
                        )}
                    </button>
                )}
            </div>

        </div>
    );
}