"""인물별 일괄 녹음: 한 인물의 대사를 한 번에 녹음하고 침묵 구간으로 잘라 대사마다 나눈다.
- 같은 호출 안에서 녹음하므로 목소리가 장면마다 바뀌지 않는다.
- 나눈 조각마다 받아쓰기로 대본과 맞춰 보고, 개수가 안 맞거나 틀리면 그 인물만 다시 녹음한다(최대 3번).
- 끝의 '치익' 잡음은 trim_tail로 지운다.
사용: GEMINI_API_KEY=... python3 tools/cast_batch.py [인물키 ...]
"""
import json, os, re, subprocess, sys, difflib
sys.path.insert(0, os.path.dirname(__file__))
import gemini_tts as g
from trim_tail import trim

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VDIR = os.path.join(ROOT, 'assets', 'audio', 'voices'); NDIR = os.path.join(ROOT, 'assets', 'audio', 'narration')

# (컷, 대사 자리, 대본, 연기 메모)  자리: 숫자=lines[k], 'opt0'=options[0].reply, 'nar'=해설, 'add'=새 대사 추가
CAST = {
 'gu': dict(voice='Charon', name='구 작가', who='구 작가', base='CH01-gu', profile=
   'a Korean man in his forties, a gentle photographer and writer from Seoul who fled the North alone, educated standard Seoul accent, warm, a quiet shadow of homesickness', lines=[
   ('CH01-B04', 0, '밥까지 얻어먹었으니 값은 해야지. 식구들 사진 한 장 찍어 드리리다.', 'grateful for the meal, a light friendly joke, smiling as he offers to take a photo'),
   ('CH01-B07', 0, '어머니, 사진은 남습니다.', 'quiet regret about what he himself could not do; he never took a photo of his own family; slow, heartfelt, a little sad'),
   ('CH01-B08', 0, '해방되고, 이북에선 글을 마음대로 쓸 수가 없어서… 저 혼자 내려왔지요. 금방 다시 올라갈 줄 알고… 원산 식구들 사진 한 장 못 챙겼어요. 이제는… 삼팔선이 막혀서.', 'confessing, eyes lowered, pausing with sorrow; voice almost breaking at the end'),
   ('CH01-B11', 0, '자네가 한번 들여다보게.', 'kind and encouraging, handing the camera to the young man'),
   ('CH01-B14b', 0, '그래서 사진이 재밌는 거야.', 'watching the young man look into a camera for the first time, warmly amused and pleased, a soft chuckle in the voice'),
   ('CH01-B15', 0, '자, 움직이지 마시고요. 하나, 둘—', 'focused and cheerful photographer counting slowly'),
   ('CH02-B14', 0, '늦어서 미안하오. 두 장 넣소.', 'reading his own short letter, plain and kind, slightly apologetic'),
   ('CH12-B01', 0, '자, 움직이지 마시고요. 하나, 둘—', 'focused and cheerful photographer counting slowly'),
   ('CH12-P01', 0, '셋!', 'bright and clear, the shutter moment')]),
 'mom': dict(voice='Achernar', name='어머니', who='어머니', base='CH01-mom', profile=
   'a Korean countrywoman in her late thirties, warm, gentle, soft-spoken, her sentence endings trailing softly', lines=[
   ('CH01-B05', 0, '아이고… 이 꼴로 무슨 사진을요. 애 아버지도 없는 집에서…', 'embarrassed and shy, waving it off, a little sad about her husband'),
   ('CH01-B09', 0, '…그럼, 잠깐만 기다리세요.', 'moved by his story: pity for him and gratitude for his kindness; soft, gentle decision'),
   ('CH02-B17', 0, '한 장은 니가 가져가라.', 'tender and loving to her son, warm smile in the voice'),
   ('CH03-B04', 0, '민우야, 손 놓지 마라.', 'tense, firm and worried in a jostling crowd'),
   ('CH03-B06m', 0, '민우야!', 'screaming her son\'s name in panic as the crowd tears him away'),
   ('CH03-B10', 0, '민우야— 임진강 다리에서— 다리에서 만나자!', 'shouting with all her strength across a noisy station to her son far away on a moving train, desperate, voice cracking')]),
 'minseok': dict(voice='Achird', name='민석', who='민석', base='CH01-ms', profile=
   'an 18-year-old Korean country boy, kind big brother, warm and a bit clumsy in speech, speaking at a relaxed natural pace', lines=[
   ('CH01-B14', 0, '야… 다 거꾸로 보이네요.', 'amazed, looking into a camera for the first time, delighted'),
   ('CH02-B08', 0, '이건 니 이름. 이건 형 이름.', 'gently teaching his little brother, slow and clear, affectionate'),
   ('CH02-B10', 0, '유월엔 학교 가라. 형이 월급 모아 놨다.', 'proud and caring, a little shy'),
   ('CH02-B12', 0, '사진기 하나 사서… 신문에 사진 싣는 사람 될 거다. 작년 그 구 선생처럼.', 'dreamy, looking far away, hopeful'),
   ('CH02-B16', 'add', '하하하! 하하, 민우야, 니 얼굴 좀 봐라. 하하하!', 'bursting into a bright, warm, natural laugh at his little brother\'s stiff face in the photo'),
   ('CH12-B03', 0, '웃어, 민우야.', 'a gentle whisper, smiling, squeezing his brother\'s shoulders')]),
 'kid': dict(voice='Aoede', name='민우', who='민우', base='CH05-kid', profile=g.KID_STYLE[10], lines=[
   ('CH05-B02', 0, '구두 닦아요! 구두!', 'a 10-year-old shoeshine boy calling out loudly to customers in a busy market, cheerful, hiding his tiredness'),
   ('CH05-B08', 0, '오늘은 없네. 내일 신문에는 있을지도 몰라.', 'quietly to himself, folding the newspaper, disappointed but holding on to hope')]),
 'old': dict(voice='Algenib', name='노인 민우', who='민우', base='CH10-old', profile=
   'a Korean grandfather around seventy, a refugee from Kaesong, low warm slightly husky voice, slow old-fashioned speech', lines=[
   ('CH09-B05', 0, '엄마, 나 개성 왔어요. …엄마는 그날 임진강 다리까지 오셨어요?', 'alone on a small bridge in his lost hometown, whispering to his mother, voice trembling'),
   ('CH10-P01', 'opt0', '어서 오게. 이 추운 날 멀리서들 왔구먼.', 'children greet him on a snowy morning; he looks up and answers with a warm gentle smile'),
   ('CH10-P02', 'opt1', '우리 형 이름이네. 어릴 적엔 이 글자를 못 읽었지.', 'softly, looking down at the paper, a faint wistful smile'),
   ('CH10-P03', 0, '상에는 돌아가신 분만 올리는 거라네. 우리 어머니랑 형은… 돌아가셨는지, 살아 계신지도 아직 모르니까. 형은 일흔을 훌쩍 넘었고, 어머니는 살아 계시면 아흔도 넘으셨겠지. 그래도… 혹시 모르는 거 아닌가.', 'explaining calmly to children; bitter, a faint stubborn hope at the end'),
   ('CH10-B07', 0, '가 봤지요. 선죽교도 건너 보고. 그런데 우리 집은 버스 창으로만 봤어요. 내려 달란 말을 못 했지. …이젠 그 버스도 끊겼네요. 저 강 건너 오십 리, 걸어서 하룻길인데.', 'to another old refugee, looking across the river, quiet regret'),
   ('CH10-B09', 0, '김민석. 쇠 김, 민첩할 민, 주석 석.', 'saying his brother\'s name slowly, character by character, with bitter calm'),
   ('CH11-B07', 0, '…형아.', 'touching his big brother\'s face in an old photo after 66 years, a choked tender whisper')]),
 'sg': dict(voice='Kore', name='성구 어머니', who='성구 어머니', base='CH04-sg', profile='a Korean neighbor woman in her forties, strong and practical', lines=[
   ('CH04-B06', 0, '민우야, 가자. 강 건너야 산다.', 'shouting urgently to a boy who is talking to someone else, pulling him away in a hurry, out of breath')]),
 'police': dict(voice='Alnilam', name='순경', who='순경', base='CH04-pol', profile='a Korean policeman interpreting for soldiers at a chaotic night station', lines=[
   ('CH04-B02', 1, '내려요! 군용열차요, 다들 내려!', 'shouting loudly and urgently over a panicking crowd, commanding')]),
 'soldier': dict(voice='Orus', name='병사', who='병사', base='CH04-sol', profile='an American soldier in 1950, tense and loud', lines=[
   ('CH04-B02', 0, 'Off! Everybody off!', 'barking orders at refugees on top of a train, urgent, in English')]),
 'nar': dict(voice='Sulafat', name='해설', who=None, base='NAR', profile=g.NARRATOR_STYLE, lines=[
   ('CH09-B01', 'nar', None, 'calm and gentle'),
   ('CH10-B02', 'nar', None, 'calm and gentle'),
   ('CH10-B05', 'nar', None, 'quiet, a little sad'),
   ('CH04-P02x', 'nar', None, 'gentle, encouraging the child to try again')]),
}


