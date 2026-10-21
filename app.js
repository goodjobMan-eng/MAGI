import {createLocationGate,placeForChapter,PLACES} from './location-gate.js';
import {mountParticipation,TRACE_KEY} from './participation.js';
import {renderInk} from './paper-ink.js';
const $=s=>document.querySelector(s);
const data=await fetch('story/chapters.json').then(r=>{if(!r.ok)throw Error('story');return r.json()}).catch(()=>null);
if(!data){$('#disclaimer').textContent='이야기를 불러오지 못했습니다. HTTP 서버로 열어 주세요.';throw Error('Story unavailable');}
const chapters=data.chapters,cuts=chapters.flatMap(c=>c.cuts.map(k=>({...k,chapter:c})));
const previewId=['localhost','127.0.0.1'].includes(location.hostname)?new URLSearchParams(location.search).get('preview'):null;
const progressKey=previewId?'landscape-qa-progress-v1':'landscape-story-v1',traceKey=previewId?'landscape-qa-trace-v1':TRACE_KEY;
let saved={index:0,unlocked:0,cutId:null,onsite:false};try{saved={...saved,...JSON.parse(localStorage.getItem(progressKey)||'{}')};}catch{}
if(saved.cutId){const n=cuts.findIndex(c=>c.id===saved.cutId);if(n>=0)saved.index=n;}else if(saved.index){const legacy=data.legacyCutIds?.[saved.index];const id=legacy==='CH04-B04'?'CH04-P04':legacy;saved.index=Math.max(0,cuts.findIndex(c=>c.id===id));}
saved.index=Math.max(0,Math.min(cuts.length-1,Number(saved.index)||0));saved.unlocked=Math.max(0,Math.min(11,Number(saved.unlocked)||0));
let index=saved.index,auto=false,music=true,typing=null,timer=null,full=false,busy=false,epoch=0,bgm=null,voices=[],started=false,participation=null,musicGap=null;
const stop=()=>{clearInterval(typing);clearTimeout(timer);clearTimeout(musicGap);voices.forEach(v=>v.pause());voices=[];};
const imageCache=new Map();
function prepareImage(file){
 if(!file)return Promise.resolve(true);
 if(!imageCache.has(file))imageCache.set(file,new Promise(resolve=>{const im=new Image();im.onload=()=>im.decode().catch(()=>{}).then(()=>resolve(true));im.onerror=()=>{imageCache.delete(file);resolve(false);};im.src='assets/images/'+file;}));
 return imageCache.get(file);
}
new ResizeObserver(()=>{if(started)renderInk($('#overlays'),$('#image'),cuts[index].overlay);}).observe($('#art'));
function persist(){saved.index=index;saved.cutId=cuts[index].id;try{localStorage.setItem(progressKey,JSON.stringify(saved));}catch{}}
const gate=createLocationGate({onPause:()=>{stop();bgm?.pause();}});
const ensurePlace=async n=>{const place=placeForChapter(cuts[n].chapter.id);return previewId||!place?true:gate.request(place);};
const duration=c=>c.dur??Math.max(3,Math.min(9,([...c.lines.map(l=>l.text),c.narration||'',c.caption||''].join('').length*.12+2)));
function schedule(){clearTimeout(timer);if(auto&&started&&!document.hidden&&index<cuts.length-1&&participation?.autoAllowed)timer=setTimeout(()=>advance(1),duration(cuts[index])*1000);}
function duck(on){if(bgm)bgm.volume=music?(on?.18*.355:.18):0;}
function audioFor(c,e){
 const url=`assets/audio/bgm/${c.chapter.bgmFile||c.chapter.bgm+'.wav'}`;
 if(!bgm||!bgm.src.endsWith(url)){bgm?.pause();bgm=new Audio(url);bgm.loop=true;bgm.volume=music?.18:0;bgm.play().catch(()=>{});}
 if(c.silentBgm||c.soundDirection?.includes('무음')||c.id==='CH12-T06'||c.id==='CH12-T07')bgm.pause();
 else if(c.id==='CH12-B04'){bgm.pause();musicGap=setTimeout(()=>{if(e===epoch)bgm?.play().catch(()=>{});},3000);}
 else bgm.play().catch(()=>{});
 const queue=[...(c.narrationVoice?[`assets/audio/narration/${c.narrationVoice}`]:[]),...(c.mission==='shutter'?[]:c.lines.filter(l=>l.voice).map(l=>`assets/audio/voices/${l.voice}`))];let n=0;
 function next(){if(e!==epoch)return;const src=queue[n++];if(!src){duck(false);return;}const v=new Audio(src);voices.push(v);duck(true);let ended=false;const finish=()=>{if(ended)return;ended=true;next();};v.onended=finish;v.onerror=finish;v.play().catch(finish);}if(c.voiceDelay)musicGap=setTimeout(next,c.voiceDelay*1000);else next();
 for(const name of c.sfx){const s=new Audio(`assets/audio/sfx/${name}.wav`);voices.push(s);s.volume=.35;s.play().catch(()=>{});}
}
function show(){
 stop();participation?.cleanup();participation=null;$('#participation').replaceChildren();$('#words').scrollTop=0;epoch++;const e=epoch,c=cuts[index];if(index===cuts.length-1)saved.unlocked=chapters.length-1;persist();
 $('#reader').classList.toggle('text-page',!c.img);$('#reader').classList.toggle('white-page',c.id==='CH12-T06'||c.id==='CH12-T06a');$('#reader').classList.toggle('interactive',['talk','choice','mission'].includes(c.kind));$('#reader').classList.toggle('record-page',c.kind==='record');
 $('#reader').classList.toggle('epilogue',Boolean(c.epilogue));
 $('#chapterLabel').textContent=c.epilogue?'그 집에 남은 시간':`${c.chapter.id.slice(2)} · ${c.chapter.title}`;$('#progress').textContent=`${index+1} / ${cuts.length}`;$('#prev').disabled=index===0;$('#next').disabled=index===cuts.length-1;
 const image=$('#image'),p=$('#picture');p.className=[c.effect,c.move].filter(Boolean).join(' ');image.className='';image.alt=c.alt;image.style.visibility='hidden';$('#placeholder').textContent='';$('#placeholder').hidden=true;$('#overlays').replaceChildren();
 image.onload=()=>{if(e===epoch){image.style.visibility='visible';$('#placeholder').hidden=true;renderInk($('#overlays'),image,c.overlay);}};
 image.onerror=()=>{if(e===epoch){$('#placeholder').textContent='그림을 불러오지 못했습니다. 연결을 확인한 뒤 다시 열어 주세요.';$('#placeholder').hidden=false;}};
 if(c.img){image.src=`assets/images/${c.img}`;if(image.complete&&image.naturalWidth)image.onload();}else image.removeAttribute('src');
 if(cuts[index+1]?.img)prepareImage(cuts[index+1].img);
 $('#caption').textContent=c.caption||'';const box=$('#dialogue');box.replaceChildren();
 const entries=[...(c.narration?[{text:c.narration}]:[]),...(c.mission==='shutter'?[]:c.lines)];let spans=[];
 for(const line of entries){const para=document.createElement('p');para.className=line.who?'line':'line narration';if(line.who){const who=document.createElement('span');who.className='speaker';who.textContent=line.who+(line.offscreen?' · 화면 밖':'')+(line.aside?' · 혼잣말':'');para.append(who);}const span=document.createElement('span');para.append(span);box.append(para);spans.push({span,text:line.text});}
 let count=0,total=spans.reduce((s,t)=>s+t.text.length,0);full=total===0;
 const reveal=()=>{let left=count;for(const s of spans){s.span.textContent=s.text.slice(0,Math.max(0,left));left-=s.text.length;}};
 typing=setInterval(()=>{count++;reveal();if(count>=total){full=true;clearInterval(typing);}},50);
 show.finish=()=>{count=total;reveal();full=true;clearInterval(typing);};
 if(c.id==='CH12-T07'){$('#dialogue').textContent=c.narration;clearInterval(typing);full=true;}
 const update=()=>{$('#next').disabled=index===cuts.length-1||!participation?.canAdvance;$('.hint').textContent=index===cuts.length-1?'':participation?.canAdvance?'화면을 눌러 넘기세요':c.mission==='shutter'?'셔터를 눌러 함께 찍어요':c.mission==='find-name'?'명단에서 형 이름을 찾아보세요':'민우에게 말을 건네 주세요';schedule();};
 const reply=answer=>{show.finish();$('#dialogue').textContent=answer.who+': '+answer.text;if(answer.narration){const n=document.createElement('p');n.className='line';n.textContent=answer.narration;$('#dialogue').append(n);}if(answer.img){$('#placeholder').hidden=false;$('#image').src='assets/images/'+answer.img;}const q=[...(answer.voice?['assets/audio/voices/'+answer.voice]:[]),...(answer.narrationVoice?['assets/audio/narration/'+answer.narrationVoice]:[])];let k=0;const play=()=>{if(e!==epoch)return;const src=q[k++];if(!src){duck(false);return;}const v=new Audio(src);voices.push(v);duck(true);let once=false;const go=()=>{if(once)return;once=true;setTimeout(play,350);};v.onended=go;v.onerror=go;v.play().catch(go);};play();};
 participation=mountParticipation(c,{root:$('#participation'),art:$('#art'),onsite:saved.onsite,auto,traceKey,go:(id,flash=false)=>jump(id,flash),forward:()=>advance(1),changed:()=>queueMicrotask(update),reply,dialogue:$('#dialogue'),caption:$('#caption')});
 audioFor(c,e);update();
}
async function jump(id,flash=false){const n=cuts.findIndex(c=>c.id===id);if(n<0)return;await advance(n-index,true,flash);}
async function advance(delta,forced=false,flash=false){
 if(busy)return;if(!forced&&delta>0&&!full){show.finish();schedule();return;}if(!forced&&delta>0&&!participation?.canAdvance)return;const next=index+delta;if(next<0||next>=cuts.length)return;
 busy=true;if(!await ensurePlace(next)){busy=false;return;}await prepareImage(cuts[next].img);stop();const c=cuts[index],type=flash?'flash':delta<=0?'cut':c.transition,curtain=$('#curtain');
 const ms=type==='flash'?150:type==='slow-black'||type==='white'?1500:type==='black'?600:type==='dissolve'?800:0;
 const fade=async(from,to,d)=>{if(d)await curtain.animate([{opacity:from},{opacity:to}],{duration:d,fill:'forwards'}).finished;else curtain.style.opacity=to;};
 let oldPicture=null;
 if(type==='dissolve'&&c.img){
  const box=$('#art').getBoundingClientRect(),pose=getComputedStyle($('#picture')).transform;oldPicture=$('#picture').cloneNode(true);oldPicture.classList.remove('push','pan-left','pan-right');oldPicture.style.transform=pose;oldPicture.style.animation='none';
  oldPicture.removeAttribute('id');oldPicture.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
  Object.assign(oldPicture.style,{position:'fixed',left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px',zIndex:4,pointerEvents:'none',overflow:'hidden'});
  const img=oldPicture.querySelector('img');if(img)Object.assign(img.style,{width:'100%',height:'100%',objectFit:'contain'});document.body.append(oldPicture);
 }
 if(type!=='cut'&&type!=='fade-from-black'&&type!=='dissolve'){curtain.style.background=type==='flash'||type==='white'?'white':'black';if(type==='flash'){curtain.style.opacity=1;await new Promise(resolve=>setTimeout(resolve,150));}else await fade(0,1,ms/2);}
 if(delta>0&&cuts[next].chapter.id!==c.chapter.id){saved.unlocked=Math.max(saved.unlocked,chapters.findIndex(x=>x.id===c.chapter.id));}
 index=next;show();if(flash&&c.mission==='shutter'&&c.lines[0]?.voice){const v=new Audio('assets/audio/voices/'+c.lines[0].voice);voices.push(v);v.play().catch(()=>{});}if(oldPicture){await oldPicture.animate([{opacity:1},{opacity:0}],{duration:800,fill:'forwards'}).finished;oldPicture.remove();}else await fade(1,0,type==='black-hard'||type==='flash'?0:ms/2);curtain.getAnimations().forEach(a=>a.cancel());curtain.style.opacity=0;busy=false;
}
async function begin(n){if(busy)return;if(!previewId){const target=placeForChapter(cuts[n].chapter.id);if(target){const needed=gate.required(target);if(!gate.has(needed))n=cuts.findIndex(c=>c.chapter.id===PLACES[needed].chapter);}}busy=true;const allowed=await ensurePlace(n);if(!allowed){busy=false;return;}await prepareImage(cuts[n].img);busy=false;saved.onsite=true;started=true;index=n;$('#home').hidden=true;$('#reader').hidden=false;show();}
$('#start').onclick=()=>begin(Math.max(0,cuts.findIndex(c=>c.id===previewId)));$('#resume').onclick=()=>begin(saved.index);$('#resume').disabled=saved.index===0;
$('#homeButton').onclick=()=>{stop();participation?.cleanup();participation=null;epoch++;bgm?.pause();bgm=null;started=false;$('#home').hidden=false;$('#reader').hidden=true;$('#resume').disabled=false;};
$('#auto').onclick=()=>{auto=!auto;$('#auto').textContent=`자동 ${auto?'켜짐':'꺼짐'}`;$('#auto').setAttribute('aria-pressed',auto);if(cuts[index].mission==='shutter')show();else schedule();};
$('#music').onclick=()=>{music=!music;$('#music').textContent=`음악 ${music?'켜짐':'꺼짐'}`;$('#music').setAttribute('aria-pressed',music);duck(voices.some(v=>!v.paused));};
$('#font').onclick=()=>{const large=$('#reader').classList.toggle('large');$('#font').setAttribute('aria-pressed',large);};
$('#prev').onclick=()=>advance(-1);$('#next').onclick=()=>advance(1);
$('#page').onclick=e=>{if(e.target.closest('button,input,canvas,#participation,.item-targets'))return;advance(e.clientX<innerWidth*.15?-1:1);};
document.addEventListener('keydown',e=>{if(!started||e.target.closest('button,input,canvas'))return;if(['ArrowRight',' ','Enter'].includes(e.key)){e.preventDefault();advance(1);}if(e.key==='ArrowLeft'){e.preventDefault();advance(-1);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);voices.forEach(v=>v.pause());bgm?.pause();}else if(started){const c=cuts[index];if(!c.silentBgm&&!c.soundDirection?.includes('무음')&&!['CH12-T06','CH12-T07'].includes(c.id))bgm?.play().catch(()=>{});schedule();}});

