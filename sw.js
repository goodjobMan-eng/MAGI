// 데이터 없이 실행하기: 앱 파일을 모두 태블릿에 저장해 두고, 연결이 없어도 저장본으로 연다.
const FONT_CSS = [
  'https://fonts.googleapis.com/css2?family=Gaegu:wght@300&family=Hahmlet:wght@200;300&family=Nanum+Myeongjo:wght@400;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=Nanum+Pen+Script&display=swap'
];
const APP = 'magi-app', FONTS = 'magi-fonts';

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

async function post(msg) { for (const c of await self.clients.matchAll()) c.postMessage(msg); }

// 화면의 '데이터 없이 쓰도록 저장' 버튼이 부른다.
async function saveAll() {
  const list = await fetch('offline-files.json', { cache: 'no-store' }).then(r => r.json());
  const cache = await caches.open(APP);
  let done = 0, failed = [];
  const queue = [...list.files];
  async function worker() {
    while (queue.length) {
      const f = queue.shift();
      try {
        const r = await fetch(f, { cache: 'no-store' });
        if (!r.ok) throw Error(r.status);
        await cache.put(new URL(f, self.registration.scope).href, r);
      } catch { failed.push(f); }
      post({ type: 'progress', done: ++done, total: list.files.length });
    }
  }
  await Promise.all([1, 2, 3, 4].map(worker));
  await cache.put('offline-files.json', new Response(JSON.stringify(list)));
  // 글꼴(구글 글꼴)도 함께 저장
  const fc = await caches.open(FONTS);
  for (const u of FONT_CSS) {
    try {
      const css = await fetch(u).then(r => r.text());
      await fc.put(u, new Response(css, { headers: { 'Content-Type': 'text/css' } }));
      const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]);
      for (let i = 0; i < urls.length; i += 8)
        await Promise.all(urls.slice(i, i + 8).map(async w => { try { if (!await fc.match(w)) await fc.put(w, await fetch(w)); } catch {} }));
    } catch { failed.push('글꼴'); }
  }
  post({ type: 'saved', version: list.version, failed });
}

self.addEventListener('message', e => { if (e.data === 'save-all') e.waitUntil(saveAll()); });

// 영상·소리는 부분 요청(Range)으로 오므로 저장본에서 잘라서 돌려준다.
async function ranged(req, res) {
  const range = req.headers.get('range');
  if (!range || !res) return res;
  const buf = await res.arrayBuffer(), m = /bytes=(\d*)-(\d*)/.exec(range);
  const start = m && m[1] ? +m[1] : 0, end = m && m[2] ? +m[2] : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: { 'Content-Type': res.headers.get('Content-Type') || '', 'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' }
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.match(req.url, { cacheName: FONTS }).then(r => r || fetch(req)));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    const key = url.origin + url.pathname;
    const hit = await caches.match(key, { cacheName: APP, ignoreSearch: true });
    // 저장본이 있으면 연결과 상관없이 저장본을 쓴다(현장에서 데이터가 끊겨도 같은 화면).
    if (hit) return ranged(req, hit);
    try { return await fetch(req); }
    catch { return (await caches.match(url.origin + url.pathname.replace(/[^/]*$/, ''), { cacheName: APP })) || Response.error(); }
  })());
});
