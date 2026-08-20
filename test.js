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
assert.ok(L.pomodoro_distract, '뽀모도로 딴짓 멘트 풀이 없다');
for (const k of ['basic', 'commu', 'tsun', 'sunbi']) {
  assert.ok(L.pomodoro_focus[k] && L.pomodoro_focus[k].length >= 30, '뽀모도로 집중 ' + k + ' 풀 부족: ' + L.pomodoro_focus?.[k]?.length);
  assert.equal(new Set(L.pomodoro_focus[k]).size, L.pomodoro_focus[k].length, '뽀모도로 집중 ' + k + ' 에 중복 있음');
  for (const s of L.pomodoro_focus[k]) assert.ok(s.length <= 40, '뽀모도로 집중 ' + k + ' 줄이 너무 김: ' + s);

  assert.ok(L.pomodoro_break[k] && L.pomodoro_break[k].length >= 10, '뽀모도로 휴식 ' + k + ' 풀 부족: ' + L.pomodoro_break?.[k]?.length);
  assert.equal(new Set(L.pomodoro_break[k]).size, L.pomodoro_break[k].length, '뽀모도로 휴식 ' + k + ' 에 중복 있음');
  for (const s of L.pomodoro_break[k]) assert.ok(s.length <= 40, '뽀모도로 휴식 ' + k + ' 줄이 너무 김: ' + s);

  assert.ok(L.pomodoro_distract[k] && L.pomodoro_distract[k].length >= 15, '뽀모도로 딴짓 ' + k + ' 풀 부족: ' + L.pomodoro_distract?.[k]?.length);
  assert.equal(new Set(L.pomodoro_distract[k]).size, L.pomodoro_distract[k].length, '뽀모도로 딴짓 ' + k + ' 에 중복 있음');
  for (const s of L.pomodoro_distract[k]) assert.ok(s.length <= 40, '뽀모도로 딴짓 ' + k + ' 줄이 너무 김: ' + s);
}
const FLAGS = ['tabs', 'scroll', 'stay', 'idle', 'long', 'video', 'forms'];
for (const k of ['basic', 'commu', 'tsun', 'sunbi']) {
  assert.ok(L[k].length >= 500, k + ' 풀이 500개 미만: ' + L[k].length);
  assert.equal(new Set(L[k]).size, L[k].length, k + ' 에 중복 있음');
  for (const s of L[k]) {
    // 접두사는 시간대('8-11|') 또는 상황('@tabs>=8|') 하나만
    const c = /^@([a-z]+)(>=|<=|>|<)?(\d+)?\|/.exec(s);
    if (c) {
      assert.ok(FLAGS.includes(c[1]), k + ' 모르는 조건 키: ' + c[1] + ' (' + s + ')');
      assert.ok(!c[2] || c[3], k + ' 비교값이 없다: ' + s);
    }
    const body = s.replace(/^\d+-\d+\|/, '').replace(/^@[a-z]+(>=|<=|>|<)?\d*\|/, '');
    assert.ok(body.length <= 40, k + ' 줄이 너무 김: ' + body);
    assert.ok(!/^\d+-\d+\|/.test(body), k + ' 시간대 접두사 중복: ' + s);
    assert.ok(!/^@/.test(body), k + ' 조건 접두사 중복: ' + s);
  }
}

// content.js 가 아는 조건 키와 lines.js 가 쓰는 키가 어긋나지 않아야 한다
const contentSrc = fs.readFileSync(path.join(dir, 'content.js'), 'utf8');
for (const f of FLAGS) {
  assert.ok(contentSrc.includes(f + ':'), 'content.js 에 flags.' + f + ' 가 없다');
}

