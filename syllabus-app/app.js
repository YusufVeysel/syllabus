import { firebaseConfig } from './firebase-config.js';
(() => {
/* ---------- constants & helpers ---------- */
const TYPES=[['assignment','Assignment'],['exam','Exam'],['quiz','Quiz'],['reading','Reading'],['lab','Lab'],['project','Project'],['lecture','Lecture'],['other','Other']];
const TYPE_LABEL=Object.fromEntries(TYPES);
const COLORS=['#4F6BED','#E0663A','#1E9E74','#B04FC9','#D9A21B','#E04A7A','#2BA3B8','#7A8597'];
const PRI=[[0,'None'],[1,'Low'],[2,'Med'],[3,'High']];
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH=['January','February','March','April','May','June','July','August','September','October','November','December'];
const P={
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 week:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2"/>',
 inbox:'<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
 list:'<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7"/>',
 cal:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
 timer:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 sub:'<path d="M5 4v10a3 3 0 0 0 3 3h11M15 13l4 4-4 4"/>',
 note:'<path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"/>',
 left:'<path d="M15 6l-6 6 6 6"/>', right:'<path d="M9 6l6 6-6 6"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
 cap:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6"/>'
};
const ic=n=>`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-5);
const pad=n=>String(n).padStart(2,'0');
const keyOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseKey=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d)};
const addDays=(k,n)=>{const d=parseKey(k);d.setDate(d.getDate()+n);return keyOf(d)};
const todayKey=()=>keyOf(new Date());
const diffDays=(a,b)=>Math.round((parseKey(b)-parseKey(a))/864e5);
const isKey=k=>typeof k==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(k);
const shortDate=k=>{const d=parseKey(k);return `${d.getDate()} ${MON[d.getMonth()]}`};
const longDate=k=>{const d=parseKey(k);return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`};
const safeColor=c=>/^#[0-9a-f]{6}$/i.test(c||'')?c:COLORS[7];
function lsGet(k){try{return localStorage.getItem(k)}catch{return null}}
function lsSet(k,v){try{localStorage.setItem(k,v)}catch{}}

/* ---------- state ---------- */
const DEFAULT_PROFILE=()=>({focusLog:{},pomo:{work:25,brk:5}});
const S={tasks:{},courses:{},profile:DEFAULT_PROFILE(),view:'today',selected:null,calMonth:null,calDay:todayKey(),mode:'loading',loaded:false,user:null};
try{const v=lsGet('syllabus.view');if(v&&!v.startsWith('course:'))S.view=v;}catch{}
let backend=null;
function resetData(){S.tasks={};S.courses={};S.profile=DEFAULT_PROFILE();S.selected=null;S.loaded=false;if(S.view.startsWith('course:'))S.view='today'}

/* local backend: this device only (used when sync is not set up) */
const LS_KEY='syllabus.data.v1';
function readLocal(){try{const d=JSON.parse(lsGet(LS_KEY));if(d&&typeof d==='object')return d}catch{}return null}
const localBackend={
  name:'local',
  init(){const d=readLocal();if(d){S.tasks=d.tasks||{};S.courses=d.courses||{};S.profile={...DEFAULT_PROFILE(),...(d.profile||{})}}},
  save(){lsSet(LS_KEY,JSON.stringify({tasks:S.tasks,courses:S.courses,profile:S.profile}))},
  putTask(){this.save()},delTask(){this.save()},putCourse(){this.save()},delCourse(){this.save()},putProfile(){this.save()},stop(){}
};

/* cloud backend: Firestore, one private tree per account at users/{uid} */
function makeFirebaseBackend(F,uid){
  const {db,doc,collection,setDoc,deleteDoc,onSnapshot,query,limit}=F;
  const root=doc(db,'users',uid);
  const tasksCol=collection(root,'tasks'),coursesCol=collection(root,'courses');
  const pending=new Map(),timers=new Map(),unsubs=[];
  const clean=o=>JSON.parse(JSON.stringify(o));
  // Firestore applies writes locally at once (and queues them while offline),
  // so writes are fired without awaiting; only text edits are debounced.
  function write(key,fn,delay){
    pending.set(key,fn);clearTimeout(timers.get(key));
    timers.set(key,setTimeout(()=>{const f=pending.get(key);pending.delete(key);timers.delete(key);
      try{Promise.resolve(f()).catch(onWriteError)}catch(e){onWriteError(e)}},delay||0));
  }
  const busy=k=>pending.has(k);
  const got={t:false,c:false,p:false};
  const ready=()=>{if(got.t&&got.c&&got.p)S.loaded=true;render()};
  const err=e=>{console.error(e);toast(e&&e.code==='permission-denied'?'Your account could not read its data. Check the Firestore rules in the setup guide.':'Lost the connection to your synced tasks. Reload to reconnect.')};
  return {
    name:'cloud',
    putTask(t,d){const x=clean(t);write('t:'+t.id,()=>setDoc(doc(tasksCol,t.id),x),d)},
    delTask(id){write('t:'+id,()=>deleteDoc(doc(tasksCol,id)))},
    putCourse(c){const x=clean(c);write('c:'+c.id,()=>setDoc(doc(coursesCol,c.id),x))},
    delCourse(id){write('c:'+id,()=>deleteDoc(doc(coursesCol,id)))},
    putProfile(p,d){const x=clean(p);write('p',()=>setDoc(root,x),d)},
    subscribe(){
      unsubs.push(onSnapshot(query(tasksCol,limit(2000)),snap=>{
        const m={};snap.docs.forEach(d=>{m[d.id]={...d.data(),id:d.id}});
        for(const k of Object.keys(S.tasks))if(busy('t:'+k))m[k]=S.tasks[k];
        for(const k of Object.keys(m))if(busy('t:'+k)&&!S.tasks[k])delete m[k];
        S.tasks=m;got.t=true;ready();
      },err));
      unsubs.push(onSnapshot(query(coursesCol,limit(300)),snap=>{
        const m={};snap.docs.forEach(d=>{m[d.id]={...d.data(),id:d.id}});
        for(const k of Object.keys(S.courses))if(busy('c:'+k))m[k]=S.courses[k];
        for(const k of Object.keys(m))if(busy('c:'+k)&&!S.courses[k])delete m[k];
        S.courses=m;got.c=true;ready();
      },err));
      unsubs.push(onSnapshot(root,snap=>{
        if(snap.exists()&&!busy('p'))S.profile={...DEFAULT_PROFILE(),...snap.data()};
        got.p=true;ready();
      },err));
    },
    stop(){unsubs.forEach(u=>{try{u()}catch{}});timers.forEach(clearTimeout)}
  };
}
function onWriteError(e){
  console.error(e);const c=e&&e.code;
  if(c==='permission-denied')toast('A change was refused by the database. Check the Firestore rules in the setup guide.');
  else if(c==='resource-exhausted')toast('The free database limit was reached for today. Changes will save again later.');
  else toast('A change could not be saved. Check your connection and try again.');
}
/* ---------- data ops ---------- */
const openTasks=()=>Object.values(S.tasks).filter(t=>!t.done);
function byDue(a,b){
  const da=a.due||'9999',db_=b.due||'9999';if(da!==db_)return da<db_?-1:1;
  const ta=a.time||'99',tb=b.time||'99';if(ta!==tb)return ta<tb?-1:1;
  if((b.priority||0)!==(a.priority||0))return (b.priority||0)-(a.priority||0);
  return (a.createdAt||0)-(b.createdAt||0);
}
function saveTask(t,delay){S.tasks[t.id]=t;backend&&backend.putTask(t,delay)}
function removeTask(id){delete S.tasks[id];backend&&backend.delTask(id)}
function saveCourse(c){S.courses[c.id]=c;backend&&backend.putCourse(c)}
function removeCourse(id){delete S.courses[id];backend&&backend.delCourse(id)}
function saveProfile(delay){backend&&backend.putProfile(S.profile,delay)}
const courseList=()=>Object.values(S.courses).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
function focusOn(k){const d=S.profile.focusLog&&S.profile.focusLog[k];return d?Object.values(d).reduce((a,b)=>a+(+b||0),0):0}

function newTask(p){
  return {id:uid(),title:p.title,courseId:p.courseId||null,due:p.due||null,time:p.time||null,priority:p.priority||0,type:p.type||'other',subtasks:p.subtasks||[],notes:p.notes||'',done:!!p.done,doneAt:p.doneAt||null,createdAt:Date.now(),...(p.example?{example:true}:{})};
}
function toggleTask(id){
  const t=S.tasks[id];if(!t)return;
  const was={...t};
  t.done=!t.done;t.doneAt=t.done?Date.now():null;saveTask({...t});render();
  if(t.done)toast(`Completed “${t.title.length>40?t.title.slice(0,40)+'…':t.title}”`,()=>{saveTask(was);render()});
}

/* ---------- quick add parsing ---------- */
const WD={sun:0,sunday:0,mon:1,monday:1,tue:2,tues:2,tuesday:2,wed:3,weds:3,wednesday:3,thu:4,thur:4,thurs:4,thursday:4,fri:5,friday:5,sat:6,saturday:6};
function findCourse(q){
  q=q.toLowerCase();const cs=courseList();
  return cs.find(c=>(c.code||'').toLowerCase()===q)||cs.find(c=>(c.code||'').toLowerCase().startsWith(q))||cs.find(c=>c.name.toLowerCase().replace(/\s+/g,'').startsWith(q));
}
function parseDateWord(w){
  const T=todayKey();let m;
  if(w==='today'||w==='tod')return T;
  if(w==='tomorrow'||w==='tmr'||w==='tmrw')return addDays(T,1);
  if(w in WD){const n=(WD[w]-parseKey(T).getDay()+7)%7;return addDays(T,n)}
  if(/^\d{4}-\d{2}-\d{2}$/.test(w)&&!isNaN(parseKey(w)))return w;
  if((m=w.match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?$/))){
    const d=+m[1],mo=+m[2];if(mo<1||mo>12||d<1||d>31)return null;
    let y=m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):new Date().getFullYear();
    let k=`${y}-${pad(mo)}-${pad(d)}`;const dt=parseKey(k);if(dt.getDate()!==d)return null;
    if(!m[3]&&k<T)k=`${y+1}-${pad(mo)}-${pad(d)}`;return k;
  }
  return null;
}
function guessType(s){
  if(/\b(midterm|final|exam|vize)\b/i.test(s))return 'exam';
  if(/\bquiz\b/i.test(s))return 'quiz';
  if(/\blab\b/i.test(s))return 'lab';
  if(/\b(project|proje)\b/i.test(s))return 'project';
  if(/\b(read|reading|chapter|ch\.)\b/i.test(s))return 'reading';
  if(/\b(lecture|recording)\b/i.test(s))return 'lecture';
  if(/\b(homework|hw|assignment|problem set|pset|essay|report|worksheet|ödev)\b/i.test(s))return 'assignment';
  return 'other';
}
function parseQuick(raw){
  let s=' '+raw+' ';const out={};const T=todayKey();
  s=s.replace(/\sin\s+(\d+)\s*(d|days?|w|weeks?)(?=\s)/i,(m,n,u)=>{out.due=addDays(T,(+n)*(/^w/i.test(u)?7:1));return ' '});
  s=s.replace(/\snext\s+week(?=\s)/i,()=>{if(!out.due)out.due=addDays(T,7);return ' '});
  const keep=[];
  for(const w of s.trim().split(/\s+/).filter(Boolean)){
    const lw=w.toLowerCase();let m;
    if(w[0]==='#'&&w.length>1){const c=findCourse(w.slice(1));if(c){out.courseId=c.id;continue}}
    if((m=lw.match(/^!(1|2|3|low|med|medium|high)$/))){out.priority={1:1,2:2,3:3,low:1,med:2,medium:2,high:3}[m[1]];continue}
    if(lw[0]==='*'&&TYPE_LABEL[lw.slice(1)]){out.type=lw.slice(1);out.typeExplicit=true;continue}
    if(!out.due){const d=parseDateWord(lw);if(d){out.due=d;continue}}
    if(!out.time&&(m=lw.match(/^@?(\d{1,2}):(\d{2})$/))&&+m[1]<24&&+m[2]<60){out.time=pad(+m[1])+':'+m[2];continue}
    keep.push(w);
  }
  out.title=keep.join(' ').trim();
  if(!out.type)out.type=guessType(out.title);
  return out;
}

