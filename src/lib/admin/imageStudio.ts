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
    'Transform this reference into a polished product catalog hero image.',
    'Extract the main cake and preserve the actual cake design exactly as-is while elevating it into a premium studio product shot. Remove screenshot-era lighting, perspective cues, compression artifacts, flat UI framing, grid/listing balance, and any leftover traces of the original screenshot environment.',
    'If the cake subject is a bento cake presented in a clamshell box (lunchbox), consider the box as an integral part of the cake subject and do not remove it.',
    'Carefully remove any existing logos, branding, watermarks, or stickers from the background, the cake board/base, or the cake itself to ensure a clean, unbranded subject.',
    'Completely remove phone frames, browser chrome, app UI, buttons, search bars, text, icons, logos, watermarks, price tags, cards, borders, thumbnail shadows, multiple thumbnails, hands, tables, utensils, packaging, and any non-cake products.',
    'Keep only the most prominent hero cake, ideally the largest or most centered cake, and do not include secondary cakes or cupcakes.',
    'When isolating a cake from a screenshot, rebuild any cropped, hidden, low-resolution, or partially occluded cake edges naturally so the cake looks whole and intentionally photographed.',
    'After extraction, the original screenshot must be considered fully discarded. No part of the Google Images page, listing tile, card layout, collage, screenshot crop, or original environment may remain visible or influence the final composition.',
    'Do NOT do a simple background replacement. The final result must read as a fresh ecommerce product photoshoot, not as an edited screenshot, listing capture, collage, composite, or app card. Restage the final cake as a standalone hero product shot on a seamless light pastel purple cyclorama studio set with a clean floor-to-wall sweep.',
    'Use premium bakery product photography: soft diffused key light, subtle fill light, gentle highlight rolloff, natural depth, and a realistic grounded contact shadow.',
    'If the cake subject is cut off, partially out of frame, or covers 90-100% of the source, zoom out or extend the scene so the entire cake is fully visible with breathing room and occupies approximately 70-80% of the frame. Otherwise, recompose it as a natural centered hero product shot instead of preserving a screenshot-like crop.',
    'Do not add props, flowers, ribbons, hands, extra cake decorations, text, UI elements, or watermarks.',
    'Output a photorealistic, high-resolution bakery catalog image in the exact same aspect ratio and dimensions as the original.',
    'Make the aspect ratio 1:1.',
    'Make the size of the cake cover 70% of the whole frame.',
    'Retain the white round cake base board below the cake or create one if there is not any.',
  ].join(' ');
}

export function buildImageStudioSystemInstruction(): string {
  return [
    'You are a professional bakery ecommerce image editor and product photographer.',
    'Convert cake references into polished standalone catalog photos.',
    'When the source is a screenshot, collage, social post, or marketplace capture, treat it only as design reference for the cake itself.',
    'For screenshot-like inputs, use a cutout-and-restage workflow: extract only the cake subject, discard the entire original screenshot scene, then rebuild the image as a new studio photograph.',
    'The screenshot is disposable source material; only the cake design should survive into the final image.',
    'The final output must look like a newly photographed studio product image, never like a screenshot, listing tile, collage, or simple background swap.',
    'Removing screenshot artifacts and restaging the cake as a premium product photo is higher priority than preserving the original screenshot scene.',
    'Preserve the cake design faithfully, but recreate the surrounding scene, lighting, and composition as needed to achieve a realistic product photoshoot result.',
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
