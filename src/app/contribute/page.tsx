import React, { useEffect, useState } from 'react';
import { getSingleOrderPublic, createOrderContribution } from '../../services/supabaseService';
import { verifyXenditPayment } from '../../services/xenditService';
import { CakeGenieOrder, CakeGenieOrderItem, OrderContribution } from '../../lib/database.types';
import { formatCurrency } from '../../lib/utils/currency';
import { Loader2, CheckCircle, AlertCircle, Users, CreditCard } from 'lucide-react';
import { showSuccess, showError } from '../../lib/utils/toast';
import DetailItem from '../../components/UI/DetailItem';

interface ContributePageProps {
    orderId: string;
    onNavigateHome: () => void;
}

export default function ContributePage({ orderId, onNavigateHome }: ContributePageProps) {
    const [order, setOrder] = useState<CakeGenieOrder & { cakegenie_order_items: CakeGenieOrderItem[], order_contributions: OrderContribution[], organizer?: { first_name: string | null, email: string } } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [amount, setAmount] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

    useEffect(() => {
        async function fetchOrder() {
            if (!orderId) return;
            setLoading(true);
            const { data, error } = await getSingleOrderPublic(orderId);
            if (error) {
                setError("Order not found or could not be loaded.");
            } else {
                setOrder(data);
                // Set default amount suggestion
                if (data) {
                    const collected = data.amount_collected || 0;
                    const remaining = data.total_amount - collected;
                    const splitCount = data.split_count || 1;
                    const perPerson = data.total_amount / splitCount;

                    // Suggest per-person amount, but capped at remaining
                    const suggestion = Math.min(perPerson, remaining);
                    setAmount(parseFloat(suggestion.toFixed(2)));
                }
            }
            setLoading(false);
        }
        fetchOrder();
    }, [orderId]);

    // Check for payment status from URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const paymentStatus = params.get('payment');
        const contributionId = params.get('contribution_id');

        if (paymentStatus === 'success') {
            const verifyPayment = async () => {
                setIsVerifyingPayment(true);
                if (contributionId) {
                    await verifyXenditPayment(orderId, contributionId);
                    // Re-fetch order to update UI
                    const { data } = await getSingleOrderPublic(orderId);
                    if (data) setOrder(data);
                }
                showSuccess('Payment successful! Thank you for your contribution.');
                // Clear the query param to prevent showing the toast again on refresh
                window.history.replaceState({}, '', `/#/contribute/${orderId}`);
                setIsVerifyingPayment(false);
            };
            verifyPayment();
        } else if (paymentStatus === 'failed') {
            showError('Payment failed. Please try again.');
            window.history.replaceState({}, '', `/#/contribute/${orderId}`);
        }
    }, [orderId]);

    const handleContribute = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!order) return;
        if (amount <= 0) {
            showError("Please enter a valid amount.");
            return;
        }
        if (!name) {
            showError("Please enter your name.");
            return;
        }

        setIsSubmitting(true);
        const { success, paymentUrl, error } = await createOrderContribution({
            orderId: order.order_id,
            amount,
            contributorName: name,
            contributorEmail: email || undefined
        });

        if (success && paymentUrl) {
            window.location.href = paymentUrl; // Redirect to Xendit
        } else {
            showError(error || "Failed to initiate payment.");
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin w-8 h-8 text-purple-600" /></div>;
    if (error || !order) return <div className="flex flex-col items-center justify-center h-screen p-4 text-center"><AlertCircle className="w-12 h-12 text-red-500 mb-4" /><h2 className="text-xl font-bold text-gray-800">Error</h2><p className="text-gray-600">{error || "Order not found"}</p><button onClick={onNavigateHome} className="mt-4 text-purple-600 font-semibold hover:underline">Go Home</button></div>;

    const collected = order.amount_collected || 0;
    const total = order.total_amount;
    const progress = Math.min((collected / total) * 100, 100);
    const remaining = Math.max(total - collected, 0);
    const isFullyFunded = remaining <= 0;

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 relative">
            {isVerifyingPayment && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                    <Loader2 className="animate-spin w-12 h-12 text-purple-600 mb-4" />
                    <h3 className="text-xl font-bold text-gray-800">Verifying Payment...</h3>
                    <p className="text-gray-600">Please wait while we update the contribution status.</p>
                </div>
            )}
            {/* Logo */}
            <div className="flex justify-center mb-6">
                <img
                    src="https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20logo%20long2.webp"
                    alt="CakeGenie Logo"
                    className="w-40 h-40 object-contain cursor-pointer hover:scale-105 transition-transform"
                    onClick={onNavigateHome}
                />
            </div>
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-purple-600 to-pink-500 p-6 text-white text-center">
                    <h1 className="text-2xl font-bold">Split the Bill</h1>
                    <p className="opacity-90 mt-1">Order #{order.order_number}</p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Organizer Info & Message Combined */}
                    {(order.organizer || order.split_message) && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100">
                            <div className="flex items-start gap-3">
                                <Users className="w-5 h-5 text-purple-600 mt-1 shrink-0" />
                                <div className="flex-1 space-y-3">
                                    {order.organizer && (
                                        <div>
                                            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">Organized by</p>
                                            <p className="text-sm font-bold text-gray-900">{order.organizer.first_name || 'Anonymous'}</p>
                                            <p className="text-xs text-gray-600">{order.organizer.email}</p>
                                        </div>
                                    )}
                                    {order.split_message && (
                                        <div className={order.organizer ? "pt-3 border-t border-purple-200" : ""}>
                                            <p className="text-sm font-semibold text-purple-900 mb-1">Message from organizer:</p>
                                            <p className="text-gray-700 italic">"{order.split_message}"</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Progress */}
                    <div>
                        <div className="flex justify-between text-sm font-medium mb-2">
                            <span className="text-gray-600">Collected: {formatCurrency(collected)}</span>
                            <span className="text-gray-900">Goal: {formatCurrency(total)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-green-400 to-green-600 h-full transition-all duration-500 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-center text-sm text-gray-500 mt-2">
                            {isFullyFunded ? "Fully Funded! 🎉" : `${formatCurrency(remaining)} needed to complete this order`}
                        </p>
                    </div>

                    {/* Order Items Preview */}
                    <div className="border-t border-gray-100 pt-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Order Items</h3>
                        <div className="space-y-3">
                            {order.cakegenie_order_items.map((item, idx) => {
                                const details = item.customization_details;
                                const tierLabels = details.flavors.length === 2
                                    ? ['Top Tier', 'Bottom Tier']
                                    : details.flavors.length === 3
                                        ? ['Top Tier', 'Middle Tier', 'Bottom Tier']
                                        : ['Flavor'];

                                const colorLabelMap: Record<string, string> = {
                                    side: 'Side',
                                    top: 'Top',
                                    borderTop: 'Top Border',
                                    borderBase: 'Base Border',
                                    drip: 'Drip',
                                    gumpasteBaseBoardColor: 'Base Board'
                                };

                                return (
                                    <div key={idx} className="flex flex-col gap-3 p-3 bg-white rounded-lg border border-gray-200">
                                        <div className="flex gap-3 items-center">
                                            {item.customized_image_url && (
                                                <img src={item.customized_image_url} alt={item.cake_type} className="w-12 h-12 rounded-md object-cover bg-gray-100" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">{item.cake_type}</p>
                                                <p className="text-xs text-gray-500">{item.cake_size}</p>
                                            </div>
                                        </div>

                                        {/* Customization Details */}
                                        <details className="w-full">
                                            <summary className="text-xs font-semibold text-gray-600 cursor-pointer hover:text-purple-600 transition-colors">View Customization Details</summary>
                                            <div className="mt-2 pl-2 border-l-2 border-gray-200 space-y-1.5 text-xs text-gray-600">
                                                <DetailItem label="Type" value={`${item.cake_type}, ${item.cake_thickness}, ${item.cake_size}`} />
                                                {details.flavors.length === 1 ? (
                                                    <DetailItem label="Flavor" value={details.flavors[0]} />
                                                ) : (
                                                    details.flavors.map((flavor, flavorIdx) => (
                                                        <DetailItem key={flavorIdx} label={`${tierLabels[flavorIdx]} Flavor`} value={flavor} />
                                                    ))
                                                )}
                                                {details.mainToppers.length > 0 && <DetailItem label="Main Toppers" value={details.mainToppers.map(t => t.description).join(', ')} />}
                                                {details.supportElements.length > 0 && <DetailItem label="Support" value={details.supportElements.map(s => s.description).join(', ')} />}
                                                {details.cakeMessages.map((msg, msgIdx) => (
                                                    <DetailItem key={msgIdx} label={`Message #${msgIdx + 1}`} value={`'${msg.text}' (${msg.color})`} />
                                                ))}
                                                {details.icingDesign.drip && <DetailItem label="Icing" value="Has Drip Effect" />}
                                                {details.icingDesign.gumpasteBaseBoard && <DetailItem label="Icing" value="Gumpaste Base Board" />}
                                                {Object.entries(details.icingDesign.colors).map(([loc, color]) => (
                                                    <DetailItem key={loc} label={`${colorLabelMap[loc] || loc.charAt(0).toUpperCase() + loc.slice(1)} Color`} value={color} />
                                                ))}
                                                {details.additionalInstructions && <DetailItem label="Instructions" value={details.additionalInstructions} />}
                                            </div>
                                        </details>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Contribution Form */}
                    {!isFullyFunded ? (
                        <form onSubmit={handleContribute} className="space-y-4 border-t border-gray-100 pt-6">
                            <h3 className="text-lg font-bold text-gray-900">Make a Contribution</h3>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                                    placeholder="e.g. Juan dela Cruz"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all"
                                    placeholder="For payment receipt"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Pay</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        max={remaining}
                                        step="0.01"
                                        value={amount}
                                        onChange={e => setAmount(parseFloat(e.target.value))}
                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all font-mono text-lg"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Max contribution: {formatCurrency(remaining)}</p>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                                {isSubmitting ? "Processing..." : `Pay ${formatCurrency(amount)}`}
                            </button>
                        </form>
                    ) : (
                        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-green-800">Order Fully Funded!</h3>
                            <p className="text-green-700 mt-1">Thank you to everyone who contributed. This order is now being processed.</p>
                        </div>
                    )}

                    {/* CTA - Order Your Own */}
                    <div className="border-t border-gray-100 pt-6">
                        <div className="bg-gradient-to-r from-pink-50 to-purple-50 p-5 rounded-xl border border-pink-200 text-center">
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Want to organize your own?</h3>
                            <p className="text-sm text-gray-600 mb-4">Create your custom cake and split the bill with friends!</p>
                            <button
                                onClick={onNavigateHome}
                                className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                            >
                                Design Your Cake Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
