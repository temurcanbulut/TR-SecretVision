import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {zipSync,unzipSync,strToU8} from 'fflate';
import {ROOT} from '../src/plan.mjs';
import {sha256} from '../src/specs.mjs';
import {walk,verifyRepository} from './verify-repository.mjs';

await verifyRepository();
const roots=new Set(['.gitignore','.gitattributes','README.md','README.tr.md','DATASET_CARD.md','ANNOTATION_GUIDELINES.md','QUALITY_REPORT.md','RESEARCH_PROTOCOL.md','RELATED_WORK.md','NOTICE.md','LICENSE','LICENSE-CODE','DESIGN.md','CHANGELOG.md','CITATION.cff','CONTRIBUTING.md','SECURITY.md','EVREN_IMPORT.md','package.json','package-lock.json','data.yaml','dataset-metadata.json','data/research-data.json','data/README.md']);
const folders=['src/','tests/','tools/','assets/','LICENSES/','metadata/','qa/','annotations/','labels/','docs/','examples/','.github/ISSUE_TEMPLATE/'];
const entries=(await walk(ROOT)).filter(p=>roots.has(p)||folders.some(root=>p.startsWith(root)));
const files={};
for(const p of entries){
 if(/(?:^|\/)(?:\.env[^/]*|\.tools|\.work|\.git|node_modules)(?:\/|$)/.test(p)||p.includes('..')||p.includes('\\')||p.startsWith('/'))throw Error('Unsafe package path: '+p);
 files[p]=new Uint8Array(await readFile(resolve(ROOT,p)));
}
if(entries.filter(p=>p.startsWith('examples/images/')&&p.endsWith('.png')).length!==20||entries.some(p=>p.startsWith('images/')))throw Error('Wrong image packaging scope');
files['CHECKSUMS.sha256']=strToU8(entries.map(p=>sha256(files[p])+'  '+p).join('\n')+'\n');
const bytes=Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([p,b])=>[p,[b,{mtime:new Date('2026-10-31T12:00:00Z')}]])),{level:6}));
const parsed=unzipSync(bytes);
if(Object.keys(parsed).length!==Object.keys(files).length)throw Error('ZIP inventory changed');
for(const [p,b] of Object.entries(files))if(!parsed[p]||sha256(parsed[p])!==sha256(b))throw Error('ZIP round-trip mismatch: '+p);
const dist=resolve(ROOT,'dist');await mkdir(dist,{recursive:true});
const name='TR-SecretVision-v0.2.0-GitHub-ready.zip';
await writeFile(resolve(dist,name),bytes);
await writeFile(resolve(dist,'SHA256SUMS.txt'),sha256(bytes)+'  '+name+'\n');
const report={status:'PASS',archive:name,bytes:bytes.length,sha256:sha256(bytes),entries:Object.keys(files).length,round_trip_entries_checked:Object.keys(files).length,example_images:20,full_images_excluded:true,private_work_files_included:false,remote_repository_created:false,training_started:false};
await writeFile(resolve(dist,'PACKAGING_REPORT.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
