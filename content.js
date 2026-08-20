// 화면 양쪽에서 말풍선이 뜨고, 아래에서는 도트 골든 리트리버가 돌아다닌다.
//  · 사이드 말풍선 — 좌/우 가장자리. 빈도 설정에 따라 정해진 수를 계속 채운다.
//  · 개 말풍선     — 쓰다듬었을 때 꿀팁·애정도 멘트.
//  · 질문 패널     — Alt+F 또는 개를 클릭하면 화면 가운데. 마이크와 타자 둘 다 받는다.
(() => {
  const D = globalThis.CB_DOG, LINES = globalThis.CB_LINES;
  if (!D || !LINES || window.top !== window) return;   // 아이프레임에는 안 붙인다

  const SCALE = 3, DOG_W = D.W * SCALE, DOG_H = D.H * SCALE;
  const DEFAULTS = { enabled: true, mode: 'basic', ai: true, freq: 'normal',
                     follow: true, pos: 'both' };
  const OLD_FREQ = { quiet: 0, normal: 3, chatty: 7 };   // 예전 설정값도 받아준다
  const SS = 'cheerBuddy.bubbles';
  const TICK = 100, WALK_PX = 14, SLEEP_AFTER = 75000;
  const FOLLOW_GAP = 70, FOLLOW_GIVEUP = 8000;
  const LIFE = [2800, 16000];
  // 말풍선을 화면 어디에 띄울지
  const SIDES = { right: ['right'], left: ['left'], both: ['left', 'right'],
                  top: ['top'], bottom: ['bottom'] };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

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

  /* 화면 양쪽에서 미끄러져 들어온다 */
  .side{max-width:44vw}
  .side.left{animation:inL .38s cubic-bezier(.2,1.5,.4,1) both}
  .side.right{animation:inR .38s cubic-bezier(.2,1.5,.4,1) both}
  @keyframes inL{from{opacity:0;transform:translateX(-34px) scale(.88)}
                 to{opacity:1;transform:none}}
  @keyframes inR{from{opacity:0;transform:translateX(34px) scale(.88)}
                 to{opacity:1;transform:none}}
  .side.top{animation:inT .38s cubic-bezier(.2,1.5,.4,1) both}
  .side.bottom{animation:inB .38s cubic-bezier(.2,1.5,.4,1) both}
  @keyframes inT{from{opacity:0;transform:translateY(-30px) scale(.9)}
                 to{opacity:1;transform:none}}
  @keyframes inB{from{opacity:0;transform:translateY(30px) scale(.9)}
                 to{opacity:1;transform:none}}
  .side.top.out{animation:outT .3s ease-in forwards}
  .side.bottom.out{animation:outB .3s ease-in forwards}
  @keyframes outT{to{opacity:0;transform:translateY(-22px) scale(.92)}}
  @keyframes outB{to{opacity:0;transform:translateY(22px) scale(.92)}}
  .side.left.out{animation:outL .3s ease-in forwards}
  .side.right.out{animation:outR .3s ease-in forwards}
  @keyframes outL{to{opacity:0;transform:translateX(-24px) scale(.9)}}
  @keyframes outR{to{opacity:0;transform:translateX(24px) scale(.9)}}
  .side.quiet{animation:none;opacity:1}

  /* 개가 무는 말풍선. 꼬리가 개를 가리킨다 */
  .say{bottom:${DOG_H + 16}px;left:0;max-width:264px;font-size:15px;
       transform-origin:var(--tail) 130%;
       animation:pop .34s cubic-bezier(.2,1.6,.4,1) both}
  .say::before,.say::after{content:'';position:absolute;border-style:solid}
  .say::before{left:calc(var(--tail) - 9px);bottom:-14px;
               border-width:11px 9px 0 9px;border-color:var(--ink) transparent transparent}
  .say::after{left:calc(var(--tail) - 6px);bottom:-8px;
              border-width:8px 6px 0 6px;border-color:var(--bg) transparent transparent}
  .say.out{animation:bye .32s ease-in forwards}
  @keyframes pop{0%{opacity:0;transform:scale(.4) translateY(12px)}
                 100%{opacity:1;transform:scale(1) translateY(0)}}
  @keyframes bye{to{opacity:0;transform:scale(.85) translateY(8px)}}

  /* 화면 한가운데 질문 패널 */
  .ask{position:absolute;left:50%;top:34%;width:min(430px,86vw);max-width:none;
       transform:translate(-50%,-50%);pointer-events:auto;
       --bg:#fff6fb;--ink:#b0446e;padding:14px 15px 12px;
       box-shadow:0 8px 0 rgba(0,0,0,.12),inset 0 3px 0 rgba(255,255,255,.7),
                  0 0 0 9999px rgba(40,20,35,.22);
       animation:askIn .3s cubic-bezier(.2,1.6,.4,1) both}
  @keyframes askIn{0%{opacity:0;transform:translate(-50%,-50%) scale(.86)}
                   100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}
  .ask h3{font:400 15px/1.4 'CBGalmuri',monospace;margin-bottom:3px}
  .ask .nudge{font:400 12px/1.5 'CBGalmuri',monospace;opacity:.72;margin-bottom:9px}
  .ask .row{display:flex;align-items:center;gap:8px}
  .ask canvas{cursor:pointer;image-rendering:pixelated;flex:none;
              padding:4px;border:2px solid var(--ink);border-radius:9px;
              background:rgba(255,255,255,.8)}
  .ask canvas.rec{background:#ffdbe6;animation:blink .8s steps(2,end) infinite}
  @keyframes blink{50%{opacity:.35}}
  .ask input{flex:1;min-width:0;border:2px solid var(--ink);border-radius:9px;
             background:rgba(255,255,255,.85);color:var(--ink);
             font:400 14px 'CBGalmuri',monospace;padding:7px 9px;outline:none}
  .ask input::placeholder{color:var(--ink);opacity:.45}
  .ask button{flex:none;border:2px solid var(--ink);border-radius:9px;cursor:pointer;
              background:#ffd9ea;color:var(--ink);
              font:400 13px 'CBGalmuri',monospace;padding:7px 11px}
  .ask button:hover{background:#ffc7de}
  .ask .foot{margin-top:8px;font:400 11px 'CBGalmuri',monospace;opacity:.6}

  .c1{--bg:#ffd9ea;--ink:#b0446e}.c2{--bg:#d3f5e5;--ink:#2b8a66}.c3{--bg:#fff2c2;--ink:#a8791f}
  .c4{--bg:#e4dcff;--ink:#6a51c2}.c5{--bg:#d5ecff;--ink:#356ea8}.c6{--bg:#ffe4d2;--ink:#c26a2f}
  .c7{--bg:#e6f7c7;--ink:#5d8a24}
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

  let cfg = { ...DEFAULTS };
  let root, sh, cv, ctx, say, zzz, askEl, askInput, micEl, footEl;
  const FOOT = 'Enter 로 보내기 · Esc 로 닫기 · 대답은 양옆 말풍선으로 나와';
  const micHint = (t) => { if (footEl) footEl.textContent = t || FOOT; };
  const live = new Set();                       // 지금 떠 있는 사이드 말풍선
  const dog = { x: 60, dir: 1, state: 'sit', frame: 0, target: 0, acc: 0 };
  let tickT = 0, nextT = 0, sayT = 0, arrive = null, rec = null;
  let recent = [], queue = [], lastFetch = 0, href = location.href;
  let counts = {}, delta = {}, flushT = 0;     // 멘트별 출력 횟수 (적게 나온 것부터 고른다)
  let idleSince = Date.now(), lastScroll = 0, busy = false, lastPoke = 0;
  let mouseX = null, mouseAt = 0, nextSide = Math.random() < 0.5 ? 'left' : 'right';
  let askOpen = false;

  const clampX = (x) => Math.max(4, Math.min(innerWidth - DOG_W - 4, x));
  // 동시에 띄울 목표 개수(0~10)와, 빈자리를 채우러 오는 간격(ms)
  function plan() {
    const raw = typeof cfg.freq === 'number' ? cfg.freq : (OLD_FREQ[cfg.freq] ?? 3);
    const max = Math.max(0, Math.min(10, Math.round(raw)));
    if (!max) return { min: 0, max: 0, gap: [0, 0] };
    return { min: Math.max(1, max - 1), max,
             gap: [Math.max(320, 3000 / max), Math.max(900, 7000 / max)] };
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

    say = el('div', 'bubble say c1', sh); say.hidden = true;
    cv = el('canvas', 'dog', sh);
    cv.width = DOG_W; cv.height = DOG_H;
    cv.title = '멍! (누르면 질문 창이 열려)';
    zzz = el('div', 'zzz', sh); zzz.textContent = 'z z';
    ctx = cv.getContext('2d');
    cv.addEventListener('click', poke);
    buildAsk();
    document.documentElement.appendChild(root);

    // 폰트는 확장 리소스에서. 페이지 CSP를 타지 않는다.
    new FontFace('CBGalmuri', `url("${chrome.runtime.getURL('fonts/Galmuri11.woff2')}")`)
      .load().then((f) => document.fonts.add(f)).catch(() => {});

    dog.x = clampX(dog.x);
    render();
  }

  function unmount() {
    clearInterval(tickT); clearTimeout(nextT); clearTimeout(sayT);
    for (const b of live) { clearTimeout(b._t); b.remove(); }
    live.clear();
    tickT = nextT = sayT = 0;
    if (root) root.remove();
    root = null;
  }

  // ---------- 개 ----------
  function setState(s) {
    if (dog.state === s) return;
    dog.state = s; dog.frame = 0; dog.acc = 0;
    zzz.classList.toggle('on', s === 'sleep');
  }

  function render() {
    const t = `translate3d(${Math.round(dog.x)}px,0,0)`;
    cv.style.transform = t; zzz.style.transform = t;
    D.draw(ctx, dog.state, dog.frame, SCALE, dog.dir < 0);
  }

  // 마우스를 쫓아간다. 말풍선을 물고 있거나 질문을 듣는 중엔 가만히 있는다.
  function follow(now) {
    if (!cfg.follow || mouseX == null || !say.hidden || busy || askOpen || arrive) return;
    if (now - mouseAt > FOLLOW_GIVEUP) return;   // 마우스가 한참 멈춰 있으면 관심을 끊는다
    const want = clampX(mouseX - DOG_W / 2);
    // 70px 안쪽이면 앉는다. 이 여유가 없으면 커서에 딱 붙어 덜덜 떤다.
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
    if (location.href !== href) { href = location.href; queue = []; lastFetch = 0; }

    follow(now);

    if (dog.state === 'walk') {
      const dx = dog.target - dog.x;
      if (Math.abs(dx) <= WALK_PX) {
        dog.x = dog.target; setState('sit');
        if (arrive) { const f = arrive; arrive = null; f(); }
      } else {
        dog.dir = Math.sign(dx); dog.x += dog.dir * WALK_PX;
      }
      if (!say.hidden) placeSay();          // 말풍선을 문 채 움직이면 꼬리도 따라간다
    } else if (dog.state === 'sit' && say.hidden && !busy && !askOpen &&
               now - idleSince > SLEEP_AFTER) {
      setState('sleep');
    }

    dog.acc += TICK;
    if (dog.acc >= D.SPEED[dog.state]) { dog.acc = 0; dog.frame++; }
    render();
  }

  // ---------- 멘트 고르기 ----------
  function pool() {
    const h = new Date().getHours();
    const src = LINES[cfg.mode] || LINES.basic;
    const timed = [], plain = [];
    for (const s of src) {
      const m = /^(\d+)-(\d+)\|/.exec(s);
      if (!m) { plain.push(s); continue; }
      if (h >= +m[1] && h < +m[2]) timed.push(s.slice(m[0].length));
    }
    // 시간대 멘트는 30% 확률로 우선 노출
    return (timed.length && Math.random() < 0.3) ? timed : plain.concat(timed);
  }

  // 적게 나온 멘트부터 고른다. 다만 열에 셋은 그냥 랜덤 — 순서가 뻔해지지 않게.
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

  function pickLocal(list) {
    const all = list || pool();
    const fresh = all.filter((t) => !recent.includes(t));
    return leastUsed(fresh.length ? fresh : all);
  }

  // 페이지에서 진짜 핵심만 뽑는다. 본문 통째로 보내면 모델이 요약을 시작한다.
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

  // 큐가 비면 백그라운드로 10개 채워둔다. 지금 말할 대사를 기다리게 만들지 않는다.
  function refill() {
    if (!cfg.ai || queue.length > 2 || Date.now() - lastFetch < 45000) return;
    lastFetch = Date.now();
    try {
      chrome.runtime.sendMessage(
        { type: 'lines', mode: cfg.mode, ctx: pageContext() },
        (res) => {
          void chrome.runtime.lastError;
          if (Array.isArray(res) && res.length) queue.push(...res);
        }
      );
    } catch (_) { /* 확장이 방금 리로드된 경우 */ }
  }

  function remember(t) {
    recent.push(t); if (recent.length > 24) recent.shift();
    counts[t] = (counts[t] || 0) + 1;
    delta[t] = (delta[t] || 0) + 1;
    clearTimeout(flushT);
    flushT = setTimeout(flushCounts, 12000);   // 탭마다 쓰지 않게 몰아서 저장
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
    } catch (_) { /* 확장이 방금 리로드된 경우 */ }
  }

  // 큐는 순차로 꺼내되 가끔 로컬 멘트를 섞어 예측을 깬다.
  // 꿀팁은 개 몫이라 사이드 말풍선에서는 건너뛴다.
  function nextLine() {
    refill();
    const i = queue.findIndex((q) => q.kind !== 'tip' && !recent.includes(q.text));
    const item = (i >= 0 && Math.random() < 0.78)
      ? queue.splice(i, 1)[0]
      : { text: pickLocal(), kind: '' };
    remember(item.text);
    return item;
  }

  // 개가 물 대사: AI가 준 꿀팁이 있으면 그걸, 없으면 내장 꿀팁.
  function nextTip() {
    const i = queue.findIndex((q) => q.kind === 'tip' && !recent.includes(q.text));
    const text = i >= 0 ? queue.splice(i, 1)[0].text : pickLocal(LINES.tips);
    remember(text);
    return text;
  }

  // ---------- 사이드 말풍선 ----------
  function schedule() {
    clearTimeout(nextT);
    const p = plan();
    if (!p.max) return;                       // 조용 모드면 아무것도 안 띄운다
    nextT = setTimeout(fill, rnd(p.gap[0], p.gap[1]));
  }

  function fill() {
    if (!cfg.enabled || !root) return;
    const p = plan();
    if (!p.max) return;
    if (document.hidden) { nextT = setTimeout(fill, 3000); return; }
    // 빈자리를 채우되 한 번에 최대 두 개까지만. 그래야 와다다 터지지 않는다.
    const want = Math.round(rnd(p.min, p.max + 0.49));
    const need = Math.min(2, want - live.size);
    for (let i = 0; i < need; i++) {
      setTimeout(() => {
        if (!cfg.enabled || !root || live.size >= p.max) return;
        const item = nextLine();
        spawn(item.text, item.kind);
      }, i * 320);
    }
    schedule();
  }

  // 같은 자리에 이미 뜬 말풍선과 겹치지 않는 위치를 찾는다.
  // 좌·우 벽은 세로로, 위·아래 밴드는 가로로 흩어놓는다.
  function freeSlot(side, size) {
    const vert = side === 'left' || side === 'right';
    const span = vert ? [innerHeight * 0.08, innerHeight * 0.82]
                      : [10, Math.max(20, innerWidth - size - 10)];
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

  // 크기도 색도 높이도 매번 다르게 — 같은 자리에 같은 말풍선이 반복되지 않게.
  function spawn(text, kind, opt = {}) {
    const side = opt.side || nextPlace();
    const b = el('div', 'bubble side ' + side + ' ' +
                 (opt.cls || KIND_CLS[kind] || pick(CANDY)), sh);
    b.textContent = text;
    b.dataset.side = side;
    b.style.fontSize = (opt.size || Math.round(rnd(13, 18.9))) + 'px';
    b.style.maxWidth = (opt.width || Math.round(rnd(170, 320))) + 'px';
    if (opt.quiet) b.classList.add('quiet');

    // 좌·우는 벽에 붙여 세로로, 위·아래는 밴드 안에서 가로로 흩어놓는다.
    const vert = side === 'left' || side === 'right';
    const cross = opt.cross != null ? opt.cross
      : Math.round(side === 'bottom' ? rnd(74, 200)
        : side === 'top' ? rnd(14, 130) : rnd(12, 96));
    b.style[side] = cross + 'px';
    b.style[vert ? 'bottom' : 'left'] = '0px';
    const main = opt.main != null ? opt.main
      : freeSlot(side, vert ? b.offsetHeight : b.offsetWidth);
    b.style[vert ? 'bottom' : 'left'] = main + 'px';
    b._pos = { cross, main };
    live.add(b);

    // 읽는 데 필요한 최소 시간에 넉넉한 편차를 곱한다.
    // 편차가 좁으면 같이 뜬 말풍선이 같이 사라져서 눈에 띈다.
    const need = LIFE[0] + text.length * 90;
    const dur = opt.until ? opt.until - Date.now()
                          : Math.min(LIFE[1], need * rnd(0.75, 2.3));
    b._until = Date.now() + dur;
    b._t = setTimeout(() => kill(b), Math.max(1200, dur));
    persist();
    return b;
  }

  function kill(b) {
    if (!live.has(b)) return;
    // 탭을 안 보고 있거나 방금 스크롤했으면 조금 더 띄워둔다
    if (document.hidden || Date.now() - lastScroll < 1200) {
      b._t = setTimeout(() => kill(b), 1200); return;
    }
    b.classList.add('out');
    live.delete(b);
    setTimeout(() => b.remove(), 320);
    persist();
  }

  // ---------- 개 말풍선 ----------
  function showSay(text, kind) {
    say.textContent = text;
    say.className = 'bubble say ' + (KIND_CLS[kind] || 'k-tip');
    say.hidden = false;
    placeSay();
    clearTimeout(sayT);
    sayT = setTimeout(hideSay, Math.min(11000, 2600 + text.length * 120) * rnd(0.9, 1.2));
    idleSince = Date.now();
  }

  function placeSay() {
    const w = say.offsetWidth, cx = dog.x + DOG_W / 2;
    const left = Math.max(8, Math.min(innerWidth - w - 8, Math.round(cx - w / 2)));
    say.style.left = left + 'px';
    say.style.setProperty('--tail', (cx - left) + 'px');
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
      setTimeout(() => c.remove(), 2500);   // 렌더가 멈춰 animationend 가 안 와도 치운다
      sh.appendChild(c);
    }
  }

  // ---------- 질문 패널 ----------
  function buildAsk() {
    askEl = el('div', 'bubble ask', sh);
    askEl.hidden = true;
    el('h3', null, askEl).textContent = '뭐 물어볼래?';
    el('div', 'nudge', askEl).textContent =
      '짧게 한 가지만! 긴 건 말풍선에 안 들어가.  예) 이 사이트 믿을 만해?';
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
    send.textContent = '물어보기';
    send.addEventListener('click', sendAsk);
    footEl = el('div', 'foot', askEl);
    micHint('');

    askInput.addEventListener('keydown', (e) => {
      e.stopPropagation();                    // 사이트 단축키와 안 부딪히게
      if (e.key === 'Enter') sendAsk();
      else if (e.key === 'Escape') closeAsk(true);
    });
  }

  function openAsk() {
    if (!root || askOpen) return;
    askOpen = true;
    clearTimeout(sayT); say.hidden = true;
    askInput.value = '';
    askInput.placeholder = SR ? '말하거나 타자로 짧게!' : '짧게 한 줄로 물어봐!';
    askEl.hidden = false;
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
    if (tip) showSay(nextTip(), 'tip');
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
    micEl.classList.remove('rec');
  }

  // 권한을 먼저 받아야 한다. 바로 start() 하면 크롬이 프롬프트도 안 띄우고
  // not-allowed 로 끝내버려서 "누르자마자 꺼진다"처럼 보인다.
  async function toggleMic() {
    if (rec) { stopMic(); micHint('멈췄어. 타자로 써도 돼!'); return; }
    if (!SR) { micHint('이 브라우저는 음성 인식이 안 돼. 타자로 써줘!'); return; }
    if (!isSecureContext) { micHint('이 사이트(http)에선 마이크가 안 돼. 타자로 써줘!'); return; }
    micHint('마이크 준비 중...');
    try {
      const st = await navigator.permissions?.query({ name: 'microphone' }).catch(() => null);
      if (st && st.state === 'denied') {
        micHint('마이크가 차단돼 있어. 주소창 왼쪽 자물쇠 → 마이크 → 허용!');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());   // 권한만 확인하고 바로 끈다
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
        // 말을 시작하기 전에 끊기는 일이 잦아서 한 번은 더 들어준다
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
      clearTimeout(waiting._t); kill(waiting);
      // 대답이 여러 줄이면 좌우로 번갈아 하나씩 띄운다
      parts.slice(0, 4).forEach((t, i) => setTimeout(() => {
        if (cfg.enabled && root) spawn(t, 'answer');
      }, i * 800));
    };
    try {
      chrome.runtime.sendMessage(
        { type: 'ask', mode: cfg.mode, q, ctx: pageContext() },
        (r) => {
          void chrome.runtime.lastError;
          answer(r?.parts?.length ? r.parts : [r?.text || '잘 모르겠어...']);
        }
      );
    } catch (_) { answer(['지금은 대답을 못 하겠어...']); }
    setTimeout(() => answer(['너무 오래 걸리네. 다시 물어봐줄래?']), 15000);
  }

  // 쓰다듬기: 하트 뿜고 질문 창을 연다. 애정도가 오르는 순간에는 감동부터 한다.
  function poke() {
    if (Date.now() - lastPoke < 700 || askOpen) return;
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
    setTimeout(() => after(null), 1100);   // 백그라운드가 안 깨어나도 창은 열린다
  }

  // ---------- 페이지를 넘어가도 이어지게 ----------
  function persist() {
    const list = [...live].map((b) => ({
      side: b.dataset.side, text: b.textContent, until: b._until,
      cls: b.className.replace(/bubble side (left|right) /, '')
        .replace(' quiet', '').replace(' out', ''),
      size: parseInt(b.style.fontSize, 10),
      width: parseInt(b.style.maxWidth, 10),
      main: b._pos?.main, cross: b._pos?.cross,
    }));
    if (list.length) sessionStorage.setItem(SS, JSON.stringify(list));
    else sessionStorage.removeItem(SS);
  }

  function restore() {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(SS) || 'null'); } catch (_) {}
    if (!Array.isArray(saved) || !plan().max) return;
    for (const s of saved) {
      if (s.until - Date.now() < 900) continue;
      spawn(s.text, null, { ...s, quiet: true });
    }
  }

  // ---------- 시작/정지 ----------
  function start() {
    mount();
    restore();
    schedule();
    clearInterval(tickT);
    tickT = setInterval(tick, TICK);
  }

  addEventListener('scroll', () => { lastScroll = Date.now(); }, { passive: true });
  addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseAt = Date.now(); }, { passive: true });
  addEventListener('resize', () => {
    if (!root) return;
    dog.x = clampX(dog.x); if (!say.hidden) placeSay(); render();
  });
  addEventListener('visibilitychange', () => { if (!document.hidden) idleSince = Date.now(); });
  addEventListener('keydown', (e) => {
    if (!cfg.enabled || !root) return;
    if (e.altKey && !e.ctrlKey && !e.metaKey &&
        (e.code === 'KeyF' || e.key === 'f' || e.key === 'F' || e.key === 'ㄹ')) {
      e.preventDefault(); e.stopPropagation();
      if (askOpen) closeAsk(false); else openAsk();
    } else if (e.key === 'Escape' && askOpen) {
      closeAsk(false);
    }
  }, true);
  // 패널 바깥을 누르면 닫는다
  addEventListener('mousedown', (e) => {
    if (askOpen && !e.composedPath().includes(askEl)) closeAsk(false);
  }, true);

  // 툴바 단축키(chrome://extensions/shortcuts)로도 열 수 있다
  chrome.runtime.onMessage.addListener((m) => {
    if (m?.type !== 'openAsk' || !cfg.enabled || !root) return;
    if (askOpen) closeAsk(false); else openAsk();
  });

  // 사이트가 body를 통째로 갈아끼워도 다시 붙는다
  new MutationObserver(() => {
    if (cfg.enabled && root && !root.isConnected) document.documentElement.appendChild(root);
  }).observe(document.documentElement, { childList: true });

  addEventListener('pagehide', flushCounts);

  chrome.storage.local.get({ ...DEFAULTS, counts: {} }, (v) => {
    cfg = { ...DEFAULTS, ...v };
    counts = v.counts || {};
    if (cfg.enabled) start();
  });

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    for (const k in ch) cfg[k] = ch[k].newValue;
    if ('mode' in ch) { queue = []; recent = []; lastFetch = 0; }
    if (('freq' in ch || 'pos' in ch) && root) {
      if ('pos' in ch) for (const b of [...live]) kill(b);   // 자리를 옮겼으니 비운다
      if (!plan().max) { clearTimeout(nextT); for (const b of [...live]) kill(b); }
      else schedule();
    }
    if ('enabled' in ch) {
      if (cfg.enabled) start();
      else { sessionStorage.removeItem(SS); unmount(); }
    }
  });
})();
