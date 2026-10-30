/* Grease & Gold: World Tour - core utilities, pixel font, i18n.
   Runs unchanged in the browser and in Node (art build + tests). */
(function (G) {
'use strict';

/* ---------- constants ---------- */
G.LW = 480; G.LH = 270;                 /* logical world resolution */
G.FT = 150; G.FB = 244;                 /* walkable lane band (feet y) */
G.STEP = 1000 / 60;
G.VERSION = '2.2.0';
G.PROTO = 3;

/* The game's own buttons. Order matters: it is the order the controls screen
   lists them in and the order the online input mask packs them. */
G.ACT = ['left', 'right', 'up', 'down', 'attack', 'heavy', 'jump', 'grab', 'special', 'start', 'pause'];

G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
G.lerp = (a, b, t) => a + (b - a) * t;
G.sgn = (v) => v < 0 ? -1 : 1;
G.rnd = (a, b) => a + Math.random() * (b - a);
G.pick = (arr, r) => arr[Math.floor((r || Math.random)() * arr.length)];
G.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
G.ease = (t) => t * t * (3 - 2 * t);

G.rgb = (hex) => 0xFF000000 | ((hex & 0xFF) << 16) | (hex & 0xFF00) | ((hex >> 16) & 0xFF);

/* ---------- 5x7 pixel font (rows as 5-bit binary strings) ---------- */
const F = {
  'A': '01110,10001,10001,11111,10001,10001,10001', 'B': '11110,10001,10001,11110,10001,10001,11110',
  'C': '01110,10001,10000,10000,10000,10001,01110', 'D': '11110,10001,10001,10001,10001,10001,11110',
  'E': '11111,10000,10000,11110,10000,10000,11111', 'F': '11111,10000,10000,11110,10000,10000,10000',
  'G': '01110,10001,10000,10111,10001,10001,01111', 'H': '10001,10001,10001,11111,10001,10001,10001',
  'I': '11111,00100,00100,00100,00100,00100,11111', 'J': '00111,00010,00010,00010,00010,10010,01100',
  'K': '10001,10010,10100,11000,10100,10010,10001', 'L': '10000,10000,10000,10000,10000,10000,11111',
  'M': '10001,11011,10101,10101,10001,10001,10001', 'N': '10001,11001,10101,10011,10001,10001,10001',
  'O': '01110,10001,10001,10001,10001,10001,01110', 'P': '11110,10001,10001,11110,10000,10000,10000',
  'Q': '01110,10001,10001,10001,10101,10010,01101', 'R': '11110,10001,10001,11110,10100,10010,10001',
  'S': '01111,10000,10000,01110,00001,00001,11110', 'T': '11111,00100,00100,00100,00100,00100,00100',
  'U': '10001,10001,10001,10001,10001,10001,01110', 'V': '10001,10001,10001,10001,10001,01010,00100',
  'W': '10001,10001,10001,10101,10101,11011,10001', 'X': '10001,10001,01010,00100,01010,10001,10001',
  'Y': '10001,10001,01010,00100,00100,00100,00100', 'Z': '11111,00001,00010,00100,01000,10000,11111',
  '0': '01110,10001,10011,10101,11001,10001,01110', '1': '00100,01100,00100,00100,00100,00100,01110',
  '2': '01110,10001,00001,00010,00100,01000,11111', '3': '11111,00010,00100,00010,00001,10001,01110',
  '4': '00010,00110,01010,10010,11111,00010,00010', '5': '11111,10000,11110,00001,00001,10001,01110',
  '6': '00110,01000,10000,11110,10001,10001,01110', '7': '11111,00001,00010,00100,01000,01000,01000',
  '8': '01110,10001,10001,01110,10001,10001,01110', '9': '01110,10001,10001,01111,00001,00010,01100',
  ' ': '00000,00000,00000,00000,00000,00000,00000',
  '.': '00000,00000,00000,00000,00000,01100,01100', ',': '00000,00000,00000,00000,01100,00100,01000',
  ':': '00000,01100,01100,00000,01100,01100,00000', '!': '00100,00100,00100,00100,00100,00000,00100',
  '?': '01110,10001,00001,00010,00100,00000,00100', "'": '00100,00100,00000,00000,00000,00000,00000',
  '-': '00000,00000,00000,11111,00000,00000,00000', '+': '00000,00100,00100,11111,00100,00100,00000',
  '/': '00001,00010,00010,00100,01000,01000,10000', '(': '00010,00100,01000,01000,01000,00100,00010',
  ')': '01000,00100,00010,00010,00010,00100,01000', '%': '11001,11010,00010,00100,01000,11001,11001',
  '*': '00000,10101,01110,11111,01110,10101,00000', '=': '00000,00000,11111,00000,11111,00000,00000',
  '#': '01010,01010,11111,01010,11111,01010,01010', '&': '01100,10010,10100,01000,10101,10010,01101',
  '"': '01010,01010,00000,00000,00000,00000,00000', '<': '00010,00100,01000,10000,01000,00100,00010',
  '>': '01000,00100,00010,00001,00010,00100,01000', '_': '00000,00000,00000,00000,00000,00000,11111',
  '$': '00100,01111,10100,01110,00101,11110,00100', 'x': '00000,10001,01010,00100,01010,10001,00000',
  /* Turkish */
  'Ç': '01110,10001,10000,10000,10000,10001,01110', 'ç': '01110,10001,10000,10000,10001,01110,00100',
  'Ğ': '01110,10001,10000,10111,10001,10001,01111', 'ğ': '00100,01110,00000,01110,10001,10001,01111',
  'İ': '00100,11111,00100,00100,00100,00100,11111', 'ı': '00000,01100,00100,00100,00100,00100,01110',
  'Ö': '01010,01110,10001,10001,10001,10001,01110', 'ö': '01010,00000,01110,10001,10001,10001,01110',
  'Ş': '01111,10000,01110,00001,11110,00100,01000', 'ş': '01111,10000,01110,00001,11110,00100,01000',
  'Ü': '01010,00000,10001,10001,10001,10001,01110', 'ü': '01010,00000,10001,10001,10001,10001,01110',
  'â': '00100,01010,01110,10001,11111,10001,10001', 'î': '00100,01010,01100,00100,00100,00100,01110'
};
const GLYPH = {};
Object.keys(F).forEach(k => { GLYPH[k] = F[k].split(',').map(r => parseInt(r, 2)); });
const UPPER = {};
Object.keys(GLYPH).forEach(k => { const u = k.toUpperCase(); if (u !== k && !GLYPH[u]) UPPER[k] = GLYPH[k]; });

/** Width in font-pixels of a string at scale 1 (5px glyph + 1px gap). */
function textWidth(s, size) {
  const sc = size / 7;
  let w = 0;
  for (const ch of String(s)) w += (GLYPH[ch] || UPPER[ch] ? 5 : 5) + 1;
  return Math.max(0, (w - 1) * sc);
}
G.textWidthBitmap = textWidth;
/* Smooth display text (Lilita One). size = cap height in logical px, same contract as the old bitmap font. */
const FONT = '"Lilita One", "Arial Black", Impact, sans-serif';
let measureCtx = null;
function mctx() { if (!measureCtx) { if (G.measureCtx) measureCtx = G.measureCtx; else if (typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d'); } return measureCtx; }
function textWidthSmooth(s, size) {
  const m = mctx(), em = size * 1.34; if (!m) return String(s).length * em * .5;
  m.font = em + 'px ' + FONT; return m.measureText(String(s)).width;
}
G.textWidth = textWidthSmooth;

/** Draw text on a Canvas2D context. Size = pixel height of a glyph. */
G.text = function (ctx, str, x, y, size, color, align, outline) {
  const em = size * 1.34; str = String(str);
  ctx.save(); ctx.font = em + 'px ' + FONT; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const w = ctx.measureText(str).width, px = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, by = y + size * 1.02;
  ctx.lineJoin = 'round';
  if (outline) { ctx.lineWidth = Math.max(1.1, size * .3); ctx.strokeStyle = outline; ctx.strokeText(str, px, by); }
  else { ctx.fillStyle = 'rgba(8,4,16,.5)'; ctx.fillText(str, px + size * .07, by + size * .09); }
  ctx.fillStyle = color; ctx.fillText(str, px, by); ctx.restore(); return w;
};
G.textBitmap = function (ctx, str, x, y, size, color, align, outline) {
  const sc = Math.max(1, Math.round(size / 7));
  const w = textWidth(str, sc * 7);
  let px = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  const py = Math.round(y);
  const chars = [...String(str)];
  if (outline) {
    ctx.fillStyle = outline;
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      if (!ox && !oy) continue;
      drawRun(ctx, chars, px + ox * sc, py + oy * sc, sc);
    }
  }
  ctx.fillStyle = color;
  drawRun(ctx, chars, px, py, sc);
  return w;
};
function drawRun(ctx, chars, px, py, sc) {
  let x = px;
  for (const ch of chars) {
    const gl = GLYPH[ch] || UPPER[ch];
    if (gl) {
      for (let r = 0; r < 7; r++) {
        const row = gl[r];
        if (!row) continue;
        let run = -1;
        for (let c = 0; c <= 5; c++) {
          const on = c < 5 && (row & (1 << (4 - c)));
          if (on && run < 0) run = c;
          else if (!on && run >= 0) { ctx.fillRect(x + run * sc, py + r * sc, (c - run) * sc, sc); run = -1; }
        }
      }
    }
    x += 6 * sc;
  }
}

/* ---------- settings + i18n ---------- */
const STR = {
  en: {
    title: 'GREASE & GOLD', subtitle: 'WORLD TOUR',
    press_start: 'PRESS ENTER', insert_coin: 'INSERT COIN  -  GREASE & GOLD RECORDS',
    main_play: 'PLAY', main_online: 'ONLINE CO-OP', main_training: 'TRAINING', main_howto: 'HOW TO PLAY',
    main_settings: 'SETTINGS', main_credits: 'CREDITS',
    mode_solo: 'SOLO', mode_local: 'LOCAL CO-OP', mode_online: 'ONLINE CO-OP', mode_back: 'BACK',
    select_title: 'CHOOSE YOUR FIGHTER', select_p1: 'PLAYER 1', select_p2: 'PLAYER 2',
    select_locked: 'TAKEN', select_confirm: 'Z  SELECT', select_back: 'X  BACK',
    lobby_title: 'ONLINE LOBBY', lobby_code: 'ROOM CODE', lobby_waiting: 'WAITING FOR PLAYER 2',
    lobby_ready: 'READY', lobby_notready: 'NOT READY', lobby_start: 'START TOUR',
    lobby_leave: 'LEAVE ROOM', lobby_host: 'HOST', lobby_guest: 'GUEST', lobby_you: 'YOU',
    lobby_connecting: 'CONNECTING TO RELAY', lobby_copy: 'PRESS C TO COPY INVITE LINK',
    online_title: 'ONLINE CO-OP', online_host: 'CREATE ROOM', online_join: 'JOIN ROOM',
    online_code: 'ENTER ROOM CODE', online_hint: 'SAME CODE, TWO BROWSERS',
    online_relay: 'RELAY', online_local: 'SAME-BROWSER TABS', online_connecting: 'CONNECTING',
    online_failed: 'CONNECTION FAILED', online_full: 'ROOM IS FULL', online_notfound: 'ROOM NOT FOUND',
    online_timeout: 'RELAY TIMED OUT', online_hostleft: 'HOST LEFT THE ROOM', online_version: 'BUILD MISMATCH',
    difficulty: 'DIFFICULTY', stage: 'START STOP', easy: 'EASY', normal: 'NORMAL', hard: 'HARD',
    pause_title: 'PAUSED', pause_resume: 'RESUME', pause_restart: 'RESTART STOP', pause_settings: 'SETTINGS',
    pause_howto: 'HOW TO PLAY', pause_quit: 'QUIT TO TITLE', pause_waiting: 'WAITING FOR HOST',
    resume_title: 'RESUME?', resume_yes: 'RESUME', resume_no: 'QUIT',
    over_title: 'GAME OVER', over_continue: 'CONTINUE', over_title_btn: 'TITLE', over_score: 'SCORE',
    clear_title: 'STOP CLEAR', clear_next: 'NEXT STOP', clear_bonus: 'HYPE BONUS', clear_total: 'TOTAL',
    victory_title: 'TOUR COMPLETE', victory_sub: 'GREASE & GOLD TOOK THE CROWN',
    credits_title: 'CREDITS', settings_title: 'SETTINGS',
    set_music: 'MUSIC', set_sfx: 'SFX', set_shake: 'SCREEN SHAKE', set_flash: 'FLASH EFFECTS',
    set_scan: 'CRT SCANLINES', set_lang: 'LANGUAGE', set_rumble: 'PAD RUMBLE', set_keys: 'CONTROLS', set_back: 'BACK',
    on: 'ON', off: 'OFF', low: 'LOW', high: 'HIGH',
    keys_title: 'CONTROLS', keys_p1: 'PLAYER 1', keys_p2: 'PLAYER 2', keys_reset: 'RESET DEFAULTS',
    keys_press: 'PRESS A KEY', keys_conflict: 'KEY ALREADY USED',
    ctl_tab_keys: 'KEYBOARD', ctl_tab_pad: 'CONTROLLER',
    ctl_hint_keys: 'UP/DOWN PICK   ENTER REBIND   LEFT/RIGHT PLAYER   V PAD',
    ctl_hint_pad: 'UP/DOWN PICK   ENTER BIND   THEN PRESS A PAD BUTTON',
    ctl_pad_none: 'NO PAD CONNECTED',
    ctl_pad_ok: 'PAD READY',
    ctl_pad_std: 'STANDARD MAPPING - XBOX LAYOUT',
    ctl_lh: 'LEFT HAND', ctl_rh: 'RIGHT HAND', ctl_move: 'MOVE',
    ctl_tap: 'CLICK A KEY TO REBIND',
    act_left: 'LEFT', act_right: 'RIGHT', act_up: 'UP', act_down: 'DOWN', act_attack: 'LIGHT',
    act_heavy: 'HEAVY', act_jump: 'JUMP', act_special: 'SPECIAL', act_grab: 'GRAB', act_start: 'START', act_pause: 'PAUSE',
    howto_title: 'HOW TO PLAY', howto_move: 'MOVE', howto_move_d: 'ARROWS  -  MOVE IN AND OUT OF THE SCREEN TO DODGE LANES',
    howto_atk: 'LIGHT', howto_atk_d: 'Z  -  TAP THREE TIMES FOR THE COMBO. THE THIRD HIT KNOCKS DOWN',
    howto_heavy: 'HEAVY', howto_heavy_d: 'X  -  ONE SLOW BLOW THAT ALWAYS KNOCKS DOWN. THROWS WHOEVER YOU HOLD',
    howto_spec: 'SPECIAL', howto_spec_d: 'HOLD V WITH HYPE. DRAINS WHILE HELD, REFILLS ONLY WITH NORMAL HITS',
    howto_jump: 'JUMP', howto_jump_d: 'SPACE  -  LIGHT IN THE AIR TO STRIKE, DOWN + LIGHT TO DIVE',
    howto_grab: 'GRAB', howto_grab_d: 'S  -  NEAR AN ENEMY: GRAB, THEN LIGHT TO STRIKE OR GRAB AGAIN TO THROW',
    howto_food: 'FOOD', howto_food_d: 'SMASH CRATES AND BARRELS. KEBABS HEAL. DONER SPIT HEALS MOST',
    howto_coop: 'CO-OP', howto_coop_d: 'REVIVE A DOWNED PARTNER BY STANDING CLOSE. SHARED LIVES',
    train_title: 'TRAINING', train_dummy: 'DUMMY', train_reset: 'R RESETS THE DUMMY',
    train_hint: 'NO LIVES HERE. TRY THE MOVES IN THE LIST ON THE RIGHT.',
    hud_score: 'SCORE', hud_lives: 'LIVES', hud_hype: 'HYPE', hud_p1: 'P1', hud_p2: 'P2',
    hud_rescue: 'HOLD ON', hud_revive: 'REVIVE', hud_downed: 'DOWN',
    toast_go: 'GO!', toast_warning: 'WARNING', toast_hype: 'HYPE!',
    net_wait: 'WAITING FOR HOST', net_guest_left: 'PARTNER DISCONNECTED', net_spectate: 'SPECTATING',
    tab_music_on: 'MUSIC ON', tab_music_off: 'MUSIC OFF',
    credits_text: [
      'GREASE & GOLD: WORLD TOUR', '', 'A BROWSER ARCADE BEAT EM UP',
      'DESIGN / CODE / ART PIPELINE: FREEBUFF AGENT', 'ORIGINAL CHARACTERS + VISION: PLAYER529 & XION',
      '', 'RICKY B  -  TURKISH FLAG AND POLE', 'V.V.  -  VINTAGE MIC AND CORD',
      'JOHNNY $  -  OVERSIZED SALAMI', '',
      'SPRITE ART IS HAND-POSED AND RASTERISED BY THE PROJECT', 'BUILD PIPELINE IN TOOLS/BUILD_ART.JS',
      'MUSIC: ORIGINAL CHIPTUNE SEQUENCES (WEB AUDIO)', 'FONT: 5X7 BITMAP AUTHORED FOR THIS GAME',
      '', 'THANKS FOR PLAYING. NOW GO EAT SOMETHING.'
    ]
  },
  tr: {
    title: 'GREASE & GOLD', subtitle: 'DUNYA TURU',
    press_start: 'ENTER`A BAS', insert_coin: 'JETON AT  -  GREASE & GOLD RECORDS',
    main_play: 'OYNA', main_online: 'CEVRIMICI ORTAK', main_training: 'ANTRENMAN', main_howto: 'NASIL OYNANIR',
    main_settings: 'AYARLAR', main_credits: 'KUNYER',
    mode_solo: 'TEK KISI', mode_local: 'YEREL ORTAK', mode_online: 'CEVRIMICI ORTAK', mode_back: 'GERI',
    select_title: 'DOVUSCUNU SEC', select_p1: 'OYUNCU 1', select_p2: 'OYUNCU 2',
    select_locked: 'SECILDI', select_confirm: 'ENTER  SEC', select_back: 'ESC  GERI',
    lobby_title: 'CEVRIMICI LOBY', lobby_code: 'ODA KODU', lobby_waiting: 'OYUNCU 2 BEKLENIYOR',
    lobby_ready: 'HAZIR', lobby_notready: 'HAZIR DEGIL', lobby_start: 'TURU BASLAT',
    lobby_leave: 'ODADAN CIK', lobby_host: 'KURUCU', lobby_guest: 'KONUK', lobby_you: 'SEN',
    lobby_connecting: 'SUNUCUYA BAGLANIYOR', lobby_copy: 'DAVET LINKI ICIN C',
    online_title: 'CEVRIMICI ORTAK', online_host: 'ODA KUR', online_join: 'ODAYA KATIL',
    online_code: 'ODA KODUNU GIR', online_hint: 'AYNI KOD, IKI TARAYICI',
    online_relay: 'AKTARICI', online_local: 'AYNI TARAYICI SEKMELERI', online_connecting: 'BAGLANIYOR',
    online_failed: 'BAGLANTI BASARISIZ', online_full: 'ODA DOLU', online_notfound: 'ODA BULUNAMADI',
    online_timeout: 'SUNUCU ZAMAN ASIMI', online_hostleft: 'KURUCU ODADAN AYRILDI', online_version: 'SURUM UYUSMUYOR',
    difficulty: 'ZORLUK', stage: 'BASLANGIC', easy: 'KOLAY', normal: 'NORMAL', hard: 'ZOR',
    pause_title: 'DURAKLATILDI', pause_resume: 'DEVAM', pause_restart: 'BOLUMU YENIDEN BASLAT', pause_settings: 'AYARLAR',
    pause_howto: 'NASIL OYNANIR', pause_quit: 'BASLIGA DON', pause_waiting: 'KURUCU BEKLENIYOR',
    resume_title: 'DEVAM?', resume_yes: 'DEVAM', resume_no: 'CIK',
    over_title: 'OYUN BITTI', over_continue: 'DEVAM ET', over_title_btn: 'BASLIK', over_score: 'PUAN',
    clear_title: 'BOLUM TAMAM', clear_next: 'SONRAKI DURAK', clear_bonus: 'HYPE BONUSU', clear_total: 'TOPLAM',
    victory_title: 'TUR TAMAMLANDI', victory_sub: 'GREASE & GOLD TACI ALDI',
    credits_title: 'KUNYER', settings_title: 'AYARLAR',
    set_music: 'MUZIK', set_sfx: 'SES EFEKTI', set_shake: 'EKRAN SARSINTISI', set_flash: 'EKRAN PARLAMASI',
    set_scan: 'CRT TARAMA', set_lang: 'DIL', set_keys: 'KONTROLLER', set_back: 'GERI',
    on: 'ACIK', off: 'KAPALI', low: 'AZ', high: 'COK',
    keys_title: 'KONTROLLER', keys_p1: 'OYUNCU 1', keys_p2: 'OYUNCU 2', keys_reset: 'VARSAYILANA DON',
    keys_press: 'BIR TUS BAS', keys_conflict: 'TUS ZATEN KULLANILIYOR',
    ctl_tab_keys: 'KLAVYE', ctl_tab_pad: 'KUMANDA',
    ctl_hint_keys: 'YUKARI/ASAGI SEC   ENTER ATA   SOL/SAG OYUNCU   V KUMANDA',
    ctl_hint_pad: 'YUKARI/ASAGI SEC   ENTER ATA   SONRA TUSA BAS',
    ctl_pad_none: 'KUMANDA YOK',
    ctl_pad_ok: 'KUMANDA HAZIR',
    ctl_pad_std: 'STANDART ESLEME - XBOX DUZENI',
    ctl_lh: 'SOL EL', ctl_rh: 'SAG EL', ctl_move: 'HAREKET',
    ctl_tap: 'ATAMAK ICIN TUSA TIKLA',
    act_left: 'SOL', act_right: 'SAG', act_up: 'YUKARI', act_down: 'ASAGI', act_attack: 'HAFIF',
    act_heavy: 'AGIR', act_jump: 'ZIPLA', act_special: 'OZEL', act_grab: 'TUT', act_start: 'BASLA', act_pause: 'DURAKLAT',
    howto_title: 'NASIL OYNANIR', howto_move: 'HAREKET', howto_move_d: 'YON TUSLARI  -  DERINLIKTE HAREKET ET',
    howto_atk: 'HAFIF', howto_atk_d: 'Z  -  3 KEZ BAS: KOMBO. UCUNCU VURUS YERE SERER',
    howto_heavy: 'AGIR', howto_heavy_d: 'X  -  YAVAS TEK VURUS, HER ZAMAN YERE SERER. TUTULANI FIRLATIR',
    howto_spec: 'OZEL', howto_spec_d: 'HYPE ILE V BASILI TUT. TUTARKEN AZALIR, SADECE NORMAL VURUSLARLA DOLAR',
    howto_jump: 'ZIPLAMA', howto_jump_d: 'SPACE  -  HAVADA HAFIF, ASAGI + HAFIF DALIS',
    howto_grab: 'TUTMA', howto_grab_d: 'S  -  YAKINDA TUT, SONRA HAFIF VEYA TEKRAR TUTUP FIRLAT',
    howto_food: 'YEMEK', howto_food_d: 'KASA VE VARILLERI KIR. KEBAP CAN VERIR. DONER EN COK',
    howto_coop: 'ORTAK', howto_coop_d: 'DUSEN ARKADASININ YANINDA DUR, KALDIR. CANLAR ORTAK',
    train_title: 'ANTRENMAN', train_dummy: 'KUKLA', train_reset: 'R KUKLAYI SIFIRLAR',
    train_hint: 'BURADA CAN YOK. SAGDAKI HAREKETLERI DENE.',
    hud_score: 'PUAN', hud_lives: 'CAN', hud_hype: 'HYPE', hud_p1: 'O1', hud_p2: 'O2',
    hud_rescue: 'DAYAN', hud_revive: 'KALDIR', hud_downed: 'DUSDU',
    toast_go: 'GIT!', toast_warning: 'DIKKAT', toast_hype: 'HYPE!',
    net_wait: 'KURUCU BEKLENIYOR', net_guest_left: 'ARKADAS AYRILDI', net_spectate: 'IZLIYORSUN',
    tab_music_on: 'MUZIK ACIK', tab_music_off: 'MUZIK KAPALI',
    credits_text: [
      'GREASE & GOLD: DUNYA TURU', '', 'TARAYICIDA BIR ARCADE DOVUS OYUNU',
      'TASARIM / KOD / SANAT HATTI: FREEBUFF AGENT', 'OZGUN KARAKTERLER + VIZYON: PLAYER529 & XION',
      '', 'RICKY B  -  TURK BAYRAGI VE DIREK', 'V.V.  -  VINTAGE MIKROFON VE KABLO',
      'JOHNNY $  -  DEV SALAM', '',
      'SPRITE SANATI EL ILE POZLANIP PROJEDE URETILDI', 'URETIM HATTI: TOOLS/BUILD_ART.JS',
      'MUZIK: OZGUN CHIPTUNE DIZILERI (WEB AUDIO)', 'FONT: BU OYUN ICIN 5X7 BITMAP',
      '', 'OYNADIGIN ICIN TESEKKURler. SIMDI GIT BIRSEYLER YE.'
    ]
  }
};
G.STR = STR;
G.lang = 'en';
G.t = function (k, lang) {
  const L = STR[lang || G.lang] || STR.en;
  return (k in L) ? L[k] : STR.en[k] !== undefined ? STR.en[k] : k;
};

/* ---------- persistence ---------- */
G.DEFAULTS = {
  music: 0.55, sfx: 0.8, shake: 1, flash: 1, scanlines: 1, lang: 'en',
  shakeAllow: true, diff: 1, stage: 0, rumble: 1,
  /* Emulator-pad keyboards: left hand moves, right hand fights. Light and
     heavy sit on adjacent keys under the right hand, jump beside them, grab on
     the left of that block and special one key further in. P2's block never
     collides with P1's. */
  keys: {
    p1: {
      left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
      attack: 'KeyZ', heavy: 'KeyX', jump: 'Space', grab: 'KeyS', special: 'KeyV',
      start: 'Enter', pause: 'Escape'
    },
    p2: {
      left: 'Digit4', right: 'Digit6', up: 'Digit8', down: 'Digit2',
      attack: 'KeyO', heavy: 'Semicolon', jump: 'KeyP', grab: 'Quote', special: 'BracketLeft',
      start: 'ShiftRight', pause: 'Escape'
    }
  },
  /* Standard-mapping pad (W3C indices): light X, heavy Y, jump A, grab B,
     special RT, Start pauses, Back leaves a screen. D-pad and the left stick
     always move. */
  pad: { attack: 2, heavy: 3, jump: 0, grab: 1, special: 7, start: 9, pause: 8 }
};
G.loadSettings = function () {
  const d = JSON.parse(JSON.stringify(G.DEFAULTS));
  try {
    const raw = (typeof localStorage !== 'undefined') && localStorage.getItem('gg-settings-v2');
    if (raw) {
      const s = JSON.parse(raw);
      Object.keys(d).forEach(k => { if (s[k] !== undefined) d[k] = s[k]; });
      if (s.keys) { d.keys.p1 = Object.assign(d.keys.p1, s.keys.p1 || {}); d.keys.p2 = Object.assign(d.keys.p2, s.keys.p2 || {}); }
      if (s.pad) d.pad = Object.assign(d.pad, s.pad);
    }
  } catch (e) { /* storage may be blocked */ }
  return d;
};
G.saveSettings = function (s) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('gg-settings-v2', JSON.stringify(s)); } catch (e) {}
};
G.KEYLABEL = function (code) {
  if (!code) return '-';
  const punct = { Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\',
    Slash: '/', Comma: ',', Period: '.', Backquote: '`', Minus: '-', Equal: '=' };
  if (punct[code]) return punct[code];
  return String(code).replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '').replace(/^Numpad/, 'NUM ')
    .replace('ShiftRight', 'R-SHIFT').replace('ShiftLeft', 'L-SHIFT').replace('Space', 'SPACE')
    .replace('Enter', 'ENTER').replace('Escape', 'ESC').replace('Backspace', 'BKSP')
    .replace('ControlLeft', 'L-CTRL').replace('ControlRight', 'R-CTRL').toUpperCase();
};
})(globalThis.GG = globalThis.GG || {});
