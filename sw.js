// 백그라운드. 두 가지 일을 한다.
//  1) NVIDIA NIM 으로 지금 보는 화면에 맞는 대사 10개를 받아온다 (캐시 + 쿨다운으로 과부하 방지)
//  2) 애정도(쓰다듬은 횟수)를 센다. 10번마다 한 칸, 1000번이면 만렙.
importScripts('prompts.js', 'lines.js');

const API = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MODEL = 'nvidia/nemotron-3.5-lightning-30b-a3b';
const MIN_GAP = 40000;      // 호출 간 최소 간격
const TTL = 5 * 60 * 1000;  // 같은 페이지 재요청은 5분간 캐시로
const PER_PET = 10, MAX_LEVEL = 100;
const ARCH_PER_SITE = 40;   // 사이트 하나당 보관할 멘트 수
const ARCH_SITES = 80;      // 보관할 사이트 수 (넘치면 오래된 곳부터 버린다)

const TAG = { '일반': '', '팁': 'tip', '주의': 'warn', '정보': 'info' };

function userMsg(c) {
  return [
    `[사이트] ${c.site}`,
    `[경로] ${c.url}`,
    `[제목] ${c.title}`,
    c.head ? `[대표 제목] ${c.head}` : '',
    c.desc ? `[설명] ${c.desc}` : '',
    c.notice ? `[화면에 뜬 공지/알림] ${c.notice}` : '',
    c.sel ? `[사용자가 선택한 글] ${c.sel}` : '',
    c.body ? `[본문 일부] ${c.body}` : '',
  ].filter(Boolean).join('\n');
}

// "3. [팁] 문구" 를 {text, kind} 로 쪼갠다.
// 모델이 번호를 자주 빼먹어서 번호나 태그 둘 중 하나만 있어도 받아준다.
function parse(txt) {
  const out = [];
  for (const raw of String(txt).split('\n')) {
    const m = /^\s*(\d+\s*[.)]\s*)?(?:\[\s*([^\]]{1,6})\s*\]\s*)?(.+)$/.exec(raw);
    if (!m || (!m[1] && !m[2])) continue;        // 번호도 태그도 없으면 잡담이다
    const text = m[3].replace(/^["'`\s]+/, '').replace(/["'`\s]+$/, '');
    if (!text || text.length > 45) continue;     // 말풍선에 안 들어가는 길이는 버린다
    out.push({ text, kind: TAG[(m[2] || '').trim()] || '' });
    if (out.length >= 10) break;
  }
  return out;
}

const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);

// ── 사이트별 멘트 보관함 ──────────────────────────────────────
// AI가 만든 멘트를 사이트 주소와 함께 계속 쌓아둔다.
// 다음에 같은 사이트에 오면 API를 안 부르고 여기서 꺼내 쓴다.
async function archiveAdd(host, lines) {
  if (!host || !lines.length) return;
  const { archive } = await chrome.storage.local.get({ archive: {} });
  const slot = archive[host] || { t: 0, v: [] };
  const seen = new Set(slot.v.map((x) => x.text));
  for (const l of lines) {
    if (seen.has(l.text)) continue;
    seen.add(l.text);
    slot.v.push({ text: l.text, kind: l.kind, t: Date.now() });
  }
  if (slot.v.length > ARCH_PER_SITE) slot.v = slot.v.slice(-ARCH_PER_SITE);
  slot.t = Date.now();
  archive[host] = slot;

  const keys = Object.keys(archive);
  if (keys.length > ARCH_SITES) {
    keys.sort((a, b) => archive[a].t - archive[b].t)
      .slice(0, keys.length - ARCH_SITES)
      .forEach((k) => delete archive[k]);
  }
  // 팝업이 통째로 다시 읽지 않도록 요약을 같이 써둔다
  const stat = { sites: Object.keys(archive).length, lines: 0 };
  for (const k in archive) stat.lines += archive[k].v.length;
  await chrome.storage.local.set({ archive, archStat: stat });
}

async function archiveGet(host) {
  const { archive } = await chrome.storage.local.get({ archive: {} });
  return archive[host]?.v || [];
}

