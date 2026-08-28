import { describe, expect, it } from 'vitest';
import {
  buildCreatorApplicationEmailHtml,
  buildCreatorApplicationEmailText,
  buildResendEmailRequest,
  validateCreatorApplicationEmailPayload,
} from './email';

const payload = {
  creatorId: '11111111-1111-4111-8111-111111111111',
  name: '<Creator>',
  recipientEmail: 'creator@example.com',
  bentoCode: 'GENIEBENTO12345678',
  voucherCode: 'GENIE50ABCDEF12',
  referralCode: 'TESTCREATOR',
  referralLink: 'https://genie.ph/TESTCREATOR',
};

describe('creator application email payloads', () => {
  it('validates and normalizes the trusted application payload', () => {
    expect(validateCreatorApplicationEmailPayload(payload)).toEqual(payload);
  });

  it('rejects an external referral link', () => {
    expect(() => validateCreatorApplicationEmailPayload({
      ...payload,
      referralLink: 'https://example.com/TESTCREATOR',
    })).toThrow('Invalid referral link.');
  });

  it('escapes creator content and includes all confirmation sections', () => {
    const html = buildCreatorApplicationEmailHtml(payload);

    expect(html).toContain('&lt;Creator&gt;');
    expect(html).not.toContain('<Creator>');
    expect(html).toContain('A. Free Bento Cake (up to ₱499)');
    expect(html).toContain('Visit Genie.ph first and place your own bento cake order.');
    expect(html).toContain('Choose a design from our collection or upload your own design');
    expect(html).toContain('apply the free bento code below to get your bento cake order free (up to ₱499 off).');
    expect(html).not.toContain('If customizations make the bento cake cost more than ₱499');
    expect(html).toContain('B. 50% Personal Voucher');
    expect(html).toContain('C. Share Your Creator Link');
    expect(html).toContain('Free Delivery within Cebu City. This voucher is inactive and will be activated once you submit a video reel.');
    expect(html).toContain('Delivery is charged at the regular delivery rate but delivery is free within Cebu City.');
    expect(html).toContain('https://genie.ph/TESTCREATOR');
    expect(html).toContain('genieph%20logo%20long.jpg');
    expect(html).toContain('This is an automated message from Genie.ph');
  });

  it('builds a readable plain-text fallback', () => {
    const text = buildCreatorApplicationEmailText(payload);

    expect(text).toContain('FREE BENTO CODE: GENIEBENTO12345678');
    expect(text).toContain('PERSONAL VOUCHER CODE: GENIE50ABCDEF12');
    expect(text).toContain('YOUR UNIQUE LINK: https://genie.ph/TESTCREATOR');
  });

  it('builds the Resend message with the requested sender and recipient', () => {
    expect(buildResendEmailRequest(payload)).toMatchObject({
      from: 'Genie PH <orders@mail.genie.ph>',
      to: ['creator@example.com'],
      subject: 'Your Genie.ph Creator UGC Collab Codes',
      text: expect.stringContaining('APPLICATION RECEIVED!'),
    });
  });
});
