"""착용반 검수(2026-11-05) 반영: 글 고치기 + 바뀐 대사·해설 다시 녹음.

사용: GEMINI_API_KEY=... python3 tools/apply_review_1105.py
"""
import json, os, re, shutil, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import gemini_tts as g
import hard_trim as h

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
STORY = 'story/chapters.json'
d = json.load(open(STORY))
cuts = {c['id']: c for ch in d['chapters'] for c in ch['cuts']}
cuts.update({b['id']: b for b in d.get('branches', [])})
chap = {ch['id']: ch for ch in d['chapters']}
VD, ND = 'assets/audio/voices/', 'assets/audio/narration/'

GU = ('a Korean man in his forties, a gentle photographer and writer from Seoul who fled the North alone, '
      'educated standard Seoul accent, warm, a quiet shadow of homesickness')
MOM = 'a Korean countrywoman in her late thirties, warm, gentle, soft-spoken, her sentence endings trailing softly'
OLD = 'a Korean grandfather around seventy, a refugee from Kaesong, low warm slightly husky voice, slow old-fashioned speech'
KID9 = g.KID_STYLE[9]
KID12 = g.KID_STYLE[12]
BOY10 = 'a 10-year-old Korean BOY (male child, not a woman), anime boy voice actor, boyish, natural pace'
POST = 'a Korean village postman in his fifties in 1950, friendly, knows every family in the village'

jobs = []  # (cut, 'nar' | line index | ('opt', i), text, profile, voice, acting, filter)


def nar(cid, text):
    cuts[cid]['narration'] = text
    jobs.append((cid, 'nar', text, g.NARRATOR_STYLE, 'Sulafat', '', None))


def line(cid, i, text, prof, voice, act, flt=None):
    cuts[cid]['lines'][i]['text'] = text
    jobs.append((cid, i, text, prof, voice, act, flt))


def reply(cid, oi, text, prof, voice, act):
    cuts[cid]['options'][oi]['reply']['text'] = text
    jobs.append((cid, ('opt', oi), text, prof, voice, act, None))


# ── 1장
chap['CH01']['title'] = '사진 찍던 날'
nar('CH01-B02', '열여덟 살 민석이가 손님 한 분을 집으로 모셔 왔어요. 사진을 찍는 구 작가였어요.')
line('CH01-B07', 0, '어머님, 사진은 남습니다.', GU, 'Charon',
     'quiet regret about what he himself could not do; he never took a photo of his own family; slow, heartfelt, a little sad')
line('CH01-B08', 0, '제가 원래 원산에서 식구들과 함께 살았어요. 해방되고 나서, 이북에선 글을 마음껏 쓸 수가 없게 되어서… '
     '저 혼자 글 쓰겠다고 내려왔지요. 언제든 다시 올라갈 수 있을 거라 여겨서, 원산 식구들 사진 한 장을 못 챙겼어요. '
     '그런데 이제는… 삼팔선이 막혀서.', GU, 'Charon',
     'confessing to a woman he just met, eyes lowered, pausing with sorrow, voice catching at the end')
line('CH01-B09', 0, '…그럼, 잠깐만 기다리세요.', MOM, 'Achernar',
     'moved by his story; soft, gentle decision. Start directly with 그럼, no "아" before it')
cuts['CH01-B15']['autoNext'] = 0.7   # "하나, 둘—" 뒤 잠깐 쉬고 바로 번쩍

# ── 2장
nar('CH02-B01', '이듬해 봄, 군인 간 형이 처음으로 휴가를 나왔어요.')
line('CH02-B04', 0, '형아!', KID9, 'Aoede',
     'suddenly spots his long-awaited big brother at the gate; shouts with surprise and pure joy, running barefoot to him')
line('CH02-B13', 0, '민석이 휴가 나왔구먼? 마침 서울서 편지 왔소!', POST, 'Iapetus',
     'cheerful, calling over the fence to a family he knows well')
b15, b16 = cuts['CH02-B15'], cuts['CH02-B16']
b15['lines'].append(b16['lines'][0])   # 웃음은 같은 장면에서 바로 이어지게
chap['CH02']['cuts'] = [c for c in chap['CH02']['cuts'] if c['id'] != 'CH02-B16']

