import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUYER_ATTRIBUTION_STORAGE_KEY,
  classifyBuyerAttributionTouch,
  prepareBuyerAttributionForCheckout,
  readBuyerAttribution,
  saveBuyerAttribution,
  syncBuyerAttributionForCurrentPage,
} from './buyerAttribution';
import type { BuyerAttributionRecord } from '@/types';

describe('buyer attribution', () => {
  const gtagMock = vi.fn();

  beforeEach(() => {
    window.localStorage.clear();
    gtagMock.mockReset();
    ;(window as typeof window & { gtag?: typeof gtagMock }).gtag = gtagMock;
    window.history.pushState({}, '', 'http://localhost:3000/');
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: '',
    });
  });

  it('classifies TikTok landing params as a non-direct campaign touch', () => {
    const touch = classifyBuyerAttributionTouch({
      locationHref: 'https://genie.ph/?utm_source=tiktok&utm_medium=paid_social&utm_campaign=launch',
      referrer: '',
    });

    expect(touch.source).toBe('tiktok');
    expect(touch.medium).toBe('paid_social');
    expect(touch.campaign).toBe('launch');
    expect(touch.category).toBe('campaign');
  });

  it('classifies external referrers as referral touches', () => {
    const touch = classifyBuyerAttributionTouch({
      locationHref: 'https://genie.ph/customizing/choco-cake',
      referrer: 'https://www.cakesandmemories.com/catalog',
    });

    expect(touch.source).toBe('cakesandmemories.com');
    expect(touch.medium).toBe('referral');
    expect(touch.category).toBe('referral');
  });

  it('preserves first non-direct touch when a later direct session purchases', async () => {
    gtagMock.mockImplementation((command: string, measurementId: string, fieldName: string, callback: (value: unknown) => void) => {
      if (command !== 'get' || measurementId !== 'G-TEST123') return;
      const values: Record<string, unknown> = {
        client_id: '1234.5678',
        session_id: '111',
        session_number: 1,
      };
      callback(values[fieldName]);
    });

    window.history.pushState({}, '', '/?utm_source=tiktok&utm_medium=paid_social');
    await syncBuyerAttributionForCurrentPage('G-TEST123');

    gtagMock.mockImplementation((command: string, measurementId: string, fieldName: string, callback: (value: unknown) => void) => {
      if (command !== 'get' || measurementId !== 'G-TEST123') return;
      const values: Record<string, unknown> = {
        client_id: '1234.5678',
        session_id: '222',
        session_number: 2,
      };
      callback(values[fieldName]);
    });

    window.history.pushState({}, '', '/cart');
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: '',
    });
    const record = await prepareBuyerAttributionForCheckout('G-TEST123');

    expect(record.firstTouch?.source).toBe('tiktok');
    expect(record.firstNonDirectTouch?.source).toBe('tiktok');
    expect(record.purchaseSession?.source).toBe('(direct)');
    expect(record.ga.sessionId).toBe('222');
  });

  it('does not overwrite latest touch during same-session internal navigation', async () => {
    gtagMock.mockImplementation((command: string, measurementId: string, fieldName: string, callback: (value: unknown) => void) => {
      if (command !== 'get' || measurementId !== 'G-TEST123') return;
      const values: Record<string, unknown> = {
        client_id: '1234.5678',
        session_id: '333',
        session_number: 3,
      };
      callback(values[fieldName]);
    });

    window.history.pushState({}, '', '/?utm_source=google&utm_medium=organic');
    await syncBuyerAttributionForCurrentPage('G-TEST123');

    window.history.pushState({}, '', '/cart');
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: 'https://genie.ph/',
    });
    const record = await syncBuyerAttributionForCurrentPage('G-TEST123');

    expect(record.latestTouch?.source).toBe('google');
    expect(record.latestTouch?.medium).toBe('organic');
  });

  it('round-trips the stored record shape', () => {
    const record: BuyerAttributionRecord = {
      version: 1,
      firstTouch: null,
      firstNonDirectTouch: null,
      latestTouch: null,
      latestNonDirectTouch: null,
      purchaseSession: null,
      ga: {
        clientId: '1234.5678',
        sessionId: '999',
        sessionNumber: 9,
        lastResolvedAt: '2026-07-05T00:00:00.000Z',
      },
      latestTouchSessionId: '999',
      latestNonDirectTouchSessionId: null,
    };

    saveBuyerAttribution(record);

    expect(window.localStorage.getItem(BUYER_ATTRIBUTION_STORAGE_KEY)).toBeTruthy();
    expect(readBuyerAttribution()).toEqual(record);
  });
});
