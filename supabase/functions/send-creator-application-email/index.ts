import { withSupabase } from 'npm:@supabase/server';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCreatorApplicationEmail } from './handler.ts';

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

const environment = {
  resendApiKey: Deno.env.get('RESEND_API_KEY') || '',
};

const authenticatedHandler = withSupabase({ auth: 'secret:pinterest' }, (request) => handleCreatorApplicationEmail(request, {
  ...environment,
  authenticated: true,
}));

serve((request) => request.method === 'OPTIONS'
  ? handleCreatorApplicationEmail(request, environment)
  : authenticatedHandler(request));
