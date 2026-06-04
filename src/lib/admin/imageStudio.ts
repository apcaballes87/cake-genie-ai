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
    'Transform this reference into a polished bakery catalog hero image.',
    'First determine whether the source is a direct cake photo or a screenshot/product-grid/social-media capture.',
    'If the original image already shows a bento cake presented inside a clamshell box (lunchbox), preserve that clamshell box exactly as part of the cake subject. If the original image does not show a clamshell box or bento container, do NOT add one; present the cake on a simple, thin cake board (specifically a round board for round/circular 1-tier, 2-tier, or 3-tier cakes, or a rectangular board for square or rectangular cakes) while retaining the original board\'s color.',
    'If it is a direct cake photo, preserve the actual cake design exactly as-is while elevating it into a premium studio product shot.',
    'If it is a screenshot, collage, phone screenshot, marketplace page, Pinterest pin, or product grid, use it only as a reference for the cake design. Do NOT preserve the screenshot composition, crop, framing, margins, or original scene.',
    'For screenshot-like sources, follow this exact sequence: first identify the single hero cake subject and its essential board or bento box, second extract or cut out only that cake subject, third completely erase the entire original screenshot scene, and fourth place the extracted cake into a brand-new studio setup.',
    'Carefully remove any existing logos, branding, or stickers from the background, the cake board/base, or the cake itself to ensure a clean, unbranded subject.',
    'For screenshots, completely remove phone frames, browser chrome, app UI, buttons, search bars, text, icons, logos, watermarks, price tags, cards, borders, thumbnail shadows, multiple thumbnails, hands, tables, utensils, packaging, and any non-cake products.',
    'For screenshots with multiple cakes or items, keep only the most prominent hero cake, ideally the largest or most centered cake, and do not include secondary cakes.',
    'When isolating a cake from a screenshot, rebuild any cropped, hidden, low-resolution, or partially occluded cake edges naturally so the cake looks whole and intentionally photographed.',
    'After extraction, the original screenshot must be considered fully discarded. No part of the Google Images page, listing tile, card layout, collage, screenshot crop, or original environment may remain visible or influence the final composition.',
    'Do NOT do a simple background replacement. The final result must read as a fresh ecommerce product photoshoot, not as an edited screenshot, listing capture, collage, composite, or app card.',
    'Restage the final cake (retaining its clamshell box ONLY if it was already present in the original source image, and placing the cake on a simple, thin cake board that retains the original board\'s color otherwise, specifically using a thin round board for round/circular 1-tier, 2-tier, or 3-tier cakes, or a thin rectangular board for square or rectangular cakes) as a standalone hero product shot on a seamless light pastel purple cyclorama studio set with a clean floor-to-wall sweep.',
    'Use premium bakery product photography: soft diffused key light, subtle fill light, gentle highlight rolloff, natural depth, and a realistic grounded contact shadow.',
    'Remove screenshot-era lighting, perspective cues, compression artifacts, flat UI framing, grid/listing balance, and any leftover traces of the original screenshot environment.',
    'Keep the cake design, decorations, topper placement, writing, shape, and proportions faithful to the source cake, but always transform the cake board into a simple, thin cake board that matches the cake shape (a thin round board for round/circular 1-tier, 2-tier, or 3-tier cakes, or a thin rectangular board for square or rectangular cakes) while retaining its original color.',
    'If the cake subject is cut off, partially out of frame, or covers 90-100% of the source, zoom out or extend the scene so the entire cake is fully visible with breathing room and occupies approximately 70-80% of the frame. Otherwise, recompose it as a natural centered hero product shot instead of preserving a screenshot-like crop.',
    'Do not add props, flowers, ribbons, hands, extra cake decorations, text, UI elements, or watermarks.',
    'Output a photorealistic, high-resolution bakery catalog image in a 1:1 square aspect ratio. Reframe, expand, or extend the scene as needed so the final image is perfectly square while keeping the full cake comfortably visible.',
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
