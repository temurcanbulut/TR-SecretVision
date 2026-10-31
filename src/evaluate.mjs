import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './plan.mjs';
import { CLASSES, sha256 } from './specs.mjs';
import { decode } from './image-utils.mjs';
export function iou(a,b){const x=Math.max(a[0],b[0]),y=Math.max(a[1],b[1]),w=Math.max(0,Math.min(a[0]+a[2],b[0]+b[2])-x),h=Math.max(0,Math.min(a[1]+a[3],b[1]+b[3])-y),i=w*h;return i/(a[2]*a[3]+b[2]*b[3]-i)||0;}
export function match(predictions,truth,threshold=.5){
  const used=new Set(),matched=[],falsePositives=[];
  for(const [pi,p] of predictions.map((p,i)=>[i,p]).sort((a,b)=>(b[1].score??1)-(a[1].score??1)||a[0]-b[0])){
    let best=-1,overlap=threshold;
    for(let gi=0;gi<truth.length;gi++){if(used.has(gi)||p.class_id!==truth[gi].class_id)continue;const v=iou(p.bbox,truth[gi].bbox);if(v>=overlap){overlap=v;best=gi;}}
    if(best<0)falsePositives.push(pi);else{used.add(best);matched.push({prediction:pi,truth:best,iou:overlap});}
  }
  return {tp:matched.length,fp:falsePositives.length,fn:truth.length-matched.length,matched,false_positives:falsePositives};
}
function metric(x){const p=x.tp/(x.tp+x.fp)||0,r=x.tp/(x.tp+x.fn)||0;return {...x,precision:p,recall:r,f1:p+r?2*p*r/(p+r):0};}
function overlapFraction(a,b){const w=Math.max(0,Math.min(a[0]+a[2],b[0]+b[2])-Math.max(a[0],b[0])),h=Math.max(0,Math.min(a[1]+a[3],b[1]+b[3])-Math.max(a[1],b[1]));return w*h/(b[2]*b[3]);}
export async function score(records,predictionRecords,{pixels=true}={}){
  const byId=new Map(predictionRecords.map(r=>[r.id,r.predictions]));
  if(byId.size!==predictionRecords.length||byId.size!==records.length||records.some(r=>!byId.has(r.id)))throw new Error('Predictions must include every selected image exactly once, including empty lists');
  const total={tp:0,fp:0,fn:0},slices={},details=[];let negativeImages=0,negativeAlarms=0,targetInk=0,coveredInk=0,fullyCoveredImages=0;
  for(const r of records){
    const ps=byId.get(r.id);
    if(!Array.isArray(ps))throw new Error('Invalid predictions list');
    for(const p of ps)if(!Number.isInteger(p.class_id)||!CLASSES[p.class_id]||!Array.isArray(p.bbox)||p.bbox.length!==4||!p.bbox.every(Number.isFinite)||p.bbox[2]<=0||p.bbox[3]<=0||p.bbox[0]<0||p.bbox[1]<0||p.bbox[0]+p.bbox[2]>r.width||p.bbox[1]+p.bbox[3]>r.height||!Number.isFinite(p.score??1))throw new Error(r.id+': Invalid prediction');
    const m=match(ps,r.annotations);
    for(const key of ['tp','fp','fn'])total[key]+=m[key];
    for(const key of ['app','variant','language','theme','font_size']){
      const sk=key+':'+r[key],st=slices[sk]||={images:0,tp:0,fp:0,fn:0};st.images++;for(const k of ['tp','fp','fn'])st[k]+=m[k];
    }
    for(let ci=0;ci<CLASSES.length;ci++){
      const sk='class:'+CLASSES[ci],st=slices[sk]||={tp:0,fp:0,fn:0},cm=match(ps.filter(p=>p.class_id===ci),r.annotations.filter(a=>a.class_id===ci));for(const k of ['tp','fp','fn'])st[k]+=cm[k];
    }
    if(r.negative){negativeImages++;negativeAlarms+=+(ps.length>0);}
    const found=new Set(m.matched.map(x=>x.truth)),focalIds=new Set(r.slots.filter(s=>s.focal).map(s=>s.id));
    const focalTruth=r.annotations.map((a,i)=>({a,i})).filter(({a})=>focalIds.has(a.candidate_id));
    const safe=r.candidates.filter(c=>!c.sensitive&&focalIds.has(c.candidate_id));
    const focalDetected=focalTruth.every(({i})=>found.has(i));
    const benignAlarm=safe.some(c=>ps.some(p=>overlapFraction(p.bbox,c.bbox)>=.25));
    details.push({id:r.id,pair_id:r.pair_id,arm:r.arm,variant:r.variant,tp:m.tp,fp:m.fp,fn:m.fn,focal_detected:focalDetected,benign_candidate_alarm:benignAlarm});
    if(pixels){
      const mask=decode(await readFile(resolve(ROOT,r.ink_mask_path))),coverage=new Uint8Array(r.width*r.height);
      for(const p of ps){const[x,y,w,h]=p.bbox;for(let yy=Math.floor(y);yy<Math.min(r.height,Math.ceil(y+h));yy++)coverage.fill(1,yy*r.width+Math.floor(x),yy*r.width+Math.min(r.width,Math.ceil(x+w)));}
      let ink=0,covered=0;for(let p=0;p<coverage.length;p++)if(mask.data[p*4]>127){ink++;covered+=coverage[p];}
      targetInk+=ink;coveredInk+=covered;if(ink&&ink===covered)fullyCoveredImages++;
    }
  }
  const pairGroups=new Map();for(const d of details){const k=d.pair_id+'|'+d.variant;if(!pairGroups.has(k))pairGroups.set(k,[]);pairGroups.get(k).push(d);}
  let complete=0,passed=0;for(const group of pairGroups.values()){
    const s=group.find(x=>x.arm==='sensitive'),c=group.find(x=>x.arm==='control');if(!s||!c)continue;complete++;passed+=+(s.focal_detected&&!c.benign_candidate_alarm);
  }
  return {definition:'Class-aware score-ordered IoU >= 0.5 matching at the submitted confidence cutoff; not mAP. Pixel coverage is necessary for redaction and distinct from IoU recall.',images:records.length,overall:metric(total),slices:Object.fromEntries(Object.entries(slices).map(([k,v])=>[k,metric(v)])),
    negative_image_false_alarm_rate:negativeImages?negativeAlarms/negativeImages:null,negative_images:negativeImages,
    contrastive_pairs:{complete,passed,pass_rate:complete?passed/complete:null,rule:'All focal sensitive fragments matched in sensitive arm AND no prediction covers >=25% of any focal benign candidate fragment in control arm.'},
    pixel_coverage:pixels?{target_ink_pixels:targetInk,covered_ink_pixels:coveredInk,fraction:targetInk?coveredInk/targetInk:null,positive_images_with_all_target_ink_covered:fullyCoveredImages}:null,details};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const argv=process.argv.slice(2),get=(x,f)=>argv.includes(x)?argv[argv.indexOf(x)+1]:f,path=get('--predictions');
  if(!path)throw new Error('Usage: node src/evaluate.mjs --predictions FILE.jsonl [--split test] [--variant clean|all] [--output qa/MODEL.json]');
  const split=get('--split','test'),variant=get('--variant','clean');if(!['train','val','test'].includes(split)||!['clean','all','downscale_065','blur_070'].includes(variant))throw new Error('Invalid evaluation slice');
  const rs=(await readFile(resolve(ROOT,'metadata/manifest.jsonl'),'utf8')).trim().split('\n').map(JSON.parse).filter(r=>r.split===split&&(variant==='all'||r.variant===variant));
  const bytes=await readFile(resolve(path)),preds=bytes.toString().trim().split('\n').filter(Boolean).map(JSON.parse),result=await score(rs,preds);
  result.predictions_sha256=sha256(bytes);result.split=split;result.variant=variant;
  const output=resolve(ROOT,get('--output','qa/model_evaluation.json'));if(!output.startsWith(ROOT+((process.platform==='win32')?'\\':'/')))throw new Error('Output must stay in dataset root');
  await writeFile(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.overall));
}
