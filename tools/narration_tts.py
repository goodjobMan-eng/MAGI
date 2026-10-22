"""해설(내레이션) 음성 만들기.

story/chapters.json 의 narration 글을 읽어 assets/audio/narration/<컷ID>.mp3 를 만들고,
컷에 narrationVoice 와 자동 넘김용 dur 를 다시 적는다.

- 대본(text)과 연기 지시(voice/rate)를 섞지 않는다. 지시문이 더빙되는 사고를 막기 위해
  TTS에는 읽을 글만 넣는다.
- 만든 뒤에는 tools/check_voices.py 로 받아쓰기 검수를 한다.

사용: pip install edge-tts && python3 tools/narration_tts.py [--force]
"""
import asyncio, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORY = os.path.join(ROOT, 'story', 'chapters.json')
OUT = os.path.join(ROOT, 'assets', 'audio', 'narration')
VOICE = 'ko-KR-SunHiNeural'   # 동화 구연 해설자 한 명으로 통일
RATE = '-8%'
SKIP = {'CH01-T16', 'CH12-T07', 'CH12-T06a'}  # 제목, 크레딧, 민우의 손편지는 소리 없이

# 글자로는 맞지만 기계가 잘못 읽는 표기
SAY = [('6·25전쟁', '육이오 전쟁'), ('6·25', '육이오'), ('1,020여 개', '천이십여 개'),
       ('11만 9천 개', '십일만 구천 개'), ('12만여 명', '십이만여 명'), ('—', ', ')]


def spoken(text):
    for a, b in SAY:
        text = text.replace(a, b)
    return re.sub(r'\s+', ' ', text).strip()


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'csv=p=0', path], capture_output=True, text=True).stdout
    return float(out.strip() or 0)


async def make(text, path):
    import edge_tts
    await edge_tts.Communicate(spoken(text), VOICE, rate=RATE).save(path)


def main():
    force = '--force' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    data = json.load(open(STORY))
    manifest = os.path.join(OUT, 'manifest.json')
    made = json.load(open(manifest)) if os.path.exists(manifest) else {}
    cuts = [c for ch in data['chapters'] for c in ch['cuts']] + data.get('branches', [])
    for c in cuts:
        text = c.get('narration')
        if not text or c['id'] in SKIP:
            c.pop('narrationVoice', None)
        else:
            name = c['id'] + '.mp3'
            path = os.path.join(OUT, name)
            if force or not os.path.exists(path) or made.get(name) != text:
                asyncio.run(make(text, path))
                made[name] = text
                print('made', name)
            if not str(c.get('narrationVoice','')).endswith('-gem.mp3'): c['narrationVoice'] = name
        # 자동 넘김 시간: 해설 + 대사 + 숨 고르기
        voices = [os.path.join(OUT, c['narrationVoice'])] if c.get('narrationVoice') else []
        voices += [os.path.join(ROOT, 'assets', 'audio', 'voices', l['voice'])
                   for l in c.get('lines', []) if l.get('voice')]
        if voices:
            total = sum(duration(v) for v in voices) + 0.5 * (len(voices) - 1) + 1.6
            c['dur'] = round(max(3.0, total), 2)
    json.dump(made, open(manifest, 'w'), ensure_ascii=False, indent=1)
    json.dump(data, open(STORY, 'w'), ensure_ascii=False, indent=2)


if __name__ == '__main__':
    main()
