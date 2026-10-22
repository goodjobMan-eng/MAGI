// 태블릿에 저장해 두고 데이터 없이 쓰기
const box=document.createElement('div');box.id='offline';box.innerHTML='<button id="offlineSave" type="button">데이터 없이 쓰도록 이 기기에 저장</button><p id="offlineStatus" role="status" aria-live="polite"></p>';
document.querySelector('#home nav')?.after(box);
const btn=box.querySelector('button'),status=box.querySelector('p');
const say=t=>{status.textContent=t;};
async function info(){
 let saved=null,latest=null;
 try{saved=await caches.open('magi-app').then(c=>c.match('offline-files.json')).then(r=>r&&r.json());}catch{}
 if(navigator.onLine)try{latest=await fetch('offline-files.json',{cache:'no-store'}).then(r=>r.json());}catch{}
 const mb=n=>Math.round(n/1e6)+'MB';
 if(saved&&(!latest||latest.version===saved.version)){say('✓ 이 기기에 저장되어 있어요. 데이터가 없어도 됩니다.');btn.textContent='다시 저장하기';}
 else if(saved&&latest){say('새 버전이 있어요. 와이파이에서 다시 저장해 주세요.');btn.textContent=`새 버전 저장 (${mb(latest.bytes)})`;}
 else if(latest){say(`와이파이에서 한 번 저장해 두면 현장에서 데이터 없이 쓸 수 있어요.`);btn.textContent=`데이터 없이 쓰도록 이 기기에 저장 (${mb(latest.bytes)})`;}
 else say('인터넷에 연결되어 있지 않아요.');
}
if('serviceWorker' in navigator){
 navigator.serviceWorker.register('sw.js').then(()=>info());
 navigator.serviceWorker.addEventListener('message',e=>{const m=e.data;
  if(m.type==='progress'){say(`저장 중… ${Math.round(m.done/m.total*100)}% (${m.done}/${m.total}) 화면을 끄지 마세요.`);}
  if(m.type==='saved'){btn.disabled=false;if(m.failed.length)say(`일부를 저장하지 못했어요(${m.failed.length}개). 와이파이를 확인하고 다시 눌러 주세요.`);else info();}
 });
 btn.onclick=async()=>{if(!navigator.onLine){say('인터넷이 연결된 곳에서 저장해 주세요.');return;}btn.disabled=true;say('저장을 시작해요…');try{await navigator.storage?.persist?.();}catch{}
  const reg=await navigator.serviceWorker.ready;(navigator.serviceWorker.controller||reg.active).postMessage('save-all');};
}else{btn.hidden=true;say('이 브라우저는 저장 기능을 지원하지 않아요. 크롬으로 열어 주세요.');}
