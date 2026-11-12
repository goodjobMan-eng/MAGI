// 시작하기 전에 가로·세로를 고르게 한다. 고르기 전에는 이야기가 시작되지 않는다.
// 가로를 고르면(안드로이드 크롬) 전체 화면에서 가로로 고정해 보고, 안 되면 돌릴 때까지 기다렸다가 시작한다.
(function () {
  const portrait = matchMedia('(orientation: portrait)');
  const box = document.createElement('div');
  box.id = 'rotate-guide';
  box.hidden = true;
  box.innerHTML =
    '<div class="rg-card">' +
    '<figure class="rg-photo" aria-hidden="true"><img src="assets/images/CH12-B03.webp" alt=""></figure>' +
    '<p class="rg-title">어떻게 볼까요?</p>' +
    '<p class="rg-text">휴대폰을 옆으로 눕혀서 보면 그림이 더 크게 보여요.</p>' +
    '<div class="rg-choices">' +
    '<button type="button" class="rg-land">가로로 볼게요</button>' +
    '<button type="button" class="rg-port">세로로 볼게요</button>' +
    '</div>' +
    '<p class="rg-wait" hidden>휴대폰을 옆으로 돌리면 바로 시작해요.<br>화면이 돌아가지 않으면 휴대폰의 화면 회전 잠금을 풀어 주세요.</p>' +
    '<button type="button" class="rg-back" hidden>그냥 세로로 볼게요</button>' +
    '</div>';
  document.body.appendChild(box);

  let pending = null;   // 고른 뒤 다시 누를 시작 버튼
  let allow = false;    // 고른 뒤의 클릭은 그대로 통과
  let waiting = false;  // 가로를 골랐고 돌리기를 기다리는 중

  const reset = () => {
    waiting = false;
    box.classList.remove('waiting');
    box.querySelector('.rg-wait').hidden = true;
    box.querySelector('.rg-back').hidden = true;
    box.querySelector('.rg-choices').hidden = false;
    box.querySelector('.rg-text').hidden = false;
    box.querySelector('.rg-title').textContent = '어떻게 볼까요?';
  };
  const begin = () => {
    box.hidden = true;
    reset();
    if (!pending) return;
    const btn = pending;
    pending = null;
    allow = true;
    btn.click();
    allow = false;
  };

  document.addEventListener('click', e => {
    const btn = e.target.closest('#start,#resume');
    if (!btn || allow || !portrait.matches) return;  // 이미 가로면 바로 시작
    e.preventDefault();
    e.stopImmediatePropagation();
    pending = btn;
    reset();
    box.hidden = false;
    box.querySelector('.rg-land').focus();
  }, true);

  box.querySelector('.rg-port').onclick = begin;
  box.querySelector('.rg-back').onclick = begin;
  box.querySelector('.rg-land').onclick = async () => {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen)
        await document.documentElement.requestFullscreen();
      await screen.orientation?.lock?.('landscape');
    } catch (_) { /* 아이폰 등은 직접 돌려야 한다 */ }
    if (!portrait.matches) return begin();
    waiting = true;
    box.classList.add('waiting');
    box.querySelector('.rg-choices').hidden = true;
    box.querySelector('.rg-text').hidden = true;
    box.querySelector('.rg-title').textContent = '옆으로 돌려 주세요';
    box.querySelector('.rg-wait').hidden = false;
    box.querySelector('.rg-back').hidden = false;
  };
  const onTurn = () => { if (waiting && !portrait.matches) setTimeout(begin, 350); };
  portrait.addEventListener?.('change', onTurn);
  addEventListener('resize', onTurn);
})();
