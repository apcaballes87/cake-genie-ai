const GOOGLE_MERCHANT_ID_MAX_LENGTH = 50;
const GOOGLE_MERCHANT_ID_HASH_LENGTH = 8;

export function toGoogleMerchantId(rawValue: string): string {
  if (rawValue.length <= GOOGLE_MERCHANT_ID_MAX_LENGTH) {
    return rawValue;
  }

  const suffix = stableShortHash(rawValue);
  const prefixLength =
    GOOGLE_MERCHANT_ID_MAX_LENGTH - GOOGLE_MERCHANT_ID_HASH_LENGTH - 1;

  return `${rawValue.slice(0, prefixLength)}-${suffix}`;
}

function stableShortHash(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(GOOGLE_MERCHANT_ID_HASH_LENGTH, '0');
}
