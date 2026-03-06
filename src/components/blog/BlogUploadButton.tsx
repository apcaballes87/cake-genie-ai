'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Upload, Loader2 } from 'lucide-react';
import { showError } from '@/lib/utils/toast';

const BUCKET_NAME = 'uploadopenai';
const IMG_MAX_LONG_EDGE = 1800;

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
    const [isUploading, setIsUploading] = useState(false);
    const [status, setStatus] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            showError('Please select an image file');
            return;
        }

        setIsUploading(true);
        setStatus('Uploading your design...');

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

            setStatus('Redirecting to customization...');

            // Redirect to customizing page with the uploaded image
            const encodedUrl = encodeURIComponent(publicUrl);
            router.push(`/customizing?ref=${encodedUrl}&source=blog`);

        } catch (err) {
            console.error('Upload failed:', err);
            showError('Failed to upload. Please try again.');
            setIsUploading(false);
            setStatus('');
        }
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className={className}>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            <button
                onClick={handleClick}
                disabled={isUploading}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
                {isUploading ? (
                    <>
                        <Loader2 size={20} className="animate-spin" />
                        {status || 'Uploading...'}
                    </>
                ) : (
                    <>
                        <Upload size={20} />
                        Upload Your Design & Get Price in Seconds
                    </>
                )}
            </button>

            {status && !isUploading && (
                <p className="mt-2 text-sm text-gray-600">{status}</p>
            )}
        </div>
    );
}