/* ---------- rendering ---------- */
function dueInfo(t){
  if(!t.due)return null;const n=diffDays(todayKey(),t.due);let txt,cls='';
  if(n<0){txt=n===-1?'Yesterday':`${-n}d overdue`;cls='late'}
  else if(n===0){txt='Today';cls='now'}
  else if(n===1)txt='Tomorrow';
  else if(n<7)txt=DOW[parseKey(t.due).getDay()];
  else txt=shortDate(t.due);
  if(t.time)txt+=' '+t.time;return {txt,cls,n};
}
function courseChip(c){return c?`<span class="cc" style="--c:${safeColor(c.color)}">${esc(c.code||c.name)}</span>`:''}
function taskHTML(t){
  const c=S.courses[t.courseId];const di=dueInfo(t);const subs=t.subtasks||[];const sd=subs.filter(s=>s.done).length;
  const exam=t.type==='exam'||t.type==='quiz';
  return `<div class="task pri${t.priority||0}${t.done?' is-done':''}${S.selected===t.id?' is-sel':''}" data-act="select" data-id="${esc(t.id)}" tabindex="0" role="button" aria-label="${esc(t.title)}">
<button class="chk" data-act="toggle" data-id="${esc(t.id)}" aria-label="${t.done?'Mark not done':'Mark done'}">${t.done?ic('check'):''}</button>
<div class="t-main"><div class="t-title">${esc(t.title)}</div><div class="t-meta">${courseChip(c)}${t.type&&t.type!=='other'?`<span class="tag${exam?' tag-exam':''}">${esc(TYPE_LABEL[t.type]||'')}</span>`:''}${subs.length?`<span class="m">${ic('sub')}${sd}/${subs.length}</span>`:''}${t.notes?`<span class="m" title="Has notes">${ic('note')}</span>`:''}${t.example?'<span class="m">example</span>':''}</div></div>
${di?`<span class="due ${t.done?'':di.cls}">${esc(di.txt)}</span>`:''}</div>`;
}
function groupHTML(g){
  return `<section class="grp ${g.cls||''}"><h3 class="grp-h"><span>${esc(g.label)}</span>${g.sub?`<span class="grp-sub">${esc(g.sub)}</span>`:''}<span class="grp-n">${g.tasks.length||''}</span></h3>${g.tasks.length?`<div class="tasks">${g.tasks.map(taskHTML).join('')}</div>`:`<p class="grp-empty">${esc(g.empty||'Nothing here.')}</p>`}</section>`;
}
function bucketGroups(list){
  const T=todayKey();const b={overdue:[],today:[],tomorrow:[],week:[],later:[],nodate:[]};
  list.sort(byDue).forEach(t=>{
    if(!t.due)return b.nodate.push(t);const n=diffDays(T,t.due);
    b[n<0?'overdue':n===0?'today':n===1?'tomorrow':n<=7?'week':'later'].push(t);
  });
  return [['overdue','Overdue','late'],['today','Today'],['tomorrow','Tomorrow'],['week','Next 7 days'],['later','Later'],['nodate','No date']]
    .filter(([k])=>b[k].length).map(([k,l,cls])=>({label:l,tasks:b[k],cls}));
}
function examCards(limit){
  const T=todayKey();
  return openTasks().filter(t=>(t.type==='exam'||t.type==='quiz')&&t.due&&t.due>=T).sort(byDue).slice(0,limit).map(e=>{
    const c=S.courses[e.courseId];const n=diffDays(T,e.due);
    return `<button class="exam" data-act="select" data-id="${esc(e.id)}" style="--c:${safeColor(c&&c.color)}"><span class="exam-n"><b>${n===0?'0':n}</b><small>${n===0?'today':n===1?'day':'days'}</small></span><span class="exam-t"><span class="exam-title">${esc(e.title)}</span><span class="exam-meta">${esc(c?(c.code||c.name)+' · ':'')}${longDate(e.due)}${e.time?' '+e.time:''}</span></span></button>`;
  });
}

