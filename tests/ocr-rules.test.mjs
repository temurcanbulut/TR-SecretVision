import test from 'node:test';
import assert from 'node:assert/strict';
import {predictOcr} from '../src/ocr-rules.mjs';
import {CLASSES} from '../src/specs.mjs';

function input(label,value){
 return {width:800,height:200,lines:[{words:[{text:label,bbox:[10,20,180,16]},{text:value,bbox:[240,20,200,16]}]}]};
}
test('full-image rules use OCR words rather than annotation/candidate fields',()=>{
 const ocr=input('Personal email','fixture@example.com');
 const predictions=predictOcr(ocr,CLASSES,'context');
 assert.equal(predictions.length,1);assert.equal(predictions[0].class_id,2);
 const poisoned={...ocr,annotations:[],candidates:[],slots:[],arm:'control',split:'train'};
 assert.deepEqual(predictOcr(poisoned,CLASSES,'context'),predictions);
});
test('context can reject an identical technical number without ground-truth inputs',()=>{
 const sensitive=input('Citizen ID','01321844941'),benign=input('Document sequence','01321844941');
 assert.equal(predictOcr(sensitive,CLASSES,'literal').length,1);
 assert.equal(predictOcr(benign,CLASSES,'literal').length,1);
 assert.equal(predictOcr(sensitive,CLASSES,'context').length,1);
 assert.equal(predictOcr(benign,CLASSES,'context').length,0);
});
test('empty OCR yields empty predictions and word boxes stay inside image bounds',()=>{
 assert.deepEqual(predictOcr({width:800,height:200,lines:[]},CLASSES),[]);
 for(const p of predictOcr(input('Personal email','fixture@example.com'),CLASSES)){
  assert.ok(p.bbox[0]>=0&&p.bbox[1]>=0&&p.bbox[0]+p.bbox[2]<=800&&p.bbox[1]+p.bbox[3]<=200);
 }
});
