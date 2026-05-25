import { CartSkeleton } from '@/components/LoadingSkeletons';

export default function Loading() {
    return (
        <div className="px-4 md:px-8 py-4 md:py-8 genie-page-bg min-h-screen">
            <div className="max-w-4xl mx-auto genie-card rounded-2xl">
                <div className="flex justify-between items-center px-4 pt-4 pb-3 border-b border-purple-100">
                    <h1 className="text-2xl font-bold text-slate-900">
                        Your <span className="text-purple-400">Cart</span>
                    </h1>
                    <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
                </div>
                <div className="p-4">
                    <CartSkeleton />
                </div>
            </div>
        </div>
    );
}
