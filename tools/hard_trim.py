"""녹음 끝의 '치지직' 잡음을 찾아 자른다.

Gemini TTS 녹음 끝에는 말이 끝나고 잠깐(0.05초 이상) 조용하다가 0.4초 이하의 짧고 큰 잡음이
붙는 일이 있다. 잡음은 말소리보다 0을 지나는 횟수(영교차율)가 훨씬 많으므로 그것으로 구분한다.
조건에 맞는 마지막 덩어리를 잘라 내고 짧게 페이드아웃한다.

사용: python3 tools/hard_trim.py 파일.mp3 [...]   (--dry 는 찾기만 한다)
"""
import os, subprocess, sys
import numpy as np

SR, W = 16000, 320  # 20ms


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(float)


def find_tail_noise(a):
    n = len(a) // W
    fr = a[:n * W].reshape(n, W)
    e = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1)
    zcr = (np.abs(np.diff(np.sign(fr), axis=1)) > 0).mean(1)
    loud = e > e.max() - 35
    segs, i = [], 0
    while i < n:
        if loud[i]:
            j = i
            while j < n and loud[j]: j += 1
            segs.append([i, j]); i = j
        else:
            i += 1
    cut = None
    while len(segs) > 1:
        s, prev = segs[-1], segs[-2]
        dur, gap = s[1] - s[0], s[0] - prev[1]
        noisy = zcr[s[0]:s[1]].mean() > 0.25
        if dur <= 20 and gap >= 3 and noisy:
            cut = prev[1]; segs.pop()
        else:
            break
    return None if cut is None else cut * W / SR


def hard_trim(path, dry=False):
    a = load(path)
    end = find_tail_noise(a)
    if end is None: return None
    end += 0.06
    if not dry:
        tmp = path + '.tmp.mp3'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, '-t', f'{end:.3f}', '-af',
                        f'afade=t=out:st={max(0, end - 0.08):.3f}:d=0.08,apad=pad_dur=0.3',
                        '-c:a', 'libmp3lame', '-q:a', '2', tmp], check=True)
        os.replace(tmp, path)
    return len(a) / SR, end


if __name__ == '__main__':
    dry = '--dry' in sys.argv
    n = 0
    for p in [x for x in sys.argv[1:] if x != '--dry']:
        r = hard_trim(p, dry)
        if r: n += 1; print(f'{os.path.basename(p)}: {r[0]:.2f}s -> {r[1]:.2f}s')
    print(n, '개 잡음', '(확인만)' if dry else '제거')
