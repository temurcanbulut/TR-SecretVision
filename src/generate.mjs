import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { makeSpecs, safetyErrors, CLASSES, sha256, VERSION } from './specs.mjs';
import { buildHtml, fontCss } from './screens.mjs';
import { decode, rasterCoverage, encodeMask } from './image-utils.mjs';
import { ROOT, checkPlan, stressPairIds } from './plan.mjs';
const argv=process.argv.slice(2),preview=argv.includes('--preview');
const arg=(name,fallback)=>argv.includes(name)?argv[argv.indexOf(name)+1]:fallback;
const browserPath=arg('--browser',process.platform==='win32'?'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe':undefined);
const write=async(p,bytes)=>{await mkdir(dirname(resolve(ROOT,p)),{recursive:true});await writeFile(resolve(ROOT,p),bytes);};
export async function geometry(page){
  return page.evaluate(()=>{
    const candidates=[];
    for(const span of document.querySelectorAll('[data-candidate]')){
      const node=span.firstChild,display=node.textContent,lines=new Map();
      for(let i=0;i<display.length;i++){
        if(/[\r\n]/.test(display[i]))continue;
        const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);
        const r=range.getBoundingClientRect();if(!r.width||!r.height)continue;
        const k=Math.round(r.y*10);
        if(!lines.has(k))lines.set(k,{left:r.left,top:r.top,right:r.right,bottom:r.bottom,start:i,end:i+1});
        else{const g=lines.get(k);g.left=Math.min(g.left,r.left);g.right=Math.max(g.right,r.right);g.bottom=Math.max(g.bottom,r.bottom);g.end=i+1;}
      }
      let fragment=0;
      for(const g of lines.values()){
        let visible=true;
        const center=document.elementFromPoint((g.left+g.right)/2,(g.top+g.bottom)/2);
        if(center!==span&&!span.contains(center))visible=false;
        for(let a=span.parentElement;a;a=a.parentElement){
          const c=getComputedStyle(a),r=a.getBoundingClientRect();
          if(/hidden|clip|scroll|auto/.test(c.overflowX)&&(g.left<r.left-0.1||g.right>r.right+0.1))visible=false;
          if(/hidden|clip|scroll|auto/.test(c.overflowY)&&(g.top<r.top-0.1||g.bottom>r.bottom+0.1))visible=false;
        }
        const x=Math.floor(g.left)-2,y=Math.floor(g.top)-2,x2=Math.ceil(g.right)+2,y2=Math.ceil(g.bottom)+2;
        candidates.push({candidate_id:span.dataset.candidate,category:span.dataset.category,class_id:-1,sensitive:span.dataset.sensitive==='true',fragment:fragment++,
          text:display.slice(g.start,g.end),char_start:g.start,char_end:g.end,display_value:display,display_encoding:span.dataset.display,
          bbox:[x,y,x2-x,y2-y],source_rect:[g.left,g.top,g.right-g.left,g.bottom-g.top],padding:2,fully_visible:visible});
      }
    }
    return {candidates,text:document.body.innerText,fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)};
  // Classes are mapped outside the browser to keep the browser function self-contained.
  });
}

