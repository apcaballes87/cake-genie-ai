import { PaymentVerificationResult } from '../services/paymentVerificationService';

// Mock Supabase client
const mockSupabase = {
  functions: {
    invoke: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn()
      }))
    }))
  }))
};

// Mock the Supabase client
jest.mock('../lib/supabase/client', () => ({
  getSupabaseClient: () => mockSupabase
}));

describe('paymentVerificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyContributionPayment', () => {
    it('should return success when verification is successful', async () => {
      const mockResult: PaymentVerificationResult = {
        success: true,
        status: 'paid',
        message: 'Payment confirmed'
      };

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockResult,
        error: null
      });

      const { verifyContributionPayment } = await import('../services/paymentVerificationService');
      const result = await verifyContributionPayment('test-contribution-id');

      expect(result).toEqual(mockResult);
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('verify-contribution-payment', {
        body: { contributionId: 'test-contribution-id' }
      });
    });

    it('should return failure when verification fails', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: new Error('Verification failed')
      });

      const { verifyContributionPayment } = await import('../services/paymentVerificationService');
      const result = await verifyContributionPayment('test-contribution-id');

      expect(result).toEqual({
        success: false,
        status: 'pending',
        error: 'Failed to verify payment'
      });
    });

    it('should handle exceptions gracefully', async () => {
      mockSupabase.functions.invoke.mockRejectedValue(new Error('Network error'));

      const { verifyContributionPayment } = await import('../services/paymentVerificationService');
      const result = await verifyContributionPayment('test-contribution-id');

      expect(result).toEqual({
        success: false,
        status: 'pending',
        error: 'An error occurred during verification'
      });
    });
  });

  describe('pollPaymentStatus', () => {
    it('should return success immediately if payment is already paid in database', async () => {
      const mockContribution = {
        data: { status: 'paid' },
        error: null
      };

      // Mock the database query chain
      const mockSingle = jest.fn().mockResolvedValue(mockContribution);
      const mockEq = jest.fn(() => ({ single: mockSingle }));
      const mockSelect = jest.fn(() => ({ eq: mockEq }));
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      const { pollPaymentStatus } = await import('../services/paymentVerificationService');
      const result = await pollPaymentStatus('test-contribution-id', 1, 0); // 1 attempt, 0ms delay

      expect(result).toEqual({
        success: true,
        status: 'paid',
        message: 'Payment confirmed'
      });
    });

    it('should trigger manual verification after 3 attempts if still pending', async () => {
      // Mock pending status for first 3 attempts
      const mockPendingContribution = {
        data: { status: 'pending' },
        error: null
      };

      // Mock the database query chain for pending status
      const mockSingle = jest.fn().mockResolvedValue(mockPendingContribution);
      const mockEq = jest.fn(() => ({ single: mockSingle }));
      const mockSelect = jest.fn(() => ({ eq: mockEq }));
      mockSupabase.from.mockReturnValue({ select: mockSelect });

      // Mock successful manual verification
      const mockVerificationResult: PaymentVerificationResult = {
        success: true,
        status: 'paid',
        message: 'Payment confirmed'
      };

      mockSupabase.functions.invoke.mockResolvedValue({
        data: mockVerificationResult,
        error: null
      });

      const { pollPaymentStatus } = await import('../services/paymentVerificationService');
      const result = await pollPaymentStatus('test-contribution-id', 5, 0); // 5 attempts, 0ms delay

      // Should have called database check 3 times and manual verification once
      expect(mockSelect).toHaveBeenCalledTimes(3);
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('verify-contribution-payment', {
        body: { contributionId: 'test-contribution-id' }
      });

      expect(result).toEqual(mockVerificationResult);
    });
  });
});