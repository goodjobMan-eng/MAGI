"""Gemini(Nano Banana Pro)로 기존 그림을 고쳐 그린다.

사용: GEMINI_API_KEY=... python3 tools/gemini_image.py 원본.webp 결과.webp "고칠 내용" [참고그림.webp ...]
결과는 기존 그림과 같은 1672x941 webp로 저장한다.
"""
import base64, json, os, subprocess, sys, tempfile, urllib.request

MODEL = os.environ.get('GEMINI_IMAGE_MODEL', 'gemini-3-pro-image')
STYLE = ('Keep exactly the same hand-painted 2D Japanese animation film style, palette, line work and lighting as the input. '
         'Korean characters, historically accurate clothing and objects for the period. Anatomically correct: '
         'every person has exactly two arms and two hands, five fingers each. No text, letters or logos. 16:9.')


def png_b64(path):
    out = tempfile.mktemp(suffix='.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path, out], check=True)
    return base64.b64encode(open(out, 'rb').read()).decode()


def edit(src, dst, instruction, refs=()):
    parts = [{'inlineData': {'mimeType': 'image/png', 'data': png_b64(p)}} for p in [src, *refs]]
    parts.append({'text': f'Edit the first image. {instruction}\n{STYLE}'})
    body = {'contents': [{'parts': parts}],
            'generationConfig': {'responseModalities': ['IMAGE'], 'imageConfig': {'aspectRatio': '16:9'}}}
    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
        data=json.dumps(body).encode(),
        headers={'Content-Type': 'application/json', 'x-goog-api-key': os.environ['GEMINI_API_KEY']})
    data = json.load(urllib.request.urlopen(req, timeout=300))
    img = next(p['inlineData']['data'] for p in data['candidates'][0]['content']['parts'] if 'inlineData' in p)
    tmp = tempfile.mktemp(suffix='.png')
    open(tmp, 'wb').write(base64.b64decode(img))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-vf', 'scale=1672:941:flags=lanczos',
                    '-quality', '88', dst], check=True)
    print('saved', dst)


if __name__ == '__main__':
    edit(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:])
