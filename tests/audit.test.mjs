import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSpecs, validNationalId, mod97} from '../src/specs.mjs';
import {ablationPlan, checksumNationalId, checksumIban} from '../src/format-ablation.mjs';
import {baselinePredictions} from '../tools/rule-baselines.mjs';

test('format ablations preserve family, pair, split and real provenance limitations', () => {
  const originals = new Map(makeSpecs().map((r) => [r.id,r]));
  const plan=ablationPlan();
  assert.equal(plan.images_generated,0);
  for (const record of plan.records) {
    const source=originals.get(record.source_release_id);
    assert.equal(record.split,source.split);
    assert.equal(record.pair_id,source.pair_id);
    assert.equal(record.human_verified,false);
    assert.equal(record.annotations_valid,false);
    if(record.format_slice==='checksum_valid') for(const slot of record.slots) {
      if(slot.category==='national_id') assert.equal(validNationalId(slot.value),true);
      if(slot.category==='iban' && slot.sensitive) assert.equal(mod97(slot.value),1);
    }
  }
  for(let i=0;i<100;i++) {
    assert.equal(validNationalId(checksumNationalId(String(i))),true);
    const iban=checksumIban(String(i));
    assert.equal(mod97(iban),1);
    assert.equal(iban.slice(4,9),'00000');
  }
});

test('rule baselines do not consume sensitivity labels, arms or ground-truth boxes', () => {
  const fixture={id:'x',candidates:[{candidate_id:'a',class_id:2,bbox:[1,1,20,10]}],slots:[{id:'a',category:'email',value:'fixture@example.com',role:'Personal email'}]};
  for(const mode of ['literal_only','visible_role_rules']) {
    const clean=baselinePredictions([fixture],mode);
    const poisoned=structuredClone(fixture);
    poisoned.arm='control';poisoned.annotations=[];
    poisoned.candidates[0].sensitive=false;poisoned.slots[0].sensitive=false;
    assert.deepEqual(baselinePredictions([poisoned],mode),clean);
  }
});
