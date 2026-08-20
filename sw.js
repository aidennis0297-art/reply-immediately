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

// ── 오프라인/기본 똑똑한 강아지 답변 엔진 ──
function getOfflineDogAnswer(q, ctx) {
  const text = (q || '').toLowerCase().replace(/\s+/g, '');
  const now = new Date();
  const hours = now.getHours();
  const mins = now.getMinutes();

  if (/안녕|반가|하이|좋은아침|좋은밤|헬로|방가/.test(text)) {
    return ['주인님 안녕! 멍멍!', '오늘도 꼬리 흔들며 기다리고 있었어!'];
  }
  if (/몇시|시간|지금몇|몇분|시각|몇시야/.test(text)) {
    return [`지금은 ${hours}시 ${mins}분이다 멍!`, '집중하기 딱 좋은 시간이야!'];
  }
  if (/뭐해|뭐하고|심심|놀자|놀아|바빠/.test(text)) {
    return ['주인님 화면 구경하고 있었어 멍!', '나랑 뽀모도로 한 세트 달릴래?'];
  }
  if (/힘들|지쳐|피곤|우울|슬퍼|죽겠|살려|졸려/.test(text)) {
    return ['주인님 토닥토닥... 내가 곁에 있어 멍!', '잠깐 기지개 켜고 물 한 모금 마시자!'];
  }
  if (/칭찬|잘했|대단|최고|멋져|착해/.test(text)) {
    return ['헤헤 꼬리 프로펠러 가동 중이다 멍!', '주인님이 세상에서 제일 멋져!'];
  }
  if (/배고|밥|간식|고기|치킨|피자|야식|맛있는/.test(text)) {
    return ['나도 맛있는 뼈다귀 먹고 싶다 멍멍!', '주인님도 밥 잘 챙겨 먹고 힘내!'];
  }
  if (/뽀모|타이머|집중|공부|일|작업/.test(text)) {
    return ['우측 하단 토마토 타이머를 눌러봐 멍!', '25분 동안 내가 딴짓도 감시해줄게!'];
  }
  if (/누구|이름|너는|정체|소개/.test(text)) {
    return ['나는 브라우저 지킴이 골든리트리버 왈왈이야 멍!', '주인님을 응원하러 왔어!'];
  }
  if (/사랑|좋아|귀여|이뻐|예뻐|뽀뽀/.test(text)) {
    return ['나도 주인님이 제일 좋아 멍멍! ❤️', '와락 안길래!'];
  }
  if (/고마|감사|수고|땡큐|고마워/.test(text)) {
    return ['별말씀을요 멍! 언제든 불러줘!', '항상 주인님 편이야!'];
  }
  
  if (ctx && ctx.site && ctx.site !== 'location.hostname') {
    return [
      `지금 ${ctx.site} 사이트를 보고 있구나 멍!`,
      `"${q}" 에 대해 더 깊은 AI 답변을 원하면 팝업에서 API 키를 넣어줘 멍멍!`
    ];
  }
  return [
    `"${q}" 라고 물어봤구나 멍!`,
    '더 깊은 AI 답변을 듣고 싶다면 팝업에 NVIDIA API 키를 넣어줘 멍멍!'
  ];
}

// 개한테 직접 물었을 때. 쿨다운도 캐시도 걸지 않는다 — 사용자가 기다리고 있으니까.
async function ask({ mode, q, ctx, history }) {
  const { apiKey } = await chrome.storage.local.get({ apiKey: '' });
  if (!apiKey) {
    const parts = getOfflineDogAnswer(q, ctx);
    return { parts, text: parts[0] };
  }

  const models = [
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'meta/llama-3.1-70b-instruct',
    'meta/llama-3.1-8b-instruct',
    'nvidia/nemotron-3.5-lightning-30b-a3b',
  ];

  for (const modelName of models) {
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: self.CB_ASK[mode] || self.CB_ASK.basic },
            ...(Array.isArray(history) ? history : []).flatMap((h) => [
              { role: 'user', content: h.q },
              { role: 'assistant', content: h.a },
            ]),
            { role: 'user', content: `${userMsg(ctx)}\n\n[사용자 질문] ${q}` },
          ],
          temperature: 0.85,
          top_p: 0.95,
          max_tokens: 220,
          chat_template_kwargs: { enable_thinking: false },
        }),
      });
      if (r.ok) {
        const j = await r.json();
        const parts = String(j.choices?.[0]?.message?.content || '')
          .split(/\n+/)
          .map((t) => t.replace(/^\s*[-*\d.)\]\[\s]+/, '').replace(/^["'`]+|["'`]+$/g, '').trim())
          .filter((t) => t)
          .map((t) => t.slice(0, 90))
          .slice(0, 3);
        if (parts.length) return { parts, text: parts[0] };
      }
    } catch (_) {
      // try next model
    }
  }

  const parts = getOfflineDogAnswer(q, ctx);
  return { parts, text: parts[0] };
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

// ── 백그라운드 뽀모도로 브라우저 배지 동기화 ──
function updateBadge(pomo) {
  if (!pomo || !pomo.running || !pomo.targetEndTime) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  const remMin = Math.max(0, Math.ceil((pomo.targetEndTime - Date.now()) / 60000));
  if (remMin <= 0) {
    chrome.action.setBadgeText({ text: 'DONE' });
    chrome.action.setBadgeBackgroundColor({ color: '#52c41a' });
  } else {
    const prefix = pomo.mode === 'focus' ? '' : '☕';
    chrome.action.setBadgeText({ text: `${prefix}${remMin}m` });
    chrome.action.setBadgeBackgroundColor({ color: pomo.mode === 'focus' ? '#d4380d' : '#1890ff' });
  }
}

try {
  chrome.alarms.create('pomoBadge', { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'pomoBadge') {
      chrome.storage.local.get({ pomo: null }, (d) => {
        if (d.pomo) updateBadge(d.pomo);
      });
    }
  });
} catch (_) {}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.pomo) {
    updateBadge(changes.pomo.newValue);
  }
});
