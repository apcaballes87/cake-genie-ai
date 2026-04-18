import { describe, it, expect } from 'vitest';
import { FEATURE_FLAGS, SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_MAPS_API_KEY, EXA_API_KEY } from './config';

describe('Configuration', () => {
  describe('FEATURE_FLAGS', () => {
    it('should have the expected structure', () => {
      expect(FEATURE_FLAGS).toBeDefined();
      expect(typeof FEATURE_FLAGS).toBe('object');
    });

    it('should have USE_DATABASE_PRICING set to true', () => {
      expect(FEATURE_FLAGS.USE_DATABASE_PRICING).toBe(true);
    });
  });

  describe('Environment Variables', () => {
    it('should correctly export SUPABASE_URL from environment', () => {
      expect(SUPABASE_URL).toBe(process.env.NEXT_PUBLIC_SUPABASE_URL);
    });

    it('should correctly export SUPABASE_ANON_KEY from environment', () => {
      expect(SUPABASE_ANON_KEY).toBe(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    });

    it('should export GOOGLE_MAPS_API_KEY', () => {
      expect(typeof GOOGLE_MAPS_API_KEY).toBe('string');
    });

    it('should export EXA_API_KEY', () => {
      expect(typeof EXA_API_KEY).toBe('string');
    });
  });
});
