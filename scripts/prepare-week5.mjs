import { existsSync, copyFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { resolve, basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const database = 'apps/api/data/home-decor.sqlite';
const retired = ['apps/api/src/app_.js', 'apps/api/src/server_.js', 'deploy-changes.patch'];
if (existsSync(join(root,database+'-wal'))) {
  console.error('Stop the app and close database tools before running this command. A SQLite WAL file is still present.'); process.exit(1);
}
const stamp = new Date().toISOString().replace(/[:.]/g,'-');
const backup = resolve(root,'..',basename(root)+'-backups',stamp);
const files = [database,...retired].filter(file=>existsSync(join(root,file)));
if (files.length) {
  mkdirSync(backup,{recursive:true});
  for (const file of files) { const to=join(backup,file);mkdirSync(dirname(to),{recursive:true});copyFileSync(join(root,file),to); }
  console.log('Backup saved outside the repository: '+backup);
}
const probe=spawnSync('git',['rev-parse','--show-toplevel'],{cwd:root,encoding:'utf8'});
if (probe.status !== 0 || resolve(probe.stdout.trim()) !== root) {
  console.error('Open this update inside the SDLC_G3 Git repository, then run this command again. No files were removed.');process.exit(1);
}
const result=spawnSync('git',['rm','--cached','-f','--ignore-unmatch','--',database,...retired],{cwd:root,encoding:'utf8'});
if (result.status !== 0) { console.error(result.stderr || 'Git could not untrack the files. No local files were removed.');process.exit(1); }
for (const file of retired) rmSync(join(root,file),{force:true});
console.log('Local database retained. Its removal from Git is staged. Retired files were backed up and removed.');
console.log('Commit the source changes and staged removals on your Week 5 branch.');
