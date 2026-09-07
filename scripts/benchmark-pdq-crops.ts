import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import sharp from 'sharp';
import {
  PDQ_PIPELINE,
  computePDQFingerprint,
  PDQ_MAX_HAMMING_DISTANCE,
} from '../src/lib/server/imageFingerprint';

const require = createRequire(import.meta.url);
const { PDQ } = require('pdq-wasm') as typeof import('pdq-wasm');

const CANONICAL_SIZE = 512;
const WHITE_BACKGROUND = { r: 255, g: 255, b: 255 };

type Variant = {
  name: string;
  input: Buffer;
};

type HashResult = {
  hash: string | null;
  quality: number | null;
  status: string;
};

type Normalization = 'trim' | 'cover';

type Measurement = {
  fixture: string;
  variant: string;
  currentDistance: number | null;
  trimDistance: number | null;
  coverDistance: number | null;
  currentQuality: number | null;
  trimQuality: number | null;
  coverQuality: number | null;
};

type FixtureHashes = {
  fixture: string;
  current: Awaited<ReturnType<typeof computePDQFingerprint>>;
  trim: HashResult;
  cover: HashResult;
};

function hammingDistance(left: string | null, right: string | null): number | null {
  if (!left || !right) return null;
  let distance = 0;
  let xor = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}

function toReferenceHex(hash: Uint8Array): string {
  const source = Buffer.from(hash);
  const reference = Buffer.alloc(source.length);
  for (let offset = 0; offset < source.length; offset += 2) {
    const sourceOffset = source.length - offset - 2;
    source.copy(reference, offset, sourceOffset, sourceOffset + 2);
  }
  return reference.toString('hex');
}

async function normalizeForPDQ(
  input: Buffer,
  normalization: 'contain' | Normalization,
): Promise<{ data: Buffer; width: number; height: number; channels: number }> {
  let pipeline = sharp(input, { failOn: 'none' })
    .rotate()
    .toColorspace('srgb')
    .flatten({ background: WHITE_BACKGROUND });

  if (normalization === 'trim') {
    pipeline = pipeline.trim({ background: WHITE_BACKGROUND, threshold: 8 });
  }

  const { data, info } = await pipeline
    .resize(CANONICAL_SIZE, CANONICAL_SIZE, {
      fit: normalization === 'cover' ? 'cover' : 'contain',
      position: 'centre',
      background: WHITE_BACKGROUND,
      kernel: sharp.kernel.lanczos3,
      fastShrinkOnLoad: false,
      // The production contain pipeline intentionally does not enlarge small
      // images. The experimental cover comparison must fill the 512px canvas
      // so that it tests crop normalization rather than a smaller hash input.
      withoutEnlargement: normalization !== 'cover',
    })
    .removeAlpha()
    .toColorspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, width: info.width, height: info.height, channels: info.channels };
}

async function computeExperimentalPDQ(input: Buffer, normalization: Normalization): Promise<HashResult> {
  const normalized = await normalizeForPDQ(input, normalization);
  if (
    normalized.width !== CANONICAL_SIZE ||
    normalized.height !== CANONICAL_SIZE ||
    normalized.channels !== 3
  ) {
    throw new Error(
      `Experimental ${normalization} normalization returned ${normalized.width}x${normalized.height} with ${normalized.channels} channels.`,
    );
  }

  await PDQ.init();
  const result = PDQ.hash({
    data: Uint8Array.from(normalized.data),
    width: normalized.width,
    height: normalized.height,
    channels: normalized.channels,
  });
  const quality = Number(result.quality);
  return {
    hash: quality >= 50 ? toReferenceHex(result.hash) : null,
    quality,
    status: quality >= 50 ? 'ready' : 'low_quality',
  };
}

function crop(input: Buffer, percentage: number, position: 'center' | 'top' | 'left'): Promise<Buffer> {
  return sharp(input)
    .metadata()
    .then((metadata) => {
      if (!metadata.width || !metadata.height) throw new Error('Fixture has no dimensions.');
      const width = Math.max(1, Math.floor(metadata.width * (1 - percentage)));
      const height = Math.max(1, Math.floor(metadata.height * (1 - percentage)));
      const left = position === 'left' ? 0 : Math.floor((metadata.width - width) / 2);
      const top = position === 'top' ? 0 : Math.floor((metadata.height - height) / 2);
      return sharp(input)
        .extract({ left, top, width, height })
        .webp({ quality: 92 })
        .toBuffer();
    });
}

async function makeVariants(input: Buffer): Promise<Variant[]> {
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) throw new Error('Fixture has no dimensions.');

  return [
    { name: 'exact-bytes', input },
    {
      name: 'reencoded-webp-70',
      input: await sharp(input).webp({ quality: 70 }).toBuffer(),
    },
    {
      name: 'resized-half',
      input: await sharp(input)
        .resize({ width: Math.max(1, Math.floor(metadata.width / 2)), withoutEnlargement: true })
        .webp({ quality: 90 })
        .toBuffer(),
    },
    { name: 'center-crop-2pct', input: await crop(input, 0.02, 'center') },
    { name: 'center-crop-5pct', input: await crop(input, 0.05, 'center') },
    { name: 'top-crop-2pct', input: await crop(input, 0.02, 'top') },
    { name: 'left-crop-2pct', input: await crop(input, 0.02, 'left') },
  ];
}

