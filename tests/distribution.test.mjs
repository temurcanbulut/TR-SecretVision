import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {safeEntry,decodeArchive,inspectExisting} from '../tools/import-local-data.mjs';

test('Importer rejects traversal, absolute, Windows and ambiguous archive paths',()=>{
 for(const p of ['../image.png','images/../x','/x','C:/x','images\\x','images//x','images/./x','images/x\0.png'])assert.equal(safeEntry(p),false,p);
 assert.equal(safeEntry('images/train/trsv2_200e9294f11a667f.png'),true);
});
test('Importer rejects unknown or truncated archives before decompression',()=>{
 for(const b of [Buffer.alloc(0),Buffer.from('PK\x03\x04not-the-release')])assert.throws(()=>decodeArchive(b),/Wrong archive SHA256/);
});
test('Importer detects a conflicting existing destination without modifying it',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'trsv-import-'));
 try{
  const p=join(dir,'file.txt');await writeFile(p,'preserve');
  assert.equal(await inspectExisting(p,Buffer.from('preserve')),true);
  await assert.rejects(()=>inspectExisting(p,Buffer.from('different')),/Refusing to overwrite/);
  assert.equal(await readFile(p,'utf8'),'preserve');
  assert.equal(await inspectExisting(join(dir,'absent.txt'),Buffer.from('new')),false);
 }finally{await unlink(join(dir,'file.txt'));await rmdir(dir);}
});
