// bun scripts/check-glb-geometry.ts before.glb after.glb
import { readFile } from 'node:fs/promises';
import { assertGeometryUnchanged } from '@easyrender/harness/fidelity';

const [before, after] = process.argv.slice(2);
if (!before || !after)
  throw new Error('Usage: bun scripts/check-glb-geometry.ts before.glb after.glb');
const hash = assertGeometryUnchanged(await readFile(before), await readFile(after));
process.stdout.write(`Geometry unchanged: ${hash}\n`);
