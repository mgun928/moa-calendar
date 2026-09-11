import {test} from 'node:test';
import assert from 'node:assert/strict';
import {friendEventColor} from '../friend-colors.js';
const groups=[{id:'trip',info:{color:'sage'},events:[{id:'jeju'}]}];
test('shared group color survives calendar responses without a group id',()=>{
 assert.equal(friendEventColor({id:'jeju',type:'group'},groups),'--friend-event-color:#81945f;');
 assert.equal(friendEventColor({id:'jeju',type:'group',group:'trip'},groups),'--friend-event-color:#81945f;');
 assert.equal(friendEventColor({id:'other',type:'group'},groups),'');
 assert.equal(friendEventColor({id:'jeju',type:'personal'},groups),'');
});
