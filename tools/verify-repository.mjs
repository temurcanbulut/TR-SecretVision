import {readFile,writeFile,readdir,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PNG} from 'pngjs';
import {ROOT,checkPlan} from '../src/plan.mjs';
import {sha256,CLASSES,safetyErrors} from '../src/specs.mjs';
import {groupErrors,validateBox} from '../src/validate.mjs';

export async function walk(dir,prefix=''){
 const out=[];
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(['node_modules','.git','.tools','.work','.taste-skill','dist'].includes(e.name)||(prefix==='examples/'&&e.name==='output'))continue;
  const p=prefix+e.name;
  if(e.isSymbolicLink())throw Error('Symlinks are not packaged: '+p);
  if(e.isDirectory())out.push(...await walk(resolve(dir,e.name),p+'/'));else if(e.isFile())out.push(p);
 }
 return out.sort();
}
export async function verifyRepository({save=true}={}){
 await checkPlan();
 const json=async p=>JSON.parse(await readFile(resolve(ROOT,p),'utf8'));
 const lines=async p=>(await readFile(resolve(ROOT,p),'utf8')).trim().split('\n').map(JSON.parse);
 const release=await json('metadata/release.json'),manifest=await readFile(resolve(ROOT,'metadata/manifest.jsonl'));
 if(sha256(manifest)!==release.manifest_sha256)throw Error('Frozen manifest mismatch');
 const rs=await lines('metadata/manifest.jsonl'),pairs=await lines('metadata/pairs.jsonl'),examples=await lines('examples/manifest.jsonl');
 const byId=new Map(rs.map(r=>[r.id,r])),errors=groupErrors(rs);
 if(rs.length!==1440||byId.size!==1440||pairs.length!==600)errors.push('Unexpected inventory');
 let boxes=0,negatives=0,maskCount=0;
 for(const r of rs){
  if(r.human_verified!==false||r.source!=='fully_synthetic_closed_grammar')errors.push('Incorrect provenance: '+r.id);
  errors.push(...safetyErrors(r).map(e=>r.id+': '+e));
  const mask=await readFile(resolve(ROOT,r.ink_mask_path));if(sha256(mask)!==r.ink_mask_sha256)errors.push('Mask mismatch: '+r.id);maskCount++;
  const label=(await readFile(resolve(ROOT,`labels/${r.split}/${r.id}.txt`),'utf8')).trim();
  const ls=label?label.split('\n'):[];boxes+=ls.length;negatives+=+r.negative;
  if(ls.length!==r.annotations.length||r.negative!==(ls.length===0))errors.push('Label count/negative mismatch: '+r.id);
  ls.forEach((line,i)=>{const values=line.trim().split(/\s+/).map(Number),[c,x,y,w,h]=values,a=r.annotations[i];
   if(!a||values.length!==5||!Number.isInteger(c)||!CLASSES[c]||![x,y,w,h].every(Number.isFinite)||!validateBox(a.bbox,r.width,r.height)||c!==a.class_id||[(x-w/2)*r.width,(y-h/2)*r.height,w*r.width,h*r.height].some((v,j)=>Math.abs(v-a.bbox[j])>.0001))errors.push('YOLO/manifest mismatch: '+r.id);
  });
 }
 if(boxes!==4255||negatives!==342)errors.push('Wrong box/negative totals');
 for(const split of ['train','val','test']){
  const coco=await json('annotations/coco_'+split+'.json'),rows=rs.filter(r=>r.split===split);
  if(coco.images.length!==rows.length||coco.annotations.length!==rows.reduce((n,r)=>n+r.annotations.length,0))errors.push('COCO inventory: '+split);
  if(JSON.stringify(coco.categories)!==JSON.stringify(CLASSES.map((name,i)=>({id:i+1,name,supercategory:'sensitive_text'}))))errors.push('COCO class order: '+split);
  let n=0;for(let i=0;i<rows.length;i++)for(const a of rows[i].annotations){const b=coco.annotations[n++];if(!b||b.image_id!==i+1||b.category_id!==a.class_id+1||JSON.stringify(b.bbox)!==JSON.stringify(a.bbox))errors.push('COCO geometry: '+split);}
 }
 let identicalPayloadFields=0;
 for(const p of pairs){
  const rows=rs.filter(r=>r.pair_id===p.pair_id),base=rows.filter(r=>r.variant==='clean');
  if(base.length!==2||!base.some(r=>r.id===p.sensitive_image_id&&r.arm==='sensitive')||!base.some(r=>r.id===p.control_image_id&&r.arm==='control')||rows.some(r=>r.split!==p.split))errors.push('Pair relation: '+p.pair_id);
  if(JSON.stringify(rows.filter(r=>r.variant!=='clean').map(r=>r.id).sort())!==JSON.stringify([...p.derivative_ids].sort()))errors.push('Derivative relation: '+p.pair_id);
  for(const f of p.focal_candidates)if(f.pair_kind==='identical_payload_context'){
   identicalPayloadFields++;
   const values=base.map(r=>r.slots.find(s=>s.id===f.id)?.value);
   if(!f.identical_display_payload||values.length!==2||values[0]!==values[1])errors.push('Counterfactual payload mismatch: '+p.pair_id);
  }
 }
 const apps=new Set(),classes=new Set(),examplePairs=new Map();
 for(const r of examples){
  const {example_image_path,...original}=r;
  if(JSON.stringify(original)!==JSON.stringify(byId.get(r.id)))errors.push('Changed example metadata: '+r.id);
  if(!/^examples\/images\/trsv2_[0-9a-f]{16}\.png$/.test(example_image_path))throw Error('Unsafe example path');
  const bytes=await readFile(resolve(ROOT,example_image_path));
  if(sha256(bytes)!==r.image_sha256)errors.push('Example SHA256: '+r.id);
  const png=PNG.sync.read(bytes,{checkCRC:true});if(png.width!==r.width||png.height!==r.height)errors.push('Example dimensions: '+r.id);
  apps.add(r.app);r.annotations.forEach(a=>classes.add(a.category));
  if(!examplePairs.has(r.pair_id))examplePairs.set(r.pair_id,[]);examplePairs.get(r.pair_id).push(r.arm);
 }
 if(examples.length!==20||new Set(examples.map(r=>r.id)).size!==20||apps.size!==10||classes.size!==10||examplePairs.size!==10||[...examplePairs.values()].some(v=>v.length!==2||!v.includes('sensitive')||!v.includes('control')))errors.push('Incomplete/diversity example selection');
 if(identicalPayloadFields!==902)errors.push('Wrong same-payload field-pair count');
 let links=0;for(const path of (await walk(ROOT)).filter(p=>p.endsWith('.md'))){
  const text=await readFile(resolve(ROOT,path),'utf8');
  for(const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
   const raw=match[1];if(/^[a-z]+:/i.test(raw)||raw.startsWith('#'))continue;
   const target=resolve(dirname(resolve(ROOT,path)),decodeURIComponent(raw.split('#')[0]));
   if(!target.startsWith(ROOT))errors.push('Markdown link outside repository: '+path+' '+raw);
   else try{await access(target);links++;}catch{errors.push('Broken local link: '+path+' '+raw);}
  }
 }
 const report={status:errors.length?'FAIL':'PASS',scope:'Code, all metadata/labels/mask hashes and 20 bundled PNGs. Full-image QA requires npm run validate after local import.',images_in_release:rs.length,images_bundled:examples.length,canonical_pairs:pairs.length,identical_payload_focal_pairs:identicalPayloadFields,boxes,negative_images:negatives,example_negative_images:examples.filter(r=>r.negative).length,example_apps:apps.size,example_classes:classes.size,mask_hashes_checked:maskCount,relative_document_links_checked:links,frozen_sources:'MATCH',manifest_sha256:sha256(manifest),human_verified:0,model_evaluation_performed:false,errors:[...new Set(errors)]};
 if(save)await writeFile(resolve(ROOT,'qa/repository_validation.json'),JSON.stringify(report,null,2)+'\n');
 if(errors.length)throw Error(JSON.stringify(report.errors));
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await verifyRepository()));
