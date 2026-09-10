import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

/**
 * One rule the compiler cannot see, plus a cheap double-check of one it can.
 *
 * Rule 1 (direction) is enforced at COMPILE TIME by per-layer `tsc -p`: an
 *   undeclared cross-layer import fails with TS6059/TS6307. Verified 2026-09-10.
 *   Repeated here only because it costs nothing and names the layer plainly.
 *
 * Rule 2 (purity) is invisible to the compiler: `import { Hono } from 'hono'`
 *   inside src/domain resolves through node_modules, outside the layer graph.
 *   This script is the only thing standing between that and invariant 7.
 *
 * Imports are enumerated with TypeScript's own preProcessFile rather than a
 * regex, so dynamic `import()`, bare side-effect imports and `export ... from`
 * are all seen. An earlier regex version missed the first two.
 */

const LAYERS = ['domain', 'application', 'infrastructure', 'ui', 'root'] as const;
type Layer = (typeof LAYERS)[number];

const MAY_IMPORT: Record<Layer, readonly Layer[]> = {
  domain: [],
  application: ['domain'],
  infrastructure: ['domain', 'application'],
  ui: ['domain', 'application'],
  root: ['domain', 'application', 'infrastructure', 'ui'],
};

/** Test files legitimately need the test runner. Production code does not. */
const TEST_ONLY_ALLOWED = ['node:test', 'node:assert', 'node:assert/strict'];

const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const problems: string[] = [];

for (const file of walk(SRC)) {
  if (!file.endsWith('.ts')) continue;

  const rel = relative(SRC, file);
  const layer = rel.split(sep)[0] as Layer;
  if (!LAYERS.includes(layer)) continue;

  const isTest = file.endsWith('.test.ts');
  const source = readFileSync(file, 'utf8');

  for (const { fileName: specifier } of ts.preProcessFile(source, true, true).importedFiles) {
    if (!specifier.startsWith('.')) {
      if (layer === 'domain' && !(isTest && TEST_ONLY_ALLOWED.includes(specifier))) {
        problems.push(`${rel}: domain must import nothing external, found "${specifier}"`);
      }
      continue;
    }

    const target = /^\.\.\/([^/]+)\//.exec(specifier)?.[1] as Layer | undefined;
    if (target === undefined || !LAYERS.includes(target)) continue;

    if (target !== layer && !MAY_IMPORT[layer].includes(target)) {
      problems.push(`${rel}: ${layer} may not import ${target} ("${specifier}")`);
    }
  }
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} import rule violation(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('');
  process.exit(1);
}

console.log('✓ import rules hold: direction is inward only, domain imports nothing external');

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}
