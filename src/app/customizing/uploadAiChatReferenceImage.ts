import type { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

type StorageClient = Pick<SupabaseClient, 'storage'>;

interface UploadAiChatReferenceImageParams {
  base64Data: string;
  ownerId: string;
}

export async function uploadAiChatReferenceImage(
  supabase: StorageClient,
  params: UploadAiChatReferenceImageParams,
): Promise<string> {
  const base64String = params.base64Data.includes(',')
    ? params.base64Data.split(',')[1]
    : params.base64Data;

  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let index = 0; index < byteCharacters.length; index += 1) {
    byteNumbers[index] = byteCharacters.charCodeAt(index);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/webp' });
  const filePath = `customizations/ai-chat-references/${params.ownerId}/${Date.now()}-${uuidv4()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from('cakegenie')
    .upload(filePath, blob, {
      contentType: 'image/webp',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload AI chat reference image: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from('cakegenie').getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error('Could not get AI chat reference image public URL.');
  }

  return data.publicUrl;
}
