import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildHtml } from './screens.mjs';
import { makeSpecs, sha256 } from './specs.mjs';
import { ROOT } from './plan.mjs';
const argv=process.argv.slice(2),i=argv.indexOf('--browser'),browserPath=i>=0?argv[i+1]:'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const browser=await chromium.launch({executablePath:browserPath,headless:true,args:['--disable-background-networking']});
const context=await browser.newContext();await context.route('**/*',r=>r.abort());
const page=await context.newPage(),signatures=new Map(),errors=[];let structured=0,codeObjects=0;
try{
  for(const s of makeSpecs()){
    // Fonts are deliberately omitted: this pass checks source/DOM structure, not geometry.
    await page.setContent(buildHtml(s),{waitUntil:'load'});
    const result=await page.evaluate(()=>{
      const errors=[];let structured=0,codeObjects=0;
      for(const node of document.querySelectorAll('.json')){try{JSON.parse(node.innerText);structured++;}catch(e){errors.push('Invalid JSON: '+e.message);}}
      for(const node of document.querySelectorAll('.code')){
        const rows=[...node.querySelectorAll('.code-row')];if(!rows.length)continue;
        const parts=rows.map(row=>{const c=row.cloneNode(true);c.querySelectorAll('.lineno').forEach(n=>n.remove());return c.textContent.trim();});
        try{JSON.parse('{'+parts.join('\n').replace(/,\s*$/,'')+'}');codeObjects++;}catch(e){errors.push('Invalid inspected object: '+e.message);}
      }
      const skeleton=node=>node.nodeType===Node.ELEMENT_NODE?'('+node.tagName+'.'+[...node.classList].sort().join('.')+[...node.children].map(skeleton).join('')+')':'';
      return {errors,structured,codeObjects,skeleton:skeleton(document.querySelector('.content'))};
    });
    structured+=result.structured;codeObjects+=result.codeObjects;errors.push(...result.errors.map(x=>s.id+': '+x));
    const signature=sha256(result.skeleton);if(!signatures.has(signature))signatures.set(signature,[]);
    if(!signatures.get(signature).some(x=>x.group===s.leakage_group_id))signatures.get(signature).push({group:s.leakage_group_id,app:s.app,split:s.split});
  }
}finally{await browser.close();}
const shared=[...signatures].filter(([_,groups])=>new Set(groups.map(g=>g.split)).size>1).map(([hash,groups])=>({hash,groups}));
if(shared.length)errors.push('Cross-split identical complete content DOM structures');
const report={status:errors.length?'FAIL':'PASS',scope:'All 1200 canonical HTML fixtures; text and data attributes omitted from content structural hash. This is not a proof of visual or semantic independence.',structured_json_blocks:structured,inspected_code_objects:codeObjects,content_structure_signatures:signatures.size,cross_split_identical_structures:shared,errors};
await writeFile(resolve(ROOT,'qa/render_structure_report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,cross_split_identical_structures:shared.length}));if(errors.length)process.exitCode=1;
