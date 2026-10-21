"""Gemini TTS로 어린 민우 대사와 해설을 다시 녹음한다.

- 연기 지시는 '읽지 말 것'으로 감싸고, 읽을 글은 따옴표 안에만 둔다.
- 녹음마다 받아쓰기(faster-whisper)로 대본과 비교해, 지시문이 섞이거나 글이 빠지면 최대 4번 다시 뽑는다.
- API 키는 환경변수 GEMINI_API_KEY 로만 받는다. 저장소에 남기지 않는다.

사용:
  GEMINI_API_KEY=... python3 tools/gemini_tts.py sample      # 목소리 후보 샘플
  GEMINI_API_KEY=... python3 tools/gemini_tts.py minwoo      # 1~6장 어린 민우 전부
  GEMINI_API_KEY=... python3 tools/gemini_tts.py narration   # 해설 전부
"""
import base64, difflib, json, os, re, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORY = os.path.join(ROOT, 'story', 'chapters.json')
MODEL = os.environ.get('GEMINI_TTS_MODEL', 'gemini-3.8-flash-tts')
KID_VOICE = os.environ.get('KID_VOICE', 'Leda')
NARRATOR_VOICE = os.environ.get('NARRATOR_VOICE', 'Sulafat')

KID_STYLE = {
    8: '여덟 살 한국 남자아이 역할의 애니메이션 아역 성우. 높고 맑고 귀여운 아이 목소리, 또랑또랑한 발음',
    9: '아홉 살 한국 남자아이 역할의 애니메이션 아역 성우. 높고 맑은 아이 목소리',
    10: '열 살 한국 남자아이 역할의 애니메이션 아역 성우. 아이 목소리, 씩씩하지만 여린 느낌',
    12: '열두 살 한국 남자아이 역할의 애니메이션 아역 성우. 변성기 전의 소년 목소리',
}
NARRATOR_STYLE = ('잠들기 전 아이에게 그림책을 읽어 주는 따뜻한 여성 동화 구연 성우. '
                  '나긋나긋하고 부드럽게, 서두르지 않고, 문장 끝을 살며시 내려 읽는다. 슬픈 대목은 조용히 낮춰 읽는다')

# 대사별 감정(연기 지시). 대본 글자는 바꾸지 않는다.
ACTING = {
    'CH02-L01': '오래 기다린 형을 발견하고 반가워서 달려가며 크게 부른다',
    'CH02-L03': '공책의 한자를 신기하게 들여다보며 혼잣말처럼',
    'CH02-L05': '형을 올려다보며 궁금하고 들뜬 목소리로',
    'CH02-L08': '사진 속 굳은 자기 얼굴을 보고 쑥스러워 투덜대듯 웃으며',
    'CH03-L02': '사람들 틈에서 엄마 손을 놓치고 공포에 질려 울음 섞어 비명처럼 외친다',
    'CH04-P01-L01': '추위에 떨고 울음을 참으며 낯선 사람에게 조심스럽게 도움을 청한다',
    'CH04-P02-O02-v2': '실망해서 고개를 떨구고 아주 작게',
    'CH04-P03-L01': '엄마 모습을 떠올리려 애쓰다 말끝이 흐려지고, 마지막에 사진이 생각나 희망에 차서 급하게',
    'CH04-L03': '보따리를 다 뒤졌는데 없어서 목이 메어 울먹이며',
    'CH04-L05': '엄마 말을 붙잡듯 떨리는 목소리로 또박또박',
    'CH04-P06-O01': '끌려가면서 뒤돌아 고개 숙여 인사하며 크게',
    'CH04-P06-O02': '끌려가면서 뒤돌아 고개 숙여 인사하며 크게',
    'CH05-L01': '장터에서 손님을 부르는 씩씩한 외침, 지친 기색은 감추고',
    'CH05-P01-L01': '반가움 반, 기대 반으로 조심스럽게 묻는다. 글을 모르는 게 조금 부끄럽다',
    'CH05-P02-O01': '실망을 감추고 다시 힘을 내서',
    'CH06-L01': '해 질 녘 빈 다리에서 혼잣말로, 자신을 달래듯 조용히',
    'CH06-P01-L01': '지쳤지만 담담하게, 마지막 말에서 불안이 묻어난다',
    'CH06-P03-L01': '망설이다가 간절하게, 작은 목소리로',
    'CH06-P04-O01': '처음으로 작게 웃으며 안심한 목소리로',
}

AGE = {'CH01': 8, 'CH02': 9, 'CH03': 9, 'CH04': 9, 'CH05': 10, 'CH06': 12}
SAY = [('6·25전쟁', '육이오 전쟁'), ('6·25', '육이오'), ('1,020여 개', '천이십여 개'),
       ('11만 9천 개', '십일만 구천 개'), ('12만여 명', '십이만여 명'), ('—', ', ')]


def spoken(t):
    for a, b in SAY:
        t = t.replace(a, b)
    return re.sub(r'\s+', ' ', t).strip()


def prompt(style, text):
    return (f'[연출 메모 — 이 메모는 절대 소리 내어 읽지 마세요]\n{style}\n\n'
            f'[아래 따옴표 안의 한국어 문장만, 한 글자도 더하거나 빼지 말고 읽으세요]\n"{spoken(text)}"')