# ── 3장
nar('CH03-T01', cuts['CH03-T01']['narration'].replace('형의 편지는 더 오지', '형의 편지는 더는 오지'))
nar('CH03-B02', cuts['CH03-B02']['narration'])           # '싸움터' 발음 다시
nar('CH03-B06', '꼭 잡았던 손을… 놓치고 말았어요.')
line('CH03-B08', 0, '엄마!', KID9, 'Aoede',
     'his mother\'s hand is torn away in a crushing crowd; a sudden piercing scream of terror, much louder and more shocked')

# ── 4장
nar('CH04-B03', '사람들은 모두 기차에서 내려야 했어요. 민우는 성구 어머니를 따라 눈 덮인 들판으로 내렸어요. '
    '그래도 민우는 엄마를 찾고 싶었어요.')
nar('CH04-P02x', '그날, 민우를 도와준 사람이 있었어요. 다시 말을 걸어 볼까요?')
nar('CH04-R1', '1950년 12월 31일, 군수물자를 싣고 내려오던 기관차가 장단역에서 멈췄습니다. 퇴각하던 연합군이 기관총을 쏴서 '
    '기관차가 부서졌습니다. 기관차에 남은 총알 자국은 1,020여 개입니다. 이 기관차는 지금 임진각에 있습니다.')

# ── 5장
F112 = "asetrate=44100*1.12,aresample=44100,atempo=1/1.12,equalizer=f=250:t=q:w=1:g=-3,equalizer=f=3500:t=q:w=1:g=2"
line('CH05-P01', 0, '저기요. 혹시 글자 알아요? 우리 형 이름 맞는지 봐 줄 수 있어요? 저는 글을 몰라서, 모양만 맞춰 보거든요.',
     BOY10, 'Puck', 'shyly asking a stranger for help with the newspaper, half hopeful, a little ashamed he cannot read', F112)

# ── 6장
line('CH06-P01', 0, '어? 저번에 글자 알려 준 분이시죠? 여기서 또 뵙네요. …오늘도 형은 없어요. 형이 써 준 글씨, '
     '저는 못 읽어도 모양은 다 외웠어요.', KID12, 'Aoede',
     'recognizes the friendly stranger and brightens a little; then quietly, tired but steady')
chap['CH06']['cuts'] = [c for c in chap['CH06']['cuts'] if c['id'] not in ('CH06-P03', 'CH06-P04')]
line('CH06-B05', 0, '엄마가 다리에서 만나자고 했는데…', KID12, 'Aoede',
     'alone on the emptying bridge at dusk, quietly to himself, puzzled and sad: she said so, why does nobody come')
nar('CH06-B06', '엄마도, 형도, 이 다리로 오지 않았어요.')

# ── 7장
nar('CH07-Y01', '세월이 흘러 민우는 어른이 되었어요. 이제는 형의 이름을 읽을 수 있었지만, 그 이름을 불렀을 때 대답해 줄 사람이 없었어요.')
nar('CH07-B05', '그해 방송으로 만 가족 넘게 다시 만났어요. 하지만 민우의 팻말은, 수많은 팻말 가운데 하나로 남았어요.')

# ── 8장
nar('CH08-B03', '그 뒤로도 민우는 신청서를 거듭 냈지만, 기다리던 소식은 오지 않았어요.')
nar('CH08-B06', '2000년 여름, 남과 북의 이산가족이 서울과 평양에서 서로 만났어요. 그러나 그 명단에도 민우의 이름은 없었어요.')
nar('CH08-B07', '방송이 끝날 때까지, 민우는 차를 한 모금도 마시지 못했어요.')

# ── 9장 (목소리를 그림처럼 덤덤하게)
line('CH09-B05', 0, cuts['CH09-B05']['lines'][0]['text'], OLD, 'Algenib',
     'alone looking toward his lost home; calm, quiet and restrained, almost matter-of-fact, no crying; only a slight tremble on the last word')

# ── 10장
nar('CH10-B04', '다음 종이에는 형의 이름을 썼어요. 어릴 적 형이 공책에 써 준 글씨 그대로, 수없이 따라 써 온 그 모양으로.')
reply('CH10-P01', 0, '어서 오렴. 이 추운 날 멀리서 왔구나.', OLD, 'Algenib',
      'children greet him on a snowy morning; he looks up and answers with a warm gentle smile, like a kind grandpa')
reply('CH10-P02', 1, '우리 형 이름이란다. 어릴 적엔 이 글자를 못 읽었지.', OLD, 'Algenib',
      'softly to a child, looking down at the paper, a faint wistful smile')
