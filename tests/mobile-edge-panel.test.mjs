import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dragProgress,shouldOpen} from '../mobile-edge-panel.js';

test('both edges follow the pointer, clamped to panel height',()=>{
 assert.equal(dragProgress(0,30,1,200),30);
 assert.equal(dragProgress(0,-30,-1,600),30);
 assert.equal(dragProgress(200,-30,1,200),170);
 assert.equal(dragProgress(600,30,-1,600),570);
 assert.equal(dragProgress(0,-30,1,200),0);
 assert.equal(dragProgress(0,500,1,200),200);
});
test('small pulls cancel, substantial pulls snap open or closed',()=>{
 for(const height of [174,400,600]){
  assert.equal(shouldOpen(false,20,height),false);
  assert.equal(shouldOpen(false,80,height),true);
  assert.equal(shouldOpen(true,height-20,height),true);
  assert.equal(shouldOpen(true,height-80,height),false);
 }
});
