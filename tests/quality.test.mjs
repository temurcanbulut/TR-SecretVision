import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSpecs, safetyErrors, mod97, validNationalId, CLASSES, valueFor } from '../src/specs.mjs';
import { groupErrors, validateBox } from '../src/validate.mjs';
import { match, score } from '../src/evaluate.mjs';
const specs=makeSpecs();
test('Production plan has complete contrastive pairs and application-disjoint splits',()=>{
  assert.equal(specs.length,1200);assert.equal(new Set(specs.map(s=>s.pair_id)).size,600);assert.deepEqual(groupErrors(specs),[]);
  for(const pair of new Set(specs.map(s=>s.pair_id)))assert.deepEqual(specs.filter(s=>s.pair_id===pair).map(s=>s.arm),['sensitive','control']);
});
test('Leakage detector catches source payload copied across application groups',()=>{
  const a=structuredClone(specs[0]),b=structuredClone(specs.find(s=>s.split==='test'));b.slots[0].value=a.slots[0].value;
  assert.ok(groupErrors([a,b]).some(s=>s.includes('payload')));
});
test('Leakage detector catches a split mutation within a pair',()=>{const a=specs[0],b={...specs[1],split:'test'};assert.ok(groupErrors([a,b]).some(s=>s.includes('pair_id')));});
test('Closed grammar rejects a real email domain substituted in an otherwise valid record',()=>{
  const r=structuredClone(specs.find(s=>s.slots.some(x=>x.category==='email'&&x.sensitive)));
  r.slots.find(x=>x.category==='email').value='someone@external.invalid';assert.ok(safetyErrors(r).includes('Non-reserved email'));
});
test('All generated TCKNs and IBANs are invalid; a MOD97-valid fixture is rejected',()=>{
  for(let i=0;i<100;i++){assert.equal(validNationalId(valueFor('national_id','adversarial-'+i)),false);assert.notEqual(mod97(valueFor('iban','adversarial-'+i)),1);}
  const base='TR00'+'000000'+'0000000000000000',check=98-mod97(base),valid='TR'+String(check).padStart(2,'0')+base.slice(4);
  assert.equal(mod97(valid),1);
  const r=structuredClone(specs.find(s=>s.slots.some(x=>x.category==='iban'&&x.sensitive)));r.slots.find(x=>x.category==='iban').value=valid;
  assert.ok(safetyErrors(r).includes('IBAN must fail MOD97'));
});
test('All generator payloads pass safety checks and none is marked human verified',()=>{for(const r of specs){assert.deepEqual(safetyErrors(r),[],r.id);assert.equal(r.human_verified,false);}});
test('Phone safety rejects a plausible dialable national destination code',()=>{
  const r=structuredClone(specs.find(s=>s.slots.some(x=>x.category==='phone'&&x.sensitive))),s=r.slots.find(x=>x.category==='phone');s.value=s.value.replace('000','555');assert.ok(safetyErrors(r).includes('Phone must use invalid 000 area code'));
});
test('PEM payload cannot be mistaken for generated DER key material',()=>{
  const r=structuredClone(specs.find(s=>s.slots.some(x=>x.category==='private_key'&&x.sensitive))),s=r.slots.find(x=>x.category==='private_key');
  s.value='-----BEGIN PRIVATE KEY-----\n'+Buffer.from([0x30,0x02,0x01,0x00]).toString('base64')+'\n-----END PRIVATE KEY-----';assert.ok(safetyErrors(r).includes('Potential actual cryptographic key'));
});
test('Same-value context pairs really change the redaction target while keeping the value',()=>{
  let checked=0;for(let i=0;i<specs.length;i+=2)for(const s of specs[i].slots.filter(x=>x.focal&&x.pair_kind==='identical_payload_context')){
    const c=specs[i+1].slots.find(x=>x.id===s.id);assert.equal(s.value,c.value);assert.notEqual(s.role,c.role);assert.equal(c.sensitive,false);checked++;
  }assert.ok(checked>700);
});
test('Coordinates use positive integer half-open pixel rectangles',()=>{assert.equal(validateBox([0,0,100,20],100,20),true);for(const b of [[0,0,0,1],[-1,0,2,2],[0,0,101,20],[NaN,0,1,1],[0.5,0,1,1]])assert.equal(validateBox(b,100,20),false);});
test('Greedy matching is class aware and cannot credit duplicate predictions',()=>{
  const gt=[{class_id:0,bbox:[10,10,100,20]}],p={class_id:0,bbox:[10,10,100,20],score:.9};
  const m=match([p,p,{...p,class_id:1}],gt);assert.equal(m.tp,1);assert.equal(m.fp,2);assert.equal(m.fn,0);
});
test('A giant redaction rectangle cannot earn IoU recall',()=>{const m=match([{class_id:0,bbox:[0,0,1000,1000]}],[{class_id:0,bbox:[20,30,100,20]}]);assert.equal(m.tp,0);});
test('Evaluation rejects omitted negatives rather than silently skipping them',async()=>{
  await assert.rejects(score([{id:'a'}],[],{pixels:false}),/every selected image/);
});
test('A value-only always-redact prediction fails contrastive pair correctness',async()=>{
  const a={class_id:0,bbox:[10,10,30,10],candidate_id:'v0',sensitive:true},base={width:100,height:100,pair_id:'p',variant:'clean',app:'terminal',language:'tr',theme:'light',font_size:14,slots:[{id:'v0',focal:true}]};
  const rs=[{...base,id:'s',arm:'sensitive',annotations:[a],candidates:[a],negative:false},{...base,id:'c',arm:'control',annotations:[],candidates:[{...a,sensitive:false}],negative:true}];
  const result=await score(rs,rs.map(r=>({id:r.id,predictions:[{class_id:0,bbox:a.bbox}]})),{pixels:false});
  assert.equal(result.overall.recall,1);assert.equal(result.contrastive_pairs.pass_rate,0);assert.equal(result.negative_image_false_alarm_rate,1);
});
