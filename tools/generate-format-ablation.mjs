/** Local supplemental rendering only. Never overwrites the frozen v0.2 release. */
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright';
import {ablationPlan} from '../src/format-ablation.mjs';
import {buildHtml,fontCss} from '../src/screens.mjs';
import {geometry} from '../src/generate.mjs';
import {CLASSES,sha256} from '../src/specs.mjs';
import {ROOT} from '../src/plan.mjs';
import {validateBox} from '../src/validate.mjs';
import {PNG} from 'pngjs';

const output=resolve(ROOT,'examples/output/format-ablation-pilot-v2');
try { await access(output); throw Error('Output exists; preserve prior evidence'); }
catch(error) { if(error.code!=='ENOENT')throw error; }
const plan=ablationPlan();
// IBAN-only reference controls do not change pixels across format arms. Select
// focal same-literal ID pairs for a 200-unique-image pilot instead of counting
// duplicate reference controls as additional observations.
const allPairs=[...new Set(plan.records.filter(r=>r.slots.some(s=>s.category==='national_id' && s.focal)).map(r=>r.pair_id))];
const byApp=new Map();
for(const pair of allPairs.sort((a,b)=>sha256(a).localeCompare(sha256(b)))) {
 const app=plan.records.find(r=>r.pair_id===pair).app;
 if(!byApp.has(app))byApp.set(app,[]); byApp.get(app).push(pair);
}
const selected=[];
while(selected.length<50) {
 let advanced=false;
 for(const queue of byApp.values())if(queue.length && selected.length<50){selected.push(queue.shift());advanced=true;}
 if(!advanced)throw Error('Insufficient pairs');
}
const records=plan.records.filter(r=>selected.includes(r.pair_id));
if(records.length!==200)throw Error('Incomplete 2-arm x 2-format design');
const fonts=fontCss(ROOT), browserArg=process.argv.indexOf('--browser');
const executablePath=browserArg>=0?process.argv[browserArg+1]:process.platform==='win32'?'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe':undefined;
const browser=await chromium.launch({headless:true,executablePath});
const context=await browser.newContext({deviceScaleFactor:1});
let blocked=0;await context.route('**/*',route=>{blocked++;return route.abort();});
await mkdir(resolve(output,'images'),{recursive:true});
const rows=[], digests=new Set();
try {
 const page=await context.newPage();
 for(const spec of records) {
  await page.setViewportSize({width:spec.width,height:spec.height});
  await page.setContent(buildHtml(spec,fonts),{waitUntil:'load'});
  await page.evaluate(async()=>{await document.fonts.ready;});
  const result=await geometry(page);
  for(const candidate of result.candidates) {
   candidate.class_id=CLASSES.indexOf(candidate.category);
   if(!candidate.fully_visible||!validateBox(candidate.bbox,spec.width,spec.height))throw Error('Invalid geometry: '+spec.id);
  }
  const bytes=await page.screenshot({type:'png'}),digest=sha256(bytes),png=PNG.sync.read(bytes,{checkCRC:true});
  if(digests.has(digest)||png.width!==spec.width||png.height!==spec.height)throw Error('Duplicate/corrupt ablation image');
  digests.add(digest);
  const row={...spec,rendered:true,annotations_valid:true,annotation_origin:'dom_character_ranges',image_path:'images/'+spec.id+'.png',image_sha256:digest,
   annotations:result.candidates.filter(c=>c.sensitive),candidates:result.candidates,rendered_text:result.text,
   review_status:'automated_geometry_and_decode_only',human_verified:false};
  await writeFile(resolve(output,row.image_path),bytes,{flag:'wx'});
  rows.push(row);
  if(rows.length%40===0)console.log(JSON.stringify({rendered:rows.length,total:200}));
 }
 await writeFile(resolve(output,'manifest.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n',{flag:'wx'});
 const report={status:'PASS_AUTOMATED_CHECKS_ONLY',images:rows.length,scenario_pairs:selected.length,formats:2,arms:2,unique_sha256:digests.size,
  source_release:'v0.2.0',source_release_modified:false,browser:browser.version(),playwright:'1.64.1',network_attempts_blocked:blocked,human_verified:0,
  splits:Object.fromEntries(['train','val','test'].map(s=>[s,rows.filter(r=>r.split===s).length])),
  note:plan.limitations.replace('New DOM boxes/render review required.', 'DOM boxes produced; independent human/render review still pending.'),model_evaluation:false,publication:false};
 await writeFile(resolve(output,'QA.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 await writeFile(resolve(output,'README.md'),'# Local format-ablation pilot\n\n200 rendered synthetic screenshots: 50 source pairs × 2 arms × 2 formats.\n\n'+plan.limitations+'\n\nAutomated geometry/PNG/SHA256 checks only; human_verified=false. Not uploaded to EVREN or any dataset hub. The original v0.2 release and its recorded browser environment are unchanged.\n',{flag:'wx'});
 console.log(JSON.stringify(report));
} finally { await context.close();await browser.close(); }
