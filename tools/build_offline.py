"""오프라인(데이터 없이) 실행용 파일 목록을 만든다.

앱에서 쓰는 그림·영상·음성·음악·효과음과 앱 코드를 offline-files.json 에 적는다.
sw.js 가 이 목록을 태블릿에 한꺼번에 저장한다. 이야기나 파일을 바꾸면 다시 실행한다.

사용: python3 tools/build_offline.py
"""
import glob, hashlib, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
d = json.load(open('story/chapters.json'))
files = {'./', 'index.html', 'app.js', 'participation.js', 'participation.css', 'style.css', 'location-gate.js',
         'location-geo.js', 'landmark-guide.js', 'paper-ink.js', 'story/chapters.json', 'manifest.webmanifest', 'offline.js',
         'assets/icon-192.png', 'assets/icon-512.png'}
files |= set(glob.glob('assets/audio/bgm/*')) | set(glob.glob('assets/audio/sfx/*'))
for c in [c for ch in d['chapters'] for c in ch['cuts']] + d.get('branches', []):
    if c.get('img'): files.add('assets/images/' + c['img'])
    if c.get('video'): files.add('assets/video/' + c['video'])
    if c.get('narrationVoice'): files.add('assets/audio/narration/' + c['narrationVoice'])
    for l in c.get('lines', []):
        if l.get('voice'): files.add('assets/audio/voices/' + l['voice'])
    for o in c.get('options') or []:
        r = o.get('reply') or {}
        if r.get('voice'): files.add('assets/audio/voices/' + r['voice'])
        if r.get('narrationVoice'): files.add('assets/audio/narration/' + r['narrationVoice'])
        if r.get('img'): files.add('assets/images/' + r['img'])
# 코드 안에서 직접 부르는 그림(현장 사진 단계 등)
for js in glob.glob('*.js'):
    src = open(js).read()
    for p in glob.glob('assets/**/*.*', recursive=True):
        if os.path.basename(p) in src and not p.endswith(('.wav', '.mp3')) or p in src:
            files.add(p)
missing = sorted(f for f in files if f != './' and not os.path.exists(f))
files = sorted(f for f in files if f == './' or os.path.exists(f))
h = hashlib.sha1()
size = 0
for f in files:
    if f == './': continue
    h.update(f.encode()); h.update(open(f, 'rb').read()); size += os.path.getsize(f)
json.dump({'version': h.hexdigest()[:12], 'bytes': size, 'files': files}, open('offline-files.json', 'w'), indent=0)
print(len(files), '개', round(size / 1e6, 1), 'MB', '없는 파일:', missing or '없음')
