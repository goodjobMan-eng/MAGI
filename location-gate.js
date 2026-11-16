import {GUIDE_VERSION,guideMarkup,cropFrame,matchGuide} from './landmark-guide.js';
import {PLACES,checkPosition} from './location-geo.js';
export {PLACES,checkPosition,distanceMeters,placeForChapter} from './location-geo.js';
export const ROUTE=['train','bridge','altar'];
export function validVisits(raw){
 const visits={};for(const key of ROUTE){const v=raw?.[key];if(!v||!Number.isFinite(v.capturedAt)||v.capturedAt<=0||v.guideVersion!==GUIDE_VERSION||!['gps-contour','teacher'].includes(v.method))break;visits[key]=v;}return visits;
}
export function requiredStop(visits,requested){return ROUTE.slice(0,ROUTE.indexOf(requested)+1).find(k=>!visits[k])||requested;}
const KEY='landscape-linear-visits-v2';
// 연습 모드: 위치 확인 없이 카메라만 쓴다(윤곽은 맞춰야 넘어감). 현장 배포 상태라 false.
export const PHOTO_TEST_MODE=false;
// 선생님용: 관문 제목(장소 이름)을 5초 누르고 이 번호를 넣으면 그 지점을 통과시킨다.
// 첫 화면 제목을 5초 누르고 번호를 넣으면 이 기기의 현장 기록을 지운다(태블릿을 다음 모둠에 넘길 때).
export const TEACHER_CODE='2580';
const HOLD_MS=5000;
function onLongPress(el,fn){
 let timer=0;const stop=()=>{clearTimeout(timer);timer=0;};
 el.style.userSelect='none';el.style.webkitUserSelect='none';el.style.webkitTouchCallout='none';
 // 손가락을 붙잡아 두어(포인터 캡처) 화면 글이 바뀌며 제목이 조금 움직여도 끊기지 않게 한다. 크게 움직이면 취소.
 let x=0,y=0;
 el.addEventListener('pointerdown',e=>{stop();x=e.clientX;y=e.clientY;try{el.setPointerCapture(e.pointerId);}catch{}timer=setTimeout(()=>{timer=0;fn();},HOLD_MS);});
 el.addEventListener('pointermove',e=>{if(timer&&Math.hypot(e.clientX-x,e.clientY-y)>24)stop();});
 for(const ev of ['pointerup','pointercancel'])el.addEventListener(ev,stop);
 el.addEventListener('contextmenu',e=>e.preventDefault());
}
const askTeacher=message=>(window.prompt(message)||'').trim()===TEACHER_CODE;
const STORY_INTRO={
 train:'민우가 탄 기차가 멈춘 곳, 장단역. 그날, 그 기관차가 지금 임진각에 와 있어요. 총알 자국이 가득한 기관차를 찾아 사진으로 담아 볼까요?',
 bridge:'엄마는 "임진강 다리에서 만나자"고 했어요. 1953년 여름, 포로로 잡혀갔던 군인들이 이 다리를 걸어서 돌아왔어요. 열두 살 민우가 형을 기다리던 자유의 다리를 찾아 사진으로 담아 봐요.',
 altar:'고향에 갈 수 없는 사람들이 북쪽을 향해 절을 올리는 곳, 망배단이에요. 망배단을 찾아 사진으로 담아 봐요.'
};
export function createLocationGate({onPause,storageKey=KEY,testMode=PHOTO_TEST_MODE}){
 // 연습 기록은 실제 현장 방문 기록에 쓰지 않는다(메모리에만).
 let visits={};if(!testMode)try{visits=validVisits(JSON.parse(localStorage.getItem(storageKey)||'{}'));}catch{}
 const dialog=document.createElement('dialog');dialog.className='location-dialog';
 dialog.innerHTML='<button class="gate-close" aria-label="닫기">×</button><p class="eyebrow gate-step"></p><h2></h2><p class="gate-story"></p><p class="gate-hint"></p><div class="gate-view"><video autoplay muted playsinline hidden></video><img class="gate-photo" alt="촬영한 현장 사진" hidden><div class="gate-outline"></div><span class="gate-guide-label">이 윤곽에 맞춰 주세요</span></div><p class="gate-status" role="status" aria-live="polite"></p><meter class="gate-meter" min="0" max="100" value="0" aria-label="실루엣 맞춤 정도"></meter><button class="gate-locate">위치 확인하고 카메라 열기</button><button class="gate-shutter" hidden disabled>윤곽을 맞춰 주세요</button><button class="gate-retake" hidden>다시 촬영하기</button><p class="gate-privacy">사진은 휴대폰 안에서 윤곽을 비교한 뒤 폐기합니다. 사진·좌표를 서버로 보내지 않으며, 통과한 지점만 이 기기에 기억합니다.</p>';
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),video=$('video'),photo=$('img'),status=$('.gate-status'),view=$('.gate-view'),shutter=$('.gate-shutter');
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;
 let lastFix=null,stream=null,serial=0,resolve=null,place=null,key=null,scanTimer=null,stable=0,capturing=false,finishTimer=null;
 const stopCamera=()=>{clearTimeout(scanTimer);stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;};
 const finish=value=>{serial++;clearTimeout(finishTimer);stopCamera();photo.removeAttribute('src');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);dialog.close();const done=resolve;resolve=null;done?.(value);};
 const locate=()=>new Promise((ok,no)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(p=>{lastFix=p;ok(p);},no,{enableHighAccuracy:true,maximumAge:0,timeout:30000}):no({code:0}));
 const showError=e=>{status.textContent=e?.code===1||e?.name==='NotAllowedError'?'위치 또는 카메라 권한이 꺼져 있습니다. 브라우저의 사이트 설정에서 허용한 뒤 다시 시도해 주세요.':e?.code===3?'위치 신호를 아직 못 잡았습니다. 하늘이 트인 곳에 잠시 서 있다가 다시 눌러 주세요.':e?.code===2?'이 기기에서 위치를 알 수 없습니다. 위치 기능을 켜 주세요. 그래도 안 되면 선생님께 알려 주세요.':e?.name==='NotFoundError'?'카메라를 찾을 수 없습니다. 카메라가 있는 휴대폰으로 열어 주세요.':e?.message||'위치를 확인하지 못했습니다. 휴대폰의 위치 기능을 켜고 다시 시도해 주세요.';};
 function scan(token){
  if(token!==serial||!stream?.active||capturing)return;
  try{
   const result=matchGuide(cropFrame(video,canvas),key);stable=result.ok?stable+1:0;
   $('.gate-meter').value=result.score;view.classList.toggle('aligned',stable>=3);
   shutter.disabled=stable<3;shutter.textContent=stable>=3?'사진 찍고 이야기 열기':'윤곽을 맞춰 주세요';
   status.textContent=stable>=3?'맞았습니다. 사진을 찍으면 이야기가 이어집니다.':result.reason;
  }catch{stable=0;shutter.disabled=true;}
  scanTimer=setTimeout(()=>scan(token),350);
 }
 async function openCamera(){
  const token=++serial;stopCamera();capturing=false;stable=0;view.classList.remove('aligned');photo.hidden=true;photo.removeAttribute('src');video.hidden=true;
  $('.gate-retake').hidden=true;shutter.hidden=true;shutter.disabled=true;
  $('.gate-locate').hidden=false;$('.gate-locate').disabled=true;status.textContent='현장 위치를 확인하고 있습니다…';
  try{
   if(!window.isSecureContext)throw Error('HTTPS 주소에서 열어 주세요.');
   if(!testMode){const position=await locate();if(token!==serial)return;
   const result=checkPosition(position,place);if(!result.ok)throw Error(result.reason);}
   if(!navigator.mediaDevices?.getUserMedia)throw Error('카메라가 있는 휴대폰의 Chrome 또는 Safari로 열어 주세요.');
   const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
   if(token!==serial){acquired.getTracks().forEach(t=>t.stop());return;}
   stream=acquired;video.srcObject=stream;video.hidden=false;await video.play();if(token!==serial)return;
   shutter.hidden=false;$('.gate-locate').hidden=true;scan(token);
  }catch(e){if(token===serial){stopCamera();video.hidden=true;showError(e);}}
  finally{if(token===serial)$('.gate-locate').disabled=false;}
 }
 $('.gate-locate').onclick=openCamera;$('.gate-retake').onclick=openCamera;
 shutter.onclick=async()=>{
  if(capturing||stable<3||shutter.disabled)return;
  const token=serial;capturing=true;clearTimeout(scanTimer);shutter.disabled=true;
  try{
   status.textContent='촬영 위치와 윤곽을 확인하고 있습니다…';
   if(!testMode){const position=lastFix&&Date.now()-lastFix.timestamp<25000?lastFix:await locate();if(token!==serial)return;
   const gps=checkPosition(position,place);if(!gps.ok)throw Error(gps.reason);}
   if(!stream?.active||document.hidden)throw Error('카메라를 다시 열어 주세요.');
   const result=matchGuide(cropFrame(video,canvas),key);if(!result.ok)throw Error('촬영 순간 화면이 움직였습니다. 실루엣을 맞추고 다시 찍어 주세요.');
   photo.src=canvas.toDataURL('image/jpeg',.85);stopCamera();video.hidden=true;photo.hidden=false;shutter.hidden=true;
   visits[key]={capturedAt:Date.now(),guideVersion:GUIDE_VERSION,method:'gps-contour'};if(!testMode)try{localStorage.setItem(storageKey,JSON.stringify(visits));}catch{}
   status.textContent='사진을 맞췄습니다. 이야기가 이어집니다.';finishTimer=setTimeout(()=>{if(token===serial)finish(true);},850);
  }catch(e){if(token===serial){showError(e);stopCamera();video.hidden=true;shutter.hidden=true;$('.gate-retake').hidden=false;}}
  finally{if(token===serial)capturing=false;}
 };
 onLongPress($('h2'),()=>{
  if(!dialog.open||!key||capturing)return;
  if(!askTeacher('선생님 번호를 넣으면 이 지점을 통과시킵니다.'))return;
  serial++;stopCamera();video.hidden=true;shutter.hidden=true;$('.gate-retake').hidden=true;
  visits[key]={capturedAt:Date.now(),guideVersion:GUIDE_VERSION,method:'teacher'};if(!testMode)try{localStorage.setItem(storageKey,JSON.stringify(visits));}catch{}
  status.textContent='선생님 확인으로 통과했습니다. 이야기가 이어집니다.';const token=serial;finishTimer=setTimeout(()=>{if(token===serial)finish(true);},700);
 });
 const homeTitle=document.querySelector('#home h1');
 if(homeTitle)onLongPress(homeTitle,()=>{
  if(!askTeacher('선생님 번호를 넣으면 이 기기의 현장 사진 기록(통과한 지점)을 모두 지웁니다.'))return;
  visits={};try{localStorage.removeItem(storageKey);}catch{}
  window.alert('현장 기록을 지웠습니다. 다음 모둠은 장단 열차부터 다시 찍습니다.');
 });
 $('.gate-close').onclick=()=>finish(false);dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open)finish(false);});
 return {
  has:key=>testMode?Boolean(PLACES[key]):Boolean(visits[key]),required:requested=>testMode?requested:requiredStop(visits,requested),
  request:async requested=>{
   if(!PLACES[requested]||resolve)return false;
   if(visits[requested])return true;
   if(!testMode&&requiredStop(visits,requested)!==requested)return false;
   onPause();key=requested;place=PLACES[key];$('h2').textContent=place.name;
   const titles={train:'내려야 했던 곳',bridge:'비어가는 다리',altar:'형은 아직 모르니까'};
   $('.gate-step').textContent=`${ROUTE.indexOf(key)+1} / 3 · ${titles[key]}`;
   $('.gate-story').textContent=STORY_INTRO[key]||'';$('.gate-hint').textContent=place.hint;status.textContent='현장에 도착하면 카메라를 열어 실루엣에 맞춰 주세요.';
   $('.gate-outline').innerHTML=guideMarkup(key);view.classList.remove('aligned');$('.gate-meter').value=0;
   for(const s of ['video','img','.gate-shutter','.gate-retake'])$(s).hidden=true;
   $('.gate-locate').hidden=false;$('.gate-locate').disabled=false;$('.gate-locate').textContent=testMode?'카메라 열기':'위치 확인하고 카메라 열기';
   dialog.showModal();return new Promise(done=>{resolve=done;});
  }
 };
}
