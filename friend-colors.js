export function friendEventColor(event,groups=[]){
 if(event.type!=='group')return '';
 // Older friend-calendar RPCs omit the group ID. Match the stable event ID
 // against groups already authorized for this account in that case.
 const group=event.group?groups.find(g=>g.id===event.group):groups.find(g=>g.events?.some(e=>e.id===event.id));
 if(!group)return '';
 const palette={sage:'#81945f',clay:'#bc8158',lavender:'#a080b0',blue:'#638fa9'};
 const raw=group.info?.color??group.color,hex=palette[raw]||raw;
 return /^#[0-9a-f]{6}$/i.test(hex||'')?`--friend-event-color:${hex};`:'';
}
