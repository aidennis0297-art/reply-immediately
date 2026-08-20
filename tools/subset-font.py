# -*- coding: utf-8 -*-
"""팝업에 쓰이는 글자만 남긴 작은 폰트를 만든다 (fonts/Galmuri11-ui.woff2).

팝업 문구는 고정이라 493KB 전체를 받을 이유가 없다 — 받으면 창이 늦게 뜬다.
popup.html 이나 popup.js 의 문구를 바꾸면 이걸 다시 돌려야 새 글자가 들어간다.

    pip install fonttools brotli
    python tools/subset-font.py
"""
import io, re, os, subprocess, sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
SRC = BASE + 'fonts/Galmuri11.woff2'
OUT = BASE + 'fonts/Galmuri11-ui.woff2'

h = io.open(BASE + 'popup.html', encoding='utf-8').read()
j = io.open(BASE + 'popup.js', encoding='utf-8').read()

# 화면에 나올 수 있는 글자를 모은다
text = re.sub(r'<style[\s\S]*?</style>', '', h)
text = re.sub(r'<script[\s\S]*?</script>', '', text)
text = re.sub(r'<[^>]+>', ' ', text)
chars = set(text)
# popup.js 안의 문자열 리터럴 (라벨·안내문이 여기 있다)
for m in re.finditer(r"'([^'\\\n]*)'|\"([^\"\\\n]*)\"|`([^`\\]*)`", j):
    chars |= set(m.group(1) or m.group(2) or m.group(3) or '')
# 숫자와 흔한 기호는 넉넉히
chars |= set('0123456789%·/()[]{}<>+-=~!?.,:;\'"#&*|\\ ')
chars |= set('가나다라마바사아자차카타파하')      # 혹시 모를 여유
chars -= {'\n', '\r', '\t'}

txt = BASE + 'fonts/_subset_chars.txt'
io.open(txt, 'w', encoding='utf-8').write(''.join(sorted(chars)))

cmd = [sys.executable, '-m', 'fontTools.subset', SRC,
       '--text-file=' + txt, '--flavor=woff2', '--output-file=' + OUT,
       '--layout-features=*', '--no-hinting']
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    print('실패:', r.stderr[-800:])
    raise SystemExit(1)
os.remove(txt)
print('글자 %d자 → %s (%d bytes, 원본 %d bytes)' % (
    len(chars), os.path.basename(OUT), os.path.getsize(OUT), os.path.getsize(SRC)))
