import { createClient } from '@/lib/supabase/client';
import { compressImage, validateImageFile } from '@/lib/utils/imageOptimization';
import { v4 as uuidv4 } from 'uuid';
import type { PartyBudgetImage } from '@/lib/partyBudget';

const BUCKET_NAME = 'party-budget-images';
const MAX_IMAGES_PER_ITEM = 5;

export async function getAllBudgetImages(userId: string): Promise<PartyBudgetImage[]> {
  const { data, error } = await createClient()
    .from('cakegenie_party_budget_images')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data || []) as PartyBudgetImage[];
}

export async function getItemImages(
  userId: string,
  itemId: string
): Promise<PartyBudgetImage[]> {
  const { data, error } = await createClient()
    .from('cakegenie_party_budget_images')
    .select('*')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data || []) as PartyBudgetImage[];
}

export async function uploadBudgetItemImage(
  userId: string,
  itemId: string,
  categoryId: string,
  file: File,
  existingCount: number
): Promise<PartyBudgetImage> {
  if (existingCount >= MAX_IMAGES_PER_ITEM) {
    throw new Error(`Maximum ${MAX_IMAGES_PER_ITEM} images per item.`);
  }

  const validation = validateImageFile(file, {
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  });
  if (!validation.valid && validation.error) {
    throw new Error(validation.error);
  }

  const compressedFile = await compressImage(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 1920,
    fileType: 'image/webp',
  });

  const fileName = `${uuidv4()}.webp`;
  const filePath = `${userId}/${itemId}/${fileName}`;

  const { error: uploadError } = await createClient().storage
    .from(BUCKET_NAME)
    .upload(filePath, compressedFile, {
      contentType: 'image/webp',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = createClient().storage.from(BUCKET_NAME).getPublicUrl(filePath);

  const { data: dbRow, error: dbError } = await createClient()
    .from('cakegenie_party_budget_images')
    .insert({
      user_id: userId,
      item_id: itemId,
      category_id: categoryId,
      image_url: publicUrl,
      file_path: filePath,
      sort_order: existingCount,
    })
    .select('*')
    .single();

  if (dbError) throw dbError;
  return dbRow as PartyBudgetImage;
}

export async function deleteBudgetItemImage(
  userId: string,
  image: PartyBudgetImage
): Promise<void> {
  const { error: storageError } = await createClient().storage
    .from(BUCKET_NAME)
    .remove([image.file_path]);

  if (storageError) console.warn('Storage delete error:', storageError);

  const { error: dbError } = await createClient()
    .from('cakegenie_party_budget_images')
    .delete()
    .eq('id', image.id)
    .eq('user_id', userId);

  if (dbError) throw dbError;
}

export async function reorderBudgetItemImages(
  userId: string,
  itemId: string,
  orderedIds: string[]
): Promise<void> {
  const updates = orderedIds.map((id, index) =>
    createClient()
      .from('cakegenie_party_budget_images')
      .update({ sort_order: index })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('item_id', itemId)
  );

  const results = await Promise.all(updates);
  const error = results.find((r) => r.error);
  if (error) throw error.error;
}