def call(text_prompt, voice):
    key = os.environ['GEMINI_API_KEY']
    body = {'contents': [{'parts': [{'text': text_prompt}]}],
            'generationConfig': {'responseModalities': ['AUDIO'],
                                 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': voice}}}}}
    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
        data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'x-goog-api-key': key})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.load(r)
            part = data['candidates'][0]['content']['parts'][0]['inlineData']
            return base64.b64decode(part['data'])
        except urllib.error.HTTPError as e:
            msg = e.read().decode()[:300]
            if e.code in (429, 500, 503):
                time.sleep(20 * (attempt + 1)); continue
            raise SystemExit(f'Gemini 오류 {e.code}: {msg}')
    raise SystemExit('Gemini가 계속 응답하지 않습니다.')


def to_mp3(pcm, path):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', '-',
                    '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,'
                           'silenceremove=start_periods=1:start_threshold=-50dB,areverse,'
                           'adelay=150,apad=pad_dur=0.25,loudnorm=I=-16:TP=-1.5',
                    '-ar', '44100', '-c:a', 'libmp3lame', '-q:a', '2', path], input=pcm, check=True)


_model = None
def heard(path):
    global _model
    import numpy as np
    from faster_whisper import WhisperModel
    _model = _model or WhisperModel('medium', device='cpu', compute_type='int8')
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'],
                         capture_output=True).stdout
    segs, _ = _model.transcribe(np.frombuffer(raw, np.int16).astype(np.float32) / 32768, language='ko')
    return ''.join(s.text for s in segs)


def clean(script, path):
    norm = lambda t: re.sub(r'[^가-힣0-9]', '', t)
    a, b = norm(spoken(script)), norm(heard(path))
    ratio = difflib.SequenceMatcher(None, a, b).ratio()
    return (ratio >= 0.6 or len(a) <= 3) and len(b) <= len(a) * 1.25 + 4, ratio, b


def record(script, style, voice, path, tries=4):
    best = None
    for n in range(tries):
        to_mp3(call(prompt(style, script), voice), path)
        ok, ratio, b = clean(script, path)
        print(f'  {"ok " if ok else "다시"} {ratio:.2f} {os.path.basename(path)} | {b}', flush=True)
        if ok:
            return True
        best = best or path
    return False


def kid_lines(data):
    for ch in data['chapters']:
        if ch['id'] not in AGE: continue
        for c in ch['cuts']:
            items = [l for l in c['lines'] if l['who'] == '민우']
            items += [o['reply'] for o in c.get('options') or []
                      if o.get('reply') and o['reply'].get('voice') and o['reply']['who'] == '민우']
            for l in items:
                yield AGE[ch['id']], l
    for b in data.get('branches', []):
        for l in b['lines']:
            if l['who'] == '민우': yield 9, l


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'sample'
    data = json.load(open(STORY))
    vdir = os.path.join(ROOT, 'assets', 'audio', 'voices')
    ndir = os.path.join(ROOT, 'assets', 'audio', 'narration')
    failed = []
    if mode == 'sample':
        out = os.path.join(ROOT, 'samples'); os.makedirs(out, exist_ok=True)
        for v in sys.argv[2:] or ['Leda', 'Puck', 'Zephyr', 'Aoede']:
            record('저기… 안녕하세요. 저 민우예요. 엄마를 잃어버렸어요. 같이 찾아 줄 수 있어요?',
                   KID_STYLE[9] + '. ' + ACTING['CH04-P01-L01'], v, f'{out}/kid-{v}.mp3', 2)
        for v in ['Sulafat', 'Achernar', 'Vindemiatrix', 'Leda']:
            record('그날 밤, 기차를 놓친 어머니는 끝내 다리까지 가지 못했어요. 어머니는 무너진 개성 집으로 돌아왔어요.',
                   NARRATOR_STYLE, v, f'{out}/narrator-{v}.mp3', 2)
    if mode == 'minwoo':
        done = {}
        for age, l in kid_lines(data):
            base = re.sub(r'(-acted-v3|-fix|-kid)?\.mp3$', '', l['voice'])
            name = f'{base}-gem.mp3'
            if name not in done:
                style = KID_STYLE[age] + '. ' + ACTING.get(base, '')
                done[name] = record(l['text'], style, KID_VOICE, os.path.join(vdir, name))
                if not done[name]: failed.append(name)
            if done[name]: l['voice'] = name
    if mode == 'narration':
        for c in [c for ch in data['chapters'] for c in ch['cuts']] + data.get('branches', []):
            if c.get('narrationVoice') and c.get('narration'):
                name = c['id'] + '-gem.mp3'
                if record(c['narration'], NARRATOR_STYLE, NARRATOR_VOICE, os.path.join(ndir, name)):
                    c['narrationVoice'] = name
                else:
                    failed.append(name)
    json.dump(data, open(STORY, 'w'), ensure_ascii=False, indent=2)
    print('\n실패(이전 음성 유지):', failed or '없음')


if __name__ == '__main__':
    main()
