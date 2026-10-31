import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, checkPlan } from './plan.mjs';
import { CLASSES, makeSpecs, sha256, safetyErrors, SPLIT_BY_APP } from './specs.mjs';
import { decode, resizeGray, perceptualHash, hamming, grayDifference } from './image-utils.mjs';
const json=async p=>JSON.parse(await readFile(resolve(ROOT,p),'utf8'));
const lines=async p=>(await readFile(resolve(ROOT,p),'utf8')).trim().split('\n').map(JSON.parse);
const increment=(obj,key,n=1)=>obj[key]=(obj[key]||0)+n;
export function validateBox(box,width,height){return Array.isArray(box)&&box.length===4&&box.every(Number.isFinite)&&box.every(Number.isInteger)&&box[0]>=0&&box[1]>=0&&box[2]>0&&box[3]>0&&box[0]+box[2]<=width&&box[1]+box[3]<=height;}
export function groupErrors(records){
  const errors=[],maps=Array.from({length:5},()=>new Map()),keys=['application_group_id','leakage_group_id','pair_id','source_identity_group','payload'];
  for(const r of records){
    const values=[r.application_group_id,r.leakage_group_id,r.pair_id,r.source_identity_group];
    for(const x of r.slots){
      values.push('source-payload:'+x.payload_key_hash);
      // Generic environment-variable names are deliberately shared vocabulary, not identities.
      if(!/^\$\{(?:USER_EMAIL|CONTACT_PHONE|PAYOUT_IBAN)\}$/.test(x.value))values.push('payload:'+x.value);
    }
    for(let i=0;i<values.length;i++){
      const map=maps[Math.min(i,4)],key=values[i];
      if(map.has(key)&&map.get(key)!==r.split)errors.push(`Cross-split ${keys[Math.min(i,4)]}: ${key}`);map.set(key,r.split);
    }
  }
  return [...new Set(errors)];
}
export async function validateDataset(){
  const plan=await checkPlan(),records=await lines('metadata/manifest.jsonl'),specs=new Map(makeSpecs().map(s=>[s.id,s]));
  const errors=groupErrors(records),imageHashes=new Map(),pixelHashes=new Map(),ids=new Set(),pairs=await lines('metadata/pairs.jsonl');
  const stats={images:records.length,canonical_images:0,derived_images:0,boxes:0,logical_sensitive_values:0,negatives:0,human_verified:0,
    splits:{},apps:{},layouts:{},classes:{},languages:{},themes:{},fonts:{},font_sizes:{},variants:{},pair_kinds:{},
    corrupt_files:0,exact_file_duplicates:0,exact_pixel_duplicates:0,target_ink_pixels:0,outside_target_box_pixels:0,candidate_ink_pixels:0,synthetic_safety_violations:0};
  const hashes=[],nearCandidates=[];
  for(let ri=0;ri<records.length;ri++){
    const r=records[ri],local=[],base=specs.get(r.derived_from||r.id);
    if(!base){errors.push(r.id+': Unknown source specification');continue;}
    if(ids.has(r.id))local.push('Duplicate ID');ids.add(r.id);
    for(const key of ['app','layout','layout_name','leakage_group_id','application_group_id','source_identity_group','pair_id','split','theme','language','arm','font_size','font_pair','render_revision'])if(r[key]!==base[key])local.push('Source field mismatch: '+key);
    if(JSON.stringify(r.slots)!==JSON.stringify(base.slots))local.push('Source payload/role mutation');
    if(r.split!==SPLIT_BY_APP[r.app])local.push('Application split mutation');
    const safety=safetyErrors(r);stats.synthetic_safety_violations+=safety.length;local.push(...safety);
    stats.human_verified+=+(r.human_verified===true);
    if(r.negative!==!r.slots.some(s=>s.sensitive))local.push('Negative flag mismatch');
    if(r.variant==='clean'){stats.canonical_images++;if(r.width!==base.width||r.height!==base.height)local.push('Canonical dimensions mismatch');}
    else{
      stats.derived_images++;
      if(!plan.stress_pair_ids.includes(r.pair_id)||!['downscale_065','blur_070'].includes(r.variant))local.push('Unplanned derivative');
      const scale=r.variant==='downscale_065'?.65:1;
      if(r.width!==Math.round(base.width*scale)||r.height!==Math.round(base.height*scale))local.push('Derivative dimension mismatch');
    }
    if(!r.fonts_loaded.includes(r.font_pair?'JetBrains Mono':'IBM Plex Mono')||!r.fonts_loaded.includes(r.font_pair?'Noto Sans':'IBM Plex Sans'))local.push('Bundled fonts not loaded');
    const ss=stats.splits[r.split]||={images:0,boxes:0,negatives:0,logical_values:0,classes:{}};
    ss.images++;ss.boxes+=r.annotations.length;ss.negatives+=+r.negative;
    stats.boxes+=r.annotations.length;stats.negatives+=+r.negative;
    for(const [obj,k] of [[stats.apps,r.app],[stats.layouts,r.leakage_group_id],[stats.languages,r.language],[stats.themes,r.theme],[stats.fonts,r.font_pair],[stats.font_sizes,r.font_size],[stats.variants,r.variant]])increment(obj,k);
    for(const s of r.slots.filter(x=>x.sensitive)){stats.logical_sensitive_values++;ss.logical_values++;increment(stats.classes,s.category);increment(ss.classes,s.category);}
    for(const c of r.candidates){
      if(!validateBox(c.bbox,r.width,r.height))local.push('Invalid candidate coordinates');
      if(c.fully_visible!==true||CLASSES[c.class_id]!==c.category)local.push('Invalid class or visibility');
      const slot=r.slots.find(s=>s.id===c.candidate_id),expected=slot&&(c.display_encoding==='json_escaped'?JSON.stringify(slot.value).slice(1,-1):slot.value);
      if(!slot||slot.category!==c.category||slot.sensitive!==c.sensitive||c.display_value!==expected||expected.slice(c.char_start,c.char_end)!==c.text)local.push('Candidate text/role mismatch');
    }
    if(JSON.stringify(r.annotations)!==JSON.stringify(r.candidates.filter(c=>c.sensitive)))local.push('Target/candidate disagreement');
    for(const slot of r.slots){
      const cs=r.candidates.filter(c=>c.candidate_id===slot.id).sort((a,b)=>a.char_start-b.char_start);
      const expected=cs[0]?.display_value||'';
      if(!cs.length||cs.map(c=>c.text).join('').replace(/[\r\n]/g,'')!==expected.replace(/[\r\n]/g,''))local.push('Missing or overlapping text fragments');
    }
    try{
      const bytes=await readFile(resolve(ROOT,r.image_path)),png=decode(bytes),maskBytes=await readFile(resolve(ROOT,r.ink_mask_path)),mask=decode(maskBytes);
      if(png.width!==r.width||png.height!==r.height||mask.width!==r.width||mask.height!==r.height)local.push('PNG/mask dimensions mismatch');
      const filehash=sha256(bytes),pixelhash=sha256(png.data);
      if(filehash!==r.image_sha256||pixelhash!==r.pixel_sha256||sha256(maskBytes)!==r.ink_mask_sha256)local.push('Checksum mismatch');
      if(imageHashes.has(filehash)){stats.exact_file_duplicates++;local.push('Exact file duplicate: '+imageHashes.get(filehash));}imageHashes.set(filehash,r.id);
      if(pixelHashes.has(pixelhash)){stats.exact_pixel_duplicates++;local.push('Exact pixel duplicate: '+pixelHashes.get(pixelhash));}pixelHashes.set(pixelhash,r.id);
      const coverage=new Uint8Array(r.width*r.height),ink=r.annotations.map(()=>0);
      for(const a of r.annotations){const[x,y,w,h]=a.bbox;if(!validateBox(a.bbox,r.width,r.height))continue;for(let yy=y;yy<y+h;yy++)coverage.fill(1,yy*r.width+x,yy*r.width+x+w);}
      let count=0,outside=0;
      for(let p=0;p<coverage.length;p++)if(mask.data[p*4]>127){count++;if(!coverage[p])outside++;}
      for(let i=0;i<r.annotations.length;i++){const[x,y,w,h]=r.annotations[i].bbox;for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)ink[i]+=+(mask.data[(yy*r.width+xx)*4]>127);}
      if(outside||ink.some(x=>x<4)||count!==r.raster_audit.target_ink_pixels||(r.negative&&count))local.push('Stored glyph mask fails target coverage');
      stats.target_ink_pixels+=count;stats.outside_target_box_pixels+=outside;stats.candidate_ink_pixels+=r.raster_audit.all_candidate_ink_pixels;
      const gray=resizeGray(png),phash=perceptualHash(gray);hashes.push({id:r.id,split:r.split,app:r.app,group:r.leakage_group_id,variant:r.variant,pair_id:r.pair_id,phash,gray});
      const yolo=(await readFile(resolve(ROOT,`labels/${r.split}/${r.id}.txt`),'utf8')).trim().split('\n').filter(Boolean);
      if(yolo.length!==r.annotations.length)local.push('YOLO count mismatch');
      yolo.forEach((line,i)=>{const[c,cx,cy,w,h]=line.split(/\s+/).map(Number),a=r.annotations[i];if(!a)return;
        const reconstructed=[(cx-w/2)*r.width,(cy-h/2)*r.height,w*r.width,h*r.height];
        if(c!==a.class_id||reconstructed.some((v,j)=>Math.abs(v-a.bbox[j])>.0001))local.push('YOLO coordinate round trip mismatch');});
    }catch(err){stats.corrupt_files++;local.push('File read/decode failure: '+err.message);}
    errors.push(...[...new Set(local)].map(e=>r.id+': '+e));
    if((ri+1)%120===0)console.log(JSON.stringify({stage:'validate',completed:ri+1,total:records.length,errors:errors.length}));
  }
  for(const split of ['train','val','test']){
    const coco=await json(`annotations/coco_${split}.json`),rs=records.filter(r=>r.split===split);
    if(coco.images.length!==rs.length||coco.annotations.length!==rs.reduce((a,r)=>a+r.annotations.length,0))errors.push(split+': COCO inventory mismatch');
    if(JSON.stringify(coco.categories)!==JSON.stringify(CLASSES.map((name,i)=>({id:i+1,name,supercategory:'sensitive_text'}))))errors.push('COCO categories mismatch');
    let index=0;for(let i=0;i<rs.length;i++)for(const a of rs[i].annotations){const c=coco.annotations[index++];if(c.image_id!==i+1||c.category_id!==a.class_id+1||JSON.stringify(c.bbox)!==JSON.stringify(a.bbox))errors.push('COCO box mismatch');}
    for(const folder of ['images','labels']){const actual=await readdir(resolve(ROOT,folder,split));if(actual.length!==rs.length||actual.some(x=>!rs.some(r=>x===r.id+(folder==='images'?'.png':'.txt'))))errors.push(split+': Unexpected/missing '+folder+' files');}
    if(stats.splits[split].images!==plan.planned_splits[split])errors.push('Unexpected split size: '+split);
    for(const category of CLASSES)if((stats.splits[split].classes[category]||0)<25)errors.push(split+': Insufficient class support '+category);
  }
  for(const pair of pairs){
    const rs=records.filter(r=>r.pair_id===pair.pair_id),base=rs.filter(r=>r.variant==='clean');
    if(base.length!==2||new Set(base.map(r=>r.arm)).size!==2)errors.push('Incomplete canonical pair');
    for(const variant of new Set(rs.map(r=>r.variant)))if(rs.filter(r=>r.variant===variant).length!==2)errors.push('Incomplete derivative pair');
    for(const c of pair.focal_candidates){increment(stats.pair_kinds,c.pair_kind);if(c.pair_kind==='identical_payload_context'&&!c.identical_display_payload)errors.push('Broken same-payload counterfactual');}
  }
  const nearStats={method:'64-bit full-frame DCT pHash <= 6; secondary 32x32 grayscale MAE. A candidate is not automatically a duplicate.',comparisons:0,candidates:0,cross_split_candidates:0,cross_split_high_similarity:0,threshold_hamming:6,high_similarity_mae:2};
  for(let i=0;i<hashes.length;i++)for(let j=i+1;j<hashes.length;j++){
    nearStats.comparisons++;const a=hashes[i],b=hashes[j],distance=hamming(a.phash,b.phash);if(distance>6)continue;
    const mae=grayDifference(a.gray,b.gray),cross=a.split!==b.split;nearStats.candidates++;if(cross)nearStats.cross_split_candidates++;
    if(cross&&mae<=2)nearStats.cross_split_high_similarity++;
    if(cross)nearCandidates.push({a:a.id,b:b.id,a_app:a.app,b_app:b.app,distance,gray_mae:mae,high_similarity:mae<=2});
  }
  if(nearStats.cross_split_high_similarity)errors.push('Cross-split high-similarity images require quarantine or explicit review');
  const environment=await json('metadata/environment.json');if(environment.network_requests||environment.console_errors.length)errors.push('Renderer network or console errors');
  if(records.length!==1440||pairs.length!==600)errors.push('Unexpected dataset/pair count');
  const report={status:errors.length?'FAIL':'PASS',generated_on:'2026-10-31',manifest_sha256:sha256(await readFile(resolve(ROOT,'metadata/manifest.jsonl'))),stats,near_duplicates:nearStats,errors:[...new Set(errors)],human_verification:'All records false. AI visual inspection is reported separately. No real-world validation or model-training claim.',security_scope:'Closed-source provenance and invalid-format guards; not an external credential or identity verification service.'};
  await writeFile(resolve(ROOT,'qa/validation_report.json'),JSON.stringify(report,null,2)+'\n');
  await writeFile(resolve(ROOT,'qa/cross_split_near_candidates.json'),JSON.stringify(nearCandidates.sort((a,b)=>a.gray_mae-b.gray_mae),null,2)+'\n');
  await writeFile(resolve(ROOT,'qa/perceptual_hashes.json'),JSON.stringify(hashes.map(({gray,...h})=>h),null,2)+'\n');
  console.log(JSON.stringify({status:report.status,images:stats.images,boxes:stats.boxes,logical_values:stats.logical_sensitive_values,negatives:stats.negatives,cross_split_near:nearStats.cross_split_candidates,errors:errors.slice(0,8)}));
  return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const r=await validateDataset();if(r.status!=='PASS')process.exitCode=1;}
