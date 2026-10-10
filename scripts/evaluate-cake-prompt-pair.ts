/**
 * Uncached, sequential prompt comparison using local images and local artifacts.
 * node --import tsx scripts/evaluate-cake-prompt-pair.ts --before before.txt --after after.txt \
 *   --manifest images.json --out /tmp/cake-prompt-evaluation --dry-run
 * Manifest: [{ "id": "case-one", "imagePath": "./case-one.webp" }]
 * Relative image paths resolve beside the manifest. Remove --dry-run for paid inference.
 */
import { createHash } from 'node:crypto';
import { readFile, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ANALYSIS_MODEL = 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 120_000;
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Difference = { path: string; before?: Json; after?: Json; beforeMissing?: true; afterMissing?: true };

function diff(before: Json, after: Json, current = '$'): Difference[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before !== null && after !== null && typeof before === 'object' && typeof after === 'object'
    && Array.isArray(before) === Array.isArray(after)) {
    const left = before as Record<string, Json>;
    const right = after as Record<string, Json>;
    return [...new Set([...Object.keys(left), ...Object.keys(right)])].sort().flatMap(key => {
      const field = Array.isArray(before) ? `${current}[${key}]` : `${current}[${JSON.stringify(key)}]`;
      if (!Object.hasOwn(left, key)) return [{ path: field, beforeMissing: true as const, after: right[key] }];
      if (!Object.hasOwn(right, key)) return [{ path: field, before: left[key], afterMissing: true as const }];
      return diff(left[key], right[key], field);
    });
  }
  return [{ path: current, before, after }];
}

function localPath(value: string, base = process.cwd()) {
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) throw new Error(`Only local filesystem paths are accepted: ${value}`);
  return path.resolve(base, value);
}

async function readNonempty(file: string) {
  if (!(await stat(file)).isFile()) throw new Error(`Expected a regular file: ${file}`);
  const content = await readFile(file);
  if (!content.length) throw new Error(`File is empty: ${file}`);
  return content;
}

