import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const require=createRequire(import.meta.url);
const root=path.dirname(require.resolve('@capacitor/cli/package.json'));
const {extractTemplate}=require(path.join(root,'dist/util/template.js'));
const capRequire=createRequire(path.join(root,'package.json'));
const tarVersion=capRequire('tar/package.json').version;
const archives=(await readdir(path.join(root,'assets'))).filter(n=>n.endsWith('.tar.gz'));
assert(archives.length>=4);
const fixture=await mkdtemp(path.join(tmpdir(),'oyi-cap-template-'));
try {
  for(const archive of archives){const dest=path.join(fixture,archive.slice(0,-7));await extractTemplate(path.join(root,'assets',archive),dest);assert((await readdir(dest)).length>0);}
  console.log(`PASS extraction compatibility ONLY: Capacitor 6 with tar ${tarVersion}, ${archives.length} bundled templates. This does not certify security.`);
} finally {await rm(fixture,{recursive:true,force:true});}
