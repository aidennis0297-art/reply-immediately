const DEFAULTS = { enabled: true, mode: 'basic', ai: true, freq: 3,
                   follow: true, pos: 'both', size: 100, edge: 16,
                   dog: true, keepChat: true, apiKey: '', pets: 0,
                   pomoOn: true, pomoSound: true };
const OLD_FREQ = { quiet: 0, normal: 3, chatty: 7 };   // 예전 설정값도 받아준다
const PER_PET = 10, MAX_PET = 1000;
const $ = (id) => document.getElementById(id);
const save = (o) => chrome.storage.local.set(o);

function playPop8Bit() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(540, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.035);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  } catch (_) {}
}

// 슬라이더는 드래그하는 동안 계속 값이 바뀐다.
// 매번 저장하면 크롬의 분당 쓰기 한도에 걸려 마지막 값이 씹히므로 잠깐 모아서 쓴다.
const pending = {};
let saveT = 0;
function saveSoon(o) {
  Object.assign(pending, o);
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const batch = { ...pending };
    for (const k in pending) delete pending[k];
    save(batch);
  }, 180);
}

// 팝업 안에서도 개가 앉아서 꼬리를 흔든다
const ctx = $('ico').getContext('2d');
let f = 0;
CB_DOG.draw(ctx, 'sit', 0, 3, false);
setInterval(() => CB_DOG.draw(ctx, 'sit', ++f, 3, false), 420);

// 도트 전원 버튼
const powerCv = $('power').getContext('2d');
function showPower(on) {
  $('power').classList.toggle('on', on);
  $('powerLabel').textContent = on ? '켜짐' : '꺼짐';
  CB_DOG.drawIcon(powerCv, 'power', 3, on ? '#b0446e' : '#c9b3be');
}
$('power').onclick = () => {
  playPop8Bit();
  const on = !$('power').classList.contains('on');
  showPower(on);
  save({ enabled: on });
};

// 말풍선 위치 아이콘 5개
const POS_ICON = { left: 'posLeft', right: 'posRight', both: 'posBoth',
                   top: 'posTop', bottom: 'posBottom' };
function drawPosIcons(sel) {
  for (const b of $('poss').querySelectorAll('button[data-v]')) {
    const on = b.dataset.v === sel;
    CB_DOG.drawIcon(b.querySelector('canvas').getContext('2d'),
      POS_ICON[b.dataset.v], 3, on ? '#b0446e' : '#c3a3b2');
  }
}

function showEdge(n) {
  $('edgeRange').value = n;
  $('edgeLabel').innerHTML = n === 0 ? '<b>화면에 딱 붙임</b>' : `화면 끝에서 <b>${n}px</b>`;
}

function showSize(n) {
  $('sizeRange').value = n;
  const name = n <= 80 ? '작게' : n >= 120 ? '크게' : '보통';
  $('sizeLabel').innerHTML = `${name} <b>${n}%</b>`;
}

function showFreq(n) {
  $('freqRange').value = n;
  $('freqLabel').innerHTML = n === 0 ? '<b>안 띄움</b>' : `동시에 <b>${n}</b>개`;
}

function paint(box, val) {
  for (const b of box.querySelectorAll('button[data-v]')) b.classList.toggle('on', b.dataset.v === val);
}

// 저장값이 오기 전에도 창이 비어 보이지 않게 기본 모습부터 그려둔다
showPower(true);
drawPosIcons('both');
paint($('modes'), 'basic');

function showBond(pets) {
  const n = Math.min(MAX_PET, pets);
  const lv = Math.floor(n / PER_PET);
  $('lv').textContent = `애정도 Lv.${lv}`;
  $('cnt').textContent = `${n} / ${MAX_PET}`;
  $('fill').style.width = (n / MAX_PET * 100) + '%';
  $('next').textContent = lv >= 100 ? '만렙! 그래도 계속 쓰다듬어 주세요'
                                    : `다음 단계까지 ${PER_PET - (n % PER_PET)}번`;
}

function showKey(v) {
  const el = $('keyState');
  if (!v) { el.textContent = '비워두면 내장 멘트 400여 개로만 떠듭니다.'; el.className = 'hint'; return; }
  const ok = v.startsWith('nvapi-');
  el.textContent = ok ? '키 저장됨. 화면에 맞는 멘트를 받아옵니다.' : '키 형식이 이상해요 (nvapi- 로 시작).';
  el.className = ok ? 'hint ok' : 'hint';
}

chrome.storage.local.get({ ...DEFAULTS, archStat: null }, (c) => {
  showPower(c.enabled);
  $('dog').checked = c.dog !== false;
  $('follow').checked = c.follow;
  $('keepChat').checked = c.keepChat !== false;
  $('pomoOn').checked = c.pomoOn !== false;
  $('pomoSound').checked = c.pomoSound !== false;
  $('ai').checked = c.ai;
  $('apiKey').value = c.apiKey;
  paint($('modes'), c.mode);
  paint($('poss'), c.pos);
  drawPosIcons(c.pos);
  showFreq(typeof c.freq === 'number' ? c.freq : (OLD_FREQ[c.freq] ?? 3));
  showSize(c.size || 100);
  showEdge(c.edge == null ? 16 : c.edge);
  showBond(c.pets);
  showKey(c.apiKey);
  showArchive(c.archStat);
});

for (const id of ['dog', 'follow', 'keepChat', 'pomoOn', 'pomoSound', 'ai']) {
  $(id).onchange = (e) => {
    playPop8Bit();
    save({ [id]: e.target.checked });
  };
}
$('apiKey').onchange = (e) => {
  const v = e.target.value.trim();
  save({ apiKey: v });
  showKey(v);
};

for (const [box, key] of [[$('modes'), 'mode'], [$('poss'), 'pos']]) {
  box.onclick = (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    playPop8Bit();
    paint(box, b.dataset.v);
    if (key === 'pos') drawPosIcons(b.dataset.v);
    save({ [key]: b.dataset.v });
  };
}

$('freqRange').oninput = (e) => {
  const n = +e.target.value;
  showFreq(n);
  saveSoon({ freq: n });
};

$('sizeRange').oninput = (e) => {
  const n = +e.target.value;
  showSize(n);
  saveSoon({ size: n });
};

$('edgeRange').oninput = (e) => {
  const n = +e.target.value;
  showEdge(n);
  saveSoon({ edge: n });
};

// ── 사이트별 멘트 보관함 ──
function showArchive(stat) {
  const n = stat?.lines || 0;
  $('archStat').textContent = n
    ? `${stat.sites}개 사이트 · ${n}줄 모았어요`
    : '아직 모은 게 없어요';
}

$('expArch').onclick = () => {
  chrome.storage.local.get({ archive: {}, counts: {} }, (d) => {
    const out = {
      만든날: new Date().toISOString().slice(0, 10),
      사이트별멘트: d.archive,
      멘트별마지막사용순번: d.counts,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)],
      { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'walwalwal-lines.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
};

$('clrArch').onclick = () => {
  if (!confirm('모아둔 사이트별 멘트를 전부 지울까요?')) return;
  chrome.storage.local.set({ archive: {}, archStat: { sites: 0, lines: 0 } },
    () => showArchive(null));
};

// 팝업이 열려 있는 동안 다른 탭에서 쓰다듬어도 게이지가 따라 오른다
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  if (ch.pets) showBond(ch.pets.newValue);
  if (ch.archStat) showArchive(ch.archStat.newValue);
});
