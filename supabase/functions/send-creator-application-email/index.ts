import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCreatorApplicationEmail } from './handler.ts';

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

serve((request) => handleCreatorApplicationEmail(request, {
  resendApiKey: Deno.env.get('RESEND_API_KEY') || '',
}));
