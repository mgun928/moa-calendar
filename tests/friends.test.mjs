import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupFriends} from '../friends.js';
class Element{
 dataset={};style={setProperty(){}};open=false;
 append(){}
 showModal(){this.open=true;}
 close(){this.open=false;}
 nodes=new Map();listeners={};innerHTML='';textContent='';hidden=false;
 querySelector(s){if(s==='#friend-refresh')return null;if(!this.nodes.has(s))this.nodes.set(s,new Element());return this.nodes.get(s);}
 querySelectorAll(){return [];}
 addEventListener(name,fn){this.listeners[name]=fn;}
 replaceChildren(){this.innerHTML='';}
 before(){}
 scrollIntoView(){}
}
function setup(rpc){
 const root=new Element();let created=false;
 globalThis.document={hidden:true,createElement:()=>{if(!created){created=true;return root;}return new Element();},querySelector:()=>new Element(),addEventListener(){}};
 globalThis.window={addEventListener(){}};
 return {root,api:setupFriends({rpc},'f1100000-0000-4000-8000-000000000001')};
}
test('self search does not call the backend',async()=>{
 let calls=0;const {root,api}=setup(async()=>{calls++;return {data:[]};});
 try{await root.querySelector('#friend-search').listeners.submit({preventDefault(){},target:{elements:{id:{value:'f1100000-0000-4000-8000-000000000001'}}}});assert.equal(calls,0);assert.match(root.querySelector('#friend-status').textContent,/자기 자신/);}finally{api.stop();}
});
test('friend profile is read-only and clears cached calendar after access is revoked',async()=>{
 let denied=false;const id='f1100000-0000-4000-8000-000000000002';
 const {root,api}=setup(async(name,args)=>({data:args.action==='list'?[{id,nickname:'<script>',status:'accepted'}]:denied?null:[{id:'public',title:'<public>',date:'2026-09-01',endDate:'2026-09-01',time:'09:00'}],error:args.action==='calendar'&&denied?{message:'친구 관계 없음'}:null}));
 try{
  await root.listeners.click({target:{closest:s=>s==='[data-friend-action]'?{dataset:{friendAction:'profile',id}}:null}});
  assert.match(root.querySelector('#friend-list').innerHTML,/&lt;script&gt;/);
  assert.doesNotMatch(root.querySelector('#friend-calendar').innerHTML,/data-event|delete-event/);
  root.querySelector('#friend-calendar').innerHTML='cached event';denied=true;await api.refresh();
  assert.equal(root.querySelector('#friend-calendar').innerHTML,'');assert.match(root.querySelector('#friend-status').textContent,/관계 없음/);
 }finally{api.stop();}
});
test('missing RPC is reported rather than faking successful setup',async()=>{
 const {root,api}=setup(async()=>({error:{code:'PGRST202',message:'missing'}}));
 try{await api.refresh();assert.match(root.querySelector('#friend-status').textContent,/DB 설정/);}finally{api.stop();}
});

test('friend mutations automatically reload the list without a refresh button',async()=>{
 const calls=[];
 const {root,api}=setup(async(name,args)=>{calls.push(args.action);return {data:[]};});
 try{
  assert.doesNotMatch(root.innerHTML,/id="friend-refresh"/);
  for(const action of ['request','accept','decline','remove']){
   calls.length=0;
   await root.listeners.click({target:{closest:s=>s==='[data-friend-action]'?{dataset:{friendAction:action,id:'friend'}}:null}});
   assert.deepEqual(calls,[action,'list']);
  }
 }finally{api.stop();}
});

test('eight-character codes are normalized and resolved before requests',async()=>{
 const calls=[];const {root,api}=setup(async(name,args)=>{calls.push({name,args});return {data:{id:'other',nickname:'친구'}};});
 try{
  await root.querySelector('#friend-search').listeners.submit({preventDefault(){},target:{elements:{id:{value:' ab12cd34 '}}}});
  assert.deepEqual(calls,[{name:'moa_friend_code',args:{action:'search',friend_code:'AB12CD34'}}]);
  assert.match(root.querySelector('#friend-result').innerHTML,/친구 요청/);
 }finally{api.stop();}
});
test('own short code cannot create a self request',async()=>{
 const {root,api}=setup(async()=>({data:{id:'f1100000-0000-4000-8000-000000000001',nickname:'나'}}));
 try{
  await root.querySelector('#friend-search').listeners.submit({preventDefault(){},target:{elements:{id:{value:'AB12CD34'}}}});
  assert.match(root.querySelector('#friend-status').textContent,/자기 자신/);
  assert.equal(root.querySelector('#friend-result').innerHTML,'');
 }finally{api.stop();}
});