function viewMeta(){
  const T=todayKey(),v=S.view;
  if(v==='today')return {eb:longDate(T),title:'Today'};
  if(v==='week')return {eb:`${shortDate(T)} – ${shortDate(addDays(T,6))}`,title:'Next 7 days'};
  if(v==='inbox')return {eb:'Tasks without a course',title:'Inbox'};
  if(v==='all')return {eb:'Every open task',title:'All tasks'};
  if(v==='done')return {eb:'Most recent first',title:'Completed'};
  if(v==='calendar')return {eb:'Deadlines by day',title:'Calendar'};
  if(v==='focus')return {eb:'Pomodoro timer',title:'Focus'};
  if(v.startsWith('course:')){const c=S.courses[v.slice(7)];if(c)return {eb:c.code||'Course',title:c.name}}
  return {eb:'',title:'Today'};
}

function renderSide(){
  const T=todayKey();const op=openTasks();
  const cnt={today:op.filter(t=>t.due&&t.due<=T).length,week:op.filter(t=>t.due&&diffDays(T,t.due)<=6).length,inbox:op.filter(t=>!t.courseId||!S.courses[t.courseId]).length,all:op.length};
  const late=op.some(t=>t.due&&t.due<T);
  const nav=(v,l,i,n,cls='')=>`<button class="nav${S.view===v?' on':''}" data-act="view" data-v="${v}">${ic(i)}<span class="nav-l">${l}</span><span class="nav-n ${cls}">${n||''}</span></button>`;
  $('#smartNav').innerHTML=nav('today','Today','sun',cnt.today,late?'late':'')+nav('week','Next 7 days','week',cnt.week)+nav('inbox','Inbox','inbox',cnt.inbox)+nav('all','All tasks','list',cnt.all)+nav('done','Completed','check','');
  const cs=courseList();
  $('#courseNav').innerHTML=cs.length?cs.map(c=>{const n=op.filter(t=>t.courseId===c.id).length;const v='course:'+c.id;
    return `<button class="nav${S.view===v?' on':''}" data-act="view" data-v="${esc(v)}"><span class="dot" style="--c:${safeColor(c.color)}"></span><span class="nav-l">${esc(c.name)}</span><span class="nav-n">${n||''}</span></button>`}).join('')
    :`<button class="nav" data-act="newCourse">${ic('plus')}<span class="nav-l muted">Add your first course</span></button>`;
  $('#toolNav').innerHTML=nav('calendar','Calendar','cal','')+`<button class="nav${S.view==='focus'?' on':''}" data-act="view" data-v="focus">${ic('timer')}<span class="nav-l">Focus</span><span class="nav-n" id="focusBadge"></span></button>`;
  const hasEx=Object.values(S.courses).some(c=>c.example)||Object.values(S.tasks).some(t=>t.example);
  const modeTxt=S.mode==='cloud'?`Synced${S.user&&S.user.email?' · '+esc(S.user.email):''}`:S.mode==='local'?'Saved on this device only':S.mode==='signedout'?'Signed out':'Connecting…';
  $('#sideFoot').innerHTML=`<span class="mode ${S.mode==='cloud'?'cloud':''}">${modeTxt}</span>${hasEx?`<span id="exWrap"><button class="link-btn" data-act="askClearEx">Remove example semester</button></span>`:''}<span class="foot-row"><button class="link-btn" data-act="backup">Back up</button><button class="link-btn" data-act="restore">Restore</button>${S.mode==='cloud'?'<button class="link-btn" data-act="signOut">Sign out</button>':''}</span><span>Press <b>N</b> to add a task</span>`;
  tickUI();
}

function renderMain(){
  const body=$('#viewBody');
  const m=viewMeta();$('#viewEyebrow').textContent=m.eb;$('#viewTitle').textContent=m.title;
  $('#quickAdd').hidden=S.view==='focus'||S.view==='done';
  renderActions();
  if(!S.loaded){body.innerHTML='<p class="loading">Opening your planner…</p>';return}
  const v=S.view,T=todayKey();
  const isEmpty=!Object.keys(S.tasks).length&&!Object.keys(S.courses).length;
  let h='';
  if(isEmpty&&v!=='focus'&&v!=='calendar'){body.innerHTML=welcomeHTML();return}
  if(v==='today'){
    const op=openTasks();
    const ex=examCards(6);if(ex.length)h+=`<div class="exam-strip">${ex.join('')}</div>`;
    const over=op.filter(t=>t.due&&t.due<T).sort(byDue),tod=op.filter(t=>t.due===T).sort(byDue);
    const doneToday=Object.values(S.tasks).filter(t=>t.done&&t.doneAt&&keyOf(new Date(t.doneAt))===T).sort((a,b)=>b.doneAt-a.doneAt);
    if(over.length)h+=groupHTML({label:'Overdue',tasks:over,cls:'late'});
    h+=groupHTML({label:'Due today',sub:longDate(T),tasks:tod,empty:'Nothing due today. Plan ahead in Next 7 days, or add a task above.'});
    const tm=op.filter(t=>t.due===addDays(T,1)).sort(byDue);
    if(tm.length)h+=groupHTML({label:'Tomorrow',sub:longDate(addDays(T,1)),tasks:tm});
    if(doneToday.length)h+=groupHTML({label:'Completed today',tasks:doneToday});
  }else if(v==='week'){
    const op=openTasks();
    const over=op.filter(t=>t.due&&t.due<T).sort(byDue);
    if(over.length)h+=groupHTML({label:'Overdue',tasks:over,cls:'late'});
    for(let i=0;i<7;i++){const k=addDays(T,i);h+=groupHTML({label:i===0?'Today':i===1?'Tomorrow':DOW[parseKey(k).getDay()],sub:shortDate(k),tasks:op.filter(t=>t.due===k).sort(byDue),empty:'Free day.'})}
  }else if(v==='inbox'){
    const g=bucketGroups(openTasks().filter(t=>!t.courseId||!S.courses[t.courseId]));
    h+=g.length?g.map(groupHTML).join(''):groupHTML({label:'Inbox',tasks:[],empty:'Inbox is clear. Tasks you add without a #course land here.'});
  }else if(v==='all'){
    const g=bucketGroups(openTasks());h+=g.length?g.map(groupHTML).join(''):groupHTML({label:'All tasks',tasks:[],empty:'No open tasks. Nice work.'});
  }else if(v==='done'){
    const d=Object.values(S.tasks).filter(t=>t.done).sort((a,b)=>(b.doneAt||0)-(a.doneAt||0));
    h+=groupHTML({label:'Completed',tasks:d.slice(0,300),empty:'Tasks you tick off show up here.'});
  }else if(v.startsWith('course:')){
    const c=S.courses[v.slice(7)];if(!c){S.view='today';return renderMain()}
    const ct=Object.values(S.tasks).filter(t=>t.courseId===c.id);const op=ct.filter(t=>!t.done);
    const nextEx=op.filter(t=>(t.type==='exam'||t.type==='quiz')&&t.due&&t.due>=T).sort(byDue)[0];
    let wk=0;for(let i=0;i<7;i++){const d=S.profile.focusLog&&S.profile.focusLog[addDays(T,-i)];if(d&&d[c.id])wk+=+d[c.id]||0}
    h+=`<div class="stats-strip"><div class="stat"><b>${op.length}</b><span>open tasks</span></div><div class="stat"><b>${ct.length-op.length}</b><span>completed</span></div><div class="stat"><b>${nextEx?diffDays(T,nextEx.due)+'d':'–'}</b><span>${nextEx?'until '+esc(nextEx.title):'no exam scheduled'}</span></div><div class="stat"><b>${wk}</b><span>focus min, last 7 days</span></div></div>`;
    const g=bucketGroups(op);h+=g.length?g.map(groupHTML).join(''):groupHTML({label:'Open tasks',tasks:[],empty:`No open tasks for ${c.code||c.name}. Add one above.`});
  }else if(v==='calendar')h=calendarHTML();
  else if(v==='focus')h=focusHTML();
  body.innerHTML=h;
  if(v==='focus')tickUI();
}

