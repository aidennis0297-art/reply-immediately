// 화면 양쪽에서 말풍선이 뜨고, 아래에서는 도트 골든 리트리버가 돌아다닌다.
//  · 사이드 말풍선 — 좌/우(또는 위/아래) 가장자리. 설정한 개수만큼 계속 채운다.
//  · 개 말풍선     — 쓰다듬었을 때 꿀팁·애정도 멘트.
//  · 질문 바       — 개를 클릭하면 개 위에 뜬다. 마이크와 타자 둘 다 받는다.
(() => {
  const D = globalThis.CB_DOG, LINES = globalThis.CB_LINES;
  if (!D || !LINES || window.top !== window) return;   // 아이프레임에는 안 붙인다

  const SCALE = 3, DOG_W = D.W * SCALE, DOG_H = D.H * SCALE;
  const MODES = ['basic', 'commu', 'tsun', 'sunbi'];
  const DEFAULTS = {
    enabled: true, mode: 'basic', ai: true, freq: 3, follow: true,
    pos: 'both', size: 100, edge: 16, dog: true, keepChat: true, barW: 340,
  };
  const OLD_FREQ = { quiet: 0, normal: 3, chatty: 7 };   // 예전 설정값도 받아준다
  const CHAT_KEY = 'cheerBuddy.chat';
  const TICK = 100, WALK_PX = 14, SLEEP_AFTER = 75000;
  const FOLLOW_GAP = 70, FOLLOW_GIVEUP = 8000;
  const LIFE = [2800, 16000];
  const SIDES = { right: ['right'], left: ['left'], both: ['left', 'right'],
                  top: ['top'], bottom: ['bottom'] };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  // 츤데레 말풍선에 깔 하트 무늬. 도트 하트를 그려 배경 이미지로 쓴다.
  const heartPattern = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 22;
    const x = c.getContext('2d');
    x.globalAlpha = 0.28;
    D.drawIcon(x, 'heart', 2, '#ff8fbb');
    return c.toDataURL();
  })();

  const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  .dog{position:absolute;bottom:6px;left:0;width:${DOG_W}px;height:${DOG_H}px;
       image-rendering:pixelated;pointer-events:auto;cursor:pointer;
       transition:transform .1s linear;will-change:transform;
       filter:drop-shadow(0 2px 2px rgba(0,0,0,.18))}
  .zzz{position:absolute;bottom:${DOG_H}px;left:0;width:${DOG_W}px;text-align:right;
       font:700 13px 'CBGalmuri',monospace;color:#8fb8d8;opacity:0;
       transition:transform .1s linear}
  .zzz.on{animation:zzz 2.6s ease-out infinite}
  @keyframes zzz{0%{opacity:0;transform:translate(0,0) scale(.7)}25%{opacity:.95}
                 100%{opacity:0;transform:translate(14px,-26px) scale(1.25)}}
  .heart{position:absolute;bottom:${DOG_H - 4}px;image-rendering:pixelated;
         pointer-events:none;animation:float 1.15s ease-out forwards}
  @keyframes float{0%{opacity:0;transform:translateY(0) scale(.5)}
                   20%{opacity:1;transform:translateY(-8px) scale(1)}
                   100%{opacity:0;transform:translateY(-52px) scale(1.2)}}

  .bubble{position:absolute;padding:.75em .95em .8em;
          border:3px solid var(--ink);border-radius:.95em;background:var(--bg);color:var(--ink);
          font-family:'CBGalmuri','Galmuri11',monospace;font-weight:400;line-height:1.6;
          letter-spacing:.2px;word-break:keep-all;white-space:pre-wrap;text-align:left;
          box-shadow:0 4px 0 rgba(0,0,0,.10),inset 0 3px 0 rgba(255,255,255,.6)}

  .side{max-width:44vw}
  .side.left{animation:inL .38s cubic-bezier(.2,1.5,.4,1) both}
  .side.right{animation:inR .38s cubic-bezier(.2,1.5,.4,1) both}
  .side.top{animation:inT .38s cubic-bezier(.2,1.5,.4,1) both}
  .side.bottom{animation:inB .38s cubic-bezier(.2,1.5,.4,1) both}
  @keyframes inL{from{opacity:0;transform:translateX(-34px) scale(.88)}to{opacity:1;transform:none}}
  @keyframes inR{from{opacity:0;transform:translateX(34px) scale(.88)}to{opacity:1;transform:none}}
  @keyframes inT{from{opacity:0;transform:translateY(-30px) scale(.9)}to{opacity:1;transform:none}}
  @keyframes inB{from{opacity:0;transform:translateY(30px) scale(.9)}to{opacity:1;transform:none}}
  .side.left.out{animation:outL .3s ease-in forwards}
  .side.right.out{animation:outR .3s ease-in forwards}
  .side.top.out{animation:outT .3s ease-in forwards}
  .side.bottom.out{animation:outB .3s ease-in forwards}
  @keyframes outL{to{opacity:0;transform:translateX(-24px) scale(.9)}}
  @keyframes outR{to{opacity:0;transform:translateX(24px) scale(.9)}}
  @keyframes outT{to{opacity:0;transform:translateY(-22px) scale(.92)}}
  @keyframes outB{to{opacity:0;transform:translateY(22px) scale(.92)}}

  /* 개가 무는 말풍선과 질문 바. 꼬리가 개를 가리킨다 */
  .tail{transform-origin:var(--tail) 130%}
  .tail::before,.tail::after{content:'';position:absolute;border-style:solid}
  .tail::before{left:calc(var(--tail) - 9px);bottom:-14px;
                border-width:11px 9px 0 9px;border-color:var(--ink) transparent transparent}
  .tail::after{left:calc(var(--tail) - 6px);bottom:-8px;
               border-width:8px 6px 0 6px;border-color:var(--bg) transparent transparent}
  .say{bottom:${DOG_H + 16}px;left:0;max-width:264px;font-size:15px;
       animation:pop .34s cubic-bezier(.2,1.6,.4,1) both}
  .say.out{animation:bye .32s ease-in forwards}
  @keyframes pop{0%{opacity:0;transform:scale(.4) translateY(12px)}
                 100%{opacity:1;transform:scale(1) translateY(0)}}
  @keyframes bye{to{opacity:0;transform:scale(.85) translateY(8px)}}

  /* 개 위에 붙는 질문 바 */
  .ask{bottom:${DOG_H + 16}px;left:0;--bg:#fff6fb;--ink:#b0446e;
       padding:9px 10px 8px;pointer-events:auto;
       animation:pop .3s cubic-bezier(.2,1.6,.4,1) both}
  .ask .row{display:flex;align-items:center;gap:6px}
  .ask canvas{cursor:pointer;image-rendering:pixelated;flex:none;
              padding:3px;border:2px solid var(--ink);border-radius:8px;
              background:rgba(255,255,255,.8)}
  .ask canvas.rec{background:#ffdbe6;animation:blink .8s steps(2,end) infinite}
  @keyframes blink{50%{opacity:.35}}
  .ask input{flex:1;min-width:60px;border:2px solid var(--ink);border-radius:8px;
             background:rgba(255,255,255,.9);color:var(--ink);
             font:400 14px 'CBGalmuri',monospace;padding:6px 8px;outline:none}
  .ask input::placeholder{color:var(--ink);opacity:.45}
  .ask button{flex:none;border:2px solid var(--ink);border-radius:8px;cursor:pointer;
              background:#ffd9ea;color:var(--ink);
              font:400 12px 'CBGalmuri',monospace;padding:6px 8px}
  .ask button:hover{background:#ffc7de}
  .ask .foot{margin-top:6px;font:400 11px 'CBGalmuri',monospace;opacity:.62;
             display:flex;justify-content:space-between;gap:8px}
  .ask .foot .chat{cursor:pointer;text-decoration:underline;white-space:nowrap}
  .grip{position:absolute;right:-3px;bottom:-3px;width:14px;height:14px;
        cursor:ew-resize;border-right:3px solid var(--ink);border-bottom:3px solid var(--ink);
        border-radius:0 0 6px 0;opacity:.55}
  .grip:hover{opacity:1}
  .grip.l{left:-3px;right:auto;cursor:ew-resize;
          border:0;border-left:3px solid var(--ink);border-bottom:3px solid var(--ink);
          border-radius:0 0 0 6px}

  .c1{--bg:#ffd9ea;--ink:#b0446e}.c2{--bg:#d3f5e5;--ink:#2b8a66}.c3{--bg:#fff2c2;--ink:#a8791f}
  .c4{--bg:#e4dcff;--ink:#6a51c2}.c5{--bg:#d5ecff;--ink:#356ea8}.c6{--bg:#ffe4d2;--ink:#c26a2f}
  .c7{--bg:#e6f7c7;--ink:#5d8a24}
  /* 말투마다 고유한 색. '모두' 모드에서 누가 말했는지 색으로 안다 */
  .p-commu{--bg:#dde5f7;--ink:#1f3d78}
  .p-sunbi{--bg:#f0e3d1;--ink:#5c3a1e}
  .p-tsun{--bg:#ffe6f0;--ink:#c2367a;
          background-image:url(${heartPattern});background-repeat:repeat}
  .k-warn{--bg:#ffe2e2;--ink:#c0392b;border-style:dashed}
  .k-tip{--bg:#d9f7e6;--ink:#20805a}
  .k-info{--bg:#e2edff;--ink:#3a68b0}
  .k-answer{--bg:#e8e2ff;--ink:#5a44b8;box-shadow:0 4px 0 rgba(0,0,0,.1),
            inset 0 3px 0 rgba(255,255,255,.6),0 0 0 3px rgba(140,110,255,.22)}
  .k-bond{--bg:#ffd0e6;--ink:#c2367a;box-shadow:0 4px 0 rgba(0,0,0,.1),
          inset 0 3px 0 rgba(255,255,255,.6),0 0 0 4px rgba(255,140,190,.28)}
  [hidden]{display:none!important}`;

  const CANDY = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];
  const KIND_CLS = { warn: 'k-warn', tip: 'k-tip', info: 'k-info',
                     bond: 'k-bond', answer: 'k-answer' };
  const PERSONA_CLS = { commu: 'p-commu', tsun: 'p-tsun', sunbi: 'p-sunbi' };

  let cfg = { ...DEFAULTS };
  let root, sh, cv, ctx, say, zzz, askEl, askInput, micEl, footEl, chatEl;
  const FOOT = 'Enter 로 보내기 · Esc 로 닫기';
  const micHint = (t) => { if (footEl) footEl.firstChild.textContent = t || FOOT; };
  const live = new Set();
  const dog = { x: 60, dir: 1, state: 'sit', frame: 0, target: 0, acc: 0 };
  let tickT = 0, nextT = 0, sayT = 0, tabT = 0, arrive = null, rec = null;
  let recent = [], queue = [], lastFetch = 0, href = location.href;
  let counts = {}, delta = {}, flushT = 0;
  let idleSince = Date.now(), lastScroll = 0, busy = false, lastPoke = 0;
  let mouseX = null, mouseAt = 0, nextSide = Math.random() < 0.5 ? 'left' : 'right';
  let askOpen = false, chat = [];
  const flags = { tabs: 0, scroll: 0, stay: 0, idle: 0, long: 0, video: 0, forms: 0 };
  let pageAt = Date.now(), flagT = 0;

  const clampX = (x) => Math.max(4, Math.min(innerWidth - DOG_W - 4, x));
  const zoom = () => Math.max(0.6, Math.min(1.4, (cfg.size || 100) / 100));
  const edge = () => Math.max(0, Math.min(60, cfg.edge == null ? 16 : cfg.edge));
  const dogOn = () => cfg.dog !== false;
  // '모두' 를 고르면 말풍선마다 말투가 바뀐다
  const activeMode = () => (cfg.mode === 'all' ? pick(MODES)
                            : MODES.includes(cfg.mode) ? cfg.mode : 'basic');

  function plan() {
    const raw = typeof cfg.freq === 'number' ? cfg.freq : (OLD_FREQ[cfg.freq] ?? 3);
    const max = Math.max(0, Math.min(10, Math.round(raw)));
    if (!max) return { min: 0, max: 0, gap: [0, 0] };
    return { min: Math.max(1, max - 1), max,
             gap: [Math.max(320, 3000 / max), Math.max(900, 7000 / max)] };
  }

  // ---------- 지금 무슨 상황인지 ----------
  const COND = /^@([a-z]+)(>=|<=|>|<)?(\d+)?\|/;

  function readFlags() {
    const doc = document.documentElement;
    const room = Math.max(1, doc.scrollHeight - innerHeight);
    flags.scroll = Math.min(100, Math.round((scrollY / room) * 100));
    flags.stay = Math.round((Date.now() - pageAt) / 1000);
    flags.idle = mouseAt ? Math.round((Date.now() - mouseAt) / 1000) : 0;
    flags.long = (document.body?.textContent || '').length;
    flags.video = [...document.querySelectorAll('video')].some((v) => !v.paused && !v.ended) ? 1 : 0;
    flags.forms = document.querySelectorAll('input:not([type=hidden]),textarea').length;
  }

  function readTabs() {
    try {
      chrome.runtime.sendMessage({ type: 'tabs' }, (n) => {
        void chrome.runtime.lastError;
        if (typeof n === 'number') flags.tabs = n;
      });
    } catch (_) { /* 확장이 방금 리로드된 경우 */ }
  }

  function condOK(m) {
    const v = flags[m[1]] || 0;
    if (!m[2]) return v > 0;
    const n = +m[3];
    return m[2] === '>=' ? v >= n : m[2] === '<=' ? v <= n
         : m[2] === '>' ? v > n : v < n;
  }

  // ---------- 화면 붙이기 ----------
  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  function mount() {
    if (root && root.isConnected) return;
    root = document.createElement('div');
    root.id = 'cheer-buddy-root';
    root.style.cssText = 'all:initial;position:fixed;inset:0;pointer-events:none;' +
                         'z-index:2147483647';
    sh = root.attachShadow({ mode: 'open' });
    el('style', null, sh).textContent = CSS;

    say = el('div', 'bubble tail say c1', sh); say.hidden = true;
    cv = el('canvas', 'dog', sh);
    cv.width = DOG_W; cv.height = DOG_H;
    cv.title = '멍! (누르면 질문 바가 열려)';
    zzz = el('div', 'zzz', sh); zzz.textContent = 'z z';
    ctx = cv.getContext('2d');
    cv.addEventListener('click', poke);
    buildAsk();
    document.documentElement.appendChild(root);

    new FontFace('CBGalmuri', `url("${chrome.runtime.getURL('fonts/Galmuri11.woff2')}")`,
                 { display: 'swap' })
      .load().then((f) => document.fonts.add(f)).catch(() => {});

    dog.x = clampX(dog.x);
    applyDog();
    render();
  }

  function unmount() {
    clearInterval(tickT); clearInterval(tabT); clearTimeout(nextT); clearTimeout(sayT);
    for (const b of live) { clearTimeout(b._t); b.remove(); }
    live.clear();
    tickT = nextT = sayT = tabT = 0;
    if (root) root.remove();
    root = null;
  }

  // 개만 따로 껐다 켰다 할 수 있다. 말풍선은 그대로 뜬다.
  function applyDog() {
    if (!root) return;
    const on = dogOn();
    cv.hidden = !on;
    zzz.hidden = !on;
    if (!on) {
      closeAsk(false);
      clearTimeout(sayT);
      say.hidden = true;
    }
  }

  // ---------- 개 ----------
  function setState(s) {
    if (dog.state === s) return;
    dog.state = s; dog.frame = 0; dog.acc = 0;
    zzz.classList.toggle('on', s === 'sleep' && dogOn());
  }

  function render() {
    const t = `translate3d(${Math.round(dog.x)}px,0,0)`;
    cv.style.transform = t; zzz.style.transform = t;
    D.draw(ctx, dog.state, dog.frame, SCALE, dog.dir < 0);
  }

  function follow(now) {
    if (!cfg.follow || !dogOn() || mouseX == null || !say.hidden || busy || askOpen || arrive) return;
    if (now - mouseAt > FOLLOW_GIVEUP) return;
    const want = clampX(mouseX - DOG_W / 2);
    if (Math.abs(want - dog.x) <= FOLLOW_GAP) {
      if (dog.state === 'walk') setState('sit');
      return;
    }
    if (dog.state === 'sleep') { setState('stand'); idleSince = now; return; }
    dog.target = want;
    setState('walk');
  }

  function tick() {
    if (document.hidden) return;
    const now = Date.now();
    if (location.href !== href) {
      // 페이지가 바뀌면 앞 페이지에서 만든 건 전부 버린다
      href = location.href; pageAt = now;
      queue = []; lastFetch = 0;
      for (const b of [...live]) drop(b);
      clearTimeout(sayT); say.hidden = true;
    }
    if (now - flagT > 2000) { flagT = now; readFlags(); }

    follow(now);

    if (dog.state === 'walk') {
      const dx = dog.target - dog.x;
      if (Math.abs(dx) <= WALK_PX) {
        dog.x = dog.target; setState('sit');
        if (arrive) { const f = arrive; arrive = null; f(); }
      } else {
        dog.dir = Math.sign(dx); dog.x += dog.dir * WALK_PX;
      }
      if (!say.hidden) place(say);
      if (askOpen) place(askEl);
    } else if (dog.state === 'sit' && say.hidden && !busy && !askOpen &&
               now - idleSince > SLEEP_AFTER) {
      setState('sleep');
    }

    dog.acc += TICK;
    if (dog.acc >= D.SPEED[dog.state]) { dog.acc = 0; dog.frame++; }
    render();
  }

  // ---------- 멘트 고르기 ----------
  function pool(mode) {
    const h = new Date().getHours();
    const src = LINES[mode] || LINES.basic;
    const fit = [], plain = [];
    for (const s of src) {
      const t = /^(\d+)-(\d+)\|/.exec(s);
      if (t) {
        if (h >= +t[1] && h < +t[2]) fit.push(s.slice(t[0].length));
        continue;
      }
      const c = COND.exec(s);
      if (c) {
        if (condOK(c)) fit.push(s.slice(c[0].length));
        continue;
      }
      plain.push(s);
    }
    return (fit.length && Math.random() < 0.65) ? fit : plain.concat(fit);
  }

  function leastUsed(list) {
    if (!list.length) return '';
    if (Math.random() < 0.3) return pick(list);
    let min = Infinity, best = [];
    for (const t of list) {
      const n = counts[t] || 0;
      if (n < min) { min = n; best = [t]; }
      else if (n === min) best.push(t);
    }
    return pick(best);
  }

  function pickFrom(list) {
    const fresh = list.filter((t) => !recent.includes(t));
    return leastUsed(fresh.length ? fresh : list);
  }

  function remember(t) {
    recent.push(t); if (recent.length > 24) recent.shift();
    counts[t] = (counts[t] || 0) + 1;
    delta[t] = (delta[t] || 0) + 1;
    clearTimeout(flushT);
    flushT = setTimeout(flushCounts, 12000);
  }

  function flushCounts() {
    const d = delta;
    if (!Object.keys(d).length) return;
    delta = {};
    try {
      chrome.storage.local.get({ counts: {} }, (v) => {
        void chrome.runtime.lastError;
        const merged = v.counts || {};
        for (const k in d) merged[k] = (merged[k] || 0) + d[k];
        counts = merged;
        chrome.storage.local.set({ counts: merged });
      });
    } catch (_) { /* ignore */ }
  }

  function pageContext() {
    const meta = (sel) => document.querySelector(sel)?.content?.trim() || '';
    const clean = (s) => (s || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
    const notice = [...document.querySelectorAll(
      '[role="alert"],[role="status"],[class*="notice"],[class*="alert"],' +
      '[class*="banner"],[class*="toast"],[id*="notice"]')]
      .map((e) => clean(e.innerText)).filter((t) => t.length > 4 && t.length < 160)[0] || '';
    const main = document.querySelector('article,main,[role="main"]') || document.body;
    return {
      host: location.hostname,
      site: meta('meta[property="og:site_name"]') || location.hostname.replace(/^www\./, ''),
      url: location.pathname.slice(0, 60),
      title: clean(document.title).slice(0, 120),
      head: clean(document.querySelector('h1')?.innerText).slice(0, 100),
      desc: clean(meta('meta[name="description"]') || meta('meta[property="og:description"]')).slice(0, 180),
      notice: notice.slice(0, 160),
      sel: clean(String(getSelection() || '')).slice(0, 160),
      body: clean(main.innerText).slice(0, 420),
      lang: document.documentElement.lang || '',
    };
  }

  function refill() {
    if (!cfg.ai || queue.length > 2 || Date.now() - lastFetch < 45000) return;
    lastFetch = Date.now();
    const mode = activeMode();
    try {
      chrome.runtime.sendMessage(
        { type: 'lines', mode, ctx: pageContext() },
        (res) => {
          void chrome.runtime.lastError;
          if (Array.isArray(res) && res.length) {
            queue.push(...res.map((r) => ({ ...r, persona: mode })));
          }
        }
      );
    } catch (_) { /* ignore */ }
  }

  function nextLine() {
    refill();
    const i = queue.findIndex((q) => q.kind !== 'tip' && !recent.includes(q.text));
    if (i >= 0 && Math.random() < 0.78) {
      const item = queue.splice(i, 1)[0];
      remember(item.text);
      return item;
    }
    const mode = activeMode();
    const text = pickFrom(pool(mode));
    remember(text);
    return { text, kind: '', persona: mode };
  }

  function nextTip() {
    const i = queue.findIndex((q) => q.kind === 'tip' && !recent.includes(q.text));
    const text = i >= 0 ? queue.splice(i, 1)[0].text : pickFrom(LINES.tips);
    remember(text);
    return text;
  }

  // ---------- 사이드 말풍선 ----------
  function schedule() {
    clearTimeout(nextT);
    const p = plan();
    if (!p.max) return;
    nextT = setTimeout(fill, rnd(p.gap[0], p.gap[1]));
  }

  function fill() {
    if (!cfg.enabled || !root) return;
    const p = plan();
    if (!p.max) return;
    if (document.hidden) { nextT = setTimeout(fill, 3000); return; }
    const want = Math.round(rnd(p.min, p.max + 0.49));
    const need = Math.min(2, want - live.size);
    for (let i = 0; i < need; i++) {
      setTimeout(() => {
        if (!cfg.enabled || !root || live.size >= p.max) return;
        const item = nextLine();
        spawn(item.text, item.kind, { persona: item.persona });
      }, i * 320);
    }
    schedule();
  }

  function freeSlot(side, size) {
    const vert = side === 'left' || side === 'right';
    const pad = Math.min(10, edge());
    const span = vert ? [innerHeight * 0.02, innerHeight * 0.92]
                      : [pad, Math.max(20, innerWidth - size - pad)];
    const taken = [...live].filter((b) => b.dataset.side === side).map((b) => {
      const v = parseInt(vert ? b.style.bottom : b.style.left, 10) || 0;
      return [v, v + (vert ? b.offsetHeight : b.offsetWidth)];
    });
    for (let i = 0; i < 24; i++) {
      const v = Math.round(rnd(span[0], span[1]));
      if (taken.every(([lo, hi]) => v + size + 14 < lo || v > hi + 14)) return v;
    }
    return Math.round(rnd(span[0], span[1]));
  }

  function nextPlace() {
    const list = SIDES[cfg.pos] || SIDES.both;
    if (list.length === 1) return list[0];
    const s = nextSide;
    nextSide = s === 'left' ? 'right' : 'left';
    return s;
  }

  function spawn(text, kind, opt = {}) {
    const side = opt.side || nextPlace();
    const cls = KIND_CLS[kind] || PERSONA_CLS[opt.persona] || pick(CANDY);
    const b = el('div', 'bubble side ' + side + ' ' + cls, sh);
    b.textContent = text;
    b.dataset.side = side;
    const z = zoom();
    b.style.fontSize = Math.round(rnd(13, 18.9) * z) + 'px';
    b.style.maxWidth = Math.round(rnd(170, 320) * z) + 'px';

    const vert = side === 'left' || side === 'right';
    const e = edge();
    const cross = Math.round(side === 'bottom' ? 58 + rnd(0, e) : rnd(0, e));
    b.style[side] = cross + 'px';
    b.style[vert ? 'bottom' : 'left'] = '0px';
    b.style[vert ? 'bottom' : 'left'] =
      freeSlot(side, vert ? b.offsetHeight : b.offsetWidth) + 'px';
    live.add(b);

    const need = LIFE[0] + text.length * 90;
    const dur = Math.min(LIFE[1], need * rnd(0.75, 2.3));
    b._t = setTimeout(() => kill(b), Math.max(1200, dur));
    return b;
  }

  function kill(b) {
    if (!live.has(b)) return;
    if (document.hidden || Date.now() - lastScroll < 1200) {
      b._t = setTimeout(() => kill(b), 1200); return;
    }
    b.classList.add('out');
    live.delete(b);
    setTimeout(() => b.remove(), 320);
  }

  // 페이지가 바뀌었을 때처럼 즉시 치울 때
  function drop(b) {
    clearTimeout(b._t);
    live.delete(b);
    b.remove();
  }

  // ---------- 개 말풍선 ----------
  function showSay(text, kind) {
    if (!dogOn()) return;
    say.textContent = text;
    say.className = 'bubble tail say ' + (KIND_CLS[kind] || 'k-tip');
    say.style.fontSize = Math.round(15 * zoom()) + 'px';
    say.style.maxWidth = Math.round(264 * zoom()) + 'px';
    say.hidden = false;
    place(say);
    clearTimeout(sayT);
    sayT = setTimeout(hideSay, Math.min(11000, 2600 + text.length * 120) * rnd(0.9, 1.2));
    idleSince = Date.now();
  }

  // 개 위에 올려놓고 꼬리가 개를 가리키게 한다
  function place(node) {
    const w = node.offsetWidth, cx = dog.x + DOG_W / 2;
    const left = Math.max(8, Math.min(innerWidth - w - 8, Math.round(cx - w / 2)));
    node.style.left = left + 'px';
    node.style.setProperty('--tail', (cx - left) + 'px');
  }

  function hideSay() {
    if (document.hidden || Date.now() - lastScroll < 1400) {
      sayT = setTimeout(hideSay, 1400); return;
    }
    say.classList.add('out');
    setTimeout(() => { say.hidden = true; say.classList.remove('out'); }, 320);
    idleSince = Date.now();
  }

  function popHearts(n) {
    for (let i = 0; i < n; i++) {
      const c = el('canvas', 'heart');
      const [w, h] = D.iconSize('heart');
      c.width = w * SCALE; c.height = h * SCALE;
      D.drawIcon(c.getContext('2d'), 'heart', SCALE);
      c.style.left = Math.round(dog.x + DOG_W / 2 - 10 + rnd(-16, 16)) + 'px';
      c.style.animationDelay = i * 120 + 'ms';
      c.addEventListener('animationend', () => c.remove());
      setTimeout(() => c.remove(), 2500);
      sh.appendChild(c);
    }
  }

  // ---------- 질문 바 ----------
  function buildAsk() {
    askEl = el('div', 'bubble tail ask', sh);
    askEl.hidden = true;
    askEl.style.width = (cfg.barW || 340) + 'px';

    const row = el('div', 'row', askEl);
    micEl = el('canvas', null, row);
    const [mw, mh] = D.iconSize('mic');
    micEl.width = mw * 2; micEl.height = mh * 2;
    micEl.title = SR ? '눌러서 말하기' : '이 브라우저에선 음성 인식이 안 돼';
    D.drawIcon(micEl.getContext('2d'), 'mic', 2, '#b0446e');
    micEl.addEventListener('click', toggleMic);

    askInput = el('input', null, row);
    askInput.type = 'text';
    askInput.maxLength = 120;
    const send = el('button', null, row);
    send.textContent = '물어봐';
    send.addEventListener('click', sendAsk);

    footEl = el('div', 'foot', askEl);
    footEl.appendChild(document.createTextNode(FOOT));
    chatEl = el('span', 'chat', footEl);
    chatEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (chat.length) { newChat(); } else { cfg.keepChat = !cfg.keepChat; saveCfg({ keepChat: cfg.keepChat }); }
      showChatState();
    });

    // 가장자리를 잡고 좌우로 끌면 폭이 바뀐다
    for (const cls of ['grip', 'grip l']) {
      const g = el('div', cls, askEl);
      g.addEventListener('mousedown', (ev) => startResize(ev, cls.includes('l') ? -1 : 1));
    }

    askInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') sendAsk();
      else if (e.key === 'Escape') closeAsk(true);
    });
  }

  function startResize(ev, dir) {
    ev.preventDefault(); ev.stopPropagation();
    const x0 = ev.clientX, w0 = askEl.offsetWidth;
    const move = (e) => {
      const w = Math.max(220, Math.min(innerWidth - 40, w0 + (e.clientX - x0) * dir));
      askEl.style.width = w + 'px';
      place(askEl);
    };
    const up = () => {
      removeEventListener('mousemove', move, true);
      removeEventListener('mouseup', up, true);
      saveCfg({ barW: askEl.offsetWidth });
    };
    addEventListener('mousemove', move, true);
    addEventListener('mouseup', up, true);
  }

  function saveCfg(o) {
    Object.assign(cfg, o);
    try { chrome.storage.local.set(o); } catch (_) { /* ignore */ }
  }

  function showChatState() {
    if (!chatEl) return;
    chatEl.textContent = chat.length
      ? `이어서 대화 중 (${chat.length}) · 새 대화`
      : (cfg.keepChat ? '대화 이어가기 켬' : '대화 이어가기 끔');
  }

  function newChat() {
    chat = [];
    try { sessionStorage.removeItem(CHAT_KEY); } catch (_) {}
  }

  function loadChat() {
    try { chat = JSON.parse(sessionStorage.getItem(CHAT_KEY) || '[]'); } catch (_) { chat = []; }
    if (!Array.isArray(chat)) chat = [];
  }

  function saveChat() {
    try { sessionStorage.setItem(CHAT_KEY, JSON.stringify(chat.slice(-8))); } catch (_) {}
  }

  function openAsk() {
    if (!root || askOpen || !dogOn()) return;
    askOpen = true;
    clearTimeout(sayT); say.hidden = true;
    askInput.value = '';
    askInput.placeholder = SR ? '말하거나 타자로 짧게!' : '짧게 한 줄로 물어봐!';
    askEl.style.width = (cfg.barW || 340) + 'px';
    askEl.hidden = false;
    micHint('');
    showChatState();
    place(askEl);
    setState('listen');
    idleSince = Date.now();
    setTimeout(() => askInput.focus(), 30);
  }

  function closeAsk(tip) {
    if (!askOpen) return;
    askOpen = false;
    stopMic();
    askEl.hidden = true;
    busy = false;
    setState('sit');
    if (tip && dogOn()) showSay(nextTip(), 'tip');
  }

  const MIC_ERR = {
    'not-allowed': '마이크가 막혀 있어. 주소창 왼쪽 자물쇠 → 마이크 → 허용!',
    'service-not-allowed': '브라우저가 음성 인식을 막았어. 타자로 써줘!',
    'audio-capture': '마이크를 못 찾겠어. 연결됐는지 봐줄래?',
    'network': '인터넷이 불안한가 봐. 타자로 써줘!',
    'aborted': '',
  };

  function stopMic() {
    if (rec) { try { rec.stop(); } catch (_) {} rec = null; }
    if (micEl) micEl.classList.remove('rec');
  }

  async function toggleMic() {
    if (rec) { stopMic(); micHint('멈췄어. 타자로 써도 돼!'); return; }
    if (!SR) { micHint('이 브라우저는 음성 인식이 안 돼. 타자로 써줘!'); return; }
    if (!isSecureContext) { micHint('이 사이트(http)에선 마이크가 안 돼. 타자로!'); return; }
    micHint('마이크 준비 중...');
    try {
      const st = await navigator.permissions?.query({ name: 'microphone' }).catch(() => null);
      if (st && st.state === 'denied') {
        micHint('마이크가 차단돼 있어. 주소창 왼쪽 자물쇠 → 마이크 → 허용!');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      micHint(e && e.name === 'NotAllowedError'
        ? '마이크를 막아놨네. 주소창 왼쪽 자물쇠 → 마이크 → 허용!'
        : '마이크를 못 열었어. 타자로 써줘!');
      return;
    }
    startRec(false);
  }

  function startRec(isRetry) {
    try {
      rec = new SR();
      rec.lang = 'ko-KR';
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const t = [...e.results].map((r) => r[0].transcript).join('').trim();
        askInput.value = t;
        if (t) micHint('“' + t + '”');
        if (e.results[e.results.length - 1].isFinal && t) { stopMic(); sendAsk(); }
      };
      rec.onerror = (e) => {
        stopMic();
        if (e.error === 'no-speech' && !isRetry) { micHint('안 들려. 다시 말해줘!'); startRec(true); return; }
        if (e.error === 'no-speech') { micHint('아무 말도 안 들렸어. 다시 눌러줘!'); return; }
        micHint(MIC_ERR[e.error] || '잘 못 들었어. 타자로 써줄래?');
      };
      rec.onend = () => { if (rec) { stopMic(); micHint(''); } };
      rec.start();
      micEl.classList.add('rec');
      micHint('듣고 있어... 다시 누르면 멈춰');
    } catch (_) {
      stopMic();
      micHint('마이크를 못 열었어. 타자로 써줘!');
    }
  }

  function sendAsk() {
    const q = askInput.value.trim();
    if (!q) return;
    const mode = activeMode();
    closeAsk(false);
    setState('listen');
    busy = true;
    const waiting = spawn('음... 잠깐만!', 'answer');
    let done = false;
    const answer = (parts) => {
      if (done) return;
      done = true;
      busy = false;
      setState('sit');
      drop(waiting);
      parts.slice(0, 4).forEach((t, i) => setTimeout(() => {
        if (cfg.enabled && root) spawn(t, 'answer');
      }, i * 800));
      chat.push({ q, a: parts.join(' ').slice(0, 160) });
      if (chat.length > 8) chat.shift();
      saveChat();
      showChatState();
    };
    try {
      chrome.runtime.sendMessage(
        { type: 'ask', mode, q, ctx: pageContext(),
          history: cfg.keepChat === false ? [] : chat.slice(-4) },
        (r) => {
          void chrome.runtime.lastError;
          answer(r?.parts?.length ? r.parts : [r?.text || '잘 모르겠어...']);
        }
      );
    } catch (_) { answer(['지금은 대답을 못 하겠어...']); }
    setTimeout(() => answer(['너무 오래 걸리네. 다시 물어봐줄래?']), 15000);
  }

  function poke() {
    if (Date.now() - lastPoke < 700 || askOpen || !dogOn()) return;
    lastPoke = Date.now();
    clearTimeout(sayT);
    say.hidden = true;
    busy = true;
    setState('listen'); idleSince = Date.now();
    popHearts(1 + Math.floor(Math.random() * 3));

    let done = false;
    const after = (bondLine) => {
      if (done) return;
      done = true;
      busy = false;
      if (!cfg.enabled || !root) return;
      if (bondLine) { setState('sit'); showSay(bondLine, 'bond'); }
      else openAsk();
    };
    try {
      chrome.runtime.sendMessage({ type: 'pet' }, (r) => {
        void chrome.runtime.lastError;
        setTimeout(() => after(r?.line), 700);
      });
    } catch (_) { /* ignore */ }
    setTimeout(() => after(null), 1100);
  }

  // ---------- 시작/정지 ----------
  function start() {
    mount();
    loadChat();
    schedule();
    readFlags();
    readTabs();
    clearInterval(tickT);
    tickT = setInterval(tick, TICK);
    clearInterval(tabT);
    tabT = setInterval(() => { if (!document.hidden) readTabs(); }, 30000);
  }

  addEventListener('scroll', () => { lastScroll = Date.now(); }, { passive: true });
  addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseAt = Date.now(); }, { passive: true });
  addEventListener('resize', () => {
    if (!root) return;
    dog.x = clampX(dog.x);
    if (!say.hidden) place(say);
    if (askOpen) place(askEl);
    render();
  });
  addEventListener('visibilitychange', () => { if (!document.hidden) idleSince = Date.now(); });
  addEventListener('pagehide', flushCounts);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && askOpen) closeAsk(false);
  }, true);
  addEventListener('mousedown', (e) => {
    if (askOpen && !e.composedPath().includes(askEl)) closeAsk(false);
  }, true);

  new MutationObserver(() => {
    if (cfg.enabled && root && !root.isConnected) document.documentElement.appendChild(root);
  }).observe(document.documentElement, { childList: true });

  chrome.storage.local.get({ ...DEFAULTS, counts: {} }, (v) => {
    cfg = { ...DEFAULTS, ...v };
    counts = v.counts || {};
    if (cfg.enabled) start();
  });

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    for (const k in ch) if (k !== 'counts') cfg[k] = ch[k].newValue;
    if ('mode' in ch) { queue = []; recent = []; lastFetch = 0; }
    if ('dog' in ch) applyDog();
    if (('freq' in ch || 'pos' in ch || 'size' in ch || 'edge' in ch) && root) {
      if ('pos' in ch || 'size' in ch || 'edge' in ch) for (const b of [...live]) kill(b);
      if (!plan().max) { clearTimeout(nextT); for (const b of [...live]) kill(b); }
      else { clearTimeout(nextT); nextT = setTimeout(fill, 250); }
    }
    if ('enabled' in ch) {
      if (cfg.enabled) start();
      else unmount();
    }
  });
})();