line('CH10-P03', 0, '이 종이는 상에 올리지 않을 거란다. 상에는 돌아가신 분만 올리거든. 우리 어머니랑 형은… 돌아가셨는지, '
     '살아 계신지도 아직 모르니까. 형은 일흔을 훌쩍 넘었고, 어머니는 살아 계시면 아흔도 넘으셨겠지. 그래도… 혹시 모르잖니.',
     OLD, 'Algenib', 'gently explaining to a child, slow, a quiet hope under the sadness')
nar('CH10-B06', '그때 옆에서 차례를 지내던 다른 할아버지가 다가와 말을 건넸어요.')
line('CH10-B09', 0, cuts['CH10-B09']['lines'][0]['text'], OLD, 'Algenib',
     'saying his brother\'s name slowly and very clearly, character by character, with bitter calm; clear standard pronunciation of 주석 석')

# ── 11장
nar('CH11-B01', '그로부터 여섯 해 뒤, 파주의 옛 싸움터. 유해발굴감식단이 붓으로 흙을 조심조심 털어 내고 있었어요.')

# ── 에필로그·크레딧
cuts['CH12-D01']['narration'] = cuts['CH12-D01']['narration'].replace('넋과 삶에', '삶과 넋에')
t = cuts['CH12-T07']['narration']
t = t.replace('이야기 다듬기·검수: Anthropic Claude', '이야기 다듬기·검수: Anthropic Claude\n검수: 착용반')
t = t.replace('그림: OpenAI 이미지 생성 · Google Gemini 이미지 생성 (AI 생성)',
              '그림: OpenAI 이미지 생성 · Google Gemini · Google Flow (AI 생성)')
t = t.replace('영상: Google Veo (AI 생성)', '영상: Google Veo · Google Flow (AI 생성)')
cuts['CH12-T07']['narration'] = t

# ── 기록 카드 소제목
for c in cuts.values():
    if isinstance(c.get('caption'), str):
        c['caption'] = c['caption'].replace('그곳에 남은 기록', '실제로 있었던 일')

json.dump(d, open(STORY, 'w'), ensure_ascii=False, indent=2)
print('글 수정 완료. 녹음', len(jobs), '개')

norm = lambda s: re.sub(r'[^가-힣A-Za-z0-9]', '', s)
failed = []
for cid, slot, text, prof, voice, act, flt in jobs:
    c = cuts[cid]
    if slot == 'nar':
        name = f'{cid}-r1105.mp3'; path = ND + name
        style = prof
    else:
        name = f'{cid}-{"o%d" % slot[1] if isinstance(slot, tuple) else "l%d" % slot}-r1105.mp3'; path = VD + name
        style = prof + '. Scene: ' + act
    raw = path + '.raw.mp3'
    ok = g.record(text, style, voice, raw, 4)
    if not ok and len(norm(text)) > 3:
        failed.append(cid); os.remove(raw); continue
    if flt:
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', flt, path], check=True); os.remove(raw)
    else:
        os.replace(raw, path)
    # 끝 잡음: 자른 뒤에도 받아쓰기가 같을 때만 자른다
    if h.hard_trim(path, dry=True):
        tmp = path + '.t.mp3'; shutil.copy(path, tmp); h.hard_trim(tmp)
        if norm(g.heard(tmp)) == norm(g.heard(path)): os.replace(tmp, path)
        else: os.remove(tmp)
    if slot == 'nar': c['narrationVoice'] = name
    elif isinstance(slot, tuple): c['options'][slot[1]]['reply']['voice'] = name
    else: c['lines'][slot]['voice'] = name
    json.dump(d, open(STORY, 'w'), ensure_ascii=False, indent=2)

# 자동 넘김 시간 다시 계산
dur = lambda p: float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p],
                                     capture_output=True, text=True).stdout or 0)
for c in [c for ch in d['chapters'] for c in ch['cuts']] + d.get('branches', []):
    v = ([ND + c['narrationVoice']] if c.get('narrationVoice') else []) + \
        [VD + l['voice'] for l in c.get('lines', []) if l.get('voice')]
    v = [x for x in v if os.path.exists(x)]
    if v: c['dur'] = round(max(3.0, sum(map(dur, v)) + 0.5 * (len(v) - 1) + 1.6), 2)
json.dump(d, open(STORY, 'w'), ensure_ascii=False, indent=2)
print('실패:', failed or '없음')