async function runFixture(fixturePath: string): Promise<Measurement[]> {
  const original = await readFile(fixturePath);
  const variants = await makeVariants(original);
  const baseline = await computePDQFingerprint(original);
  const baselineTrim = await computeExperimentalPDQ(original, 'trim');
  const baselineCover = await computeExperimentalPDQ(original, 'cover');
  const measurements: Measurement[] = [];

  console.log(`\nFixture: ${fixturePath}`);
  console.log(`Production pipeline: ${PDQ_PIPELINE}`);
  console.log(`Threshold: <=${PDQ_MAX_HAMMING_DISTANCE}, quality >=50`);
  console.log('variant\tcurrent distance\ttrim distance\tcover distance\tcurrent quality\ttrim quality\tcover quality\tcurrent status');

  for (const variant of variants) {
    const current = variant.name === 'exact-bytes' ? baseline : await computePDQFingerprint(variant.input);
    const trim = variant.name === 'exact-bytes' ? baselineTrim : await computeExperimentalPDQ(variant.input, 'trim');
    const cover = variant.name === 'exact-bytes' ? baselineCover : await computeExperimentalPDQ(variant.input, 'cover');
    const currentDistance = hammingDistance(baseline.pdqHash, current.pdqHash);
    const trimDistance = hammingDistance(baselineTrim.hash, trim.hash);
    const coverDistance = hammingDistance(baselineCover.hash, cover.hash);
    measurements.push({
      fixture: basename(fixturePath),
      variant: variant.name,
      currentDistance,
      trimDistance,
      coverDistance,
      currentQuality: current.pdqQuality,
      trimQuality: trim.quality,
      coverQuality: cover.quality,
    });
    console.log(
      [
        variant.name,
        currentDistance ?? 'n/a',
        trimDistance ?? 'n/a',
        coverDistance ?? 'n/a',
        current.pdqQuality ?? 'n/a',
        trim.quality ?? 'n/a',
        cover.quality ?? 'n/a',
        current.status,
      ].join('\t'),
    );
  }

  return measurements;
}

async function hashFixture(fixturePath: string): Promise<FixtureHashes> {
  const original = await readFile(fixturePath);
  return {
    fixture: basename(fixturePath),
    current: await computePDQFingerprint(original),
    trim: await computeExperimentalPDQ(original, 'trim'),
    cover: await computeExperimentalPDQ(original, 'cover'),
  };
}

async function printPairwiseDistances(fixtures: string[]) {
  if (fixtures.length < 2) return;
  const hashes: FixtureHashes[] = [];
  for (const fixturePath of fixtures) {
    hashes.push(await hashFixture(fixturePath));
  }

  console.log('\nPairwise distances between the original fixture files:');
  console.log('fixture A\tfixture B\tcurrent contain\ttrim(8) + contain\tcenter cover');
  for (let left = 0; left < hashes.length; left += 1) {
    for (let right = left + 1; right < hashes.length; right += 1) {
      const first = hashes[left];
      const second = hashes[right];
      console.log(
        [
          first.fixture,
          second.fixture,
          hammingDistance(first.current.pdqHash, second.current.pdqHash) ?? 'n/a',
          hammingDistance(first.trim.hash, second.trim.hash) ?? 'n/a',
          hammingDistance(first.cover.hash, second.cover.hash) ?? 'n/a',
        ].join('\t'),
      );
    }
  }
}

function summarize(measurements: Measurement[], label: string, getDistance: (measurement: Measurement) => number | null) {
  const transformed = measurements.filter((measurement) => measurement.variant !== 'exact-bytes');
  const distances = transformed
    .map(getDistance)
    .filter((distance): distance is number => distance !== null)
    .sort((left, right) => left - right);
  if (distances.length === 0) return;

  const percentile = (fraction: number) => distances[Math.min(distances.length - 1, Math.ceil(distances.length * fraction) - 1)];
  const rates = [31, PDQ_MAX_HAMMING_DISTANCE, 40, 50, 64]
    .map((threshold) => `${threshold}:${distances.filter((distance) => distance <= threshold).length}/${distances.length}`)
    .join(' ');

  console.log(
    `${label}: median=${percentile(0.5)} p90=${percentile(0.9)} max=${distances[distances.length - 1]} match-rates(${rates})`,
  );
}

async function main() {
  const requested = process.argv.slice(2);
  const fixtures = requested.length > 0
    ? requested.map((path) => resolve(path))
    : [resolve('public/test-watermarked-image.webp'), resolve('cinnamoroll-test.webp')];

  const measurements: Measurement[] = [];
  for (const fixturePath of fixtures) {
    measurements.push(...await runFixture(fixturePath));
  }

  console.log('\nInterpretation: distances above the configured threshold are misses. This benchmark is diagnostic only; it does not alter the production pipeline.');
  summarize(measurements, 'Current contain + white', (measurement) => measurement.currentDistance);
  summarize(measurements, 'Experimental trim(8) + contain', (measurement) => measurement.trimDistance);
  summarize(measurements, 'Experimental center cover', (measurement) => measurement.coverDistance);
  await printPairwiseDistances(fixtures);
  console.log(`Fixtures: ${fixtures.map((fixture) => basename(fixture)).join(', ')}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
