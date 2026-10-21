"""대사 음성 받아쓰기 검수.

모든 대사·해설 음성을 받아써서 대본과 비교한다. 지시문("따뜻한 목소리로…")이 더빙되었거나
대사가 빠진 파일은 받아쓴 글이 대본보다 길거나 달라지므로 FAIL로 표시한다.

사용: pip install faster-whisper && python3 tools/check_voices.py
"""
import difflib, json, os, re, subprocess
import numpy as np
from faster_whisper import WhisperModel

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = json.load(open(os.path.join(ROOT, 'story', 'chapters.json')))
model = WhisperModel('medium', device='cpu', compute_type='int8')
norm = lambda t: re.sub(r'[^가-힣A-Za-z0-9]', '', t)


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'],
                         capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


jobs = []
for c in [c for ch in data['chapters'] for c in ch['cuts']] + data.get('branches', []):
    for l in c.get('lines', []):
        if l.get('voice'): jobs.append((c['id'], l['text'], 'voices/' + l['voice']))
    for o in c.get('options') or []:
        r = o.get('reply')
        if r and r.get('voice'): jobs.append((c['id'], r['text'], 'voices/' + r['voice']))
    if c.get('narrationVoice'): jobs.append((c['id'], c['narration'], 'narration/' + c['narrationVoice']))

bad = 0
for cid, script, rel in jobs:
    segs, _ = model.transcribe(load(os.path.join(ROOT, 'assets', 'audio', rel)), language='ko')
    heard = ''.join(s.text for s in segs)
    a, b = norm(script), norm(heard)
    ratio = difflib.SequenceMatcher(None, a, b).ratio()
    extra = len(b) > len(a) * 1.25 + 4      # 대본에 없는 말이 붙었다(지시문 더빙)
    ok = ratio >= 0.6 and not extra
    bad += not ok
    print(('ok  ' if ok else 'FAIL'), f'{ratio:.2f}', cid, rel, '|', heard.strip())
print('\n문제 파일', bad, '개')