function renderActions(){
  const a=$('#viewActions'),v=S.view;
  if(v==='calendar'){
    const m=S.calMonth||todayKey().slice(0,7);const [y,mo]=m.split('-').map(Number);
    a.innerHTML=`<button class="icon-btn" data-act="calNav" data-d="-1" aria-label="Previous month">${ic('left')}</button><span class="month-lbl">${MONTH[mo-1]} ${y}</span><button class="icon-btn" data-act="calNav" data-d="1" aria-label="Next month">${ic('right')}</button><button class="btn" data-act="calToday">Today</button>`;
  }else if(v.startsWith('course:')&&S.courses[v.slice(7)]){
    a.innerHTML=`<span id="cActs"><button class="btn ghost" data-act="editCourse">${ic('edit')}Edit</button><button class="btn ghost danger" data-act="askDelCourse">${ic('trash')}Delete</button></span>`;
  }else a.innerHTML='';
}

function welcomeHTML(){
  return `<div class="welcome"><h2>Set up your semester</h2><p>Add each course you're taking, then drop in assignments, readings and exam dates. Syllabus sorts them into Today and Next 7 days, counts down to exams, and tracks your study time.</p>
<div class="row"><button class="btn primary" data-act="newCourse">${ic('plus')}Add a course</button><button class="btn" data-act="loadEx">Load an example semester</button>${(()=>{if(S.mode!=='cloud')return '';const d=readLocal();const n=d?Object.keys(d.tasks||{}).length:0;return n?`<button class="btn" data-act="copyLocal">Copy ${n} task${n===1?'':'s'} from this device</button>`:''})()}</div>
<div class="syntax"><code>#MATH201</code><span>file it under a course (by code or name)</span><code>fri · tomorrow · 14.11</code><span>set a due date (day/month works)</span><code>23:59</code><span>set a time</span><code>!high · !2</code><span>set priority</span><code>*exam · *reading</code><span>set the type (words like "midterm" or "quiz" are detected)</span><code>in 3 days</code><span>relative dates</span></div></div>`;
}

function calendarHTML(){
  const T=todayKey();const m=S.calMonth||T.slice(0,7);const [y,mo]=m.split('-').map(Number);
  const first=new Date(y,mo-1,1);const off=(first.getDay()+6)%7;const dim=new Date(y,mo,0).getDate();
  const weeks=Math.ceil((off+dim)/7);const start=keyOf(new Date(y,mo-1,1-off));
  const byDay={};Object.values(S.tasks).forEach(t=>{if(t.due)(byDay[t.due]=byDay[t.due]||[]).push(t)});
  let cells='';
  for(let i=0;i<weeks*7;i++){
    const k=addDays(start,i);const d=parseKey(k);const items=(byDay[k]||[]).sort((a,b)=>(a.done-b.done)||byDue(a,b));
    const out=d.getMonth()!==mo-1;
    const col=t=>safeColor(S.courses[t.courseId]&&S.courses[t.courseId].color);
    cells+=`<button class="cal-cell${out?' out':''}${k===T?' today':''}${k===S.calDay?' sel':''}" data-act="calDay" data-day="${k}" aria-label="${longDate(k)}, ${items.length} tasks"><span class="cal-d">${d.getDate()}</span>${items.slice(0,3).map(t=>`<span class="cal-it${t.done?' done':''}${t.type==='exam'?' exam':''}" style="--c:${col(t)}">${esc(t.title)}</span>`).join('')}${items.length>3?`<span class="cal-more">+${items.length-3} more</span>`:''}<span class="cal-dots">${items.slice(0,4).map(t=>`<i style="--c:${col(t)}"></i>`).join('')}</span></button>`;
  }
  const dayTasks=(byDay[S.calDay]||[]).sort((a,b)=>(a.done-b.done)||byDue(a,b));
  return `<div class="cal"><div class="cal-dow">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<div>${x}</div>`).join('')}</div><div class="cal-grid">${cells}</div></div>`+
    groupHTML({label:S.calDay===T?'Today':longDate(S.calDay),sub:S.calDay===T?longDate(T):'',tasks:dayTasks,empty:'Nothing on this day. Tasks you add above land here.'});
}

/* ---------- focus timer ---------- */
const TM=(()=>{try{const t=JSON.parse(lsGet('syllabus.timer'));if(t&&t.mode)return t}catch{}return {mode:'work',running:false,endsAt:0,remaining:null,taskId:null}})();
const saveTimer=()=>lsSet('syllabus.timer',JSON.stringify(TM));
const pomo=()=>({work:Math.min(180,Math.max(1,+(S.profile.pomo&&S.profile.pomo.work)||25)),brk:Math.min(60,Math.max(1,+(S.profile.pomo&&S.profile.pomo.brk)||5))});
const totalMs=()=>(TM.mode==='work'?pomo().work:pomo().brk)*60000;
const remainingMs=()=>TM.running?Math.max(0,TM.endsAt-Date.now()):(TM.remaining??totalMs());
const fmtMs=ms=>{const s=Math.ceil(ms/1000);return `${pad(Math.floor(s/60))}:${pad(s%60)}`};
const RC=2*Math.PI*110;
let audio=null;
function ensureAudio(){try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume()}catch{}}
function beep(){if(!audio)return;try{[0,.35,.7].forEach(t=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=880;o.connect(g);g.connect(audio.destination);const s=audio.currentTime+t;g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(.25,s+.02);g.gain.exponentialRampToValueAtTime(.0001,s+.28);o.start(s);o.stop(s+.3)})}catch{}}
function logFocus(min){
  const T=todayKey();const t=TM.taskId&&S.tasks[TM.taskId];const key=(t&&t.courseId)||'none';
  const fl=S.profile.focusLog=S.profile.focusLog||{};const d=fl[T]=fl[T]||{};d[key]=(+d[key]||0)+min;saveProfile();
  if(t){saveTask({...t,focusMin:(t.focusMin||0)+min})}
  const c=t&&S.courses[t.courseId];
  return c?(c.code||c.name):null;
}
function tGo(){ensureAudio();if(TM.running){TM.remaining=remainingMs();TM.running=false}else{TM.endsAt=Date.now()+remainingMs();TM.running=true}saveTimer();tickUI()}
function tStop(){
  if(TM.mode==='work'){const min=Math.floor((totalMs()-remainingMs())/60000);if(min>=1){const c=logFocus(min);toast(`${min} min logged${c?' to '+c:''}.`)}}
  TM.running=false;TM.remaining=null;saveTimer();render();
}
function tMode(m){if(TM.mode===m)return;if(TM.running&&TM.mode==='work')tStop();TM.mode=m;TM.running=false;TM.remaining=null;saveTimer();render()}
function complete(){
  TM.running=false;TM.remaining=null;
  if(TM.mode==='work'){const min=pomo().work;const c=logFocus(min);beep();toast(`Session done: ${min} min logged${c?' to '+c:''}. Take a break.`);TM.mode='break'}
  else{beep();toast('Break over. Ready for the next session.');TM.mode='work'}
  saveTimer();render();
}
function tickUI(){
  const rem=remainingMs();const tt=$('#tTime');
  if(tt){
    tt.textContent=fmtMs(rem);
    const arc=$('#ringArc');if(arc){arc.style.strokeDashoffset=String(RC*(rem/totalMs()));arc.classList.toggle('brk',TM.mode==='break')}
    const g=$('#tGoBtn');if(g)g.textContent=TM.running?'Pause':(TM.remaining!=null&&TM.remaining<totalMs()?'Resume':'Start');
  }
  const b=$('#focusBadge');if(b)b.textContent=TM.running?fmtMs(rem):'';
}
setInterval(()=>{if(TM.running){if(remainingMs()<=0)complete();else tickUI()}},500);

function focusHTML(){
  const T=todayKey();const p=pomo();
  const opts=openTasks().sort(byDue).slice(0,150).map(t=>{const c=S.courses[t.courseId];return `<option value="${esc(t.id)}"${TM.taskId===t.id?' selected':''}>${esc((c?(c.code||c.name)+' · ':'')+t.title)}</option>`}).join('');
  const t=TM.taskId&&S.tasks[TM.taskId];
  const days=[...Array(7)].map((_,i)=>addDays(T,i-6));const vals=days.map(focusOn);
  const week=vals.reduce((a,b)=>a+b,0);
  const per={};days.forEach(k=>{const d=S.profile.focusLog&&S.profile.focusLog[k];if(d)for(const [cid,v] of Object.entries(d))per[cid]=(per[cid]||0)+(+v||0)});
  const rows=Object.entries(per).sort((a,b)=>b[1]-a[1]);const mx=Math.max(1,...rows.map(r=>r[1]));
  const streak=(()=>{let n=0,k=T;if(!focusOn(k))k=addDays(k,-1);while(focusOn(k)>0){n++;k=addDays(k,-1)}return n})();
  return `<div class="focus"><div class="panel focus-card">
