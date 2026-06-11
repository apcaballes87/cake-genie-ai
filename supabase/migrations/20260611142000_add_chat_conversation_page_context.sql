ALTER TABLE public.chat_conversations
ADD COLUMN IF NOT EXISTS last_customer_page_url TEXT,
ADD COLUMN IF NOT EXISTS last_customer_page_title TEXT,
ADD COLUMN IF NOT EXISTS last_customer_page_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_customer_page_seen_at
ON public.chat_conversations(last_customer_page_seen_at DESC);
