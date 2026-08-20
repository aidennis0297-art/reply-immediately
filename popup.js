const DEFAULTS = { enabled: true, mode: 'basic', ai: true, freq: 'normal', follow: true, apiKey: '', pets: 0 };
const PER_PET = 10, MAX_PET = 1000;
const $ = (id) => document.getElementById(id);
const save = (o) => chrome.storage.local.set(o);

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
  const on = !$('power').classList.contains('on');
  showPower(on);
  save({ enabled: on });
};

function paint(box, val) {
  for (const b of box.querySelectorAll('button[data-v]')) b.classList.toggle('on', b.dataset.v === val);
}

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

chrome.storage.local.get(DEFAULTS, (c) => {
  showPower(c.enabled);
  $('follow').checked = c.follow;
  $('ai').checked = c.ai;
  $('apiKey').value = c.apiKey;
  paint($('modes'), c.mode);
  paint($('freqs'), c.freq);
  showBond(c.pets);
  showKey(c.apiKey);
});

for (const id of ['follow', 'ai']) {
  $(id).onchange = (e) => save({ [id]: e.target.checked });
}
$('apiKey').onchange = (e) => {
  const v = e.target.value.trim();
  save({ apiKey: v });
  showKey(v);
};

for (const [box, key] of [[$('modes'), 'mode'], [$('freqs'), 'freq']]) {
  box.onclick = (e) => {
    const b = e.target.closest('button[data-v]');
    if (!b) return;
    paint(box, b.dataset.v);
    save({ [key]: b.dataset.v });
  };
}

// ── 사이트별 멘트 보관함 ──
function showArchive() {
  chrome.storage.local.get({ archive: {} }, ({ archive }) => {
    const sites = Object.keys(archive);
    const n = sites.reduce((a, k) => a + (archive[k].v?.length || 0), 0);
    $('archStat').textContent = n
      ? `${sites.length}개 사이트 · ${n}줄 모았어요`
      : '아직 모은 게 없어요';
  });
}
showArchive();

$('expArch').onclick = () => {
  chrome.storage.local.get({ archive: {}, counts: {} }, (d) => {
    const out = {
      만든날: new Date().toISOString().slice(0, 10),
      사이트별멘트: d.archive,
      멘트별출력횟수: d.counts,
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
  chrome.storage.local.set({ archive: {} }, showArchive);
};

// 팝업이 열려 있는 동안 다른 탭에서 쓰다듬어도 게이지가 따라 오른다
chrome.storage.onChanged.addListener((ch, area) => {
  if (area !== 'local') return;
  if (ch.pets) showBond(ch.pets.newValue);
  if (ch.archive) showArchive();
});