<div class="seg" role="tablist"><button role="tab" class="${TM.mode==='work'?'on':''}" data-act="tMode" data-m="work">Focus · ${p.work}</button><button role="tab" class="${TM.mode==='break'?'on':''}" data-act="tMode" data-m="break">Break · ${p.brk}</button></div>
<div class="ring-wrap"><svg viewBox="0 0 240 240" aria-hidden="true"><circle class="ring-bg" cx="120" cy="120" r="110" fill="none" stroke-width="8"/><circle id="ringArc" class="ring-fg" cx="120" cy="120" r="110" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="${RC}" stroke-dashoffset="0"/></svg>
<div class="ring-c"><div class="ring-time" id="tTime">${fmtMs(remainingMs())}</div><div class="ring-sub">${TM.mode==='work'?(t?esc(t.title):'Focus session'):'Break: stand up, drink water'}</div></div></div>
<div class="focus-ctl"><button class="btn primary" data-act="tGo" id="tGoBtn">Start</button><button class="btn" data-act="tStop">${TM.mode==='work'?'Stop & log':'Skip break'}</button></div>
<label class="fld"><span>Working on</span><select id="tTask"><option value="">No specific task</option>${opts}</select></label>
<div class="focus-set"><label>Focus <input type="number" id="pWork" min="1" max="180" value="${p.work}"> min</label><label>Break <input type="number" id="pBrk" min="1" max="60" value="${p.brk}"> min</label></div>
</div>
<div class="panel"><div class="big-stats"><div class="stat"><b>${focusOn(T)}</b><span>min today</span></div><div class="stat"><b>${week}</b><span>min, last 7 days</span></div><div class="stat"><b>${streak}</b><span>day streak</span></div></div>
${week?chartSVG(days,vals,T):'<p class="muted">Your focus minutes appear here after your first session. Pick a task, press Start, and the time is logged to its course.</p>'}
${rows.length?`<h3 class="mini-h" style="margin-top:20px">By course, last 7 days</h3>`+rows.map(([cid,v])=>{const c=S.courses[cid];return `<div class="crow" style="--c:${safeColor(c&&c.color)}"><span>${esc(c?c.name:'No course')}</span><b>${v} min</b><span class="bar-t"><i style="width:${(v/mx*100).toFixed(1)}%"></i></span></div>`}).join(''):''}
</div></div>`;
}
function chartSVG(days,vals,T){
  const W=320,H=150,L=34,B=22,TP=14,R=6;const max=Math.max(60,Math.ceil(Math.max(...vals)/30)*30);
  const ih=H-B-TP,bw=(W-L-R)/7;const y=v=>H-B-(v/max)*ih;
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Focus minutes per day, last 7 days">`;
  [0,max/2,max].forEach(v=>{s+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-6}" y="${y(v)+3}" text-anchor="end">${v}m</text>`});
  vals.forEach((v,i)=>{const x=L+i*bw+bw*.2,w=bw*.6,h=(v/max)*ih;
    if(v>0)s+=`<rect class="bar${days[i]===T?' today':''}" x="${x}" y="${H-B-h}" width="${w}" height="${h}" rx="3"/><text class="val" x="${x+w/2}" y="${H-B-h-4}" text-anchor="middle">${v}</text>`;
    s+=`<text x="${x+w/2}" y="${H-6}" text-anchor="middle">${DOW[parseKey(days[i]).getDay()].slice(0,2)}</text>`});
  return s+'</svg>';
}

/* ---------- rail: upcoming or detail ---------- */
function upcomingHTML(){
  const T=todayKey();const ex=examCards(4);
  const soon=openTasks().filter(t=>t.due&&t.due>=T&&diffDays(T,t.due)<=7&&t.type!=='exam'&&t.type!=='quiz').sort(byDue).slice(0,7);
  return `<h2 class="rail-h">Coming up</h2>
<h3 class="mini-h">Exams & quizzes</h3>${ex.length?ex.join(''):'<p class="muted">No exams scheduled. Add one with <b>*exam</b> or a word like "midterm".</p>'}
<h3 class="mini-h">Deadlines this week</h3>${soon.length?`<div class="mini-list">${soon.map(t=>{const di=dueInfo(t);return `<button class="mini" data-act="select" data-id="${esc(t.id)}">${courseChip(S.courses[t.courseId])}<span class="t">${esc(t.title)}</span><span class="due ${di.cls}">${esc(di.txt)}</span></button>`}).join('')}</div>`:'<p class="muted">Nothing due in the next 7 days.</p>'}
<h3 class="mini-h">Study time</h3><div class="focus-mini"><div><b>${focusOn(T)}</b> <span class="muted">min today</span></div><button class="btn" data-act="view" data-v="focus">${ic('timer')}Open timer</button></div>`;
}
function detailHTML(t){
  const T=todayKey();const subs=t.subtasks||[];const sd=subs.filter(s=>s.done).length;
  const exam=(t.type==='exam'||t.type==='quiz')&&t.due&&!t.done;const n=t.due?diffDays(T,t.due):0;
  return `<div class="detail">
<div class="d-bar"><button class="chk big${t.done?' on':''}" data-act="toggle" data-id="${esc(t.id)}" aria-label="${t.done?'Mark not done':'Mark done'}">${t.done?ic('check'):''}</button>
<select id="dCourse" class="pill-sel" data-f="courseId" aria-label="Course"><option value="">Inbox (no course)</option>${courseList().map(c=>`<option value="${esc(c.id)}"${t.courseId===c.id?' selected':''}>${esc((c.code?c.code+' · ':'')+c.name)}</option>`).join('')}</select>
<span class="sp"></span><button class="icon-btn" data-act="close" aria-label="Close details">${ic('x')}</button></div>
<textarea id="dTitle" class="d-title" data-f="title" rows="1" aria-label="Task title">${esc(t.title)}</textarea>
${exam&&n>=0?`<div class="countdown"><b>${n}</b><span>${n===1?'day':'days'} until this ${t.type==='quiz'?'quiz':'exam'}${t.time?' · '+t.time:''}</span></div>`:''}
<div class="d-grid">
<label class="fld"><span>Due date</span><input type="date" id="dDue" data-f="due" value="${t.due||''}"></label>
<label class="fld"><span>Time</span><input type="time" id="dTime" data-f="time" value="${t.time||''}"></label>
<label class="fld"><span>Type</span><select id="dType" data-f="type">${TYPES.map(([v,l])=>`<option value="${v}"${(t.type||'other')===v?' selected':''}>${l}</option>`).join('')}</select></label>
<div class="fld"><span>Priority</span><div class="seg">${PRI.map(([v,l])=>`<button class="p${v}${(t.priority||0)===v?' on':''}" data-act="pri" data-v="${v}">${l}</button>`).join('')}</div></div>
</div>
<div class="d-sec"><h4>Subtasks <span>${subs.length?sd+'/'+subs.length:''}</span></h4><div class="subs">${subs.map(s=>`<div class="sub${s.done?' done':''}"><button class="chk sm${s.done?' on':''}" data-act="subToggle" data-sid="${esc(s.id)}" aria-label="Toggle step">${s.done?ic('check'):''}</button><input class="sub-in" data-sid="${esc(s.id)}" value="${esc(s.text)}" aria-label="Step"><button class="icon-btn sm" data-act="subDel" data-sid="${esc(s.id)}" aria-label="Remove step">${ic('x')}</button></div>`).join('')}</div>
<form class="sub-add" id="subAdd"><input id="subNew" placeholder="Add a step, e.g. Outline, draft, proofread" aria-label="New step"></form></div>
<div class="d-sec"><h4>Notes</h4><textarea id="dNotes" class="d-notes" data-f="notes" placeholder="Room number, chapters, rubric, links…">${esc(t.notes||'')}</textarea></div>
<div class="d-foot"><button class="btn ghost" data-act="focusTask" data-id="${esc(t.id)}">${ic('timer')}Focus on this</button><span class="sp"></span><span id="delWrap"><button class="btn ghost danger" data-act="askDel">${ic('trash')}Delete</button></span></div>
<p class="d-stamp">Added ${t.createdAt?shortDate(keyOf(new Date(t.createdAt))):''}${t.focusMin?` · ${t.focusMin} min focused`:''}${t.done&&t.doneAt?` · done ${shortDate(keyOf(new Date(t.doneAt)))}`:''}</p>
</div>`;
}
const isField=el=>el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
let railDirty=false,mainDirty=false;
function renderRail(force){
  const rail=$('#rail');const t=S.selected&&S.tasks[S.selected];
  if(S.selected&&!t&&S.loaded)S.selected=null;
  const id=t?t.id:'';
  if(!force&&rail.dataset.id===id&&rail.contains(document.activeElement)&&isField(document.activeElement)){railDirty=true;return}
  railDirty=false;rail.dataset.id=id;
  document.body.classList.toggle('has-sel',!!t);
  rail.innerHTML=t?detailHTML(t):(S.loaded?upcomingHTML():'');
  if(t)fitTitle();
  syncScrim();
}
function fitTitle(){const el=$('#dTitle');if(el){el.style.height='auto';el.style.height=el.scrollHeight+'px'}}
function syncScrim(){
  const narrow=innerWidth<=1100;const show=document.body.classList.contains('drawer')||(narrow&&document.body.classList.contains('has-sel'));
  $('#scrim').hidden=!show;
}
function render(){
  renderSide();
  const body=$('#viewBody');
  if(body.contains(document.activeElement)&&isField(document.activeElement))mainDirty=true;else{mainDirty=false;renderMain()}
  renderRail();
}