async function capture(page,s,fonts,selectedStress){
  await page.setViewportSize({width:s.width,height:s.height});
  await page.setContent(buildHtml(s,fonts),{waitUntil:'load'});
  await page.evaluate(async()=>{await document.fonts.ready;});
  const geo=await geometry(page);
  for(const c of geo.candidates){
    c.class_id=CLASSES.indexOf(c.category);
    const[x,y,w,h]=c.bbox;
    if(x<0||y<0||x+w>s.width||y+h>s.height||!c.fully_visible)throw new Error(`${s.app}/${s.layout}/${s.case_index}: clipped ${c.candidate_id} ${JSON.stringify(c.bbox)}`);
  }
  if(new Set(geo.candidates.map(c=>c.candidate_id)).size!==s.slots.length)throw new Error('Missing or duplicate candidate span');
  const errors=safetyErrors({...s,rendered_text:geo.text});if(errors.length)throw new Error(s.id+': '+errors.join('; '));
  const original=await page.screenshot({type:'png',animations:'disabled',caret:'hide'});
  const hideAll=await page.addStyleTag({content:'[data-candidate]{color:transparent!important;text-shadow:none!important}'});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const allHidden=await page.screenshot({type:'png',animations:'disabled',caret:'hide'});await hideAll.evaluate(x=>x.remove());
  await page.addStyleTag({content:'[data-sensitive="true"]{color:transparent!important;text-shadow:none!important}'});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const targetHidden=await page.screenshot({type:'png',animations:'disabled',caret:'hide'});
  return saveRecord(s,original,allHidden,targetHidden,geo.candidates,geo.text,geo.fonts,selectedStress);
}
async function saveRecord(s,original,allHidden,targetHidden,candidates,text,fonts,cache){
  const annotations=candidates.filter(c=>c.sensitive),png=decode(original);
  const all=rasterCoverage(png,decode(allHidden),candidates),target=rasterCoverage(png,decode(targetHidden),annotations);
  if(all.outside_pixels||target.outside_pixels||all.fragment_ink_pixels.some(x=>x<4)||target.fragment_ink_pixels.some(x=>x<4))throw new Error(s.id+': glyph coverage failed '+JSON.stringify({all:all.outside_pixels,target:target.outside_pixels,ink:all.fragment_ink_pixels}));
  if((annotations.length===0)!==(target.changed_pixels===0))throw new Error('Negative mask mismatch');
  const image_path=preview?`.work/preview/${s.id}.png`:`images/${s.split}/${s.id}.png`,ink_mask_path=preview?`.work/preview-masks/${s.id}.png`:`qa/ink_masks/${s.id}.png`;
  const mask=encodeMask(target.mask,s.width,s.height);
  await write(image_path,original);await write(ink_mask_path,mask);
  if(cache&&!preview){await write(`.work/counterfactual/${s.id}-all.png`,allHidden);await write(`.work/counterfactual/${s.id}-target.png`,targetHidden);}
  return {...s,negative:annotations.length===0,image_path,image_sha256:sha256(original),pixel_sha256:sha256(png.data),ink_mask_path,ink_mask_sha256:sha256(mask),
    annotation_origin:s.variant==='clean'?'dom_character_ranges':'mapped_dom_ranges_with_raster_validation',annotations,candidates,rendered_text:text,fonts_loaded:fonts,
    raster_audit:{all_candidate_ink_pixels:all.changed_pixels,target_ink_pixels:target.changed_pixels,all_outside_pixels:all.outside_pixels,target_outside_pixels:target.outside_pixels,target_fragment_ink:target.fragment_ink_pixels},
    human_verified:false,ai_visual_reviewed:false};
}
async function transform(page,bytes,variant,width,height){
  return Buffer.from(await page.evaluate(async({data,variant,width,height})=>{
    const image=new Image();image.src=data;await image.decode();
    const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');
    if(variant==='blur_070')ctx.filter='blur(0.7px)';
    ctx.drawImage(image,0,0,width,height);return c.toDataURL('image/png').split(',')[1];
  },{data:'data:image/png;base64,'+bytes.toString('base64'),variant,width,height}),'base64');
}
async function derivatives(page,r){
  const inputs=await Promise.all([r.image_path,`.work/counterfactual/${r.id}-all.png`,`.work/counterfactual/${r.id}-target.png`].map(p=>readFile(resolve(ROOT,p))));
  const out=[];
  for(const variant of ['downscale_065','blur_070']){
    const width=variant==='downscale_065'?Math.round(r.width*.65):r.width,height=variant==='downscale_065'?Math.round(r.height*.65):r.height,sx=width/r.width,sy=height/r.height,pad=variant==='downscale_065'?2:3;
    const candidates=r.candidates.map(c=>{
      const[x,y,w,h]=c.bbox,x0=Math.max(0,Math.floor(x*sx)-pad),y0=Math.max(0,Math.floor(y*sy)-pad),x1=Math.min(width,Math.ceil((x+w)*sx)+pad),y1=Math.min(height,Math.ceil((y+h)*sy)+pad);
      return {...c,source_bbox:c.bbox,bbox:[x0,y0,x1-x0,y1-y0],padding:'mapped source padding + '+pad,source_rect:c.source_rect.map((v,i)=>v*(i%2?sy:sx))};
    });
    const converted=[];for(const input of inputs)converted.push(await transform(page,input,variant,width,height));
    out.push(await saveRecord({...r,id:r.id+'_'+variant,variant,width,height,derived_from:r.id,transform:{variant,scale_x:sx,scale_y:sy,extra_padding:pad}},...converted,candidates,r.rendered_text,r.fonts_loaded,false));
  }
  return out;
}
export async function exportAnnotations(records){
  const pairs=[];
  for(const split of ['train','val','test']){
    const rs=records.filter(r=>r.split===split),annotations=[];let aid=1;
    for(let i=0;i<rs.length;i++){
      const r=rs[i];
      for(const a of r.annotations)annotations.push({id:aid++,image_id:i+1,category_id:a.class_id+1,bbox:a.bbox,area:a.bbox[2]*a.bbox[3],iscrowd:0,segmentation:[],attributes:{candidate_id:a.candidate_id,fragment:a.fragment}});
      const yolo=r.annotations.map(a=>{const[x,y,w,h]=a.bbox;return `${a.class_id} ${((x+w/2)/r.width).toFixed(8)} ${((y+h/2)/r.height).toFixed(8)} ${(w/r.width).toFixed(8)} ${(h/r.height).toFixed(8)}`;}).join('\n');
      await write(`labels/${split}/${r.id}.txt`,yolo+(yolo?'\n':''));
    }
    await write(`annotations/coco_${split}.json`,JSON.stringify({info:{version:VERSION,description:'Fully synthetic TR-SecretVision context benchmark'},images:rs.map((r,i)=>({id:i+1,file_name:r.image_path,width:r.width,height:r.height})),annotations,categories:CLASSES.map((name,i)=>({id:i+1,name,supercategory:'sensitive_text'}))})+'\n');
  }
  for(const pairId of new Set(records.map(r=>r.pair_id))){
    const rs=records.filter(r=>r.pair_id===pairId),base=rs.filter(r=>r.variant==='clean'),positive=base.find(r=>r.arm==='sensitive'),control=base.find(r=>r.arm==='control');
    pairs.push({pair_id:pairId,split:positive.split,application_group_id:positive.app,leakage_group_id:positive.leakage_group_id,sensitive_image_id:positive.id,control_image_id:control.id,
      focal_candidates:positive.slots.filter(s=>s.focal).map(s=>({id:s.id,category:s.category,pair_kind:s.pair_kind,identical_display_payload:s.value===control.slots.find(c=>c.id===s.id).value})),
      derivative_ids:rs.filter(r=>r.variant!=='clean').map(r=>r.id)});
  }
  await write('metadata/pairs.jsonl',pairs.map(r=>JSON.stringify(r)).join('\n')+'\n');
  await write('metadata/manifest.jsonl',records.map(r=>JSON.stringify(r)).join('\n')+'\n');
  await write('data.yaml',`path: .\ntrain: images/train\nval: images/val\ntest: images/test\nnc: ${CLASSES.length}\nnames:\n${CLASSES.map((x,i)=>`  ${i}: ${x}`).join('\n')}\n`);
}
async function contactSheet(page,records,path){
  const tiles=await Promise.all(records.map(async r=>({r,image:(await readFile(resolve(ROOT,r.image_path))).toString('base64')})));
  await page.setViewportSize({width:1600,height:Math.ceil(tiles.length/4)*310});
  await page.setContent(`<html><body style="margin:0;background:#d9dce0;font:12px Arial;display:grid;grid-template-columns:repeat(4,400px)">${tiles.map(({r,image})=>`<div style="padding:7px"><div>${r.app}/${r.layout} • ${r.arm} • ${r.font_size}px</div><div style="position:relative;width:386px;height:${r.height*386/r.width}px"><img src="data:image/png;base64,${image}" style="width:386px">${r.annotations.map(a=>{const[x,y,w,h]=a.bbox;return `<div style="position:absolute;left:${x*386/r.width}px;top:${y*386/r.width}px;width:${w*386/r.width}px;height:${h*386/r.width}px;border:1px solid #e43b34;box-sizing:border-box"></div>`;}).join('')}</div><div>${r.id}</div></div>`).join('')}</body></html>`);
  await write(path,await page.screenshot({type:'png',fullPage:true}));
}
export async function main(){
  const all=makeSpecs(),plan=preview?null:await checkPlan(),stress=new Set(plan?.stress_pair_ids||stressPairIds(all));
  const selected=preview?all.filter(s=>s.case_index===((3-s.layout-s.app.length+40)%4)):all;
  // Preview one pair per layout; choose the largest font independently below if selection count differs.
  const specs=preview?[...new Set(all.map(s=>s.leakage_group_id))].flatMap(g=>{const rs=all.filter(s=>s.leakage_group_id===g);const p=rs.find(s=>s.font_size===18)?.pair_id||rs[0].pair_id;return rs.filter(s=>s.pair_id===p);}):selected;
  const browser=await chromium.launch({executablePath:browserPath,headless:true,args:['--no-first-run','--disable-background-networking','--disable-background-timer-throttling','--disable-renderer-backgrounding','--force-color-profile=srgb']});
  let blocked=0;const context=await browser.newContext({deviceScaleFactor:1,locale:'tr-TR',timezoneId:'Europe/Istanbul'});
  await context.route('**/*',route=>{blocked++;return route.abort();});
  const fonts=fontCss(ROOT),records=[],errors=[];let cursor=0,completed=0;
  const existing=!preview&&argv.includes('--refresh-existing')?new Map((await readFile(resolve(ROOT,'metadata/manifest.jsonl'),'utf8')).trim().split('\n').map(JSON.parse).filter(r=>r.variant==='clean').map(r=>[r.id,r])):new Map();
  let reused=0,rendered=0;
  try{
    await Promise.all(Array.from({length:1},async()=>{
      const page=await context.newPage();page.on('pageerror',err=>errors.push(String(err)));
      while(cursor<specs.length){const s=specs[cursor++];try{
        const previous=existing.get(s.id),unchanged=previous&&Object.entries(s).every(([k,v])=>JSON.stringify(previous[k])===JSON.stringify(v));
        if(unchanged){
          if(sha256(await readFile(resolve(ROOT,previous.image_path)))!==previous.image_sha256||sha256(await readFile(resolve(ROOT,previous.ink_mask_path)))!==previous.ink_mask_sha256)throw new Error('Cached image checksum mismatch');
          records.push(previous);reused++;
        }else{records.push(await capture(page,s,fonts,stress.has(s.pair_id)));rendered++;}
      }catch(err){throw new Error(s.id+': '+err.message);}
        if(++completed%40===0)console.log(JSON.stringify({stage:preview?'preview':'canonical',completed,total:specs.length}));}
      await page.close();
    }));
    records.sort((a,b)=>a.id.localeCompare(b.id));
    const page=await context.newPage();
    if(!preview){
      let done=0;for(const r of [...records].filter(r=>stress.has(r.pair_id))){records.push(...await derivatives(page,r));if(++done%20===0)console.log(JSON.stringify({stage:'robustness',sources:done,total:120}));}
      records.sort((a,b)=>a.split.localeCompare(b.split)||a.id.localeCompare(b.id));
      await exportAnnotations(records);
      await write('metadata/environment.json',JSON.stringify({version:VERSION,node:process.version,browser:browser.version(),browser_family:'Brave/Chromium',device_scale_factor:1,network_requests:blocked,console_errors:errors,canonical_rerendered:rendered,canonical_unchanged_cache:reused,cache_policy:'Only exact specification matches with matching image/mask SHA256; all derivatives recomputed; all files independently validated after generation',source_inputs:'Closed deterministic grammar only; no account files, clipboard, browsing profile, external corpus or key generation',created_on:'2026-10-31'},null,2));
    }else await write('.work/preview-records.json',JSON.stringify(records));
    const review=preview?records:records.filter(r=>r.variant==='clean').filter(r=>r.case_index===Math.floor(parseInt(sha256(r.leakage_group_id).slice(0,4),16)%15));
    for(let i=0;i<review.length;i+=8)await contactSheet(page,review.slice(i,i+8),preview?`.work/preview-sheet-${i/8+1}.png`:`qa/review-sheet-${i/8+1}.png`);
    if(!preview)await write('qa/visual_selection.json',JSON.stringify({method:'One hash-seeded canonical pair per structural layout; 80 images. Separate native and stress inspection is recorded after viewing.',human_verified:false,ids:review.map(r=>r.id)},null,2));
    console.log(JSON.stringify({mode:preview?'preview':'full',images:records.length,boxes:records.reduce((n,r)=>n+r.annotations.length,0),network_requests:blocked,page_errors:errors.length}));
  }finally{await browser.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
