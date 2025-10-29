
'use client';

import React, { useState, useEffect, useCallback, ChangeEvent, FormEvent } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { showSuccess, showError } from '../../../lib/utils/toast';
import { CakeGenieOrder, CakeGenieOrderItem, PaymentStatus, OrderStatus } from '../../../lib/database.types';
import { useOrders, useUploadPaymentProof, useOrderDetails, useCancelOrder } from '../../../hooks/useOrders';
import { Loader2, ArrowLeft, ChevronDown, Package, Clock, CreditCard, CheckCircle, UploadCloud, Trash2 } from 'lucide-react';
import { OrdersSkeleton, Skeleton } from '../../../components/LoadingSkeletons';

interface EnrichedOrder extends CakeGenieOrder {
  cakegenie_order_items?: any[]; // Can be items or count object
  cakegenie_addresses?: any;
}

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
                    {preview && <img src={preview} alt="Preview" className="w-12 h-12 object-cover rounded-md" />}
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

    if (isLoading) {
        return <div className="p-4"><Skeleton className="h-24 w-full" /></div>;
    }

    if (!details) {
        return <div className="p-4 text-center text-sm text-red-600">Could not load order details.</div>;
    }
    
    const deliveryDate = new Date(details.delivery_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

    return (
        <div className="space-y-4">
            <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Items</h4>
                <div className="space-y-3">
                    {details.cakegenie_order_items?.map(item => (
                        <div key={item.item_id} className="flex gap-3 items-center">
                            <img src={item.customized_image_url} alt={item.cake_type} className="w-12 h-12 object-cover rounded-md flex-shrink-0" />
                            <div className="flex-grow">
                                <p className="text-xs font-medium text-slate-700">{item.cake_type}</p>
                                <p className="text-xs text-slate-500">{item.cake_size}</p>
                            </div>
                            <p className="text-xs font-semibold text-slate-600">₱{item.final_price.toLocaleString()}</p>
                        </div>
                    ))}
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
                    <CheckCircle className="w-5 h-5 mx-auto mb-1 text-blue-600"/>
                    <p className="font-semibold">Payment proof submitted.</p>
                    <p>We are currently reviewing your payment. Please wait for confirmation.</p>
                </div>
            )}
            {details.payment_proof_url && details.payment_status !== 'pending' && (
               <a href={details.payment_proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-600 hover:underline text-center block mt-2">View Submitted Proof</a>
            )}
        </div>
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
    
    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // The query now returns an array with a count object, e.g., [{ count: 2 }]
    const itemCount = order.cakegenie_order_items?.[0]?.count ?? 0;

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

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-mono text-sm font-bold text-slate-800">#{order.order_number}</p>
                        <p className="text-xs text-slate-500 mt-1">Placed on {orderDate}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-lg font-bold text-pink-600">₱{order.total_amount.toLocaleString()}</p>
                        <p className="text-xs text-slate-500">{itemCount} item(s)</p>
                    </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <StatusBadge status={order.order_status} type="order" />
                            <StatusBadge status={order.payment_status} type="payment" />
                        </div>
                        <div className="flex items-center gap-3">
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
    const { user } = useAuth();
    const userId = user?.id;
    const [currentPage, setCurrentPage] = useState(1);
    const [allOrders, setAllOrders] = useState<EnrichedOrder[]>([]);
    const ORDERS_PER_PAGE = 5;

    const { data: pageData, isLoading: pageLoading, isFetching, error } = useOrders(userId, {
        limit: ORDERS_PER_PAGE,
        offset: (currentPage - 1) * ORDERS_PER_PAGE,
        includeItems: false, // Fetch only item counts for the list view
    });

    useEffect(() => {
        if (error) {
            showError(error instanceof Error ? error.message : "Could not fetch your orders.");
        }
    }, [error]);

    const totalOrderCount = pageData?.totalCount || 0;
    
    // Effect to append new orders to the list
    useEffect(() => {
        if (pageData?.orders) {
            if (currentPage === 1) {
                setAllOrders(pageData.orders);
            } else {
                setAllOrders(prevOrders => {
                    const existingOrderIds = new Set(prevOrders.map(o => o.order_id));
                    const newOrders = pageData.orders.filter(o => !existingOrderIds.has(o.order_id));
                    return [...prevOrders, ...newOrders];
                });
            }
        }
    }, [pageData, currentPage]);
    
    // Reset state on user change
    useEffect(() => {
        setCurrentPage(1);
        setAllOrders([]);
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
    
    const initialLoading = pageLoading && allOrders.length === 0;

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
        <div className="w-full max-w-3xl mx-auto py-8 px-4">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors" aria-label="Go back">
                    <ArrowLeft />
                </button>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-transparent bg-clip-text">My Orders</h1>
            </div>

            <div className="space-y-4">
                {allOrders.length > 0 ? (
                    allOrders.map(order => <OrderCard key={order.order_id} order={order} onOrderUpdate={handleOrderUpdate} />)
                ) : (
                    <div className="text-center py-16 bg-white/50 rounded-2xl">
                        <Package className="w-12 h-12 mx-auto text-slate-400" />
                        <p className="text-slate-500 mt-4">You haven't placed any orders yet.</p>
                        <button onClick={onClose} className="mt-4 text-pink-600 font-semibold hover:underline">Start Shopping</button>
                    </div>
                )}
            </div>
            
            <div className="mt-6 text-center">
                 <p className="text-sm text-slate-500 mb-4">Showing {allOrders.length} of {totalOrderCount} orders.</p>
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