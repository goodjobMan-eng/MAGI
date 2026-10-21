import {GUIDE_VERSION,guideMarkup,cropFrame,matchGuide} from './landmark-guide.js';
import {PLACES,checkPosition} from './location-geo.js';
export {PLACES,checkPosition,distanceMeters,placeForChapter} from './location-geo.js';
export const ROUTE=['train','bridge','altar'];
export function validVisits(raw){
 const visits={};for(const key of ROUTE){const v=raw?.[key];if(!v||!Number.isFinite(v.capturedAt)||v.capturedAt<=0||v.guideVersion!==GUIDE_VERSION||v.method!=='gps-contour')break;visits[key]=v;}return visits;
}
export function requiredStop(visits,requested){return ROUTE.slice(0,ROUTE.indexOf(requested)+1).find(k=>!visits[k])||requested;}
const KEY='landscape-linear-visits-v2';
// Temporary public rehearsal mode. Set false for the on-site release.
export const PHOTO_TEST_MODE=true;
export function createLocationGate({onPause,storageKey=KEY,testMode=PHOTO_TEST_MODE}){
 // Do not write rehearsal progress into real GPS/photo visit records.
 if(testMode)return {has:key=>Boolean(PLACES[key]),required:requested=>requested,request:async requested=>Boolean(PLACES[requested])};
 let visits={};try{visits=validVisits(JSON.parse(localStorage.getItem(storageKey)||'{}'));}catch{}
 const dialog=document.createElement('dialog');dialog.className='location-dialog';
 dialog.innerHTML='<button class="gate-close" aria-label="닫기">×</button><p class="eyebrow gate-step"></p><h2></h2><p class="gate-hint"></p><div class="gate-view"><video autoplay muted playsinline hidden></video><img class="gate-photo" alt="촬영한 현장 사진" hidden><div class="gate-outline"></div><span class="gate-guide-label">이 윤곽에 맞춰 주세요</span></div><p class="gate-status" role="status" aria-live="polite"></p><meter class="gate-meter" min="0" max="100" value="0" aria-label="실루엣 맞춤 정도"></meter><button class="gate-locate">위치 확인하고 카메라 열기</button><button class="gate-shutter" hidden disabled>윤곽을 맞춰 주세요</button><button class="gate-retake" hidden>다시 촬영하기</button><p class="gate-privacy">사진은 휴대폰 안에서 윤곽을 비교한 뒤 폐기합니다. 사진·좌표를 서버로 보내지 않으며, 통과한 지점만 이 기기에 기억합니다.</p>';
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),video=$('video'),photo=$('img'),status=$('.gate-status'),view=$('.gate-view'),shutter=$('.gate-shutter');
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;
 let stream=null,serial=0,resolve=null,place=null,key=null,scanTimer=null,stable=0,capturing=false,finishTimer=null;
 const stopCamera=()=>{clearTimeout(scanTimer);stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;};
 const finish=value=>{serial++;clearTimeout(finishTimer);stopCamera();photo.removeAttribute('src');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);dialog.close();const done=resolve;resolve=null;done?.(value);};
 const locate=()=>new Promise((ok,no)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(ok,no,{enableHighAccuracy:true,maximumAge:0,timeout:18000}):no({code:0}));
 const showError=e=>{status.textContent=e?.code===1||e?.name==='NotAllowedError'?'위치 또는 카메라 권한이 꺼져 있습니다. 브라우저의 사이트 설정에서 허용한 뒤 다시 시도해 주세요.':e?.name==='NotFoundError'?'카메라를 찾을 수 없습니다. 카메라가 있는 휴대폰으로 열어 주세요.':e?.message||'위치를 확인하지 못했습니다. 휴대폰의 위치 기능을 켜고 다시 시도해 주세요.';};
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
   const position=await locate();if(token!==serial)return;
   const result=checkPosition(position,place);if(!result.ok)throw Error(result.reason);
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
   const position=await locate();if(token!==serial)return;
   const gps=checkPosition(position,place);if(!gps.ok)throw Error(gps.reason);
   if(!stream?.active||document.hidden)throw Error('카메라를 다시 열어 주세요.');
   const result=matchGuide(cropFrame(video,canvas),key);if(!result.ok)throw Error('촬영 순간 화면이 움직였습니다. 실루엣을 맞추고 다시 찍어 주세요.');
   photo.src=canvas.toDataURL('image/jpeg',.85);stopCamera();video.hidden=true;photo.hidden=false;shutter.hidden=true;
   visits[key]={capturedAt:Date.now(),guideVersion:GUIDE_VERSION,method:'gps-contour'};try{localStorage.setItem(storageKey,JSON.stringify(visits));}catch{}
   status.textContent='사진을 맞췄습니다. 이야기가 이어집니다.';finishTimer=setTimeout(()=>{if(token===serial)finish(true);},850);
  }catch(e){if(token===serial){showError(e);stopCamera();video.hidden=true;shutter.hidden=true;$('.gate-retake').hidden=false;}}
  finally{if(token===serial)capturing=false;}
 };
 $('.gate-close').onclick=()=>finish(false);dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open)finish(false);});
 return {
  has:key=>Boolean(visits[key]),required:requested=>requiredStop(visits,requested),
  request:async requested=>{
   if(!PLACES[requested]||resolve)return false;
   if(visits[requested])return true;
   if(requiredStop(visits,requested)!==requested)return false;
   onPause();key=requested;place=PLACES[key];$('h2').textContent=place.name;
   const titles={train:'내려야 했던 곳',bridge:'비어가는 다리',altar:'형은 아직 모르니까'};
   $('.gate-step').textContent=`${ROUTE.indexOf(key)+1} / 3 · ${titles[key]}`;
   $('.gate-hint').textContent=place.hint;status.textContent='현장에 도착하면 카메라를 열어 실루엣에 맞춰 주세요.';
   $('.gate-outline').innerHTML=guideMarkup(key);view.classList.remove('aligned');$('.gate-meter').value=0;
   for(const s of ['video','img','.gate-shutter','.gate-retake'])$(s).hidden=true;
   $('.gate-locate').hidden=false;$('.gate-locate').disabled=false;
   dialog.showModal();return new Promise(done=>{resolve=done;});
  }
 };
}
