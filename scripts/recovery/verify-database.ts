import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dumpDatabase, rehearseDatabase } from '../../lib/recovery/postgres-archive';

async function main() {
  const target = new URL(process.env.DIRECT_URL || '');
  if (!['127.0.0.1','localhost'].includes(target.hostname)) throw new Error('A disposable local database is required');
  const dir=await mkdtemp(join(tmpdir(),'neejee-rehearsal-'));
  try {
    const dump = await dumpDatabase(dir);
    const result = await rehearseDatabase(dump,dir);
    console.log('Restored the isolated application database:',JSON.stringify(result));
  } finally { await rm(dir,{recursive:true,force:true}); }
}
main().catch((e) => {console.error(e.message,e.code);process.exitCode=1;});
