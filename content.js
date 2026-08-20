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
    dogPos: null,
    pomoOn: true, pomoSound: true, pomoFocusMin: 25, pomoBreakMin: 5, pomoLongBreakMin: 15,
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

  /* ── 8비트 도트 픽셀 아이콘 & 페르소나별 고유 스타일 ── */
  .p-icon{display:inline-block;vertical-align:-2px;margin-right:6px;image-rendering:pixelated;flex:none}
  .p-basic{--bg:#fffbf0;--ink:#7c4d12;border-color:#e5a73b;
           box-shadow:0 4px 0 rgba(160,100,20,.12),inset 0 3px 0 rgba(255,255,255,.85)}
  .p-commu{--bg:#edf3fc;--ink:#1b3874;border-color:#456db5;
           box-shadow:0 4px 0 rgba(25,60,130,.12),inset 0 3px 0 rgba(255,255,255,.85)}
  .p-sunbi{--bg:#f6eee4;--ink:#523418;border-color:#8c5d36;
           box-shadow:0 4px 0 rgba(90,55,25,.12),inset 0 3px 0 rgba(255,255,255,.85)}
  .p-tsun{--bg:#fff0f6;--ink:#b82b6c;border-color:#f06292;
          background-image:url(${heartPattern});background-repeat:repeat;
          box-shadow:0 4px 0 rgba(190,40,110,.12),inset 0 3px 0 rgba(255,255,255,.85)}
  .p-pomo{--bg:#fff2f0;--ink:#cf1322;border-color:#ff4d4f;
          box-shadow:0 4px 0 rgba(220,30,40,.15),inset 0 3px 0 rgba(255,255,255,.85)}

  .k-warn{--bg:#ffe2e2;--ink:#c0392b;border-style:dashed}
  .k-tip{--bg:#d9f7e6;--ink:#20805a}
  .k-info{--bg:#e2edff;--ink:#3a68b0}
  .k-answer{--bg:#e8e2ff;--ink:#5a44b8;box-shadow:0 4px 0 rgba(0,0,0,.1),
            inset 0 3px 0 rgba(255,255,255,.6),0 0 0 3px rgba(140,110,255,.22)}
  .k-bond{--bg:#ffd0e6;--ink:#c2367a;box-shadow:0 4px 0 rgba(0,0,0,.1),
          inset 0 3px 0 rgba(255,255,255,.6),0 0 0 4px rgba(255,140,190,.28)}

  /* ── 뽀모도로 타이머 UI ── */
  .pomo-widget{position:fixed;bottom:12px;right:18px;pointer-events:auto;z-index:2147483640;
               font-family:'CBGalmuri','Galmuri11',monospace;user-select:none;
               transition:transform .2s ease,opacity .2s ease}
  .pomo-pill{display:flex;align-items:center;gap:6px;padding:6px 12px;
             border:2.5px solid #d4380d;border-radius:20px;background:#fff2e8;color:#d4380d;
             cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.15),inset 0 2px 0 rgba(255,255,255,.8);
             font-size:13px;font-weight:700}
  .pomo-pill:hover{background:#ffe7ba;transform:translateY(-1px)}
  .pomo-pill canvas{image-rendering:pixelated;flex:none}
  .pomo-pill.running{animation:pomoPulse 2s ease-in-out infinite}
  @keyframes pomoPulse{0%,100%{box-shadow:0 3px 0 rgba(0,0,0,.15),0 0 0 0 rgba(255,77,79,.4)}
                       50%{box-shadow:0 3px 0 rgba(0,0,0,.15),0 0 0 6px rgba(255,77,79,0)}}

  .pomo-hud{position:absolute;bottom:0;right:0;width:240px;padding:12px;
            border:3px solid #d4380d;border-radius:14px;background:#fff7f0;color:#5a1e06;
            box-shadow:0 6px 0 rgba(0,0,0,.18),inset 0 3px 0 rgba(255,255,255,.9);
            animation:pop .28s cubic-bezier(.2,1.6,.4,1) both}
  .pomo-hud .hud-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;
                      font-size:12px;font-weight:700;color:#d4380d}
  .pomo-hud .hud-icons{display:flex;gap:5px;align-items:center}
  .pomo-hud .icon-btn{cursor:pointer;padding:2px 5px;border:1.5px solid #d4380d;border-radius:6px;
                      background:#fff;color:#d4380d;font-size:11px;line-height:1}
  .pomo-hud .icon-btn:hover{background:#ffd591}
  .pomo-hud .hud-clock{text-align:center;font-size:32px;font-weight:700;line-height:1.1;
                       color:#cf1322;letter-spacing:1px;margin:6px 0 4px;font-variant-numeric:tabular-nums}
  .pomo-hud .hud-status{text-align:center;font-size:11px;color:#873800;margin-bottom:8px}
  .pomo-hud .hud-bar{height:8px;border:1.5px solid #d4380d;border-radius:5px;background:#ffe7ba;
                     overflow:hidden;margin-bottom:10px}
  .pomo-hud .hud-prog{height:100%;background:repeating-linear-gradient(90deg,#ff4d4f 0 4px,#ff7875 4px 8px);
                      width:0%;transition:width .3s ease}
  .pomo-hud .hud-modes{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:8px}
  .pomo-hud .hud-modes button{padding:4px 0;font:inherit;font-size:11px;border:1.5px solid #d4380d;
                              border-radius:6px;background:#fff;color:#873800;cursor:pointer}
  .pomo-hud .hud-modes button.on{background:#ffd591;border-color:#ad2102;font-weight:700;color:#5a1e06}
  .pomo-hud .hud-acts{display:flex;gap:5px}
  .pomo-hud .hud-acts button{flex:1;padding:6px 0;font:inherit;font-size:12px;font-weight:700;
                             border:2px solid #d4380d;border-radius:8px;cursor:pointer}
  .pomo-hud .btn-main{background:#ffd591;color:#5a1e06}
  .pomo-hud .btn-main:hover{background:#ffc069}
  .pomo-hud .btn-sub{background:#fff;color:#873800}
  .pomo-hud .btn-sub:hover{background:#fff2e8}
  .pomo-hud .hud-sets{text-align:center;font-size:11px;color:#ad2102;margin-top:8px}

  [hidden]{display:none!important}`;

  const CANDY = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];
  const KIND_CLS = { warn: 'k-warn', tip: 'k-tip', info: 'k-info',
                     bond: 'k-bond', answer: 'k-answer', pomo: 'p-pomo' };
  const PERSONA_INFO = {
    basic: { icon: 'persona_basic', cls: 'p-basic' },
    commu: { icon: 'persona_commu', cls: 'p-commu' },
    tsun:  { icon: 'persona_tsun',  cls: 'p-tsun' },
    sunbi: { icon: 'persona_sunbi', cls: 'p-sunbi' },
    pomo:  { icon: 'persona_pomo',  cls: 'p-pomo' },
  };
  const PERSONA_CLS = {
    basic: 'p-basic',
    commu: 'p-commu',
    tsun: 'p-tsun',
    sunbi: 'p-sunbi',
    pomo: 'p-pomo',
  };

  // ── 8비트 사운드 신시사이저 (Web Audio API) ──
  const SFX_CTX = () => {
    if (!window._cbAudio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) window._cbAudio = new AC();
    }
    if (window._cbAudio && window._cbAudio.state === 'suspended') {
      window._cbAudio.resume();
    }
    return window._cbAudio;
  };

  function play8Bit(type = 'click') {
    if (cfg.pomoSound === false) return;
    try {
      const ctx = SFX_CTX();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'click') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.035);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'start') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.06);
        osc.frequency.setValueAtTime(783.99, now + 0.12);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.setValueAtTime(0.09, now + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (type === 'pause') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (type === 'half') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1174.66, now + 0.06);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'done') {
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        freqs.forEach((f, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = i === 3 ? 'triangle' : 'square';
          o.frequency.setValueAtTime(f, now + i * 0.07);
          g.gain.setValueAtTime(0.09, now + i * 0.07);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + (i === 3 ? 0.35 : 0.1));
          o.connect(g);
          g.connect(ctx.destination);
          o.start(now + i * 0.07);
          o.stop(now + i * 0.07 + (i === 3 ? 0.36 : 0.11));
        });
      } else if (type === 'break_done') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(783.99, now);
        osc.frequency.setValueAtTime(1046.50, now + 0.07);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      }
    } catch (_) {}
  }

  // ── 단일 진실 공급원 (Single Source of Truth) 뽀모도로 상태 ──
  const POMO_DEFAULT = {
    mode: 'focus',        // 'focus' | 'break' | 'longBreak'
    running: false,
    targetEndTime: 0,     // 유닉스 밀리초 타임스탬프 (Date.now() + rem*1000)
    durationSec: 25 * 60,
    pausedRemainingSec: 25 * 60,
    sets: 0,
    halfNotified: false,
    hudOpen: false,
  };
  let pomo = { ...POMO_DEFAULT };
  let pomoEl, pomoPill, pomoHud, pomoClockEl, pomoProgEl, pomoStatusEl, pomoSetsEl, pomoBtnMain;

  let cfg = { ...DEFAULTS };
  let root, sh, cv, ctx, say, zzz, askEl, askInput, micEl, footEl, chatEl;
  const FOOT = 'Enter 로 보내기 · Esc 로 닫기';
  const micHint = (t) => { if (footEl) footEl.firstChild.textContent = t || FOOT; };
  const live = new Set();
  const dog = { x: 60, dir: 1, state: 'sit', frame: 0, target: 0, acc: 0 };
  let tickT = 0, nextT = 0, sayT = 0, tabT = 0, posT = 0, arrive = null, rec = null;
  let recent = [], queue = [], lastFetch = 0, href = location.href;
  let counts = {}, delta = {}, flushT = 0, seq = 0;
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
    buildPomo();
    document.documentElement.appendChild(root);

    new FontFace('CBGalmuri', `url("${chrome.runtime.getURL('fonts/Galmuri11.woff2')}")`,
                 { display: 'swap' })
      .load().then((f) => document.fonts.add(f)).catch(() => {});

    loadDogPos();
    dog.x = clampX(dog.x);
    applyDog();
    applyPomoVisibility();
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
      // 화면이 바뀌었으니 앞 화면 기준으로 받아둔 대사는 버린다.
      // 다만 이미 떠 있는 말풍선은 건드리지 않는다 — 지우면 눈에 띄게 끊긴다.
      href = location.href; pageAt = now;
      saveDogPos();
      queue = []; lastFetch = 0;
    }
    if (now - flagT > 2000) { flagT = now; readFlags(); }

    follow(now);
    checkPomoTick();

    if (dog.state === 'walk') {
      const dx = dog.target - dog.x;
      if (Math.abs(dx) <= WALK_PX) {
        dog.x = dog.target; setState('sit');
        clearTimeout(posT); posT = setTimeout(saveDogPos, 6000);
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
    // 조건이 맞는 멘트는 수가 적다. 크기에 맞춰 우선순위를 준다 —
    // 무조건 앞세우면 같은 몇 개가 돌고 돌아 금세 지겨워진다.
    const bias = Math.min(0.45, fit.length / 40);
    return (fit.length && Math.random() < bias) ? fit : plain.concat(fit);
  }

  // 한 번 쓴 멘트는 줄 맨 뒤로 보낸다.
  // counts[t] 는 '마지막으로 쓴 순번' — 작을수록 오래전에 썼다는 뜻.
  function leastUsed(list) {
    if (!list.length) return '';
    // 아직 한 번도 안 나온 게 있으면 그것부터. 풀을 한 바퀴 다 돈다.
    const fresh = list.filter((t) => !counts[t]);
    if (fresh.length) return pick(fresh);
    // 다 돌았으면 가장 오래전에 쓴 쪽에서만 고른다.
    const sorted = [...list].sort((a, b) => counts[a] - counts[b]);
    return pick(sorted.slice(0, Math.max(3, Math.round(sorted.length * 0.12))));
  }

  function pickFrom(list) {
    const fresh = list.filter((t) => !recent.includes(t));
    return leastUsed(fresh.length ? fresh : list);
  }

  function remember(t) {
    recent.push(t); if (recent.length > 40) recent.shift();
    counts[t] = ++seq;          // 방금 썼으니 맨 뒤로
    delta[t] = counts[t];
    // 말이 계속 나오면 타이머를 다시 걸지 않는다. 안 그러면 영원히 저장이 밀린다.
    if (!flushT) flushT = setTimeout(() => { flushT = 0; flushCounts(); }, 12000);
  }

  function flushCounts() {
    const d = delta;
    if (!Object.keys(d).length) return;
    delta = {};
    try {
      chrome.storage.local.get({ counts: {} }, (v) => {
        void chrome.runtime.lastError;
        const merged = v.counts || {};
        // 탭이 여러 개면 순번이 엇갈릴 수 있다. 더 나중 것을 남긴다.
        for (const k in d) merged[k] = Math.max(merged[k] || 0, d[k]);
        counts = merged;
        seq = Math.max(seq, ...Object.values(merged));
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
    if (!main) return { host: location.hostname, site: location.hostname, url: '',
                        title: '', head: '', desc: '', notice: '', sel: '', body: '', lang: '' };
    return {
      host: location.hostname,
      site: meta('meta[property="og:site_name"]') || location.hostname.replace(/^www\./, ''),
      url: location.pathname.slice(0, 60),
      title: clean(document.title).slice(0, 120),
      head: clean(document.querySelector('h1')?.innerText).slice(0, 100),
      desc: clean(meta('meta[name="description"]') || meta('meta[property="og:description"]')).slice(0, 180),
      notice: notice.slice(0, 160),
      sel: clean(String(getSelection() || '')).slice(0, 160),
      body: clean(main.innerText || '').slice(0, 420),
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
    // 뽀모도로 타이머 동작 중일 때는 전용 집중/응원 멘트 풀에서만 추출!
    if (pomo && pomo.running && pomo.mode === 'focus') {
      const mode = activeMode();
      const list = LINES.pomodoro_focus?.[mode] || LINES.pomodoro_focus?.basic || [];
      if (list.length) {
        const text = pickFrom(list);
        remember(text);
        return { text, kind: '', persona: mode };
      }
    } else if (pomo && pomo.running && (pomo.mode === 'break' || pomo.mode === 'longBreak')) {
      const mode = activeMode();
      const list = LINES.pomodoro_break?.[mode] || LINES.pomodoro_break?.basic || [];
      if (list.length) {
        const text = pickFrom(list);
        remember(text);
        return { text, kind: '', persona: mode };
      }
    }

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
    // 화면이 비어 있으면 한 번에 더 채운다. 평소에는 두 개씩만.
    const burst = live.size === 0 ? Math.min(3, want) : 2;
    const need = Math.min(burst, want - live.size);
    const step = live.size === 0 ? 130 : 320;
    for (let i = 0; i < need; i++) {
      setTimeout(() => {
        if (!cfg.enabled || !root || live.size >= p.max) return;
        const item = nextLine();
        spawn(item.text, item.kind, { persona: item.persona });
      }, i * step);
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
    const personaKey = opt.persona || activeMode();
    const pInfo = PERSONA_INFO[personaKey] || PERSONA_INFO.basic;
    const cls = KIND_CLS[kind] || PERSONA_CLS[personaKey] || pInfo.cls || pick(CANDY);
    const b = el('div', 'bubble side ' + side + ' ' + cls, sh);

    // 텍스트 글자 대신 8비트 도트 픽셀 아이콘을 직접 비트로 찍어서 배치
    const iconName = kind === 'warn' ? 'warn'
                   : kind === 'tip' ? 'tip'
                   : kind === 'info' ? 'info'
                   : (pInfo.icon || 'persona_basic');
    if (D.ICONS[iconName]) {
      const icCv = el('canvas', 'p-icon', b);
      const [iw, ih] = D.iconSize(iconName);
      icCv.width = iw * 2; icCv.height = ih * 2;
      D.drawIcon(icCv.getContext('2d'), iconName, 2);
    }
    b.appendChild(document.createTextNode(text));

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


  // ---------- 개 말풍선 ----------
  function showSay(text, kind, opt = {}) {
    if (!dogOn()) return;
    say.classList.remove('out');
    say.innerHTML = '';
    const personaKey = opt.persona || (kind === 'pomo' ? 'pomo' : activeMode());
    const pInfo = PERSONA_INFO[personaKey] || PERSONA_INFO.basic;
    const iconName = kind === 'pomo' ? 'persona_pomo'
                   : kind === 'warn' ? 'warn'
                   : kind === 'tip' ? 'tip'
                   : kind === 'info' ? 'info'
                   : kind === 'bond' ? 'persona_tsun'
                   : (pInfo.icon || 'persona_basic');
    if (D.ICONS[iconName]) {
      const icCv = el('canvas', 'p-icon', say);
      const [iw, ih] = D.iconSize(iconName);
      icCv.width = iw * 2; icCv.height = ih * 2;
      D.drawIcon(icCv.getContext('2d'), iconName, 2);
    }
    say.appendChild(document.createTextNode(text));
    say.className = 'bubble tail say ' + (KIND_CLS[kind] || PERSONA_CLS[personaKey] || 'k-tip');
    say.style.fontSize = Math.round(15 * zoom()) + 'px';
    say.style.maxWidth = Math.round(264 * zoom()) + 'px';
    say.hidden = false;
    place(say);
    requestAnimationFrame(() => place(say));
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

  // 여러 줄 답변을 개가 한 줄씩 이어서 말한다 (강아지 전용 비트 아이콘과 골든 어투)
  function saySeries(parts) {
    const run = (i) => {
      if (!cfg.enabled || !root || i >= parts.length) return;
      showSay(parts[i], 'answer', { persona: 'basic' });
      clearTimeout(sayT);
      sayT = setTimeout(() => {
        if (i + 1 < parts.length) run(i + 1);
        else hideSay();
      }, Math.min(9000, 2400 + parts[i].length * 110));
    };
    run(0);
  }

  // ── 뽀모도로 딴짓 감지기 (Distraction Guard) ──
  const DISTRACT_HOSTS = [
    'youtube.com', 'instagram.com', 'tiktok.com', 'x.com', 'twitter.com',
    'reddit.com', 'dcinside.com', 'fmkorea.com', 'arca.live', 'ruliweb.com',
    'theqoo.net', 'instiz.net', 'inven.co.kr', 'clien.net', 'bobaedream.co.kr',
    'humoruniv.com', 'comic.naver.com', 'webtoon.kakao.com', 'netflix.com',
    'chzzk.naver.com', 'sooplive.co.kr', 'twitch.tv'
  ];
  let lastDistractWarn = 0;

  function isDistractionSite() {
    const host = location.hostname.toLowerCase();
    return DISTRACT_HOSTS.some((d) => host === d || host.endsWith('.' + d));
  }

  function checkDistraction() {
    if (!pomo || !pomo.running || pomo.mode !== 'focus') return;
    if (!isDistractionSite()) return;
    const now = Date.now();
    if (now - lastDistractWarn < 25000) return; // 25초 쿨다운
    lastDistractWarn = now;

    if (dogOn()) {
      dog.target = clampX(innerWidth / 2 - DOG_W / 2);
      setState('walk');
    }
    const mode = activeMode();
    const list = LINES.pomodoro_distract?.[mode] || LINES.pomodoro_distract?.basic || [];
    if (list.length) {
      const text = pick(list);
      play8Bit('pause');
      setTimeout(() => {
        showSay(text, 'warn', { persona: mode });
      }, 350);
    }
  }

  function recordPomoCompletion() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      chrome.storage.local.get({ pomoHistory: {}, pomoToday: null }, (d) => {
        const hist = d.pomoHistory || {};
        hist[today] = (hist[today] || 0) + 1;
        const curToday = (d.pomoToday && d.pomoToday.date === today)
          ? d.pomoToday
          : { date: today, sets: 0, minutes: 0 };
        curToday.sets += 1;
        curToday.minutes += (cfg.pomoFocusMin || 25);
        chrome.storage.local.set({ pomoHistory: hist, pomoToday: curToday });
      });
    } catch (_) {}
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

  // ── 뽀모도로 타이머 UI 및 제어 ──
  function buildPomo() {
    pomoEl = el('div', 'pomo-widget', sh);

    // 1) Compact Pill
    pomoPill = el('div', 'pomo-pill', pomoEl);
    const pillCv = el('canvas', null, pomoPill);
    pillCv.width = 16; pillCv.height = 14;
    D.drawIcon(pillCv.getContext('2d'), 'tomato', 2, '#d4380d');
    const pillText = el('span', 'pomo-pill-text', pomoPill);
    pillText.textContent = '25:00 ▶';

    pomoPill.addEventListener('click', (e) => {
      e.stopPropagation();
      play8Bit('click');
      togglePomoHud();
    });

    // 2) Expanded HUD
    pomoHud = el('div', 'pomo-hud', pomoEl);
    pomoHud.hidden = true;

    const head = el('div', 'hud-head', pomoHud);
    const headTitle = el('span', null, head);
    headTitle.textContent = '🍅 뽀모도로 타이머';

    const icons = el('div', 'hud-icons', head);
    const soundBtn = el('span', 'icon-btn', icons);
    soundBtn.textContent = cfg.pomoSound !== false ? '🔊' : '🔇';
    soundBtn.title = '8비트 효과음 켜기/끄기';
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cfg.pomoSound = !cfg.pomoSound;
      saveCfg({ pomoSound: cfg.pomoSound });
      soundBtn.textContent = cfg.pomoSound ? '🔊' : '🔇';
      play8Bit('click');
    });

    const closeBtn = el('span', 'icon-btn', icons);
    closeBtn.textContent = '✕';
    closeBtn.title = '접기';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      play8Bit('click');
      closePomoHud();
    });

    pomoClockEl = el('div', 'hud-clock', pomoHud);
    pomoClockEl.textContent = '25:00';

    pomoStatusEl = el('div', 'hud-status', pomoHud);
    pomoStatusEl.textContent = '집중할 준비 되셨나요?';

    const barWrap = el('div', 'hud-bar', pomoHud);
    pomoProgEl = el('div', 'hud-prog', barWrap);

    const modes = el('div', 'hud-modes', pomoHud);
    const mFocus = el('button', 'on', modes); mFocus.textContent = '집중 25m';
    const mBreak = el('button', '', modes); mBreak.textContent = '휴식 5m';
    const mLong = el('button', '', modes); mLong.textContent = '긴휴식 15m';

    mFocus.addEventListener('click', () => { play8Bit('click'); setPomoMode('focus'); });
    mBreak.addEventListener('click', () => { play8Bit('click'); setPomoMode('break'); });
    mLong.addEventListener('click', () => { play8Bit('click'); setPomoMode('longBreak'); });

    const acts = el('div', 'hud-acts', pomoHud);
    pomoBtnMain = el('button', 'btn-main', acts);
    pomoBtnMain.textContent = '▶ 시작';
    pomoBtnMain.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePomoRunning();
    });

    const btnReset = el('button', 'btn-sub', acts);
    btnReset.textContent = '⏹ 리셋';
    btnReset.addEventListener('click', (e) => {
      e.stopPropagation();
      play8Bit('click');
      resetPomo();
    });

    const btnSkip = el('button', 'btn-sub', acts);
    btnSkip.textContent = '⏭ 다음';
    btnSkip.addEventListener('click', (e) => {
      e.stopPropagation();
      play8Bit('click');
      skipPomo();
    });

    pomoSetsEl = el('div', 'hud-sets', pomoHud);
    pomoSetsEl.textContent = '오늘 달성: 🍅 0세트';

    applyPomoVisibility();
    updatePomoUI();
  }

  function pomoDuration(mode) {
    if (mode === 'break') return (cfg.pomoBreakMin || 5) * 60;
    if (mode === 'longBreak') return (cfg.pomoLongBreakMin || 15) * 60;
    return (cfg.pomoFocusMin || 25) * 60;
  }

  function getPomoRemaining() {
    if (!pomo.running || !pomo.targetEndTime) {
      return pomo.pausedRemainingSec != null ? pomo.pausedRemainingSec : pomoDuration(pomo.mode);
    }
    return Math.max(0, Math.round((pomo.targetEndTime - Date.now()) / 1000));
  }

  function setPomoMode(mode) {
    const dur = pomoDuration(mode);
    const next = {
      ...pomo,
      mode,
      running: false,
      targetEndTime: 0,
      durationSec: dur,
      pausedRemainingSec: dur,
      halfNotified: false,
    };
    pomo = next;
    play8Bit('click');
    updatePomoUI();
    chrome.storage.local.set({ pomo: next });
  }

  function togglePomoRunning() {
    if (pomo.running) {
      const rem = getPomoRemaining();
      const next = {
        ...pomo,
        running: false,
        targetEndTime: 0,
        pausedRemainingSec: rem,
      };
      pomo = next;
      play8Bit('pause');
      updatePomoUI();
      chrome.storage.local.set({ pomo: next });
    } else {
      const rem = pomo.pausedRemainingSec != null ? pomo.pausedRemainingSec : pomoDuration(pomo.mode);
      const target = Date.now() + rem * 1000;
      const dur = pomoDuration(pomo.mode);
      const next = {
        ...pomo,
        running: true,
        targetEndTime: target,
        durationSec: dur,
        pausedRemainingSec: rem,
        halfNotified: rem <= Math.round(dur / 2) ? pomo.halfNotified : false,
      };
      pomo = next;
      play8Bit('start');
      if (pomo.mode === 'focus') sayPomo('focus_start');
      else sayPomo('break_start');
      for (const b of [...live]) kill(b);
      clearTimeout(nextT);
      nextT = setTimeout(fill, 200);
      updatePomoUI();
      chrome.storage.local.set({ pomo: next });
    }
  }

  function resetPomo() {
    const dur = pomoDuration(pomo.mode);
    const next = {
      ...pomo,
      running: false,
      targetEndTime: 0,
      durationSec: dur,
      pausedRemainingSec: dur,
      halfNotified: false,
    };
    pomo = next;
    play8Bit('click');
    updatePomoUI();
    chrome.storage.local.set({ pomo: next });
  }

  function skipPomo() {
    const nextMode = pomo.mode === 'focus' ? ((pomo.sets + 1) % 4 === 0 ? 'longBreak' : 'break') : 'focus';
    const nextSets = pomo.mode === 'focus' ? pomo.sets + 1 : pomo.sets;
    const dur = pomoDuration(nextMode);
    const next = {
      ...pomo,
      mode: nextMode,
      sets: nextSets,
      running: false,
      targetEndTime: 0,
      durationSec: dur,
      pausedRemainingSec: dur,
      halfNotified: false,
    };
    pomo = next;
    play8Bit('click');
    updatePomoUI();
    chrome.storage.local.set({ pomo: next });
  }

  function sayPomo(phase) {
    const mode = activeMode();
    const list = LINES.pomodoro?.[mode]?.[phase] || LINES.pomodoro?.basic?.[phase] || [];
    if (!list.length) return;
    const text = pick(list);
    showSay(text, 'pomo', { persona: mode });
  }

  function checkPomoTick() {
    const rem = getPomoRemaining();
    updatePomoUI(rem);

    if (pomo.running && pomo.mode === 'focus') {
      checkDistraction();
    }

    if (!pomo.running || !pomo.targetEndTime) return;

    const dur = pomo.durationSec || pomoDuration(pomo.mode);
    if (!pomo.halfNotified && pomo.mode === 'focus' && rem <= Math.round(dur / 2) && rem > 0) {
      pomo.halfNotified = true;
      play8Bit('half');
      sayPomo('focus_half');
      chrome.storage.local.set({ pomo: { ...pomo, halfNotified: true } });
    }

    if (rem <= 0) {
      if (pomo.mode === 'focus') {
        const nextSets = (pomo.sets || 0) + 1;
        recordPomoCompletion();
        play8Bit('done');
        sayPomo('focus_done');
        popHearts(4);
        const nextMode = (nextSets % 4 === 0) ? 'longBreak' : 'break';
        const durNext = pomoDuration(nextMode);
        const next = {
          ...pomo,
          mode: nextMode,
          sets: nextSets,
          running: false,
          targetEndTime: 0,
          durationSec: durNext,
          pausedRemainingSec: durNext,
          halfNotified: false,
        };
        pomo = next;
        updatePomoUI();
        chrome.storage.local.set({ pomo: next });
      } else {
        play8Bit('break_done');
        sayPomo('break_done');
        const durNext = pomoDuration('focus');
        const next = {
          ...pomo,
          mode: 'focus',
          running: false,
          targetEndTime: 0,
          durationSec: durNext,
          pausedRemainingSec: durNext,
          halfNotified: false,
        };
        pomo = next;
        updatePomoUI();
        chrome.storage.local.set({ pomo: next });
      }
    }
  }

  function updatePomoUI(forcedRem) {
    if (!pomoEl) return;
    const rem = typeof forcedRem === 'number' ? forcedRem : getPomoRemaining();
    const min = Math.floor(rem / 60);
    const sec = rem % 60;
    const timeStr = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    const modeLabel = pomo.mode === 'focus' ? '집중' : pomo.mode === 'break' ? '휴식' : '긴 휴식';

    const pillText = pomoPill?.querySelector('.pomo-pill-text');
    if (pillText) {
      pillText.textContent = `${pomo.mode === 'focus' ? '🍅' : '☕'} ${timeStr} ${pomo.running ? '⏸' : '▶'}`;
    }
    pomoPill?.classList.toggle('running', !!pomo.running);

    if (pomoClockEl) pomoClockEl.textContent = timeStr;
    if (pomoStatusEl) {
      pomoStatusEl.textContent = pomo.running
        ? `${modeLabel} 진행 중!`
        : `${modeLabel} 준비 중 (${Math.round(pomoDuration(pomo.mode) / 60)}분)`;
    }
    if (pomoProgEl) {
      const total = pomo.durationSec || pomoDuration(pomo.mode);
      const prog = Math.min(100, Math.max(0, Math.round(((total - rem) / total) * 100)));
      pomoProgEl.style.width = prog + '%';
    }
    if (pomoHud) {
      const buttons = pomoHud.querySelectorAll('.hud-modes button');
      if (buttons.length === 3) {
        buttons[0].classList.toggle('on', pomo.mode === 'focus');
        buttons[1].classList.toggle('on', pomo.mode === 'break');
        buttons[2].classList.toggle('on', pomo.mode === 'longBreak');
      }
    }
    if (pomoBtnMain) {
      pomoBtnMain.textContent = pomo.running ? '⏸ 일시정지' : '▶ 시작';
      pomoBtnMain.className = pomo.running ? 'btn-sub' : 'btn-main';
    }
    if (pomoSetsEl) {
      const count = pomo.sets || 0;
      const icons = '🍅 '.repeat(count % 4) + '⚪ '.repeat(4 - (count % 4));
      pomoSetsEl.textContent = `오늘 달성: ${icons.trim()} (${count}세트)`;
    }
  }

  function togglePomoHud() {
    if (!pomoHud) return;
    pomoHud.hidden = !pomoHud.hidden;
    pomo.hudOpen = !pomoHud.hidden;
    updatePomoUI();
  }

  function closePomoHud() {
    if (!pomoHud) return;
    pomoHud.hidden = true;
    pomo.hudOpen = false;
  }

  function applyPomoVisibility() {
    if (!pomoEl) return;
    pomoEl.hidden = cfg.pomoOn === false;
  }

  function loadPomoState(data) {
    if (!data) return;
    if (data.pomo) {
      Object.assign(pomo, data.pomo);
    } else {
      if (data.pomoMode) pomo.mode = data.pomoMode;
      if (typeof data.pomoSets === 'number') pomo.sets = data.pomoSets;
      if (typeof data.pomoHalfNotified === 'boolean') pomo.halfNotified = data.pomoHalfNotified;
      if (typeof data.pomoTargetEndTime === 'number') pomo.targetEndTime = data.pomoTargetEndTime;
      if (typeof data.pomoDurationSec === 'number') pomo.durationSec = data.pomoDurationSec;
      if (typeof data.pomoPausedRemainingSec === 'number') pomo.pausedRemainingSec = data.pomoPausedRemainingSec;
      if (typeof data.pomoRunning === 'boolean') pomo.running = data.pomoRunning;
    }
    updatePomoUI();
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
    micEl.addEventListener('click', () => { play8Bit('click'); toggleMic(); });

    askInput = el('input', null, row);
    askInput.type = 'text';
    askInput.maxLength = 120;
    const send = el('button', null, row);
    send.textContent = '물어봐';
    send.addEventListener('click', () => { play8Bit('click'); sendAsk(); });

    footEl = el('div', 'foot', askEl);
    footEl.appendChild(document.createTextNode(FOOT));
    chatEl = el('span', 'chat', footEl);
    chatEl.addEventListener('click', (e) => {
      e.stopPropagation();
      play8Bit('click');
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
      if (e.key === 'Enter') { play8Bit('click'); sendAsk(); }
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

  // 페이지를 옮겨도 개는 있던 자리에서 이어진다 (반응형 비율 기반 0ms 즉시 복원)
  function saveDogPos() {
    if (!root) return;
    const maxW = Math.max(10, innerWidth - DOG_W);
    const ratio = Math.max(0, Math.min(1, dog.x / maxW));
    const p = {
      x: Math.round(dog.x),
      ratio,
      dir: dog.dir,
      state: dog.state === 'walk' ? 'sit' : dog.state,
    };
    cfg.dogPos = p;
    try { sessionStorage.setItem('cheerBuddy.dogPos', JSON.stringify(p)); } catch (_) {}
    try { chrome.storage.local.set({ dogPos: p }); } catch (_) { /* ignore */ }
  }

  function loadDogPos(customPos) {
    let p = customPos || cfg.dogPos;
    if (!p) {
      try { p = JSON.parse(sessionStorage.getItem('cheerBuddy.dogPos') || 'null'); } catch (_) {}
    }
    if (!p) return;
    const maxW = Math.max(10, innerWidth - DOG_W);
    if (typeof p.ratio === 'number') {
      dog.x = clampX(p.ratio * maxW);
    } else if (typeof p.x === 'number') {
      dog.x = clampX(p.x);
    }
    dog.dir = p.dir === -1 ? -1 : 1;
    if (['sit', 'stand', 'sleep'].includes(p.state)) dog.state = p.state;
  }

  function saveCfg(o) {
    Object.assign(cfg, o);
    try { sessionStorage.setItem('cheerBuddy.cfg', JSON.stringify(cfg)); } catch (_) {}
    try { chrome.storage.local.set(o); } catch (_) {}
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
    closeAsk(false);
    setState('listen');
    busy = true;
    showSay('음... 냄새 맡아보는 중이다 멍!', 'answer', { persona: 'basic' });
    let done = false;
    const answer = (parts) => {
      if (done) return;
      done = true;
      busy = false;
      setState('sit');
      saySeries(parts.slice(0, 4));
      chat.push({ q, a: parts.join(' ').slice(0, 160) });
      if (chat.length > 8) chat.shift();
      saveChat();
      showChatState();
    };
    try {
      chrome.runtime.sendMessage(
        { type: 'ask', mode: 'basic', q, ctx: pageContext(),
          history: cfg.keepChat === false ? [] : chat.slice(-4) },
        (r) => {
          void chrome.runtime.lastError;
          answer(r?.parts?.length ? r.parts : [r?.text || '냄새 맡아봐도 잘 모르겠어 멍...']);
        }
      );
    } catch (_) { answer(['킁킁... 지금은 대답을 못 하겠어 멍...']); }
    setTimeout(() => answer(['너무 오래 걸리네. 다시 물어봐줄래 멍?']), 15000);
  }

  function poke() {
    if (Date.now() - lastPoke < 700 || askOpen || !dogOn()) return;
    lastPoke = Date.now();
    clearTimeout(sayT);
    say.hidden = true;
    busy = true;
    setState('listen'); idleSince = Date.now();
    play8Bit('click');
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
    clearTimeout(nextT);
    nextT = setTimeout(fill, 120);   // 새 페이지에서 빈 화면으로 시작하지 않게
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
  function syncOnVisible() {
    if (document.hidden) return;
    idleSince = Date.now();
    updatePomoUI();
    try {
      chrome.storage.local.get({ pomo: null, dogPos: null }, (v) => {
        if (!v) return;
        if (v.pomo) loadPomoState(v);
        if (v.dogPos && !document.hasFocus()) {
          loadDogPos(v.dogPos);
          render();
        }
      });
    } catch (_) {}
  }

  addEventListener('visibilitychange', syncOnVisible);
  addEventListener('focus', syncOnVisible);

  const onUnload = () => {
    flushCounts();
    saveDogPos();
  };
  addEventListener('pagehide', onUnload);
  addEventListener('beforeunload', onUnload);

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && askOpen) closeAsk(false);
    if (e.key === 'Escape' && pomo?.hudOpen) closePomoHud();
  }, true);
  addEventListener('mousedown', (e) => {
    if (askOpen && !e.composedPath().includes(askEl)) closeAsk(false);
    if (pomo?.hudOpen && pomoEl && !e.composedPath().includes(pomoEl)) closePomoHud();
  }, true);

  new MutationObserver(() => {
    if (cfg.enabled && root && !root.isConnected && document.documentElement) {
      document.documentElement.appendChild(root);
    }
  }).observe(document.documentElement, { childList: true });

  // ── 초기 시작 (크롬 전역 저장소에서 로드) ──
  chrome.storage.local.get({ ...DEFAULTS, pomo: null, dogPos: null, counts: {} }, (v) => {
    cfg = { ...DEFAULTS, ...v };
    counts = v.counts || {};
    const used = Object.values(counts);
    seq = used.length ? Math.max(...used) : 0;
    if (v.pomo) loadPomoState(v);
    if (v.dogPos) cfg.dogPos = v.dogPos;
    if (cfg.enabled) {
      start();
    }
  });

  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== 'local') return;
    for (const k in ch) if (k !== 'counts' && k !== 'dogPos' && k !== 'pomo') cfg[k] = ch[k].newValue;
    if ('mode' in ch) { queue = []; recent = []; lastFetch = 0; }
    if ('dog' in ch) applyDog();
    if ('pomoOn' in ch) applyPomoVisibility();
    if ('pomo' in ch && ch.pomo.newValue) {
      loadPomoState(ch.pomo.newValue);
    }
    if ('dogPos' in ch && !document.hasFocus() && ch.dogPos.newValue) {
      loadDogPos(ch.dogPos.newValue);
      render();
    }
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
