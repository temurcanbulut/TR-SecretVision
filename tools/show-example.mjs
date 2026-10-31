import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {PNG} from 'pngjs';
import {ROOT} from '../src/plan.mjs';
import {sha256} from '../src/specs.mjs';

const records=(await readFile(resolve(ROOT,'examples/manifest.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
const selection=JSON.parse(await readFile(resolve(ROOT,'examples/selection.json'),'utf8'));
const args=process.argv.slice(2),index=args.indexOf('--pair');
const pair=index>=0?args[index+1]:selection.default_pair_id;
const rows=records.filter(r=>r.pair_id===pair);
if(rows.length!==2)throw Error('Choose a canonical pair from examples/selection.json');
const out=resolve(ROOT,'examples/output');await mkdir(out,{recursive:true});
for(const r of rows){
 const bytes=await readFile(resolve(ROOT,r.example_image_path));
 if(sha256(bytes)!==r.image_sha256)throw Error('Example image checksum mismatch');
 const image=PNG.sync.read(bytes,{checkCRC:true});
 for(const a of r.annotations){
  const [x,y,w,h]=a.bbox;
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
   if(xx>=x+2&&xx<x+w-2&&yy>=y+2&&yy<y+h-2)continue;
   const p=(yy*image.width+xx)*4;image.data[p]=220;image.data[p+1]=45;image.data[p+2]=45;image.data[p+3]=255;
  }
 }
 const output=resolve(out,r.arm+'-ground-truth.png');
 await writeFile(output,PNG.sync.write(image));
 console.log(JSON.stringify({id:r.id,pair_id:r.pair_id,arm:r.arm,split:r.split,output,preview:'GROUND_TRUTH_NOT_MODEL_PREDICTION',human_verified:r.human_verified,targets:r.annotations.length,focal_fields:r.slots.filter(s=>s.focal).map(s=>({role:s.role,value:s.value,sensitive:s.sensitive,pair_kind:s.pair_kind}))}));
}
