// Collect the official Alpine PostgreSQL tools for the private Linux backup function.
// Vercel keeps the resulting native tools inside this deployment.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
if (process.env.VERCEL !== '1' && process.env.NEEJEE_TEST_DB_BACKUPS !== '1') process.exit(0);
const manifest = JSON.parse(await readFile(new URL('./postgres17-alpine.json', import.meta.url), 'utf8'));
const base = 'https://dl-cdn.alpinelinux.org/alpine/v3.22/main/x86_64/';
const out = join(process.cwd(),'.neejee-postgres');
const temp = await mkdtemp(join(tmpdir(),'neejee-tools-'));
try {
  await mkdir(out, {recursive:true});
  const cache=join(process.cwd(),'.next','cache','neejee-pg-tools');
  await mkdir(cache,{recursive:true});
  await Promise.all(manifest.map(async item => {
    const apk = join(temp,item.file);
    const cached=join(cache,item.sha256+'.apk');
    const matches = bytes => createHash('sha256').update(bytes).digest('hex') === item.sha256;
    const prior=await readFile(cached).catch(() => null);
    if (prior && matches(prior)) {
      await writeFile(apk,prior);
    } else {
      execFileSync('curl',['--proto','=https','--retry','2','--max-time','45','-fsSL',base+item.file,'-o',apk]);
      const bytes=await readFile(apk);
      if (!matches(bytes)) throw new Error('PostgreSQL dependency checksum mismatch');
      await writeFile(cached,bytes);
    }
    for (const [member,name] of Object.entries(item.members)) {
      const bytes = execFileSync('tar',['--ignore-zeros','-xOzf',apk,member],{maxBuffer:12*1024*1024,stdio:['ignore','pipe','ignore']});
      if (!bytes.length) throw new Error('A PostgreSQL dependency is empty');
      const source = join(temp,name);
      await writeFile(source,bytes); await chmod(source,0o755); await copyFile(source,join(out,name));
    }
  }));
  for (const command of ['pg_dump','pg_restore']) {
    console.log(execFileSync(join(out,'ld-musl-x86_64.so.1'),['--library-path',out,join(out,command),'--version'],{encoding:'utf8'}).trim());
  }
} finally { await rm(temp,{recursive:true,force:true}); }
