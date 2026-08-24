export type CreatorApplicationEmailPayload = {
  creatorId: string;
  name: string;
  recipientEmail: string;
  bentoCode: string;
  voucherCode: string;
  referralCode: string;
  referralLink: string;
};

export const CREATOR_EMAIL_FROM = 'Genie PH <orders@mail.genie.ph>';
export const CREATOR_EMAIL_SUBJECT = 'Your Genie.ph Creator UGC Collab Codes';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function validateCreatorApplicationEmailPayload(input: unknown): CreatorApplicationEmailPayload {
  if (!input || typeof input !== 'object') {
    throw new Error('Request body must be an object.');
  }

  const candidate = input as Record<string, unknown>;
  const values = {
    creatorId: typeof candidate.creatorId === 'string' ? candidate.creatorId.trim() : '',
    name: typeof candidate.name === 'string' ? candidate.name.trim() : '',
    recipientEmail: typeof candidate.recipientEmail === 'string' ? candidate.recipientEmail.trim().toLowerCase() : '',
    bentoCode: typeof candidate.bentoCode === 'string' ? candidate.bentoCode.trim().toUpperCase() : '',
    voucherCode: typeof candidate.voucherCode === 'string' ? candidate.voucherCode.trim().toUpperCase() : '',
    referralCode: typeof candidate.referralCode === 'string' ? candidate.referralCode.trim().toUpperCase() : '',
    referralLink: typeof candidate.referralLink === 'string' ? candidate.referralLink.trim() : '',
  };

  if (!UUID_PATTERN.test(values.creatorId)) throw new Error('Invalid creator ID.');
  if (!values.name || values.name.length > 120) throw new Error('Invalid creator name.');
  if (!EMAIL_PATTERN.test(values.recipientEmail) || values.recipientEmail.length > 254) throw new Error('Invalid recipient email.');
  if (!CODE_PATTERN.test(values.bentoCode) || !CODE_PATTERN.test(values.voucherCode) || !CODE_PATTERN.test(values.referralCode)) {
    throw new Error('Invalid creator code.');
  }

  let referralUrl: URL;
  try {
    referralUrl = new URL(values.referralLink);
  } catch {
    throw new Error('Invalid referral link.');
  }

  if (
    referralUrl.protocol !== 'https:'
    || referralUrl.hostname !== 'genie.ph'
    || referralUrl.port
    || referralUrl.username
    || referralUrl.password
    || referralUrl.pathname !== `/${values.referralCode}`
    || referralUrl.search
    || referralUrl.hash
  ) {
    throw new Error('Invalid referral link.');
  }

  return values;
}

function codeBox(label: string, code: string) {
  return `
    <p style="margin:24px 0 8px;color:#a855f7;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${label}</p>
    <div style="padding:16px 18px;border:1px solid #e9d5ff;border-radius:12px;background:#ffffff;color:#172033;font-size:18px;font-weight:700;letter-spacing:0.02em;word-break:break-all;">${escapeHtml(code)}</div>
  `;
}

function section(title: string, content: string, background = '#ffffff') {
  return `
    <section style="margin:16px 0;padding:24px;border:1px solid #e9d5ff;border-radius:22px;background:${background};">
      <h2 style="margin:0 0 16px;color:#172033;font-size:22px;line-height:1.3;">${title}</h2>
      ${content}
    </section>
  `;
}

export function buildCreatorApplicationEmailHtml(payload: CreatorApplicationEmailPayload) {
  const name = escapeHtml(payload.name);
  const referralLink = escapeHtml(payload.referralLink);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${CREATOR_EMAIL_SUBJECT}</title>
  </head>
  <body style="margin:0;background:#f7f3fb;color:#3f4b61;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:680px;margin:0 auto;padding:32px 16px;">
      <div style="padding:32px 24px;background:#ffffff;border-radius:24px;">
        <h1 style="margin:0;text-align:center;color:#172033;font-size:34px;line-height:1.15;">Application Received!</h1>
        <p style="margin:20px auto 28px;max-width:580px;text-align:center;font-size:17px;line-height:1.65;">
          Hi ${name}, thank you for applying to the <strong style="color:#a855f7;">Genie.ph</strong> Creator UGC Collab. Your codes are below—please save them before leaving this email.
        </p>

        ${section('A. Free Bento Cake (up to ₱499)', `
          <p style="margin:0;font-size:16px;line-height:1.65;">Receive up to ₱499 off one bento cake for your content creation. If customizations make the bento cake cost more than ₱499, you pay the difference. Use it to record your experience and create a review. Delivery is charged at the regular delivery rate but delivery is free within Cebu City.</p>
          <p style="margin:16px 0 0;font-size:16px;line-height:1.65;">Focus your content on how easy it is to order online through Genie.ph: upload a design, get an instant quote, customize the cake, and complete the order without waiting for long chat replies.</p>
          ${codeBox('Free bento code', payload.bentoCode)}
        `, '#fcf8ff')}

        ${section('B. 50% Personal Voucher', `
          <p style="margin:0;font-size:16px;line-height:1.65;">This voucher is valid once for the email address used in your application. It gives 50% off the cake subtotal, capped at ₱1,500. Delivery is not discounted. The voucher starts inactive and is activated once you submit a video reel.</p>
          ${codeBox('Personal voucher code', payload.voucherCode)}
        `)}

        ${section('C. Share Your Creator Link', `
          <p style="margin:0;font-size:16px;line-height:1.65;">Share your link with your audience. They receive 10% off, and you receive 15% commission for each successful order using your code.</p>
          <p style="margin:24px 0 8px;color:#a855f7;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Your unique link</p>
          <a href="${referralLink}" style="display:block;padding:16px 18px;border:1px solid #e9d5ff;border-radius:12px;color:#172033;font-size:17px;font-weight:700;word-break:break-all;text-decoration:none;">${referralLink}</a>
        `)}

        <p style="margin:28px 0 0;text-align:center;color:#697386;font-size:13px;line-height:1.6;">Genie.ph Creator UGC Collab</p>
      </div>
    </div>
  </body>
</html>`;
}

export function buildResendEmailRequest(payload: CreatorApplicationEmailPayload) {
  return {
    from: CREATOR_EMAIL_FROM,
    to: [payload.recipientEmail],
    subject: CREATOR_EMAIL_SUBJECT,
    html: buildCreatorApplicationEmailHtml(payload),
  };
}
