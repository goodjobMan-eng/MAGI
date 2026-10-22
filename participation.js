const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
export const TRACE_KEY='landscape-memory-strokes-v1';
export const SELFIE_KEY='landscape-selfie-v1';
export function readTrace(key=TRACE_KEY){try{const value=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(value)&&value.length&&value.some(s=>s.length>1)&&value.every(s=>Array.isArray(s)&&s.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1))?value:null;}catch{return null;}}

export function mountParticipation(c,ctx){
 const {root,art,onsite,go,forward,changed,reply,auto}=ctx;
 let allowed=!['choice','mission'].includes(c.kind),disposed=false,handles=[];
 const timers=[];const later=(f,ms)=>{const t=setTimeout(()=>{if(!disposed)f();},ms);timers.push(t);};
 function button(text,fn,parent=root){const b=el('button',text);b.type='button';b.onclick=e=>{e.stopPropagation();fn();};parent.append(b);return b;}
 const feedback=el('p','','participation-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 function say(text){feedback.textContent=text;}
 function done(text='이어서 읽기'){allowed=true;changed();button(text,forward);}
 function choices(){
  const list=el('div',null,'choices');root.append(list);
  for(const option of c.options||[])button(option.text,()=>{
   if(!option.reply){go(option.next);return;}
   list.hidden=true;reply(option.reply);say('');
   const b=button(option.next===c.id?'다시 말 걸기':'이어서 읽기',()=>go(option.next));b.focus();
  },list);
  root.append(feedback);
 }

 if(c.kind==='choice')choices();
 if(c.kind==='mission'&&c.mission==='remember'){
  const list=el('div',null,'memory-fields');root.append(list,feedback);
  let step=0;
  function draw(){
   list.replaceChildren();const field=c.fields[step];
   const title=el('p',`${step+1} / ${c.fields.length} · ${field.label}`);list.append(title);
   const options=el('div',null,'choices');list.append(options);
   field.options.forEach((text,i)=>button(text,()=>{
    if(i!==field.answer){say('민우가 들려준 기억을 한 번 더 떠올려 주세요.');return;}
    step++;
    if(step===c.fields.length){list.replaceChildren();say(c.completion);done('기억을 이어 가기');}
    else{say('');draw();list.querySelector('button')?.focus();}
   },options));
  }
  draw();
 }
 if(c.kind==='mission'&&c.mission==='tap-items'){
  const seen=new Set(),targets=el('div',null,'item-targets');art.append(targets);handles.push(targets);
  c.items.forEach((item,i)=>{
   const b=button(item.label,()=>{if(seen.has(i))return;seen.add(i);b.classList.add('found');b.setAttribute('aria-pressed','true');say(`${item.reply} (${seen.size} / ${c.items.length})`);if(seen.size===c.items.length)done('사진을 찾아봤어');},targets);
   b.setAttribute('aria-pressed','false');Object.assign(b.style,{left:item.x+'%',top:item.y+'%',width:item.w+'%',height:item.h+'%'});
  });
  say('공책, 놋숟가락, 버선 한 짝, 찢어진 밑자락을 눌러 보자.');root.append(feedback);
 }
 if(c.kind==='mission'&&c.mission==='find-name'){
  root.append(el('p',`공책의 이름: ${c.target}`,'name-sample'));
  const zoomLabel=el('label','명단 확대 '),zoom=el('input');zoom.type='range';zoom.min='100';zoom.max='200';zoom.value='100';zoom.setAttribute('aria-label','명단 확대');zoomLabel.append(zoom);root.append(zoomLabel);
  const scroll=el('div',null,'name-scroll mission-name-panel'),stage=el('div',null,'name-stage'),paper=el('div',null,'name-paper'),panel=el('div',null,'name-grid');scroll.tabIndex=0;scroll.setAttribute('aria-label','포로 명단, 확대하고 스크롤할 수 있습니다');
  paper.append(el('h3','國軍捕虜名簿','name-masthead'),el('p','국군포로 명단','name-subtitle'),panel);stage.append(paper);scroll.append(stage);art.append(scroll);handles.push(scroll);
  c.names.forEach(name=>button(name,()=>say(c.decoys[name]||'이 이름도 형 이름과 달라요. 형 이름은 김민석이에요.'),panel));
  let currentScale=1;
  const baseWidth=660,baseHeight=1020;
  function setZoom(){
   const centerX=(scroll.scrollLeft+scroll.clientWidth/2)/currentScale,centerY=(scroll.scrollTop+scroll.clientHeight/2)/currentScale;
   const fit=Math.min(1,Math.max(240,scroll.clientWidth-24)/baseWidth),nextScale=fit*Number(zoom.value)/100;
   paper.style.transform=`scale(${nextScale})`;stage.style.width=baseWidth*nextScale+'px';stage.style.height=baseHeight*nextScale+'px';
   scroll.scrollLeft=Math.max(0,centerX*nextScale-scroll.clientWidth/2);scroll.scrollTop=Math.max(0,centerY*nextScale-scroll.clientHeight/2);currentScale=nextScale;
  }
  zoom.oninput=setZoom;const sizeObserver=new ResizeObserver(setZoom);sizeObserver.observe(scroll);handles.push({remove(){sizeObserver.disconnect();}});setZoom();
  root.append(feedback);const b=button('이 명단에는 없어',()=>go('CH05-P04'));b.disabled=true;
  let left=c.doneDelay||10;const status=el('span',`${left}초 뒤에 말할 수 있어요.`,'delay-status');root.append(status);
  const tick=()=>{left--;status.textContent=left?`${left}초 뒤에 말할 수 있어요.`:'명단을 살펴봤다면 민우에게 말해 주세요.';if(left>0)later(tick,1000);else b.disabled=false;};later(tick,1000);
 }
 if(c.kind==='mission'&&c.mission==='trace'){
  const canvas=el('canvas',null,'trace-canvas');canvas.width=900;canvas.height=300;canvas.setAttribute('aria-label','김민석 세 글자의 흐린 획을 손가락으로 따라 쓰세요');art.append(canvas);handles.push(canvas);root.append(feedback);
  const guide=document.createElement('canvas');guide.width=900;guide.height=300;const g=guide.getContext('2d',{willReadFrequently:true}),p=canvas.getContext('2d');
  let mask,covered=new Uint8Array(900*300),totals=[0,0,0],counts=[0,0,0],passed=[false,false,false],strokes=[],active=null,ready=false;
  function paint(){p.clearRect(0,0,900,300);p.font='220px "Nanum Pen Script", "Gowun Batang", serif';p.textAlign='center';p.textBaseline='middle';[...c.text].forEach((ch,i)=>{p.fillStyle=passed[i]?'#4a3d2a':'#bfb8aa';p.fillText(ch,150+i*300,157);});p.lineWidth=15;p.strokeStyle='#493b25';p.lineCap='round';p.lineJoin='round';for(const stroke of strokes){if(!stroke.length)continue;p.beginPath();p.moveTo(stroke[0].x*900,stroke[0].y*300);for(const point of stroke)p.lineTo(point.x*900,point.y*300);p.stroke();}}
  function cover(x,y){for(let dy=-11;dy<=11;dy++)for(let dx=-11;dx<=11;dx++){if(dx*dx+dy*dy>121)continue;const xx=Math.round(x+dx),yy=Math.round(y+dy);if(xx<0||xx>=900||yy<0||yy>=300)continue;const n=yy*900+xx;if(mask[n*4+3]>80&&!covered[n]){covered[n]=1;counts[Math.min(2,Math.floor(xx/300))]++;}}}
  function point(e){const r=canvas.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
  function draw(e){if(!active||!ready||allowed)return;const q=point(e),last=active[active.length-1]||q;const distance=Math.hypot((q.x-last.x)*900,(q.y-last.y)*300),steps=Math.max(1,Math.ceil(distance/3));for(let i=0;i<=steps;i++)cover((last.x+(q.x-last.x)*i/steps)*900,(last.y+(q.y-last.y)*i/steps)*300);active.push(q);paint();}
  function finish(){if(!active)return;active=null;passed=totals.map((t,i)=>t>0&&counts[i]/t>=(c.threshold||.6));paint();say(passed.map((ok,i)=>`${c.text[i]} ${ok?'완료':Math.min(100,Math.round(counts[i]/Math.max(1,totals[i])*100))+'%'}`).join(' · '));if(passed.every(Boolean)&&!allowed){try{localStorage.setItem(ctx.traceKey||TRACE_KEY,JSON.stringify(strokes));}catch{}done('이름을 기억했어');}}
  canvas.onpointerdown=e=>{e.preventDefault();if(!ready||allowed)return;canvas.setPointerCapture(e.pointerId);active=[];strokes.push(active);draw(e);};canvas.onpointermove=e=>{if(active){e.preventDefault();draw(e);}};canvas.onpointerup=finish;canvas.onpointercancel=finish;
  button('다시 쓰기',()=>{if(allowed)return;covered.fill(0);counts=[0,0,0];passed=[false,false,false];strokes=[];active=null;paint();say('흐린 글씨의 획을 천천히 따라 써 보세요.');});
  document.fonts.load('220px "Nanum Pen Script"',c.text).catch(()=>[]).then(()=>document.fonts.ready).then(()=>{if(disposed)return;g.font='220px "Nanum Pen Script", "Gowun Batang", serif';g.textAlign='center';g.textBaseline='middle';[...c.text].forEach((ch,i)=>g.fillText(ch,150+i*300,157));mask=g.getImageData(0,0,900,300).data;for(let i=0;i<900*300;i++)if(mask[i*4+3]>80)totals[Math.floor((i%900)/300)]++;ready=true;paint();say('각 글자의 흐린 획을 60% 이상 따라 쓰면 진해집니다.');});
 }
 if(c.kind==='mission'&&c.mission==='shutter'){
  // 구 작가의 '하나, 둘, 셋!'에 맞춰 셔터 누르기
  let fired=false,start=0,run=0;const box=el('div',null,'rhythm'),count=el('p','','rhythm-count');box.append(el('p','구 작가가 "셋!" 할 때 셔터를 눌러요.'),count);root.append(box);
  let ac=null;const tick=hi=>{try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=hi?1320:880;g.gain.setValueAtTime(.18,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.12);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+.13);}catch{}};
  const fire=()=>{if(fired||disposed)return;fired=true;const k=new Audio('assets/audio/sfx/shutter.wav');k.volume=.9;k.play().catch(()=>{});count.textContent='찰칵!';go(c.next,true);};
  const round=()=>{if(disposed||fired)return;const id=++run;start=performance.now()+800;count.textContent='';count.classList.remove('go');say('');
   [['하나',800],['둘',1800],['셋!',2800]].forEach(([w,t],i)=>later(()=>{if(id!==run||fired)return;count.textContent=w;count.classList.toggle('go',i===2);tick(i===2);},t));
   later(()=>{if(id!==run||fired)return;if(auto){fire();return;}say('앗, 놓쳤어요. 다시 한 번!');later(()=>{if(id===run)round();},1200);},3900);};
  const press=()=>{if(fired)return;const t=performance.now()-start;
   if(t>=1850&&t<=3050){fire();return;}
   run++;say(t<1850?'조금 빨랐어요! "셋"에 맞춰 다시 눌러 봐요.':'앗, 놓쳤어요. 다시 한 번!');count.textContent='';later(round,1300);};
  const b=button('●',press);b.className='shutter-button';b.setAttribute('aria-label','셔터 누르기');root.append(feedback);later(round,600);
 }
 if(c.effect==='with-selfie'){
  let src=null;try{src=sessionStorage.getItem(SELFIE_KEY);}catch{}
  if(src){const card=el('figure',null,'selfie-print');const im=el('img');im.src=src;im.alt='함께 찍은 내 얼굴';card.append(im,el('figcaption','그날의 풍경 속의 나'));art.append(card);handles.push(card);}
 }
 if(c.kind==='record'&&onsite&&c.question){
  allowed=false;const words=ctx.dialogue;words.hidden=true;ctx.caption.textContent='현장 질문';const q=c.question;root.append(el('p',q.prompt));const list=el('div',null,'choices');root.append(list,feedback);
  q.options.forEach((text,i)=>button(text,()=>{if(i===q.answer){list.remove();root.querySelector('p')?.remove();feedback.remove();words.hidden=false;ctx.caption.textContent=c.caption;allowed=true;changed();}else say('안내판을 한 번 더 보자');},list));
 }
 if(c.effect==='memory-trace'){
  const strokes=readTrace(ctx.traceKey||TRACE_KEY);
  if(!strokes)root.append(el('p','김민석','memory-fallback hand'));
  else{const canvas=el('canvas',null,'trace-memory');canvas.width=900;canvas.height=300;canvas.setAttribute('aria-label','자유의 다리에서 내가 따라 쓴 김민석의 획');root.append(canvas);const p=canvas.getContext('2d');p.lineWidth=15;p.strokeStyle='#493b25';p.lineCap='round';p.lineJoin='round';const segments=[];for(const s of strokes)for(let i=1;i<s.length;i++)segments.push([s[i-1],s[i]]);let i=0;function draw(){if(disposed)return;for(let k=0;k<8&&i<segments.length;k++,i++){const [a,b]=segments[i];p.beginPath();p.moveTo(a.x*900,a.y*300);p.lineTo(b.x*900,b.y*300);p.stroke();}if(i<segments.length)later(draw,16);}draw();}
 }
 return {get canAdvance(){return allowed;},get autoAllowed(){return !['talk','choice','mission'].includes(c.kind)&&allowed;},cleanup(){disposed=true;timers.forEach(clearTimeout);handles.forEach(n=>n.remove());ctx.dialogue.hidden=false;}};
}
