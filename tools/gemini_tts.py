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

# 연기 지시는 영어로 적는다(한국어 지시는 모델이 소리 내어 읽는 일이 잦았다).
KID_STYLE = {
    8: 'an 8-year-old Korean boy, voiced by a professional anime child voice actor: high, clear, cute, crisp diction',
    9: 'a 9-year-old Korean boy, voiced by a professional anime child voice actor: high, clear child voice',
    10: 'a 10-year-old Korean boy, anime child voice actor: a child voice, brave but fragile',
    12: 'a 12-year-old Korean boy before his voice changes, anime child voice actor',
}
NARRATOR_STYLE = ('A warm female Korean picture-book narrator reading to a child at bedtime: gentle, soft, unhurried, '
                  'softly lowering at the end of each sentence; quiet and tender on sad lines.')

ACTING = {
    'CH02-L01': 'spots his long-awaited big brother and shouts happily while running to him',
    'CH02-L03': 'marveling at the Chinese characters in the notebook, almost to himself',
    'CH02-L05': 'looking up at his brother, curious and excited',
    'CH02-L08': 'embarrassed at his stiff face in the photo, grumbling with a laugh',
    'CH03-L02': 'loses his mother\'s hand in a crowd; screams in terror, about to cry',
    'CH04-P01-L01': 'shivering, holding back tears, carefully asking a stranger for help',
    'CH04-P02-O02-v2': 'disappointed, head down, very small voice',
    'CH04-P03-L01': 'struggling to recall his mother\'s face, trailing off; then suddenly remembers the photo and speaks fast with hope',
    'CH04-L03': 'searched the whole bundle and found nothing; choked up, on the verge of tears',
    'CH04-L05': 'trembling, clinging to his mother\'s words, speaking each word carefully',
    'CH04-P06-O01': 'being pulled away, turns back and bows, saying it loudly',
    'CH04-P06-O02': 'being pulled away, turns back and bows, saying it loudly',
    'CH05-L01': 'a shoeshine boy calling out to customers in a market, cheerful, hiding his tiredness',
    'CH05-P01-L01': 'half glad, half hopeful, asking carefully; a little ashamed he cannot read',
    'CH05-P02-O01': 'hiding disappointment and finding courage again',
    'CH06-L01': 'alone on an empty bridge at dusk, quietly to himself, comforting himself',
    'CH06-P01-L01': 'tired but calm; anxiety shows in the last sentence',
    'CH06-P03-L01': 'hesitates, then asks earnestly in a small voice',
    'CH06-P04-O01': 'smiling a little for the first time, relieved',
}

AGE = {'CH01': 8, 'CH02': 9, 'CH03': 9, 'CH04': 9, 'CH05': 10, 'CH06': 12}
SAY = [('6·25전쟁', '육이오 전쟁'), ('6·25', '육이오'), ('1,020여 개', '천이십여 개'),
       ('11만 9천 개', '십일만 구천 개'), ('12만여 명', '십이만여 명'), ('—', ', ')]


def spoken(t):
    for a, b in SAY:
        t = t.replace(a, b)
    return re.sub(r'\s+', ' ', t).strip()


def prompt(style, text):
    return (f"# AUDIO PROFILE\n{style}\n## DIRECTOR'S NOTES\nSpeak only the transcript, in Korean. "
            f"Do not read these notes.\n## TRANSCRIPT\n{spoken(text)}")


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
                   KID_STYLE[9] + '. Scene: ' + ACTING['CH04-P01-L01'], v, f'{out}/kid-{v}.mp3', 2)
        for v in ['Sulafat', 'Achernar', 'Vindemiatrix', 'Leda']:
            record('그날 밤, 기차를 놓친 어머니는 끝내 다리까지 가지 못했어요. 어머니는 무너진 개성 집으로 돌아왔어요.',
                   NARRATOR_STYLE, v, f'{out}/narrator-{v}.mp3', 2)
    if mode == 'minwoo':
        done = {}
        for age, l in kid_lines(data):
            base = re.sub(r'(-acted-v3|-fix|-kid)?\.mp3$', '', l['voice'])
            name = f'{base}-gem.mp3'
            if name not in done:
                style = KID_STYLE[age] + '. Scene: ' + ACTING.get(base, 'natural')
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
