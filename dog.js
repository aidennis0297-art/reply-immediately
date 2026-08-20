// 골든 리트리버 도트 스프라이트. 24x16 그리드, 문자 1개 = 픽셀 1개.
// . 투명 | o 윤곽 | l 밝은금 | m 금색 | d 진한금(귀) | w 크림(주둥이/발) | n 코 | e 눈 
(() => {
  const W = 24, H = 16;
  const PAL = {
    o: '#7a4a22', l: '#ffd894', m: '#f0b25c', d: '#c9863c',
    w: '#fff4e2', n: '#2a1a10', e: '#2a1a10'
  };

  // 서 있는 상반신 (y0~y11). 걷기는 이 위에 다리 프레임만 갈아끼운다.
  const BODY = [
    '................oooo',
    '...............ollllo',
    '..............ollllllo',
    '.............oddllllllo',
    '.............oddllelllo',
    '..o..........oddllllwwno',
    '.omo.........oddlllwwwno',
    '.omo..ooooooooddllllwwo',
    '..omoollllllllddllllwwwo',
    '...ommlllllllllllllwooo',
    '...ommmmmmmmmmmmmmmoo',
    '...ommmmmmmmmmmmmmmo',
  ];

  // 다리 4프레임 (y12~y15). 0번은 가만히 서 있는 자세.
  const LEGS = [
    ['...ommo.....ommo', '...ommo.....ommo', '...ommo.....ommo', '...owwo.....owwo'],
    ['...ommo....ommo', '...ommo...ommo', '..ommo....ommo', '..owwo...owwo'],
    ['....ommo...ommo', '....ommo...ommo', '....ommo...ommo', '....owwo...owwo'],
    ['..ommo......ommo', '.ommo.......ommo', '.ommo.......ommo', '.owwo.......owwo'],
  ];

  // 앉은 자세 (꼬리 2프레임)
  const SIT = [[
    '................oooo',
    '...............ollllo',
    '..............ollllllo',
    '.............oddllllllo',
    '.............oddllelllo',
    '....oo.......oddllllwwno',
    '...omdo......oddlllwwwno',
    '...ommo......oddllllwwwo',
    '..ommmo....ollllllwooo',
    '..ommmmoooollllllllo',
    '..ommmmmmmmmmmmmmmo',
    '..ommmmmmmmmmmmmmmo',
    '..ommmmmmmmmmmmmmmo',
    '..ommmmmmmmmmmommo',
    '..ommmmmmmmmmmoowwo',
    '..owwwwwwwwwwwo..oo',
  ], [
    '................oooo',
    '...............ollllo',
    '..............ollllllo',
    '.............oddllllllo',
    '.............oddllelllo',
    '..oo.........oddllllwwno',
    '..omdo.......oddlllwwwno',
    '...ommo......oddllllwwwo',
    '..ommmo....ollllllwooo',
    '..ommmmoooollllllllo',
    '..ommmmmmmmmmmmmmmo',
    '..ommmmmmmmmmmmmmmo',
    '..ommmmmmmmmmmmmmmo',
    '..ommmmmmmmmmmommo',
    '..ommmmmmmmmmmoowwo',
    '..owwwwwwwwwwwo..oo',
  ]];

  // 귀 기울이는 자세. 앉은 채로 귀를 쫑긋 세우고 눈을 크게 뜬다 (2프레임, 귀가 까딱).
  const LISTEN = [[
    '.............dd.oooo',
    '.............dd.ollllo',
    '............oddllllllo',
    '............oddllllllo',
    '.............ollleelllo',
    '....oo.......ollllllwwno',
    '...omdo......olllllwwwno',
    '...ommo......ollllllwwwo',
    '..ommmo....ollllllwooo',
    '..ommmmoooollllllllo',
    '..ommmmmmmmmmmmmmmo',
    '..ommmmmmmmmmmmmmmo',
    '..ommmmmmmmmmmmmmmo',
    '..ommmmmmmmmmmommo',
    '..ommmmmmmmmmmoowwo',
    '..owwwwwwwwwwwo..oo',
  ], [
    '............dd..oooo',
    '............dd..ollllo',
    '............oddllllllo',
    '............oddllllllo',
    '.............ollleelllo',
    '..oo.........ollllllwwno',
    '..omdo.......olllllwwwno',
    '...ommo......ollllllwwwo',
    '..ommmo....ollllllwooo',
    '..ommmmoooollllllllo',
    '..ommmmmmmmmmmmmmmo',
    '..ommmmmmmmmmmmmmmo',
    '..ommmmmmmmmmmmmmmo',
    '..ommmmmmmmmmmommo',
    '..ommmmmmmmmmmoowwo',
    '..owwwwwwwwwwwo..oo',
  ]];

  // 자는 자세 (숨쉬기 2프레임). 몸을 둥글게 말고 머리를 앞발 위에 얹는다.
  const SLEEP = [[
    '', '', '', '', '',
    '........oooooo',
    '......oollllllooo',
    '...oooollllllllllo',
    '..omdollllllllllllo',
    '.ommmolllllllooddllo',
    '.ommmmolllllloddll--o',
    '.ommmmmmmmmmoddllllwwo',
    '..ommmmmmmmmmoddlllwwno',
    '..ommmmmmmmmmmoollwwwo',
    '..ommwwwwwwwwwwwwwwwo',
    '...oooooooooooooooo',
  ], [
    '', '', '', '', '', '',
    '........oooooo',
    '......oollllllooo',
    '...oooollllllllllo',
    '..omdollllllllllllo',
    '.ommmolllllllooddllo',
    '.ommmmolllllloddll--o',
    '.ommmmmmmmmmoddllllwwo',
    '..ommmmmmmmmmoddlllwwno',
    '..ommwwwwwwwwwwwwwwwo',
    '...oooooooooooooooo',
  ]];

  // 말풍선 안이나 버튼에 찍는 작은 도트 아이콘들
  const ICONS = {
    heart: [
      '.oo.oo.',
      'oppoppo',
      'opppppo',
      '.opppo.',
      '..opo..',
      '...o...',
    ],
    mic: [
      '..ooo..',
      '.oOOOo.',
      '.oOOOo.',
      '.oOOOo.',
      '.oOOOo.',
      'o.oOo.o',
      'o..o..o',
      '.ooooo.',
      '...o...',
      '..ooo..',
    ],
    power: [
      '....o....',
      '...ooo...',
      '.oo.o.oo.',
      'o...o...o',
      'o.......o',
      'o.......o',
      '.o.....o.',
      '..ooooo..',
      '...ooo...',
    ],
  };

  // '-' 감은 눈, 'O' 감은 눈(가로줄), 'p' 하트 분홍
  PAL['-'] = '#7a4a22';      // 감은 눈
  PAL['O'] = '#fff6fb';      // 마이크 몸통
  PAL['p'] = '#ff6f9c';      // 하트

  const pad = (rows) => {
    const out = [];
    for (let y = 0; y < H; y++) {
      const r = (rows[y] || '');
      if (r.length > W) throw new Error('sprite row ' + y + ' too wide: ' + r.length);
      out.push(r.padEnd(W, '.'));
    }
    return out;
  };

  const FRAMES = {
    stand: [pad([...BODY, ...LEGS[0]])],
    walk: LEGS.map((legs) => pad([...BODY, ...legs])),
    sit: SIT.map(pad),
    listen: LISTEN.map(pad),
    sleep: SLEEP.map(pad),
  };

  // 상태별 프레임 간격(ms)
  const SPEED = { stand: 400, walk: 110, sit: 420, listen: 340, sleep: 900 };

  function draw(ctx, state, frame, scale, flip) {
    const set = FRAMES[state] || FRAMES.stand;
    const rows = set[frame % set.length];
    ctx.clearRect(0, 0, W * scale, H * scale);
    ctx.save();
    if (flip) { ctx.translate(W * scale, 0); ctx.scale(-1, 1); }
    for (let y = 0; y < H; y++) {
      const row = rows[y];
      for (let x = 0; x < W; x++) {
        const c = PAL[row[x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    ctx.restore();
  }

  // 아이콘 하나를 캔버스에 찍는다. color 를 주면 윤곽색을 갈아끼운다.
  function drawIcon(ctx, name, scale, color) {
    const rows = ICONS[name];
    const w = rows[0].length, h = rows.length;
    const pal = color ? { ...PAL, o: color, p: color, O: '#fff' } : PAL;
    ctx.clearRect(0, 0, w * scale, h * scale);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = pal[rows[y][x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  const iconSize = (name) => [ICONS[name][0].length, ICONS[name].length];

  globalThis.CB_DOG = { W, H, PAL, FRAMES, SPEED, ICONS, draw, drawIcon, iconSize };
})();
