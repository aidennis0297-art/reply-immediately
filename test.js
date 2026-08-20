// node test.js — 형식 파싱과 멘트 풀을 검증한다. 실패하면 즉시 던진다.
const fs = require('fs'), assert = require('assert'), path = require('path');
const dir = __dirname;

// ---- sw.js 의 parse() 만 꺼내온다 ----
global.importScripts = () => {};
global.self = global;
const parseLines = eval(fs.readFileSync(path.join(dir, 'sw.js'), 'utf8')
  .replace(/^importScripts.*$/m, '')
  .replace(/chrome\.(commands|runtime)[\s\S]*$/, '') + '\nparse');

const sample = `1. [일반] 오늘도 잘하고 있어!
2. [팁] Ctrl+F 로 찾으면 빨라.
3. [주의] 결제 버튼 옆에 구독 체크 있어.
4. [정보] 이 사이트 공지 떴어.
5. 태그 없는 줄도 받아줌
6) 괄호 번호도 받아줌
7. [일반] "따옴표는 벗긴다"
쓰레기 줄은 무시된다
8. [이상한태그] 모르는 태그는 일반 취급
9. [일반] ${'가'.repeat(70)}
10. [일반] 마지막 줄`;

const r = parseLines(sample);
assert.equal(r.length, 9, '70자 줄은 버리고 9개가 남아야 함: ' + r.length);
assert.deepEqual(r[0], { text: '오늘도 잘하고 있어!', kind: '' });
assert.equal(r[1].kind, 'tip');
assert.equal(r[2].kind, 'warn');
assert.equal(r[3].kind, 'info');
assert.equal(r[4].text, '태그 없는 줄도 받아줌');
assert.equal(r[5].text, '괄호 번호도 받아줌');
assert.equal(r[6].text, '따옴표는 벗긴다');
assert.equal(r[7].kind, '', '모르는 태그는 일반');
assert.equal(r[8].text, '마지막 줄');
assert.deepEqual(parseLines('설명 없이 그냥 문장만 왔을 때'), [], '번호 없는 응답은 전부 버린다');
assert.equal(parseLines(Array.from({ length: 20 }, (_, i) => `${i + 1}. 줄`).join('\n')).length, 10, '10개까지만');

// ---- 멘트 풀 ----
require(path.join(dir, 'lines.js'));
const L = globalThis.CB_LINES;
assert.equal(L.bond.length, 100, '애정도 멘트는 정확히 100개');
for (const k of ['basic', 'commu', 'tsun', 'sunbi']) {
  assert.ok(L[k].length >= 40, k + ' 풀이 너무 작다');
  assert.equal(new Set(L[k]).size, L[k].length, k + ' 에 중복 있음');
  for (const s of L[k]) {
    const body = s.replace(/^\d+-\d+\|/, '');
    assert.ok(body.length <= 40, k + ' 줄이 너무 김: ' + body);
    assert.ok(!/^\d+-\d+\|/.test(body), k + ' 시간대 접두사 중복: ' + s);
  }
}

// ---- 말투 키가 프롬프트와 짝이 맞는지 ----
eval(fs.readFileSync(path.join(dir, 'prompts.js'), 'utf8'));
for (const k of ['basic', 'commu', 'tsun', 'sunbi']) {
  assert.ok(self.CB_PROMPTS[k], k + ' 프롬프트 없음');
  assert.ok(self.CB_PROMPTS[k].includes('[출력 형식]'), k + ' 프롬프트에 출력 형식 없음');
}

// ---- 스프라이트 ----
require(path.join(dir, 'dog.js'));
const D = globalThis.CB_DOG;
for (const [st, frames] of Object.entries(D.FRAMES)) {
  for (const f of frames) {
    assert.equal(f.length, D.H, st + ' 프레임 높이 불일치');
    for (const row of f) assert.equal(row.length, D.W, st + ' 행 너비 불일치');
  }
}
assert.ok(D.SPEED.walk < D.SPEED.sleep, '걷기가 자기보다 빨라야 함');

// ---- 확장 패키징 규칙 ----
// 크롬은 '_' 로 시작하는 파일·폴더 이름을 시스템 예약으로 보고 확장 로드를 거부한다.
for (const f of fs.readdirSync(dir)) {
  assert.ok(!f.startsWith('_'), "'_' 로 시작하는 이름은 크롬이 거부한다: " + f);
}
const mf = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const refs = [
  mf.background.service_worker,
  ...mf.content_scripts.flatMap((c) => c.js),
  mf.action.default_popup,
  ...Object.values(mf.icons),
  'fonts/Galmuri11.woff2',           // content.js 와 popup.html 이 이 경로를 쓴다
];
for (const f of refs) {
  assert.ok(fs.existsSync(path.join(dir, f)), 'manifest/코드가 가리키는 파일이 없다: ' + f);
}
for (const f of ['content.js', 'popup.html']) {
  assert.ok(fs.readFileSync(path.join(dir, f), 'utf8').includes('fonts/Galmuri11.woff2'),
    f + ' 의 폰트 경로가 바뀌었다');
}

// ---- 애정도: 10번마다 한 칸, 1000번이면 만렙 ----
const store = { pets: 0 };
global.chrome = {
  storage: {
    local: { get: async (d) => ({ ...d, ...store }), set: async (o) => Object.assign(store, o) },
    session: { get: async (d) => d, set: async () => {} },
  },
};
const doPet = eval(fs.readFileSync(path.join(dir, 'sw.js'), 'utf8')
  .replace(/^importScripts.*$/m, '')
  .replace(/chrome\.(commands|runtime)[\s\S]*$/, '') + '\npet');

(async () => {
  const ups = [];
  for (let i = 1; i <= 1010; i++) {
    const res = await doPet();
    if (res.line) ups.push({ at: i, level: res.level, line: res.line });
  }
  assert.equal(ups.length, 100, '레벨업은 정확히 100번: ' + ups.length);
  assert.deepEqual(ups[0], { at: 10, level: 1, line: L.bond[0] });
  assert.deepEqual(ups[99], { at: 1000, level: 100, line: L.bond[99] });
  assert.equal(store.pets, 1010);
  assert.equal((await doPet()).level, 100, '1000번을 넘어도 100레벨에서 멈춘다');

  console.log('통과: parse %d케이스, 멘트 %d개, 스프라이트 %d상태, 애정도 %d단계',
    r.length, Object.values(L).flat().length, Object.keys(D.FRAMES).length, ups.length);
})();