def load(): return json.load(open(os.path.join(ROOT, 'story', 'chapters.json')))


def find(d, cid):
    for c in [c for ch in d['chapters'] for c in ch['cuts']] + d.get('branches', []):
        if c['id'] == cid: return c


def batch_prompt(profile, items):
    notes = '\n'.join(f'Line {i+1}: {a}' for i, (_, _, _, a) in enumerate(items))
    script = '\n\n'.join(g.spoken(t) for _, _, t, _ in items)
    return (f"# AUDIO PROFILE\nVoice actor playing {profile}.\n## DIRECTOR'S NOTES\n"
            f"Perform each line of the transcript with its own emotion below, in Korean, as a professional voice actor. "
            f"Leave about two seconds of complete silence between lines. Speak only the transcript; do not read these notes.\n"
            f"{notes}\n## TRANSCRIPT\n{script}")


def split(path, n):
    import numpy as np
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True).stdout
    a = np.frombuffer(raw, np.int16).astype(float); w = 320
    e = np.array([20 * np.log10(np.sqrt((a[i:i+w]**2).mean()) + 1) for i in range(0, len(a) - w, w)])
    loud = e > e.max() - 38
    gaps = []; i = 0
    while i < len(loud):
        if not loud[i]:
            j = i
            while j < len(loud) and not loud[j]: j += 1
            gaps.append((i, j)); i = j
        else: i += 1
    inner = [gp for gp in gaps if gp[0] > 0 and gp[1] < len(loud)]
    inner.sort(key=lambda x: x[1] - x[0], reverse=True)
    cuts = sorted(inner[:n-1])
    if len(cuts) != n - 1 or any(b - a < 25 for a, b in cuts): return None   # 0.5초보다 짧은 쉼은 대사 구분이 아님
    bounds = [0] + [(a + b) // 2 for a, b in cuts] + [len(loud)]
    return [(bounds[k] * w / 16000, bounds[k+1] * w / 16000) for k in range(n)]


def record_char(key):
    C = CAST[key]; d = load(); items = []
    for cid, slot, text, act in C['lines']:
        if slot == 'nar': text = find(d, cid)['narration']
        items.append((cid, slot, text, act))
    tmp = os.path.join(ROOT, 'samples', f'batch-{key}.mp3'); os.makedirs(os.path.dirname(tmp), exist_ok=True)
    for attempt in range(3):
        if len(items) == 1:
            ok = g.record(items[0][2], C['profile'] + '. Scene: ' + items[0][3], C['voice'], tmp, 3)
            segs = [(0, 999)] if ok else None
        else:
            g.to_mp3(g.call(batch_prompt(C['profile'], items), C['voice']), tmp)
            segs = split(tmp, len(items))
        if not segs: print(' 나누기 실패, 다시', key, flush=True); continue
        outs = []; good = True
        for k, ((cid, slot, text, act), (s, e)) in enumerate(zip(items, segs)):
            out = os.path.join(NDIR if slot == 'nar' else VDIR, f"{cid}-{'nar' if slot=='nar' else 'cast'}.mp3")
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{s:.3f}', '-to', f'{e:.3f}', '-i', tmp,
                            '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,adelay=120,apad=pad_dur=0.25',
                            '-c:a', 'libmp3lame', '-q:a', '2', out], check=True)
            trim(out)
            ok, ratio, heard = g.clean(text, out)
            if text.startswith('Off'): ok = True
            print(f"  {'ok ' if ok else '틀림'} {ratio:.2f} {os.path.basename(out)} | {heard}", flush=True)
            good &= ok; outs.append((cid, slot, text, out))
        if good: break
    else:
        print('일괄 실패, 한 줄씩 녹음', key, flush=True); outs = []
        for cid, slot, text, act in items:
            out = os.path.join(NDIR if slot == 'nar' else VDIR, f"{cid}-{'nar' if slot=='nar' else 'cast'}.mp3")
            if not g.record(text, C['profile'] + '. Scene: ' + act, C['voice'], out, 4): print('실패', cid); continue
            trim(out); outs.append((cid, slot, text, out))
    d = load()
    for cid, slot, text, out in outs:
        c = find(d, cid); name = os.path.basename(out)
        if slot == 'nar': c['narrationVoice'] = name
        elif slot == 'add': c['lines'] = [{'who': C['who'], 'text': text, 'voice': name, 'offscreen': False}]
        elif str(slot).startswith('opt'):
            r = c['options'][int(slot[3:])]['reply'] or {}
            r.update({'who': C['who'], 'text': text, 'voice': name, 'img': r.get('img')}); c['options'][int(slot[3:])]['reply'] = r
        else: c['lines'][slot]['voice'] = name; c['lines'][slot]['text'] = text
        if cid == 'CH04-P02x':
            for o in find(d, 'CH04-P02')['options']:
                if o.get('reply') and o['reply'].get('narration'): o['reply']['narrationVoice'] = name
    json.dump(d, open(os.path.join(ROOT, 'story', 'chapters.json'), 'w'), ensure_ascii=False, indent=2)
    return True


if __name__ == '__main__':
    for key in sys.argv[1:] or CAST:
        print('==', CAST[key]['name'], flush=True); record_char(key)
