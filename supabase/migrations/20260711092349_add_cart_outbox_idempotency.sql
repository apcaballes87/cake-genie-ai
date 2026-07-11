-- A stable client-generated request ID makes cart creation safely retryable.
-- It intentionally stays nullable for rows created before the durable outbox flow.
ALTER TABLE public.cakegenie_cart
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS cakegenie_cart_client_request_id_unique
  ON public.cakegenie_cart (client_request_id)
  WHERE client_request_id IS NOT NULL;