/* ---------- toast ---------- */
let toastTimer,undoFn=null;
function toast(msg,undo){
  const el=$('#toast');undoFn=undo||null;
  el.innerHTML=`<span>${esc(msg)}</span>${undo?'<button data-act="undo">Undo</button>':''}`;el.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;undoFn=null},undo?6000:4000);
}

/* ---------- course dialog ---------- */
let editingCourse=null,pickColor=COLORS[0];
function openCourseDlg(c){
  editingCourse=c?c.id:null;
  $('#dlgTitle').textContent=c?'Edit course':'New course';
  $('#cName').value=c?c.name:'';$('#cCode').value=c?(c.code||''):'';
  const used=new Set(Object.values(S.courses).map(x=>x.color));
  pickColor=c?safeColor(c.color):(COLORS.find(x=>!used.has(x))||COLORS[0]);
  drawSwatches();$('#dlg').hidden=false;setTimeout(()=>$('#cName').focus(),30);
}
function drawSwatches(){$('#cSw').innerHTML=COLORS.map(c=>`<button type="button" class="sw${c===pickColor?' on':''}" style="--c:${c}" data-act="sw" data-c="${c}" aria-label="Colour ${c}"></button>`).join('')}
$('#courseForm').addEventListener('submit',e=>{
  e.preventDefault();const name=$('#cName').value.trim();if(!name)return;
  const code=$('#cCode').value.trim().replace(/\s+/g,'').toUpperCase();
  if(editingCourse&&S.courses[editingCourse]){saveCourse({...S.courses[editingCourse],name,code,color:pickColor})}
  else{const c={id:uid(),name,code,color:pickColor,createdAt:Date.now()};saveCourse(c);S.view='course:'+c.id;toast(`Added ${code||name}. Type #${code||name.replace(/\s+/g,'')} in a task to file it here.`)}
  $('#dlg').hidden=true;render();
});

/* ---------- examples ---------- */
function loadExamples(){
  const T=todayKey();const now=Date.now();
  const mk=(name,code,color,i)=>({id:uid(),name,code,color,example:true,createdAt:now+i});
  const [ma,cs,ec,en]=[mk('Linear Algebra','MATH201',COLORS[0],0),mk('Data Structures','CS202',COLORS[2],1),mk('Microeconomics','ECON101',COLORS[1],2),mk('Academic Writing','ENG110',COLORS[3],3)];
  [ma,cs,ec,en].forEach(saveCourse);
  const st=(text,done)=>({id:uid(),text,done:!!done});
  const tk=(title,c,off,x={})=>saveTask(newTask({title,courseId:c&&c.id,due:off==null?null:addDays(T,off),example:true,type:guessType(title),...x}));
  tk('Problem set 5: eigenvalues',ma,1,{time:'23:59',priority:3,type:'assignment',subtasks:[st('Questions 1–3',true),st('Questions 4–6'),st('Typeset in LaTeX')]});
  tk('Midterm exam',ma,9,{time:'10:00',priority:3,notes:'Chapters 1–5. Room B204. No calculators.'});
  tk('Read Lay ch. 6.1–6.3',ma,0,{type:'reading'});
  tk('AVL tree project: insert and delete',cs,3,{time:'17:00',priority:2,subtasks:[st('Rotations'),st('Unit tests'),st('Write-up')]});
  tk('Lab 6: hash tables',cs,0,{time:'14:00',priority:2});
  tk('Quiz 3: graph traversal',cs,5,{time:'09:30',priority:2});
  tk('Watch lecture 11 recording',cs,-1,{priority:1});
  tk('Elasticity worksheet',ec,2,{priority:1});
  tk('Final exam',ec,24,{time:'13:00',priority:3});
  tk('Essay outline with 3 sources',en,4,{priority:2});
  tk('Book office hours for essay feedback',en,null,{});
  tk('Renew library books',null,2,{priority:1});
  tk('Read Mankiw ch. 4',ec,-3,{type:'reading',done:true,doneAt:now-864e5});
  S.view='today';render();toast('Example semester loaded. Remove it any time from the sidebar.');
}
function clearExamples(){
  const exC=new Set(Object.values(S.courses).filter(c=>c.example).map(c=>c.id));
  Object.values(S.tasks).forEach(t=>{if(t.example)removeTask(t.id);else if(exC.has(t.courseId))saveTask({...t,courseId:null})});
  exC.forEach(removeCourse);
  if(S.view.startsWith('course:')&&exC.has(S.view.slice(7)))S.view='today';
  render();toast('Example semester removed.');
}

