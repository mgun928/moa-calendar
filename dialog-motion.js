import {animateDisclosure} from './disclosure-motion.js';
export function setupDialogMotion(){
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 document.querySelectorAll('#event-dialog,#tt-dialog,#group-dialog,#members-dialog,#memory-dialog,.moa-select-picker,.moa-date-picker').forEach(dialog=>{
  const show=dialog.showModal.bind(dialog),close=dialog.close.bind(dialog);
  let animation=null,closing=null;
  dialog.showModal=()=>{
   if(dialog.open)return;
   show();
   if(!reduced())animation=dialog.animate([{opacity:0,transform:'translateY(14px) scale(.98)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:200,easing:'cubic-bezier(.2,.7,.25,1)'});
  };
  dialog.close=(value)=>{
   if(closing)return closing;
   if(!dialog.open)return Promise.resolve();
   if(reduced()){close(value);return Promise.resolve();}
   const style=getComputedStyle(dialog),from={opacity:style.opacity,transform:style.transform};
   animation?.cancel();
   animation=dialog.animate([from,{opacity:0,transform:'translateY(12px) scale(.98)'}],{duration:160,easing:'ease-in',fill:'forwards'});
   closing=animation.finished.catch(()=>{}).then(()=>{close(value);animation.cancel();animation=null;closing=null;});
   return closing;
  };
  dialog.addEventListener('cancel',e=>{e.preventDefault();void dialog.close();});
 });
 const type=document.querySelector('#event-form [name="type"]'),field=document.querySelector('#group-field');
 type.addEventListener('change',()=>{if(!field.hidden)animateDisclosure(field,true,value=>{field.hidden=!value;});});
}
