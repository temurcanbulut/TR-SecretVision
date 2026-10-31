import {readFile,writeFile,mkdir,access,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
import {ROOT} from '../src/plan.mjs';
import {sha256} from '../src/specs.mjs';
import {safeEntry,inspectExisting} from './import-local-data.mjs';

const MANIFEST_SHA256='5e7022f3e913c4bbbd602a06c0ad8923e828403d55c23423b2ef2d2a334e8bec';
const folders=['metadata/','annotations/','labels/','qa/'];
export async function prepareData(){
 const config=JSON.parse(await readFile(resolve(ROOT,'data/research-data.json'),'utf8'));
 const archive=resolve(ROOT,'data',config.filename);
 let bytes;
 try{bytes=await readFile(archive);}catch(e){
  if(e.code!=='ENOENT')throw e;
  // Full research ZIPs already contain these files; no second archive is needed.
  try{
   if(sha256(await readFile(resolve(ROOT,'metadata/manifest.jsonl')))!==MANIFEST_SHA256)throw Error('Manifest mismatch');
   for(const p of ['metadata/generation_plan.json','metadata/pairs.jsonl','annotations/coco_train.json','annotations/coco_val.json','annotations/coco_test.json'])await access(resolve(ROOT,p));
   if((await readdir(resolve(ROOT,'qa/ink_masks'))).length!==1440)throw Error('Missing masks');
   for(const split of ['train','val','test'])if((await readdir(resolve(ROOT,'labels',split))).length!==({train:720,val:360,test:360}[split]))throw Error('Missing labels');
   return {status:'PASS',mode:'already_unpacked',network_requests:0,next:'npm run verify'};
  }catch{throw Error('Research payload is missing. Clone/download the complete repository, including data/'+config.filename+'. No automatic download or EVREN export was attempted.');}
 }
 if(sha256(bytes)!==config.sha256||bytes.length!==config.bytes)throw Error('Research archive checksum/size mismatch; refusing extraction');
 const files=unzipSync(bytes),names=Object.keys(files);
 if(names.length!==config.entries||names.some(p=>!safeEntry(p)||(!folders.some(f=>p.startsWith(f))&&!['README.md','LICENSE','CHECKSUMS.sha256'].includes(p))))throw Error('Unexpected/unsafe research archive inventory');
 const lines=Buffer.from(files['CHECKSUMS.sha256']).toString('utf8').trim().split('\n');
 if(lines.length!==names.length-1)throw Error('Incomplete archive checksums');
 for(const line of lines){const [expected,p]=line.split(/\s{2,}/);if(!files[p]||sha256(files[p])!==expected)throw Error('Research entry checksum mismatch: '+p);}
 if(sha256(files['metadata/manifest.jsonl'])!==MANIFEST_SHA256)throw Error('Frozen manifest mismatch');
 const pending=[];let identical=0;
 for(const p of names.filter(p=>folders.some(f=>p.startsWith(f)))){
  const target=resolve(ROOT,p);
  if(!target.startsWith(ROOT+'/')&&!target.startsWith(ROOT+'\\'))throw Error('Destination outside repository');
  if(await inspectExisting(target,files[p]))identical++;else pending.push({target,bytes:files[p]});
 }
 for(const {target,bytes} of pending){await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});}
 return {status:'PASS',mode:'archive',written:pending.length,identical_files_skipped:identical,network_requests:0,archive_sha256:config.sha256,next:'npm run verify'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await prepareData()));