/* ---------- events ---------- */
function setView(v){S.view=v;if(!v.startsWith('course:'))lsSet('syllabus.view',v);document.body.classList.remove('drawer');$('#viewBody').scrollTop=0;render();syncScrim()}
function select(id){S.selected=id;document.body.classList.remove('drawer');renderMain();renderRail(true)}
function closeDetail(){S.selected=null;renderMain();renderRail(true)}
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');if(!el)return;
  const a=el.dataset.act,id=el.dataset.id;const t=S.selected&&S.tasks[S.selected];
  switch(a){
    case 'view':setView(el.dataset.v);break;
    case 'select':select(id);break;
    case 'toggle':e.stopPropagation();toggleTask(id);break;
    case 'close':closeDetail();break;
    case 'drawer':document.body.classList.add('drawer');syncScrim();break;
    case 'scrim':document.body.classList.remove('drawer');if(innerWidth<=1100&&S.selected)closeDetail();syncScrim();break;
    case 'newCourse':document.body.classList.remove('drawer');syncScrim();openCourseDlg(null);break;
    case 'editCourse':openCourseDlg(S.courses[S.view.slice(7)]);break;
    case 'dlgClose':$('#dlg').hidden=true;break;
    case 'sw':pickColor=el.dataset.c;drawSwatches();break;
    case 'askDelCourse':{const c=S.courses[S.view.slice(7)];if(!c)break;const n=Object.values(S.tasks).filter(x=>x.courseId===c.id).length;
      $('#cActs').innerHTML=`<span class="confirm">Delete ${esc(c.code||c.name)}?${n?` Its ${n} task${n>1?'s':''} move to Inbox.`:''} <button class="btn solid-danger" data-act="delCourse">Delete</button><button class="btn ghost" data-act="cancelCourseDel">Cancel</button></span>`;break}
    case 'cancelCourseDel':renderActions();break;
    case 'delCourse':{const cid=S.view.slice(7);Object.values(S.tasks).forEach(x=>{if(x.courseId===cid)saveTask({...x,courseId:null})});removeCourse(cid);setView('inbox');toast('Course deleted. Its tasks are in Inbox.');break}
    case 'loadEx':loadExamples();break;
    case 'askClearEx':$('#exWrap').innerHTML=`<span class="confirm">Remove all example courses and tasks? <button class="link-btn" data-act="clearEx">Remove</button> <button class="link-btn" data-act="cancelEx">Keep</button></span>`;break;
    case 'cancelEx':renderSide();break;
    case 'clearEx':clearExamples();break;
    case 'pri':if(t){saveTask({...t,priority:+el.dataset.v});renderMain();renderRail(true);renderSide()}break;
    case 'subToggle':if(t){const subs=(t.subtasks||[]).map(s=>s.id===el.dataset.sid?{...s,done:!s.done}:s);saveTask({...t,subtasks:subs});renderMain();renderRail(true)}break;
    case 'subDel':if(t){saveTask({...t,subtasks:(t.subtasks||[]).filter(s=>s.id!==el.dataset.sid)});renderMain();renderRail(true)}break;
    case 'askDel':$('#delWrap').innerHTML=`<span class="confirm">Delete this task? <button class="btn solid-danger" data-act="del">Delete</button><button class="btn ghost" data-act="cancelDel">Cancel</button></span>`;break;
    case 'cancelDel':renderRail(true);break;
    case 'del':if(t){const copy={...t};removeTask(t.id);S.selected=null;render();toast('Task deleted.',()=>{saveTask(copy);render()})}break;
    case 'focusTask':TM.taskId=id;saveTimer();S.selected=null;setView('focus');renderRail(true);break;
    case 'calNav':{const m=S.calMonth||todayKey().slice(0,7);const [y,mo]=m.split('-').map(Number);const d=new Date(y,mo-1+ +el.dataset.d,1);S.calMonth=keyOf(d).slice(0,7);renderMain();break}
    case 'calToday':S.calMonth=null;S.calDay=todayKey();renderMain();break;
    case 'calDay':S.calDay=el.dataset.day;if(el.dataset.day.slice(0,7)!==(S.calMonth||todayKey().slice(0,7)))S.calMonth=el.dataset.day.slice(0,7);renderMain();break;
    case 'tGo':tGo();break;
    case 'tStop':if(TM.mode==='break'){TM.running=false;TM.remaining=null;TM.mode='work';saveTimer();render()}else tStop();break;
    case 'tMode':tMode(el.dataset.m);break;
    case 'undo':if(undoFn){const f=undoFn;undoFn=null;$('#toast').hidden=true;f()}break;
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(!$('#dlg').hidden){$('#dlg').hidden=true;return}
    if(document.body.classList.contains('drawer')){document.body.classList.remove('drawer');syncScrim();return}
    if(S.selected&&!isField(document.activeElement)){closeDetail();return}
    if(isField(document.activeElement))document.activeElement.blur();
  }
  if((e.key==='n'||e.key==='N')&&!isField(document.activeElement)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&$('#dlg').hidden){
    if($('#quickAdd').hidden)setView('today');e.preventDefault();$('#qaInput').focus();
  }
  if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('task')){select(e.target.dataset.id)}
  if(e.key==='Enter'&&e.target.id==='dTitle'){e.preventDefault();e.target.blur()}
});
const rail=$('#rail');
rail.addEventListener('input',e=>{
  const t=S.selected&&S.tasks[S.selected];if(!t)return;const el=e.target;
  if(el.id==='dTitle'){fitTitle();const v=el.value.replace(/\n/g,' ');if(!v.trim())return;saveTask({...t,title:v},600);renderList()}
  else if(el.id==='dNotes'){saveTask({...t,notes:el.value},600);renderList()}
  else if(el.classList.contains('sub-in')){saveTask({...t,subtasks:(t.subtasks||[]).map(s=>s.id===el.dataset.sid?{...s,text:el.value}:s)},600)}
});
rail.addEventListener('change',e=>{
  const t=S.selected&&S.tasks[S.selected];if(!t)return;const el=e.target;const f=el.dataset.f;
  if(f==='due'||f==='time'||f==='type'||f==='courseId'){
    let v=el.value||null;if(f==='due'&&v&&!isKey(v))return;if(f==='type')v=v||'other';
    saveTask({...t,[f]:v});renderSide();renderList();if(f==='due'||f==='type')renderRail(true);
  }
});
rail.addEventListener('submit',e=>{
  if(e.target.id!=='subAdd')return;e.preventDefault();const t=S.selected&&S.tasks[S.selected];const inp=$('#subNew');const v=inp.value.trim();if(!t||!v)return;
  saveTask({...t,subtasks:[...(t.subtasks||[]),{id:uid(),text:v,done:false}]});renderList();renderRail(true);setTimeout(()=>{const n=$('#subNew');n&&n.focus()},0);
});
rail.addEventListener('focusout',()=>setTimeout(()=>{if(railDirty&&!(rail.contains(document.activeElement)&&isField(document.activeElement)))renderRail(true)},0));
function renderList(){const body=$('#viewBody');if(body.contains(document.activeElement)&&isField(document.activeElement)){mainDirty=true;return}renderMain()}
$('#viewBody').addEventListener('focusout',()=>setTimeout(()=>{const b=$('#viewBody');if(mainDirty&&!(b.contains(document.activeElement)&&isField(document.activeElement))){mainDirty=false;renderMain()}},0));
$('#viewBody').addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='tTask'){TM.taskId=el.value||null;saveTimer();const sub=$('.ring-sub');const t=TM.taskId&&S.tasks[TM.taskId];if(sub&&TM.mode==='work')sub.textContent=t?t.title:'Focus session'}
  if(el.id==='pWork'||el.id==='pBrk'){
    const w=Math.min(180,Math.max(1,parseInt($('#pWork').value)||25)),b=Math.min(60,Math.max(1,parseInt($('#pBrk').value)||5));
    S.profile.pomo={work:w,brk:b};saveProfile(400);if(!TM.running)TM.remaining=null;saveTimer();el.blur();
  }
});

/* quick add */
const qa=$('#qaInput');
function qaPreview(){
  const v=qa.value;const chips=$('#qaChips');
  if(!v.trim()){chips.innerHTML=Object.keys(S.tasks).length<4?`<span class="qa-hint">Try <code>#course</code> <code>fri</code> <code>23:59</code> <code>!high</code> <code>*exam</code></span>`:'';return}
  const p=parseQuick(v);const c=p.courseId?S.courses[p.courseId]:defaultCourse();const due=p.due||defaultDue();
  let h='';if(c)h+=`<span class="chip">${courseChip(c)}</span>`;
  if(due)h+=`<span class="chip">${ic('cal')}${longDate(due)}${p.time?' '+p.time:''}</span>`;else if(p.time)h+=`<span class="chip">${p.time}</span>`;
  if(p.priority)h+=`<span class="chip">${['','Low','Medium','High'][p.priority]} priority</span>`;
  if(p.type&&p.type!=='other')h+=`<span class="chip">${TYPE_LABEL[p.type]}</span>`;
  chips.innerHTML=h;
}
const defaultCourse=()=>S.view.startsWith('course:')?S.courses[S.view.slice(7)]:null;
const defaultDue=()=>S.view==='today'||S.view==='week'?todayKey():S.view==='calendar'?S.calDay:null;
qa.addEventListener('input',qaPreview);qa.addEventListener('focus',qaPreview);
qa.addEventListener('blur',()=>setTimeout(()=>{if(!qa.value)$('#qaChips').innerHTML=''},150));
$('#quickAdd').addEventListener('submit',e=>{
  e.preventDefault();const p=parseQuick(qa.value);if(!p.title){toast('Add a few words for the task title.');return}
  const dc=defaultCourse();
  const t=newTask({...p,courseId:p.courseId||(dc&&dc.id)||null,due:p.due||defaultDue()});
  saveTask(t);qa.value='';qaPreview();
  const c=S.courses[t.courseId];toast(`Added${c?' to '+(c.code||c.name):' to Inbox'}${t.due?' · '+longDate(t.due):''}`);
  renderSide();renderMain();renderRail();
});