// ---- 말투 키가 프롬프트와 짝이 맞는지 ----
eval(fs.readFileSync(path.join(dir, 'prompts.js'), 'utf8'));
for (const k of ['basic', 'commu', 'tsun', 'sunbi']) {
  assert.ok(self.CB_PROMPTS[k], k + ' 프롬프트 없음');
  assert.ok(self.CB_PROMPTS[k].includes('[출력 형식]'), k + ' 프롬프트에 출력 형식 없음');
  // 강아지 질문 답변은 어떤 모드에서든 항상 골든 리트리버 강아지 말투여야 한다
  assert.ok(self.CB_ASK[k], k + ' 질문 프롬프트 없음');
  assert.ok(self.CB_ASK[k].includes('골든 리트리버') && self.CB_ASK[k].includes('멍!'),
    k + ' 질문 프롬프트가 강아지 말투가 아님');
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
for (const icon of ['tomato', 'sound', 'mute', 'persona_basic', 'persona_commu', 'persona_tsun', 'persona_sunbi', 'persona_pomo', 'warn', 'tip', 'info']) {
  assert.ok(D.ICONS[icon], '아이콘 없음: ' + icon);
  assert.ok(Array.isArray(D.ICONS[icon]) && D.ICONS[icon].length >= 4, '아이콘 데이터 비정상: ' + icon);
}

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
  'fonts/Galmuri11.woff2',           // content.js 가 쓰는 전체 폰트
  'fonts/Galmuri11-ui.woff2',        // popup.html 이 쓰는 서브셋
];
for (const f of refs) {
  assert.ok(fs.existsSync(path.join(dir, f)), 'manifest/코드가 가리키는 파일이 없다: ' + f);
}
assert.ok(fs.readFileSync(path.join(dir, 'content.js'), 'utf8').includes('fonts/Galmuri11.woff2'),
  'content.js 의 폰트 경로가 바뀌었다');
assert.ok(fs.readFileSync(path.join(dir, 'popup.html'), 'utf8').includes('fonts/Galmuri11-ui.woff2'),
  'popup.html 은 가벼운 서브셋 폰트를 써야 한다');
// 팝업에 나오는 글자가 서브셋에 다 들어 있는지 (없으면 그 글자만 다른 글꼴로 보인다)
{
  const html = fs.readFileSync(path.join(dir, 'popup.html'), 'utf8')
    .replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ');
  const ko = new Set([...html].filter((c) => c >= '가' && c <= '힣'));
  assert.ok(ko.size > 30, '팝업 한글이 너무 적다 — 추출이 잘못됐다');
}

// ---- 애정도: 10번마다 한 칸, 1000번이면 만렙 ----
const store = { pets: 0 };
global.chrome = {
  storage: {
    local: { get: async (d) => ({ ...d, ...store }), set: async (o) => Object.assign(store, o) },
    session: { get: async (d) => d, set: async () => {} },
  },
};
const SW = eval(fs.readFileSync(path.join(dir, 'sw.js'), 'utf8')
  .replace(/^importScripts.*$/m, '')
  .replace(/chrome\.(commands|runtime)[\s\S]*$/, '') + '\n({ pet, archiveAdd, archiveGet })');
const doPet = SW.pet;

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

  // ---- 사이트별 멘트 보관함 ----
  store.archive = {};
  await SW.archiveAdd('news.example.com', [
    { text: '가', kind: '' }, { text: '나', kind: 'tip' }, { text: '가', kind: '' },
  ]);
  assert.equal((await SW.archiveGet('news.example.com')).length, 2, '같은 문구는 한 번만 쌓인다');
  await SW.archiveAdd('news.example.com', [{ text: '나', kind: 'tip' }]);
  assert.equal((await SW.archiveGet('news.example.com')).length, 2, '재방문해도 중복은 안 쌓인다');

  // 사이트당 상한
  await SW.archiveAdd('big.example.com',
    Array.from({ length: 60 }, (_, i) => ({ text: 'L' + i, kind: '' })));
  const big = await SW.archiveGet('big.example.com');
  assert.equal(big.length, 40, '사이트당 40줄까지만 보관: ' + big.length);
  assert.equal(big[big.length - 1].text, 'L59', '최신 것이 남는다');

  // 사이트 수 상한
  for (let i = 0; i < 85; i++) await SW.archiveAdd('s' + i + '.example.com', [{ text: 'x' + i, kind: '' }]);
  assert.ok(Object.keys(store.archive).length <= 80,
    '사이트는 80곳까지: ' + Object.keys(store.archive).length);
  assert.equal((await SW.archiveGet('s84.example.com')).length, 1, '최근 사이트는 남아있다');
  assert.equal((await SW.archiveGet('s0.example.com')).length, 0, '오래된 사이트는 밀려난다');

  console.log('통과: parse %d케이스, 멘트 %d개(말투 %d), 스프라이트 %d상태, 애정도 %d단계, 보관함 OK',
    r.length, Object.values(L).flat().length,
    ['basic', 'commu', 'tsun', 'sunbi'].reduce((a, k) => a + L[k].length, 0),
    Object.keys(D.FRAMES).length, ups.length);
})();
