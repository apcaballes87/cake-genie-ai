'use client';

import { memo, useMemo } from 'react';
import { TopperCard } from '@/components/TopperCard';
import type { MainTopperUI, SupportElementUI } from '@/types';

type EdiblePhotoItem =
    | (MainTopperUI & { category: 'topper' })
    | (SupportElementUI & { category: 'element' });

interface CustomizingPhotosPanelProps {
    isVisible: boolean;
    mainToppers: MainTopperUI[];
    supportElements: SupportElementUI[];
    markerMap: Map<string, string>;
    updateMainTopper: (id: string, updates: Partial<MainTopperUI>) => void;
    updateSupportElement: (id: string, updates: Partial<SupportElementUI>) => void;
    onTopperImageReplace: (topperId: string, file: File) => void;
    onSupportElementImageReplace: (elementId: string, file: File) => void;
    itemPrices?: Map<string, number>;
    isAdmin?: boolean;
}

const noop = () => undefined;

export const CustomizingPhotosPanel = memo(function CustomizingPhotosPanel({
    isVisible,
    mainToppers,
    supportElements,
    markerMap,
    updateMainTopper,
    updateSupportElement,
    onTopperImageReplace,
    onSupportElementImageReplace,
    itemPrices,
    isAdmin,
}: CustomizingPhotosPanelProps) {
    const photos = useMemo<EdiblePhotoItem[]>(() => {
        const ediblePhotoTopper = mainToppers.find((topper) => topper.original_type === 'edible_photo_top');
        const ediblePhotoSupport = supportElements.find((element) => element.original_type === 'edible_photo_side');

        const nextPhotos: EdiblePhotoItem[] = [];
        if (ediblePhotoTopper) nextPhotos.push({ ...ediblePhotoTopper, category: 'topper' });
        if (ediblePhotoSupport) nextPhotos.push({ ...ediblePhotoSupport, category: 'element' });
        return nextPhotos;
    }, [mainToppers, supportElements]);

    return (
        <div className={isVisible ? 'block' : 'hidden'}>
            <div className="space-y-4">
                {photos.length === 0 ? (
                    <div className="text-center p-8 text-slate-500">
                        <p>No edible photos detected on this cake.</p>
                        <p className="text-xs mt-2">Edible photos are only available if the AI detected them in the original design.</p>
                    </div>
                ) : (
                    photos.map((photo) => (
                        <div key={photo.id} className="border border-slate-200 rounded-xl p-4">
                            <h3 className="font-bold text-slate-700 mb-2">
                                {photo.category === 'topper' ? 'Top Photo' : 'Side Photo'}
                            </h3>
                            <TopperCard
                                item={photo}
                                type={photo.category}
                                marker={markerMap.get(photo.id)}
                                expanded={true}
                                onToggle={noop}
                                updateItem={(updates) => {
                                    if (photo.category === 'topper') {
                                        updateMainTopper(photo.id, updates as Partial<MainTopperUI>);
                                        return;
                                    }

                                    updateSupportElement(photo.id, updates as Partial<SupportElementUI>);
                                }}
                                onImageReplace={(file) => {
                                    if (photo.category === 'topper') {
                                        onTopperImageReplace(photo.id, file);
                                        return;
                                    }

                                    onSupportElementImageReplace(photo.id, file);
                                }}
                                itemPrice={itemPrices?.get(photo.id)}
                                isAdmin={isAdmin}
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});

CustomizingPhotosPanel.displayName = 'CustomizingPhotosPanel';