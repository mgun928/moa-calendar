const running=new WeakMap();
export function animateDisclosure(panel,open,setVisible){
 const previous=running.get(panel);
 const properties=['height','opacity','paddingTop','paddingBottom','marginTop','marginBottom','borderTopWidth','borderBottomWidth'];
 const snapshot=()=>{const style=getComputedStyle(panel);return Object.fromEntries(properties.map(key=>[key,style[key]]));};
 const current=snapshot();
 previous?.cancel();
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){running.delete(panel);setVisible(open);return;}
 setVisible(true);
 const full=snapshot();
 const collapsed={...full,height:'0px',opacity:'0',paddingTop:'0px',paddingBottom:'0px',marginTop:'0px',marginBottom:'0px',borderTopWidth:'0px',borderBottomWidth:'0px'};
 const animation=panel.animate([
  {...(previous?current:open?collapsed:full),overflow:'hidden',minHeight:'0px'},
  {...(open?full:collapsed),overflow:'hidden',minHeight:'0px'}
 ],{duration:220,easing:'cubic-bezier(.2,.7,.25,1)',fill:'both'});
 running.set(panel,animation);
 animation.onfinish=()=>{if(running.get(panel)!==animation)return;setVisible(open);running.delete(panel);animation.cancel();};
}
export function setupInboxMotion(){
 document.querySelectorAll('.group-inbox').forEach(details=>{
  const summary=details.querySelector('summary'),panel=details.querySelector('.inbox-popover');
  if(!summary||!panel)return;
  let expanded=details.open;
  summary.addEventListener('click',event=>{event.preventDefault();expanded=!expanded;animateDisclosure(panel,expanded,value=>{details.open=value;});});
 });
}