async function main() {
  const values = new Map<string, string>();
  let dryRun = false;
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === '--dry-run') { dryRun = true; continue; }
    if (!['--before', '--after', '--manifest', '--out', '--limit'].includes(flag)) {
      throw new Error(`Unknown argument: ${flag}`);
    }
    const value = args[++index];
    if (!value || value.startsWith('--') || values.has(flag)) throw new Error(`Missing or repeated argument: ${flag}`);
    values.set(flag, value);
  }
  for (const required of ['--before', '--after', '--manifest', '--out']) {
    if (!values.has(required)) throw new Error(`Required argument: ${required}`);
  }
  const limitText = values.get('--limit');
  if (limitText && (!/^[1-9]\d*$/.test(limitText) || !Number.isSafeInteger(Number(limitText)))) {
    throw new Error('--limit must be a positive integer');
  }
  const beforePath = localPath(values.get('--before')!);
  const afterPath = localPath(values.get('--after')!);
  const manifestPath = localPath(values.get('--manifest')!);
  const outputPath = localPath(values.get('--out')!);
  const before = (await readNonempty(beforePath)).toString('utf8');
  const after = (await readNonempty(afterPath)).toString('utf8');
  if (!before.trim() || !after.trim()) throw new Error('Both prompt files must contain text');
  const manifest: unknown = JSON.parse((await readNonempty(manifestPath)).toString('utf8'));
  if (!Array.isArray(manifest) || !manifest.length) throw new Error('Manifest must be a nonempty array of {id, imagePath}');
  const ids = new Set<string>();
  const images: Array<{ id: string; imagePath: string; mimeType: string; sha256: string; data: Buffer }> = [];
  const mimeTypes: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  for (const entry of manifest) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || typeof entry.imagePath !== 'string'
      || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(entry.id) || ids.has(entry.id)) {
      throw new Error('Each manifest row needs a unique safe id and a local imagePath');
    }
    ids.add(entry.id);
    const imagePath = localPath(entry.imagePath, path.dirname(manifestPath));
    const mimeType = mimeTypes[path.extname(imagePath).toLowerCase()];
    if (!mimeType) throw new Error(`Unsupported image extension: ${imagePath}`);
    const data = await readNonempty(imagePath);
    images.push({ id: entry.id, imagePath, mimeType, sha256: hash(data), data });
  }
  const selected = limitText ? images.slice(0, Number(limitText)) : images;
  const { buildSearchAnalysisGenerationConfig } = await import('../src/lib/admin/searchAnalysisContract');
  const { GENERATED_MAIN_TOPPER_TYPES, GENERATED_SUPPORT_ELEMENT_TYPES, GENERATED_ANALYSIS_SUBTYPES_BY_TYPE } = await import('../src/lib/ai/generatedAnalysisContract');
  const config = buildSearchAnalysisGenerationConfig({
    mainTopperTypes: [...GENERATED_MAIN_TOPPER_TYPES],
    supportElementTypes: [...GENERATED_SUPPORT_ELEMENT_TYPES],
    subtypesByType: Object.fromEntries(Object.entries(GENERATED_ANALYSIS_SUBTYPES_BY_TYPE).map(([type, subtypes]) => [type, [...subtypes]])),
  }, 'local_line_ratio', 'analysis_only');
  const metadata = {
    model: ANALYSIS_MODEL,
    sizeSchema: 'local_line_ratio',
    seoSchema: 'analysis_only',
    schemaSha256: hash(JSON.stringify(config.responseSchema)),
    systemInstructionSha256: hash(config.systemInstruction),
    before: { path: beforePath, sha256: hash(before) },
    after: { path: afterPath, sha256: hash(after) },
    timeoutMs: TIMEOUT_MS,
    outputPath,
    calls: selected.length * 2,
    postprocessing: false,
    diffBasis: 'Parsed raw model JSON; arrays compared by index; no local sizing or reconciliation',
    images: selected.map(({ id, imagePath, mimeType, sha256 }) => ({ id, imagePath, mimeType, sha256 })),
  };
  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, ...metadata }, null, 2));
    return;
  }

  // Create a fresh run directory to prevent overwriting earlier evaluation evidence.
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(outputPath);
  const save = (name: string, value: unknown) => writeFile(path.join(outputPath, name), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  await save('metadata.json', { startedAt: new Date().toISOString(), ...metadata });
  await save('generation-config.json', config);
  let activeCase: string | undefined;
  let activeVersion: string | undefined;
  try {
    const dotenv = await import('dotenv');
    dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), quiet: true });
    dotenv.config({ path: path.resolve(process.cwd(), '.env'), quiet: true });
    const { getAI } = await import('../src/lib/ai/client');
    const ai = await getAI();
    const summary: Array<{ id: string; changedFields: number }> = [];
    for (const image of selected) {
      activeCase = image.id;
      const outputs: Json[] = [];
      for (const [version, prompt] of [['before', before], ['after', after]] as const) {
        activeVersion = version;
        console.log(`Evaluating ${image.id}: ${version}`);
        const response = await ai.models.generateContent({
          model: ANALYSIS_MODEL,
          contents: [{ role: 'user', parts: [
            { inlineData: { mimeType: image.mimeType, data: image.data.toString('base64') } },
            { text: prompt },
          ] }],
          config: { ...config, abortSignal: AbortSignal.timeout(TIMEOUT_MS) },
        });
        await save(`${image.id}.${version}.response.json`, response);
        const rawText = response.text;
        if (!rawText?.trim()) throw new Error('Provider returned no response text');
        await writeFile(path.join(outputPath, `${image.id}.${version}.raw.txt`), rawText, { flag: 'wx' });
        const parsed: Json = JSON.parse(rawText);
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Model response must be a JSON object');
        await save(`${image.id}.${version}.parsed.json`, parsed);
        outputs.push(parsed);
      }
      const differences = diff(outputs[0], outputs[1]);
      await save(`${image.id}.diff.json`, differences);
      summary.push({ id: image.id, changedFields: differences.length });
    }
    await save('summary.json', { completedAt: new Date().toISOString(), cases: summary });
    console.log(`Saved ${summary.length} prompt pairs to ${outputPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await save('error.json', { failedAt: new Date().toISOString(), id: activeCase, version: activeVersion, message });
    throw new Error(`Evaluation failed${activeCase ? ` for ${activeCase} (${activeVersion})` : ''}: ${message}. Evidence: ${outputPath}`);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
