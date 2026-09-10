import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../group-sharing.js', import.meta.url),'utf8');
const { setupGroupSharing } = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
class Element {
  children=[]; nodes=new Map(); textContent=''; disabled=false;
  append(...nodes){this.children.push(...nodes);}
  prepend(node){this.children.unshift(node);}
  replaceChildren(){this.children=[];}
  querySelector(selector){if(!this.nodes.has(selector))this.nodes.set(selector,new Element());return this.nodes.get(selector);}
  querySelectorAll(){return this.children.filter(n=>n.tag==='button');}
}
function environment(){
  const workspace=new Element();
  globalThis.document={hidden:true,createElement(tag){const e=new Element();e.tag=tag;return e;},querySelector:()=>workspace};
  globalThis.window={addEventListener(){},removeEventListener(){}};
  return workspace;
}
test('inbox renders sender as text and accepting triggers recipient RPC then refresh',async()=>{
 const workspace=environment(),calls=[];let accepted=false;
 const client={async rpc(name,args){calls.push(args);return {data:args.action==='inbox'?(accepted?[]:[{id:'invitation',sender:'<img onerror=alert(1)>',name:'friends'}]):args.action==='list'?(accepted?[{id:'group'}]:[]):(accepted=true,{})};}};
 const api=await setupGroupSharing(client);
 try{
  const panel=workspace.children[0],items=panel.querySelector('.inbox-items');
  assert.equal(items.children.length,1);
  assert.match(items.children[0].children[0].textContent,/<img onerror/);
  await items.children[0].children[1].onclick();
  assert.deepEqual(calls.find(x=>x.action==='respond').payload,{id:'invitation',answer:'accepted'});
  assert.equal(items.children.length,0);
  assert.equal(api.groups[0].id,'group');
 }finally{api.stop();}
});
test('RPC failure shows feedback, keeps invite and reenables response buttons',async()=>{
 const workspace=environment();
 const client={async rpc(name,args){return args.action==='respond'?{error:{message:'invite_closed'}}:{data:args.action==='inbox'?[{id:'i',sender:'owner',name:'g'}]:[]};}};
 const api=await setupGroupSharing(client);
 try{
  const panel=workspace.children[0],row=panel.querySelector('.inbox-items').children[0];
  await row.children[2].onclick();
  assert.match(panel.querySelector('.inbox-status').textContent,/이미 처리/);
  assert.equal(row.children[1].disabled,false);
  assert.equal(row.children[2].disabled,false);
 }finally{api.stop();}
});
test('unconfigured server is visible, and cannot pretend an invite succeeded',async()=>{
 const workspace=environment();
 const api=await setupGroupSharing({async rpc(){return {error:{message:'function not found'}};}});
 try{
  assert.match(workspace.children[0].querySelector('.inbox-status').textContent,/SQL/);
  await assert.rejects(api.mutate('invite',{group_id:'g',emails:['test@example.com']}));
 }finally{api.stop();}
});
