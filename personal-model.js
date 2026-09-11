export const defaultHabits=()=>[{id:'reading',title:'책과 가까워지기',target:3},{id:'walking',title:'가볍게 산책하기',target:4}];
export const defaultTimetable=()=>({entries:[],weekend:false,start:480,end:1320});
export const weekdays=['월','화','수','목','금','토','일'];
export function minutes(value){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return NaN;
 const [h,m]=value.split(':').map(Number);return h*60+m;
}
export function clock(value){return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;}
export function validateEntry(e){
 if(!e.title.trim())return '일정 이름을 입력해 주세요.';
 if(!Number.isInteger(e.day)||e.day<0||e.day>6)return '요일을 선택해 주세요.';
 if(!Number.isInteger(e.start)||!Number.isInteger(e.end)||e.start<0||e.end>1440)return '올바른 시작·종료 시각을 입력해 주세요.';
 if(e.end<=e.start)return '종료 시각은 시작 시각보다 늦어야 해요.';
 if(!/^#[0-9a-f]{6}$/i.test(e.color))return '블록 색상을 선택해 주세요.';
 return '';
}
export function overlaps(a,b){return a.id!==b.id&&a.day===b.day&&a.start<b.end&&b.start<a.end;}
// Each connected overlap group shares a column count. Touching endpoints do not overlap.
export function layoutEntries(entries){
 const result=[];
 for(let day=0;day<7;day++){
  const sorted=entries.filter(e=>e.day===day).sort((a,b)=>a.start-b.start||b.end-a.end||a.id.localeCompare(b.id));
  let group=[],ends=[],groupEnd=-1;
  const flush=()=>{group.forEach(e=>result.push({...e,columns:ends.length}));group=[];ends=[];};
  for(const entry of sorted){
   if(entry.start>=groupEnd)flush();
   let column=ends.findIndex(end=>end<=entry.start);if(column<0)column=ends.length;
   ends[column]=entry.end;group.push({...entry,column});groupEnd=Math.max(groupEnd,entry.end);
  }
  flush();
 }
 return result;
}
export function weekDates(date=new Date()){
 const monday=new Date(date.getFullYear(),date.getMonth(),date.getDate());monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
 return Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(d.getDate()+i);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});
}
export function habitCount(checks,id,dates){return dates.filter(date=>checks[`${id}:${date}`]).length;}
