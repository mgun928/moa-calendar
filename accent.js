export const defaultAccent='#be542c';
export const validAccent=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
export function applyAccent(value){
 const color=validAccent(value)?value:defaultAccent;
 const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
 const root=document.documentElement;
 root.style.setProperty('--orange',color);root.style.setProperty('--brand',color);
 root.style.setProperty('--custom-accent',color);root.style.setProperty('--accent-ink','#ffffff');
 root.style.setProperty('--accent-soft',`rgba(${rgb.join(',')},.14)`);
 let style=document.querySelector('#custom-accent-style');
 if(!style){style=document.createElement('style');style.id='custom-accent-style';document.head.append(style);}
 style.textContent=`
 :root{--accent-text:var(--custom-accent);--accent-border:color-mix(in srgb,var(--custom-accent) 45%,transparent)}
 :root[data-theme="dark"]{--accent-text:color-mix(in srgb,var(--custom-accent) 58%,white)}
 :root input{accent-color:var(--custom-accent)}
 :root .primary,:root .primary:hover,:root .is-today .day-number,:root #calendar .event-chip.personal,:root #calendar .span-event.personal{background:var(--custom-accent);color:var(--accent-ink);border-color:var(--custom-accent)}
 :root[data-theme] body .nav-item.active,:root[data-theme] body .filter.active{background:var(--accent-soft);color:var(--theme-accent-text,var(--custom-accent));border-color:var(--custom-accent)}
 :root[data-theme] body .day.selected{background:var(--accent-soft)}
 :root :is(.count,.theme-toggle,.outline,.add-inline,.create-plus,.summary-icon){background:var(--accent-soft);color:var(--accent-text);border-color:var(--accent-border)}
 :root :is(.create-group-card,.photo-upload){background:var(--accent-soft);border-color:var(--accent-border)}
 :root :is(.create-group-card strong,.create-plus,.photo-upload>span,.memory-action,.required){color:var(--accent-text)}
 :root .dot.personal{background:var(--custom-accent)}
 :root .wordmark span,:root .quick-add-plus{color:var(--custom-accent)}
 `;
 return color;
}