async function fetchLines({ mode, ctx }) {
  const { apiKey } = await chrome.storage.local.get({ apiKey: '' });
  if (!apiKey) return [];                       // 키 없으면 로컬 멘트만 쓴다

  const key = `${mode}|${ctx.site}|${ctx.title}`;
  const st = await chrome.storage.session.get({ cache: {}, last: 0 });
  const hit = st.cache[key];
  const now = Date.now();
  if (hit && now - hit.t < TTL && hit.v.length) return shuffle(hit.v);
  // 쿨다운 중이면 예전에 이 사이트에서 만들어 둔 멘트를 꺼내 쓴다
  if (now - st.last < MIN_GAP) return shuffle(await archiveGet(ctx.host)).slice(0, 10);
  await chrome.storage.session.set({ last: now });

  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: self.CB_PROMPTS[mode] || self.CB_PROMPTS.basic },
        { role: 'user', content: userMsg(ctx) },
      ],
      temperature: 1.05,
      top_p: 0.95,
      max_tokens: 700,
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  if (!r.ok) throw new Error('NIM ' + r.status);
  const j = await r.json();
  const lines = parse(j.choices?.[0]?.message?.content || '');
  await archiveAdd(ctx.host, lines);            // 사이트 주소와 함께 보관해 둔다

  const cache = st.cache;
  cache[key] = { t: now, v: lines };
  const keys = Object.keys(cache);
  if (keys.length > 20) delete cache[keys.sort((a, b) => cache[a].t - cache[b].t)[0]];
  await chrome.storage.session.set({ cache });
  return lines.length ? lines : shuffle(await archiveGet(ctx.host)).slice(0, 10);
}

// 개한테 직접 물었을 때. 쿨다운도 캐시도 걸지 않는다 — 사용자가 기다리고 있으니까.
async function ask({ mode, q, ctx }) {
  const { apiKey } = await chrome.storage.local.get({ apiKey: '' });
  if (!apiKey) return { text: '나 아직 귀만 있고 머리가 없어... 팝업에서 API 키 넣어줘!' };
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: self.CB_ASK[mode] || self.CB_ASK.basic },
        { role: 'user', content: `${userMsg(ctx)}\n\n[사용자 질문] ${q}` },
      ],
      temperature: 0.9,
      top_p: 0.95,
      max_tokens: 220,
      chat_template_kwargs: { enable_thinking: false },
    }),
  });
  if (!r.ok) throw new Error('NIM ' + r.status);
  const j = await r.json();
  // 줄 단위로 쪼갠다. 한 줄이 말풍선 하나가 된다.
  const parts = String(j.choices?.[0]?.message?.content || '')
    .split(/\n+/)
    .map((t) => t.replace(/^\s*[-*\d.)\]\[\s]+/, '').replace(/^["'`]+|["'`]+$/g, '').trim())
    .filter((t) => t)
    .map((t) => t.slice(0, 90))
    .slice(0, 3);
  return { parts, text: parts[0] || '음... 잘 모르겠어.' };
}

async function pet() {
  const { pets } = await chrome.storage.local.get({ pets: 0 });
  const next = pets + 1;
  await chrome.storage.local.set({ pets: next });
  const before = Math.min(MAX_LEVEL, Math.floor(pets / PER_PET));
  const level = Math.min(MAX_LEVEL, Math.floor(next / PER_PET));
  return {
    pets: next, level,
    line: level > before ? globalThis.CB_LINES.bond[level - 1] : null,
  };
}

// Alt+F (chrome://extensions/shortcuts 에서 바꿀 수 있다)
chrome.commands?.onCommand.addListener((cmd, tab) => {
  if (cmd === 'ask' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'openAsk' }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg?.type === 'lines') {
    fetchLines(msg).then(send).catch((e) => { console.warn('[왈왈왈]', e.message); send([]); });
    return true;
  }
  if (msg?.type === 'pet') {
    pet().then(send).catch(() => send(null));
    return true;
  }
  if (msg?.type === 'tabs') {
    chrome.tabs.query({}, (t) => send(t.length));
    return true;
  }
  if (msg?.type === 'ask') {
    ask(msg).then(send).catch((e) => {
      console.warn('[왈왈왈]', e.message);
      send({ text: '지금은 대답을 못 가져왔어. 잠깐 뒤에 다시 물어봐!' });
    });
    return true;
  }
});
