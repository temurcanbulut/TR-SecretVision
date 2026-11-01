/** Prepare a complete ImageFolder staging directory; never logs in or uploads. */
import {access,mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {ROOT} from '../src/plan.mjs';
import {sha256,CLASSES} from '../src/specs.mjs';
import {PNG} from 'pngjs';

const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const destination=option('--output');
if(!destination)throw Error('Usage: node tools/export-huggingface.mjs --output NEW_DIRECTORY');
const output=resolve(destination);
if(output===ROOT || ROOT.startsWith(output+'/') || ROOT.startsWith(output+'\\'))throw Error('Unsafe output path');
try{await access(output);throw Error('Output exists; nothing will be overwritten');}catch(e){if(e.code!=='ENOENT')throw e;}
const bytes=await readFile(resolve(ROOT,'metadata/manifest.jsonl'));
if(sha256(bytes)!=='5e7022f3e913c4bbbd602a06c0ad8923e828403d55c23423b2ef2d2a334e8bec')throw Error('Frozen v0.2 manifest mismatch');
const records=bytes.toString().trim().split('\n').map(JSON.parse);
if(records.length!==1440)throw Error('Incomplete release');
// Preflight all images before writing a staging directory. No implicit downloads.
for(const r of records){
 if(!/^images\/(train|val|test)\/trsv2_[a-f0-9]{16}(?:_(?:downscale_065|blur_070))?\.png$/.test(r.image_path) || r.human_verified!==false)throw Error('Unexpected record');
 const b=await readFile(resolve(ROOT,r.image_path));
 if(sha256(b)!==r.image_sha256)throw Error('Image mismatch: '+r.id);
 const image=PNG.sync.read(b,{checkCRC:true});
 if(image.width!==r.width || image.height!==r.height)throw Error('Image dimensions: '+r.id);
}
for(const split of ['train','val','test']){
 const name=split==='val'?'validation':split,folder=resolve(output,name);await mkdir(folder,{recursive:true});
 const metadata=[];
 for(const r of records.filter(r=>r.split===split)){
  const file_name=basename(r.image_path);
  await copyFile(resolve(ROOT,r.image_path),resolve(folder,file_name));
  metadata.push({file_name,id:r.id,pair_id:r.pair_id,arm:r.arm,application:r.app,variant:r.variant,
   source_identity_group:r.source_identity_group,leakage_group_id:r.leakage_group_id,width:r.width,height:r.height,
   source:r.source,human_verified:false,image_sha256:r.image_sha256,
   objects:{bbox:r.annotations.map(a=>a.bbox),category:r.annotations.map(a=>a.class_id)},
   negative:r.negative});
 }
 await writeFile(resolve(folder,'metadata.jsonl'),metadata.map(r=>JSON.stringify(r)).join('\n')+'\n',{flag:'wx'});
}
const card=`---
license: cc-by-4.0
language:
  - tr
  - en
task_categories:
  - object-detection
tags:
  - synthetic
  - privacy
  - security
size_categories:
  - 1K<n<10K
---
# TR-SecretVision Context v0.2

Fully synthetic sensitive-vs-benign screenshot pairs; no human-verified examples.
1,200 canonical images + 240 dependent stress views, 600 pairs, 4,255 line boxes.
Train/validation/test: 720/360/360; whole application families and paired variants
stay together. Do not resplit near-duplicate views. Boxes are pixel [x,y,w,h],
zero-based categories in this order: ${CLASSES.join(', ')}.

This staging directory is not itself proof of a Hub publication. The original
dataset card, limitations and citation are included unchanged. Invalid identity,
phone and bank formats are learnable shortcuts; no real-world performance,
trained detector or human review is claimed. Dated full-image OCR/rule baselines are available in the source repository docs/FULL_IMAGE_OCR.md. Code is in the GitHub repository;
only the CC BY 4.0 synthetic data is included here.
`;
await writeFile(resolve(output,'README.md'),card,{flag:'wx'});
for(const name of ['DATASET_CARD.md','LICENSE','CITATION.cff','ANNOTATION_GUIDELINES.md'])await copyFile(resolve(ROOT,name),resolve(output,name));
await writeFile(resolve(output,'EXPORT_QA.json'),JSON.stringify({status:'PASS',images:1440,manifest_sha256:sha256(bytes),human_verified:0,network_requests:0,uploaded:false},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:'PASS',images:1440,output,uploaded:false}));
