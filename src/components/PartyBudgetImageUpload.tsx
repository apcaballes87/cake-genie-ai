'use client';

import { useRef, useState } from 'react';
import { Image, Loader2, X } from 'lucide-react';
import { ImageZoomModal } from '@/components/ImageZoomModal';
import { uploadBudgetItemImage, deleteBudgetItemImage } from '@/services/partyBudgetImagesService';
import { showError } from '@/lib/utils/toast';
import type { PartyBudgetImage } from '@/lib/partyBudget';

type Props = {
  userId: string | null;
  isAuthenticated: boolean;
  itemId: string;
  categoryId: string;
  images: PartyBudgetImage[];
  onImagesChange: (images: PartyBudgetImage[]) => void;
};

const MAX_IMAGES = 5;

export default function PartyBudgetImageUpload({
  userId,
  isAuthenticated,
  itemId,
  categoryId,
  images,
  onImagesChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!userId || !isAuthenticated) {
      showError('Please sign in to attach images to budget items.');
      e.target.value = '';
      return;
    }

    if (images.length + files.length > MAX_IMAGES) {
      showError(`Maximum ${MAX_IMAGES} images per item. You can add ${MAX_IMAGES - images.length} more.`);
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const newImages: PartyBudgetImage[] = [];
      for (const file of Array.from(files)) {
        const uploaded = await uploadBudgetItemImage(userId, itemId, categoryId, file, images.length + newImages.length);
        newImages.push(uploaded);
      }
      onImagesChange([...images, ...newImages]);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to upload image.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={triggerUpload}
          disabled={isUploading || images.length >= MAX_IMAGES}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-100 px-3 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-50"
          title={images.length >= MAX_IMAGES ? `Maximum ${MAX_IMAGES} images` : 'Add reference image'}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Image className="h-4 w-4" />
          )}
          {isUploading ? 'Uploading...' : 'UPLOAD'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <ImageZoomModal
        isOpen={!!zoomedImage}
        onClose={() => setZoomedImage(null)}
        originalImage={zoomedImage}
        customizedImage={null}
      />
    </>
  );
}

type ThumbnailsProps = {
  userId: string | null;
  images: PartyBudgetImage[];
  onImagesChange: (images: PartyBudgetImage[]) => void;
};

export function PartyBudgetImageThumbnails({ userId, images, onImagesChange }: ThumbnailsProps) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const handleDelete = async (image: PartyBudgetImage) => {
    if (!userId) return;
    try {
      await deleteBudgetItemImage(userId, image);
      onImagesChange(images.filter((img) => img.id !== image.id));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete image.');
    }
  };

  if (images.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 py-1">
        {images.map((img) => (
          <div key={img.id} className="group relative">
            <button
              type="button"
              onClick={() => setZoomedImage(img.image_url)}
              className="block h-12 w-12 overflow-hidden rounded-lg border border-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.image_url}
                alt="Reference"
                className="h-full w-full object-cover"
              />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(img);
              }}
              className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
              aria-label="Remove image"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
      </div>
      <ImageZoomModal
        isOpen={!!zoomedImage}
        onClose={() => setZoomedImage(null)}
        originalImage={zoomedImage}
        customizedImage={null}
      />
    </>
  );
}
