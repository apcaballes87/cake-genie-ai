-- The secure-chatbot release stored one customer attachment as a private
-- object path. The Telegram-era ChatModal and n8n payload expect public URLs,
-- so materialize that historical reference after restoring the public bucket.
UPDATE public.chat_messages
SET image_url = 'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/chat-images/' || image_url
WHERE image_url IS NOT NULL
  AND image_url !~ '^https?://';
