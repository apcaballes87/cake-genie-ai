import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCreatorApplicationEmail } from './handler.ts';

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

const environment = {
  resendApiKey: Deno.env.get('RESEND_API_KEY') || '',
  serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  secretKeys: Deno.env.get('SUPABASE_SECRET_KEYS') || '',
};

serve((request) => handleCreatorApplicationEmail(request, environment));
