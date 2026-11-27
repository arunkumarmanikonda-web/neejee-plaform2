// Usage: RECOVERY_ARCHIVE_KEY supplied by secure environment, never on the command line.
// npx tsx scripts/restore-storage-archive.ts ARCHIVE NEW_PRIVATE_DIRECTORY
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { restoreFiles } from '../lib/recovery/storage-archive';

async function main() {
  const [archive, destination] = process.argv.slice(2);
  if (!archive || !destination) throw new Error('Specify an archive and a new local directory.');
  const restored = restoreFiles(await readFile(archive), process.env.RECOVERY_ARCHIVE_KEY || '');
  const root = resolve(destination);
  await mkdir(root, { mode: 0o700 }); // refuses any existing destination
  for (const file of restored.files) {
    const target = resolve(root, file.bucket, file.name);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, file.bytes, { flag: 'wx', mode: 0o600 });
  }
  console.log('Restored %d verified files (%d bytes).', restored.files.length, restored.bytes);
}

main().catch(() => { console.error('Restore incomplete. Check the archive, key and destination.'); process.exitCode = 1; });
