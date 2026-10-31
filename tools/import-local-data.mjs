import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
import {ROOT} from '../src/plan.mjs';
import {sha256} from '../src/specs.mjs';

export const ARCHIVE_SHA256='420e5cc665e93c165dcfb6b224fca4d79909542a2e8efd4aa23396888eedf6af';
export function safeEntry(path){
 return typeof path==='string'&&path.length>0&&!path.includes('\\')&&!path.includes(':')&&!path.includes('\0')&&!path.startsWith('/')&&path.split('/').every(p=>p&&p!=='.'&&p!=='..');
}
export function decodeArchive(bytes){
 if(sha256(bytes)!==ARCHIVE_SHA256)throw Error('Wrong archive SHA256; only the original local v0.2.0 YOLO archive is accepted. No network/export was attempted.');
 const files=unzipSync(bytes);
 if(Object.keys(files).some(p=>!safeEntry(p)))throw Error('Unsafe archive path');
 return files;
}
export async function inspectExisting(target,expected){
 try{const bytes=await readFile(target);if(sha256(bytes)!==sha256(expected))throw Error('Refusing to overwrite differing file: '+target);return true;}
 catch(e){if(e.code==='ENOENT')return false;throw e;}
}
export async function importArchive(path){
 if(!path)throw Error('Usage: npm run data:import -- --archive PATH_TO_ORIGINAL_LOCAL_YOLO_ZIP');
 const files=decodeArchive(await readFile(resolve(path)));
 const records=(await readFile(resolve(ROOT,'metadata/manifest.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
 const allowed=new Set(['data.yaml','LICENSE','README.md','CHECKSUMS.sha256']);
 const pending=[];let skipped=0;
 // Validate the complete source and all existing destinations before writing.
 for(const r of records){
  const image=r.image_path,label=`labels/${r.split}/${r.id}.txt`;
  allowed.add(image);allowed.add(label);
  if(!safeEntry(image)||!safeEntry(label)||!files[image]||!files[label])throw Error('Missing/unsafe archive item: '+r.id);
  if(sha256(files[image])!==r.image_sha256)throw Error('Image mismatch: '+r.id);
  if(sha256(files[label])!==sha256(await readFile(resolve(ROOT,label))))throw Error('Label mismatch: '+r.id);
  for(const entry of [image,label]){
   const target=resolve(ROOT,entry);
   if(!target.startsWith(ROOT+'/')&&!target.startsWith(ROOT+'\\'))throw Error('Destination outside repository');
   if(await inspectExisting(target,files[entry]))skipped++;
   else pending.push({target,bytes:files[entry]});
  }
 }
 if(Object.keys(files).length!==allowed.size||[...allowed].some(p=>!Object.hasOwn(files,p)))throw Error('Unexpected archive inventory');
 for(const {target,bytes} of pending){await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});}
 return {status:'PASS',images_verified:records.length,labels_verified:records.length,written:pending.length,identical_files_skipped:skipped,network_requests:0,archive_sha256:ARCHIVE_SHA256};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),index=args.indexOf('--archive');console.log(JSON.stringify(await importArchive(index>=0?args[index+1]:null)));
}
