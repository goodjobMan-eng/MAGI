// Coordinates refer to the exhibits at Imjingak, not the former Jangdan station.
export const PLACES={
 train:{name:'장단역 증기기관차',lat:37.8902667,lon:126.7387167,radius:100,chapter:'CH01',hint:'전시된 기관차 전체가 보이도록 담아 주세요.'},
 altar:{name:'망배단',lat:37.8894573,lon:126.7405547,radius:100,chapter:'CH10',hint:'망배단 비석과 제단이 보이도록 담아 주세요.'}
};
export const placeForChapter=id=>Number(id.slice(2))>=10?'altar':'train';
export function distanceMeters(a,b){
 const rad=v=>v*Math.PI/180,dy=rad(b.lat-a.lat),dx=rad(b.lon-a.lon);
 const h=Math.sin(dy/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dx/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
export function checkPosition(position,place,now=Date.now()){
 const c=position.coords;
 if(![c.latitude,c.longitude,c.accuracy,position.timestamp].every(Number.isFinite)||c.accuracy<0)return {ok:false,reason:'위치 정보를 읽지 못했습니다. 다시 확인해 주세요.'};
 if(now-position.timestamp>30000||position.timestamp>now+5000)return {ok:false,reason:'위치 정보가 오래되었습니다. 다시 확인해 주세요.'};
 if(c.accuracy>65)return {ok:false,reason:'위치 오차가 큽니다. 탁 트인 곳에서 다시 확인해 주세요.'};
 const distance=distanceMeters({lat:c.latitude,lon:c.longitude},place);
 return distance<=place.radius?{ok:true,distance}:{ok:false,distance,reason:`${place.name}에서 약 ${Math.round(distance)}m 떨어져 있습니다. 전시물 가까이에서 다시 확인해 주세요.`};
}
const KEY='landscape-place-visits-v1';
export function createLocationGate({onPause}){
 let visits={};try{visits=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch{}
 const dialog=document.createElement('dialog');dialog.className='location-dialog';
 dialog.innerHTML='<button class="gate-close" aria-label="닫기">×</button><p class="eyebrow">현장에서 여는 이야기</p><h2></h2><p class="gate-hint"></p><p class="gate-status" role="status"></p><video autoplay muted playsinline hidden></video><img class="gate-photo" alt="방금 촬영한 현장 사진" hidden><button class="gate-locate">위치 확인하고 카메라 열기</button><button class="gate-shutter" hidden>사진 찍기</button><button class="gate-confirm" hidden>이 장소를 촬영했어요 · 이야기 시작</button><button class="gate-retake" hidden>다시 찍기</button><p class="gate-privacy">위치는 현장 도착 확인에만 사용합니다. 사진은 전송·저장하지 않으며, 촬영한 대상은 직접 확인해 주세요.</p>';
 document.body.append(dialog);
 const $=s=>dialog.querySelector(s),video=$('video'),photo=$('img'),status=$('.gate-status');
 let stream=null,serial=0,resolve=null,place=null,key=null;
 const stopCamera=()=>{stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;};
 const finish=value=>{serial++;stopCamera();photo.removeAttribute('src');dialog.close();const done=resolve;resolve=null;done?.(value);};
 const locate=()=>new Promise((ok,no)=>navigator.geolocation?navigator.geolocation.getCurrentPosition(ok,no,{enableHighAccuracy:true,maximumAge:0,timeout:18000}):no({code:0}));
 const showError=e=>{status.textContent=e?.code===1||e?.name==='NotAllowedError'?'위치 또는 카메라 권한이 꺼져 있습니다. 브라우저의 사이트 설정에서 허용한 뒤 다시 시도해 주세요.':e?.name==='NotFoundError'?'카메라를 찾을 수 없습니다. 카메라가 있는 휴대폰으로 열어 주세요.':e?.message||'위치를 확인하지 못했습니다. 휴대폰의 위치 기능을 켜고 다시 시도해 주세요.';};
 async function openCamera(){
  const token=++serial;stopCamera();photo.hidden=true;photo.removeAttribute('src');video.hidden=true;
  $('.gate-confirm').hidden=true;$('.gate-retake').hidden=true;$('.gate-shutter').hidden=true;
  $('.gate-locate').hidden=false;$('.gate-locate').disabled=true;status.textContent='현장 위치를 확인하고 있습니다…';
  try{
   if(!window.isSecureContext)throw Error('HTTPS 주소에서 열어 주세요.');
   const position=await locate();if(token!==serial)return;
   const result=checkPosition(position,place);if(!result.ok)throw Error(result.reason);
   if(!navigator.mediaDevices?.getUserMedia)throw Error('이 브라우저에서는 카메라를 열 수 없습니다. 휴대폰의 Chrome 또는 Safari로 열어 주세요.');
   const acquired=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
   if(token!==serial){acquired.getTracks().forEach(t=>t.stop());return;}
   stream=acquired;video.srcObject=stream;video.hidden=false;await video.play();if(token!==serial)return;
   status.textContent='현장 위치를 확인했습니다. 전시물을 화면에 담고 촬영해 주세요.';
   $('.gate-shutter').hidden=false;$('.gate-locate').hidden=true;
  }catch(e){if(token===serial){stopCamera();video.hidden=true;showError(e);}}
  finally{if(token===serial)$('.gate-locate').disabled=false;}
 }
 $('.gate-locate').onclick=openCamera;$('.gate-retake').onclick=openCamera;
 $('.gate-shutter').onclick=async()=>{
  const token=serial;$('.gate-shutter').disabled=true;
  try{
   if(!stream?.active||!video.videoWidth)throw Error('카메라가 준비되지 않았습니다. 다시 열어 주세요.');
   // Recheck at capture time so an old camera session cannot unlock elsewhere.
   status.textContent='촬영 위치를 다시 확인하고 있습니다…';
   const position=await locate();if(token!==serial)return;
   const result=checkPosition(position,place);if(!result.ok)throw Error(result.reason);
   if(!stream?.active||document.hidden)throw Error('카메라를 다시 열어 주세요.');
   const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
   canvas.getContext('2d').drawImage(video,0,0);photo.src=canvas.toDataURL('image/jpeg',.8);
   stopCamera();video.hidden=true;photo.hidden=false;$('.gate-shutter').hidden=true;
   $('.gate-confirm').hidden=false;$('.gate-retake').hidden=false;
   status.textContent=`사진에 ${place.name}이 담겼는지 확인해 주세요.`;
  }catch(e){if(token===serial){showError(e);$('.gate-locate').hidden=false;}}
  finally{$('.gate-shutter').disabled=false;}
 };
 $('.gate-confirm').onclick=()=>{
  if(!photo.getAttribute('src')||photo.hidden)return;
  visits[key]={capturedAt:Date.now()};try{localStorage.setItem(KEY,JSON.stringify(visits));}catch{}
  finish(true);
 };
 $('.gate-close').onclick=()=>finish(false);dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&dialog.open)finish(false);});
 return {
  has:key=>Boolean(visits[key]?.capturedAt),
  request:async requested=>{
   if(visits[requested]?.capturedAt)return true;
   if(resolve)return false;
   onPause();key=requested;place=PLACES[key];$('h2').textContent=place.name;
   $('.gate-hint').textContent=place.hint;status.textContent='전시물 앞에서 위치를 확인한 뒤 직접 사진을 찍으면 이야기가 열립니다.';
   for(const s of ['video','img','.gate-shutter','.gate-confirm','.gate-retake'])$(s).hidden=true;
   $('.gate-locate').hidden=false;$('.gate-locate').disabled=false;
   dialog.showModal();return new Promise(done=>{resolve=done;});
  }
 };
}
