'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Upload, Loader2 } from 'lucide-react';
import { showError, showLoading } from '@/lib/utils/toast';
import { ImageUploader } from '@/components/ImageUploader';

const BUCKET_NAME = 'uploadopenai';

interface BlogUploadButtonProps {
    className?: string;
}

/**
 * Upload button component for blog pages that allows users to upload
 * their cake design and get instant pricing
 */
export function BlogUploadButton({ className = '' }: BlogUploadButtonProps) {
    const router = useRouter();
    const supabase = getSupabaseClient();
    const [isUploaderOpen, setIsUploaderOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleImageSelect = async (file: File) => {
        setIsUploaderOpen(false);
        setIsUploading(true);
        showLoading('Uploading your design...');

        try {
            // Generate unique filename
            const ext = file.name.split('.').pop() || 'jpg';
            const filename = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

            // Upload to Supabase
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(filename, file);

            if (uploadError) {
                throw uploadError;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(uploadData.path);

            const publicUrl = urlData.publicUrl;

            // Redirect to customizing page with the uploaded image
            const encodedUrl = encodeURIComponent(publicUrl);
            router.push(`/customizing?ref=${encodedUrl}&source=blog`);

        } catch (err) {
            console.error('Upload failed:', err);
            showError('Failed to upload. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className={`flex justify-center ${className}`}>
            <button
                onClick={() => setIsUploaderOpen(true)}
                disabled={isUploading}
                className="flex items-center justify-center gap-2 bg-[#9b80e3] hover:bg-[#8669cc] text-white px-5 py-3 lg:px-7 lg:py-3.5 rounded-[0.875rem] font-bold transition-all shadow-md active:scale-[0.98] text-sm lg:text-base whitespace-nowrap shrink-0 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {isUploading ? (
                    <>
                        <Loader2 size={18} className="animate-spin shrink-0 lg:w-5 lg:h-5" />
                        <span>Uploading...</span>
                    </>
                ) : (
                    <>
                        <Upload size={18} className="shrink-0 lg:w-5 lg:h-5" />
                        <span>Upload Your Design & Get Price in Seconds</span>
                    </>
                )}
            </button>

            <ImageUploader
                isOpen={isUploaderOpen}
                onClose={() => setIsUploaderOpen(false)}
                onImageSelect={handleImageSelect}
            />
        </div>
    );
}
