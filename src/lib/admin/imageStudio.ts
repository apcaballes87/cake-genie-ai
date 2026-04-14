export const ADMIN_IMAGE_STUDIO_PIN = '231323';
export const IMAGE_STUDIO_PAGE_SIZE = 24;
export const IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD = 400;
export const IMAGE_STUDIO_MAX_UPSCALE_FACTOR = 3;
export const IMAGE_STUDIO_WATERMARK_LOGO_URL =
  'https://cqmhanqnfybyxezhobkx.supabase.co/storage/v1/object/public/cakegenie/genie%20ph%20logo%20long%20transparent.webp';
export const IMAGE_STUDIO_STATUS_VALUES = [
  'not_started',
  'processing',
  'completed',
  'failed',
] as const;

export type ImageStudioStatus = (typeof IMAGE_STUDIO_STATUS_VALUES)[number];

export interface CakeCacheImageRecord {
  p_hash: string;
  slug: string | null;
  seo_title: string | null;
  keywords: string | null;
  price: number | null;
  availability: string | null;
  original_image_url: string | null;
  image_width?: number | null;
  image_height?: number | null;
  studio_edited_image_url?: string | null;
  studio_edit_status?: string | null;
  studio_edit_error?: string | null;
  created_at?: string | null;
  studio_edited_at?: string | null;
}

export interface ImageStudioOutputDimensions {
  width: number;
  height: number;
  wasUpscaled: boolean;
  scaleFactor: number;
}

const IMAGE_STUDIO_STATUS_SET = new Set<string>(IMAGE_STUDIO_STATUS_VALUES);

export function normalizeImageStudioStatus(value: unknown): ImageStudioStatus {
  if (typeof value !== 'string') {
    return 'not_started';
  }

  return IMAGE_STUDIO_STATUS_SET.has(value) ? (value as ImageStudioStatus) : 'not_started';
}

export function buildImageStudioPrompt(brandLabel: string = 'genie.ph'): string {
  return [
    'Transform this into a polished cake catalog photo.',
    'First determine whether the source is a direct cake photo or a screenshot/product-grid capture.',
    'If the cake subject is a bento cake presented in a clamshell box (lunchbox), consider the box as an integral part of the cake subject and do not remove it.',
    'If it is a direct cake photo, preserve the actual cake exactly as-is and keep the cake design, decorations, topper placement, text, shape, board, camera crop, and proportions unchanged.',
    'If it is a screenshot, collage, phone screenshot, marketplace page, or product grid, extract only the single main cake subject (and its box if it is a bento cake) and discard everything else.',
    'Carefully remove any existing logos, branding, or stickers from the background, the cake board/base, or the cake itself to ensure a clean, unbranded subject.',
    'For screenshots, remove phone frames, browser chrome, app UI, buttons, text, logos, watermarks, price tags, multiple thumbnails, hands, tables, utensils, packaging, and any non-cake products.',
    'For screenshots with multiple cakes or items, keep only the most prominent hero cake, ideally the largest or most centered cake, and do not include secondary cakes.',
    'When isolating a cake from a screenshot, rebuild any partially hidden edges naturally so the final result looks like a clean standalone studio photo of one cake.',
    'Place the final cake (and its bento box if applicable) on a solid light pastel purple cyclorama studio background.',
    'Use soft diffused lighting, a gentle premium studio mood, and a realistic contact shadow so the cake still feels naturally photographed.',
    'Do not add props, flowers, ribbons, hands, extra cake decorations, text, UI elements, or watermarks.',
    'Keep the final image in the exact same aspect ratio and dimensions as the original.',
    `Leave the background clean and uncluttered with plenty of negative space behind and above the product subject.`,
  ].join(' ');
}

export function isImageStudioSmallImage(
  width: number | null | undefined,
  height: number | null | undefined
): boolean {
  if (!width || !height || width <= 0 || height <= 0) {
    return false;
  }

  return (
    width < IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD ||
    height < IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD
  );
}

export function getImageStudioOutputDimensions(
  width: number | null | undefined,
  height: number | null | undefined
): ImageStudioOutputDimensions | null {
  if (!width || !height || width <= 0 || height <= 0) {
    return null;
  }

  if (!isImageStudioSmallImage(width, height)) {
    return {
      width: Math.round(width),
      height: Math.round(height),
      wasUpscaled: false,
      scaleFactor: 1,
    };
  }

  const scaleFactor = Math.min(
    IMAGE_STUDIO_MAX_UPSCALE_FACTOR,
    Math.max(
      width < IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD
        ? IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD / width
        : 1,
      height < IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD
        ? IMAGE_STUDIO_SMALL_IMAGE_DIMENSION_THRESHOLD / height
        : 1
    )
  );

  return {
    width: Math.max(1, Math.round(width * scaleFactor)),
    height: Math.max(1, Math.round(height * scaleFactor)),
    wasUpscaled: scaleFactor > 1,
    scaleFactor,
  };
}

export function getImageStudioStoragePath({
  slug,
  pHash,
}: {
  slug: string | null;
  pHash: string;
}): string {
  const baseName = slugifySegment(slug || pHash);
  return `admin/image-studio/${baseName}.webp`;
}

export function buildImageStudioWatermarkSvg({
  width,
  height,
  brandLabel = 'genie.ph',
  opacity = 0.12,
}: {
  width: number;
  height: number;
  brandLabel?: string;
  opacity?: number;
}): string {
  const safeWidth = Math.max(320, Math.round(width));
  const safeHeight = Math.max(320, Math.round(height));
  const safeOpacity = Math.min(Math.max(opacity, 0.04), 0.3);
  const escapedLabel = escapeXml(brandLabel);
  const fontSize = Math.max(34, Math.round(safeWidth * 0.07));
  const sparkleSize = Math.max(18, Math.round(fontSize * 0.42));
  const centerX = safeWidth / 2;
  const centerY = safeHeight * 0.24;
  const labelOffset = Math.round(fontSize * 0.62);

  return `
    <svg width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}" xmlns="http://www.w3.org/2000/svg" fill="none">
      <defs>
        <filter id="soft-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="${Math.max(1, Math.round(fontSize * 0.025))}" />
        </filter>
      </defs>
      <g opacity="${safeOpacity}" filter="url(#soft-blur)">
        <path
          d="M ${centerX - labelOffset - sparkleSize} ${centerY}
             L ${centerX - labelOffset - sparkleSize / 2} ${centerY - sparkleSize / 2}
             L ${centerX - labelOffset} ${centerY}
             L ${centerX - labelOffset - sparkleSize / 2} ${centerY + sparkleSize / 2} Z"
          fill="white"
        />
        <text
          x="${centerX}"
          y="${centerY + fontSize * 0.28}"
          text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif"
          font-size="${fontSize}"
          font-weight="700"
          letter-spacing="${Math.max(0.8, fontSize * 0.035)}"
          fill="white"
        >${escapedLabel}</text>
      </g>
    </svg>
  `.trim();
}

function slugifySegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'image-studio-item';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
