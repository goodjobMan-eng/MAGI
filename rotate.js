// 시작할 때 세로 화면이면 가로로 돌리라고 안내한다. 돌리면 저절로 사라진다.
(function(){
  const mq=matchMedia('(orientation: portrait)');
  const box=document.createElement('div');box.id='rotate-guide';box.hidden=true;
  box.innerHTML='<div class="rg-card"><figure class="rg-photo" aria-hidden="true"><img src="assets/images/CH12-B03.webp" alt=""></figure><p class="rg-title">옆으로 눕혀서 보면<br>그림이 더 크게 보여요</p><button type="button" class="rg-keep">세로로 볼게요</button></div>';
  document.body.appendChild(box);
  let dismissed=false;
  const update=()=>{const reading=!document.querySelector('#reader')?.hidden;const h=dismissed||!mq.matches||!reading;if(box.hidden!==h)box.hidden=h;};
  box.querySelector('.rg-keep').onclick=()=>{dismissed=true;update();};
  mq.addEventListener?.('change',update);addEventListener('resize',update);
  document.addEventListener('click',e=>{if(e.target.closest('#start,#resume'))setTimeout(update,300);},true);
  const reader=document.querySelector('#reader');if(reader)new MutationObserver(update).observe(reader,{attributes:true,attributeFilter:['hidden']});
})();