addEventListener('resize',syncScrim);
/* re-render at midnight so Today rolls over */
let lastDay=todayKey();setInterval(()=>{if(todayKey()!==lastDay){lastDay=todayKey();render()}},60000);

/* ---------- backup & restore ---------- */
function exportData(){
  const data={app:'syllabus',version:1,exportedAt:new Date().toISOString(),courses:S.courses,tasks:S.tasks,profile:S.profile};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`syllabus-backup-${todayKey()}.json`;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  toast('Backup saved to your downloads.');
}
function importData(d,label){
  if(!d||typeof d!=='object'||(!d.tasks&&!d.courses)){toast('That file is not a Syllabus backup.');return}
  let nc=0,nt=0;
  Object.values(d.courses||{}).forEach(c=>{if(c&&c.id&&c.name){saveCourse({...c,color:safeColor(c.color)});nc++}});
  Object.values(d.tasks||{}).forEach(t=>{if(t&&t.id&&t.title){saveTask({...t});nt++}});
  if(d.profile&&d.profile.focusLog){
    const fl=S.profile.focusLog=S.profile.focusLog||{};
    for(const [day,v] of Object.entries(d.profile.focusLog)){if(!fl[day])fl[day]=v}
    saveProfile();
  }
  render();toast(`${label||'Restored'} ${nc} course${nc===1?'':'s'} and ${nt} task${nt===1?'':'s'}.`);
}
const restoreInput=document.createElement('input');restoreInput.type='file';restoreInput.accept='application/json,.json';restoreInput.hidden=true;document.body.appendChild(restoreInput);
restoreInput.addEventListener('change',async()=>{
  const f=restoreInput.files&&restoreInput.files[0];restoreInput.value='';if(!f)return;
  try{importData(JSON.parse(await f.text()))}catch{toast('That file could not be read. Pick a .json backup made by Syllabus.')}
});
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');if(!el)return;
  if(el.dataset.act==='backup')exportData();
  if(el.dataset.act==='restore')restoreInput.click();
  if(el.dataset.act==='copyLocal'){const d=readLocal();if(d)importData(d,'Copied')}
  if(el.dataset.act==='signOut'&&AUTH)AUTH.A.signOut(AUTH.auth);
});

/* ---------- sign in ---------- */
let AUTH=null,authMode='signin';
const authMsg=(m,ok)=>{const el=$('#authMsg');el.textContent=m||'';el.classList.toggle('ok',!!ok)};
function authError(e){
  const c=(e&&e.code)||'';
  const map={'auth/invalid-credential':'Email or password is wrong.','auth/wrong-password':'Email or password is wrong.','auth/user-not-found':'No account with that email. Choose "Create an account".',
    'auth/email-already-in-use':'An account with this email already exists. Sign in instead.','auth/weak-password':'Use a password with at least 6 characters.',
    'auth/invalid-email':'That email address doesn\'t look right.','auth/popup-closed-by-user':'','auth/cancelled-popup-request':'',
    'auth/network-request-failed':'No connection. Check your internet and try again.','auth/unauthorized-domain':'This web address is not allowed to sign in yet. Add it under Authentication → Settings → Authorized domains in Firebase.',
    'auth/operation-not-allowed':'This sign-in method is turned off. Enable it under Authentication → Sign-in method in Firebase.','auth/too-many-requests':'Too many attempts. Wait a minute and try again.'};
  authMsg(c in map?map[c]:'Sign-in failed. Try again.');
}
function setAuthMode(m){
  authMode=m;$('#authSubmit').textContent=m==='signup'?'Create account':'Sign in';
  $('#authSwitch').innerHTML=m==='signup'?'Have an account? <button type="button" class="link-btn" data-auth="signin">Sign in</button>':'New here? <button type="button" class="link-btn" data-auth="signup">Create an account</button>';
  $('#aPass').autocomplete=m==='signup'?'new-password':'current-password';authMsg('');
}
function showAuth(){$('#auth').hidden=false;setAuthMode(authMode)}
function hideAuth(){$('#auth').hidden=true}
$('#auth').addEventListener('click',async e=>{
  const b=e.target.closest('[data-auth]');if(!b||!AUTH)return;const {auth,A}=AUTH;const k=b.dataset.auth;
  if(k==='signin'||k==='signup')return setAuthMode(k);
  if(k==='google'){
    authMsg('');const prov=new A.GoogleAuthProvider();
    const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
    try{if(standalone)await A.signInWithRedirect(auth,prov);else await A.signInWithPopup(auth,prov)}
    catch(err){if(err&&(err.code==='auth/popup-blocked'||err.code==='auth/operation-not-supported-in-this-environment')){try{await A.signInWithRedirect(auth,prov)}catch(e2){authError(e2)}}else authError(err)}
  }
  if(k==='reset'){
    const email=$('#aEmail').value.trim();if(!email){authMsg('Type your email above first, then press "Forgot password" again.');return}
    try{await A.sendPasswordResetEmail(auth,email);authMsg('Check your inbox for a reset link.',true)}catch(err){authError(err)}
  }
});
$('#authForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!AUTH)return;const {auth,A}=AUTH;
  const email=$('#aEmail').value.trim(),pass=$('#aPass').value;authMsg('');$('#authSubmit').disabled=true;
  try{authMode==='signup'?await A.createUserWithEmailAndPassword(auth,email,pass):await A.signInWithEmailAndPassword(auth,email,pass)}
  catch(err){authError(err)}finally{$('#authSubmit').disabled=false}
});

/* ---------- boot ---------- */
$('#brandMark').innerHTML=ic('cap');$('#authMark').innerHTML=ic('cap');$('#addCourseBtn').innerHTML=ic('plus');$('#menuBtn').innerHTML=ic('menu');$('#qaIcon').innerHTML=ic('plus');
render();
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});

function startLocal(){backend=localBackend;localBackend.init();S.mode='local';S.loaded=true;render()}
async function startFirebase(){
  const base='https://www.gstatic.com/firebasejs/10.12.2/';
  const [{initializeApp},A,FS]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
  const app=initializeApp(firebaseConfig);
  const auth=A.getAuth(app);
  let db;try{db=FS.initializeFirestore(app,{localCache:FS.persistentLocalCache({tabManager:FS.persistentMultipleTabManager()})})}catch{db=FS.getFirestore(app)}
  AUTH={auth,A};
  A.getRedirectResult(auth).catch(authError);
  A.onAuthStateChanged(auth,user=>{
    if(backend&&backend.stop)backend.stop();
    resetData();
    if(user){
      S.user={email:user.email||'',name:user.displayName||''};hideAuth();
      backend=makeFirebaseBackend({db,...FS},user.uid);S.mode='cloud';render();backend.subscribe();
    }else{S.user=null;backend=null;S.mode='signedout';render();showAuth()}
  });
}
if(firebaseConfig&&firebaseConfig.apiKey){
  startFirebase().catch(e=>{console.error(e);toast('Sync could not start (offline or blocked). Showing tasks saved on this device.');startLocal()});
}else startLocal();
})();

/* Desktop (.exe) window: Google sign-in is blocked inside embedded windows, so offer email only. */
window.addEventListener('pywebviewready',()=>document.documentElement.classList.add('is-desktop'));
