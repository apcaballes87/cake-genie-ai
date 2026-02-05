import { Skeleton } from '@/components/LoadingSkeletons';

export default function Loading() {
    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
            {/* Merchant Header Skeleton */}
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start p-6 bg-white rounded-2xl border border-purple-100 shadow-sm">
                <Skeleton className="w-24 h-24 md:w-32 md:h-32 rounded-full shrink-0" />
                <div className="space-y-4 w-full text-center md:text-left">
                    <Skeleton className="h-8 w-48 mx-auto md:mx-0" />
                    <Skeleton className="h-4 w-64 mx-auto md:mx-0" />
                    <div className="flex gap-4 justify-center md:justify-start">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-6 w-20" />
                    </div>
                </div>
            </div>

            {/* Products Grid Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-2">
                        <Skeleton className="w-full aspect-square rounded-xl" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/4" />
                    </div>
                ))}
            </div>
        </div>
    );
}
