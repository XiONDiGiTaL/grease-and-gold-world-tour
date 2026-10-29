/* Rendering: one 480x270 pixel canvas for world, HUD and every menu. */
(function (G) {
'use strict';
const Art = G.Art, T = G.text, tw = G.textWidth;
const LW = G.LW, LH = G.LH;
const R = G.Render = {};
function tr(g, key) { return g.tr(key); }
const INK = '#120b18', PANEL = '#1d1229', PANEL2 = '#26173a', GOLD = '#f2b630', GOLD2 = '#ffd866',
  MAG = '#d93aa0', CREAM = '#f6ead0', DIM = '#8f84a3', RED = '#e0322e', GREEN = '#5fe06a', BLUE = '#5fd0ff';

R.init = function (assets) { R.A = assets; };
function atlasFrame(meta, kit, anim, frame) {
  const k = meta.kits[kit]; if (!k) return null;
  const an = k.anims[anim] || k.anims.idle; if (!an) return null;
  return an.frames[Math.min(frame | 0, an.frames.length - 1)];
}
R.frame = function (kit, anim, frame) { return R.A ? atlasFrame(R.A.meta, kit, anim, frame) : null; };

function shadow(ctx, x, y, w, a) { ctx.fillStyle = 'rgba(8,4,14,' + a + ')'; ctx.beginPath(); ctx.ellipse(x, y, w / 2, Math.max(2, w * .10), 0, 0, 7); ctx.fill(); }
function panel(ctx, x, y, w, h, border, fill) {
  ctx.fillStyle = INK; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = border || GOLD; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = fill || PANEL; ctx.fillRect(x, y, w, h);
}
function gauge(ctx, x, y, w, h, pct, fill, back) {
  ctx.fillStyle = INK; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = back || '#3a1020'; ctx.fillRect(x, y, w, h);
  const fw = Math.max(0, Math.round(w * Math.min(1, Math.max(0, pct))));
  ctx.fillStyle = fill; ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x, y, fw, Math.max(1, h >> 2));
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  for (let i = 1; i < 10; i++) ctx.fillRect(x + Math.round(w * i / 10), y, 1, h);
}
function keycap(ctx, label, x, y, active) {
  const w = Math.max(12, tw(label, 7) + 8);
  ctx.fillStyle = active ? GOLD : '#2a1d3a'; ctx.fillRect(x, y, w, 11);
  ctx.fillStyle = active ? '#2a1d3a' : '#4a3558'; ctx.fillRect(x, y, w, 2);
  T(ctx, label, x + 4, y + 2, 7, active ? INK : CREAM);
  return w;
}
function drawSprite(ctx, kit, anim, frameNo, x, y, face, scale, tint) {
  const f = R.frame(kit, anim, frameNo); if (!f) return;
  const im = R.A.fighters;
  const w = f.w * (scale || 1), h = f.h * (scale || 1);
  const dx = Math.round(x + (face < 0 ? -f.ox - f.w : f.ox) * (scale || 1));
  const dy = Math.round(y + f.oy * (scale || 1));
  ctx.save();
  if (tint) {
    ctx.globalAlpha = tint;
  }
  if (face < 0) {
    /* mirror around the feet anchor: local x = f.ox maps back to x - f.ox */
    ctx.translate(Math.round(x), 0);
    ctx.scale(-1, 1);
    ctx.drawImage(im, f.x, f.y, f.w, f.h, f.ox, dy, w, h);
  } else {
    ctx.drawImage(im, f.x, f.y, f.w, f.h, Math.round(x + f.ox), dy, w, h);
  }
  ctx.restore();
}
R.drawSprite = drawSprite;

/* ---------------- world ---------------- */
R.world = function (g, ctx) {
  const cam = g.cam.x, st = g.stageIdx, imgs = R.A.stages[st];
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0b0812'; ctx.fillRect(0, 0, LW, LH);
  if (imgs) {
    const draw = (img, par) => {
      const ox = Math.round(cam * par);
      if (img.width < LW) ctx.drawImage(img, 0, 0);
      else ctx.drawImage(img, Math.max(0, Math.min(img.width - LW, ox)), 0, LW, LH, 0, 0, LW, LH);
    };
    draw(imgs.far, .18); draw(imgs.mid, .48); draw(imgs.floor, 1);
  } else {
    ctx.fillStyle = '#3a4a66'; ctx.fillRect(0, 0, LW, LH); ctx.fillStyle = '#8a8a80'; ctx.fillRect(0, G.FT, LW, LH - G.FT);
  }
  const list = [];
  g.props.forEach(p => list.push({ o: p, y: p.y, k: 'prop' }));
  g.items.forEach(p => list.push({ o: p, y: p.y, k: 'item' }));
  g.enemies.forEach(p => list.push({ o: p, y: p.y, k: 'e' }));
  g.players.forEach(p => list.push({ o: p, y: p.y, k: 'p' }));
  list.sort((a, b) => a.y - b.y);

  for (const q of list) {
    const o = q.o, x = Math.round(o.x - cam), y = Math.round(o.y);
    if (q.k === 'prop') shadow(ctx, x, y, 34, .34);
    else if (q.k === 'item') shadow(ctx, x, y, 26 - Math.min(12, o.z), .3);
    else if (!(o.state === 'dead' && (o.deadT >> 2) & 1)) shadow(ctx, x, y, (o.hw * 2 + 8) * (1 - Math.min(.35, o.z / 120)), .4);
  }
  const propMeta = R.A.props;
  for (const q of list) {
    const o = q.o, x = Math.round(o.x - cam), y = Math.round(o.y);
    if (q.k === 'prop') {
      const f = propMeta.props[o.type];
      if (f) { const sh = o.shake > 0 ? ((o.shake >> 1) & 1 ? 1 : -1) : 0; ctx.drawImage(R.A.propsImg, f.x, f.y, f.w, f.h, x - (f.w >> 1) + sh, y - f.h + 1, f.w, f.h); }
    } else if (q.k === 'item') {
      const f = propMeta.food[o.type];
      if (f) {
        const bob = o.z > 0 ? 0 : Math.round(Math.sin((o.t || 0) * .1) * 2) + 3;
        const zz = Math.round(o.z) + bob;
        ctx.globalAlpha = o.life < 120 && ((o.life >> 2) & 1) ? .35 : 1;
        ctx.drawImage(R.A.propsImg, f.x, f.y, f.w, f.h, x - (f.w >> 1), y - f.h - zz, f.w, f.h);
        ctx.globalAlpha = 1;
      }
    } else {
      const z = Math.round(o.z);
      if (o.invuln > 0 && o.state !== 'dead' && ((o.invuln >> 2) & 1) && o.team === 'p') continue;
      const f = R.frame(o.kitId, o.anim, o.frame);
      if (f) {
        ctx.save();
        /* keep weapon tips from drawing through the street on ground slams */
        ctx.beginPath(); ctx.rect(0, 0, LW, Math.round(o.y - o.z) + 1); ctx.clip();
        if (o.flash > 0 && o.flash % 4 < 2) { ctx.globalAlpha = .55; }
        if (o.face < 0) {
          ctx.translate(x, 0); ctx.scale(-1, 1);
          ctx.drawImage(R.A.fighters, f.x, f.y, f.w, f.h, f.ox, y - z + f.oy, f.w, f.h);
        } else {
          ctx.drawImage(R.A.fighters, f.x, f.y, f.w, f.h, x + f.ox, y - z + f.oy, f.w, f.h);
        }
        ctx.restore();
      }
      if (o.warn && ((g.t >> 2) & 1)) {
        const hy = y - z - (o.ht || 60) - 10;
        ctx.fillStyle = INK; ctx.fillRect(x - 3, hy - 1, 7, 15);
        ctx.fillStyle = RED; ctx.fillRect(x - 1, hy + 1, 3, 8); ctx.fillRect(x - 1, hy + 11, 3, 3);
      }
      if (o.state === 'downed') {
        const pct = Math.min(1, (o.downT || 0) / 420);
        gauge(ctx, x - 16, y - 46, 32, 4, 1 - pct, '#ff5a5a');
        T(ctx, g.tr('hud_downed'), x, y - 54, 7, CREAM, 'center', INK);
      }
      if ((o.state === 'down' && (o.downT || 0) < 30) || (o.state === 'hit' && o.hitChain >= 2)) {
        const hy = y - z - (o.ht || 60) - 2;
        for (let k = 0; k < 3; k++) {
          const a = g.t * .22 + k * 2.09;
          const f2 = propMeta.fx.star[0];
          if (f2) ctx.drawImage(R.A.propsImg, f2.x, f2.y, f2.w, f2.h, Math.round(x + Math.cos(a) * 12 - 5), Math.round(hy + Math.sin(a) * 3 - 5), 11, 11);
        }
      }
      if (o.team === 'p' && g.players.length > 1) {
        const col = o.pid === 0 ? GOLD : BLUE;
        const hx = x, hy = y - z - (o.ht || 62) - 14;
        ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(hx - 5, hy - 2); ctx.lineTo(hx + 5, hy - 2); ctx.lineTo(hx, hy + 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(hx - 3, hy - 1); ctx.lineTo(hx + 3, hy - 1); ctx.lineTo(hx, hy + 2); ctx.closePath(); ctx.fill();
        T(ctx, o.pid === 0 ? 'P1' : 'P2', hx, hy - 5, 7, col, 'center', INK);
      }
      if (o.state === 'downed' && o.reviveT > 0) {
        gauge(ctx, x - 18, y - 58, 36, 3, o.reviveT / 80, GREEN);
        T(ctx, g.tr('hud_revive'), x, y - 66, 7, GREEN, 'center', INK);
      }
    }
  }
  /* projectiles come off the same atlas as props (bottle) - drawn small */
  g.projs.forEach(pr => {
    const x = Math.round(pr.x - cam), y = Math.round(pr.y - pr.z);
    ctx.fillStyle = INK; ctx.fillRect(x - 4, y - 5, 8, 10);
    ctx.fillStyle = '#6a8a4a'; ctx.fillRect(x - 3, y - 4, 6, 8);
    ctx.fillStyle = '#cfe0a8'; ctx.fillRect(x - 2, y - 4, 2, 4);
  });
  R.fx(g, ctx, cam);
};
R.fx = function (g, ctx, cam) {
  const P = R.A.props, fxm = P.fx;
  for (const f of g.fx) {
    const x = f.x - cam, y = f.y - f.z, age = f.age || 0;
    if (f.type === 'spark') {
      const fr = fxm.spark[Math.min(2, age >> 1)]; if (fr) ctx.drawImage(R.A.propsImg, fr.x, fr.y, fr.w, fr.h, Math.round(x - fr.w / 2), Math.round(y - fr.h / 2), fr.w, fr.h);
    } else if (f.type === 'boom') {
      const fr = fxm.boom[Math.min(2, age >> 2)]; if (fr) ctx.drawImage(R.A.propsImg, fr.x, fr.y, fr.w, fr.h, Math.round(x - fr.w / 2), Math.round(y - fr.h / 2), fr.w, fr.h);
    } else if (f.type === 'dust') {
      const fr = fxm.dust[Math.min(2, age >> 2)]; if (fr) { ctx.globalAlpha = Math.min(1, f.life / 12); ctx.drawImage(R.A.propsImg, fr.x, fr.y, fr.w, fr.h, Math.round(x - fr.w / 2), Math.round(y - fr.h / 2), fr.w, fr.h); ctx.globalAlpha = 1; }
    } else if (f.type === 'star') {
      const fr = fxm.star[Math.min(2, age >> 1)]; if (fr) { ctx.globalAlpha = Math.min(1, f.life / 12); ctx.drawImage(R.A.propsImg, fr.x, fr.y, fr.w, fr.h, Math.round(x - 6), Math.round(y - 6), 12, 12); ctx.globalAlpha = 1; }
    } else if (f.type === 'debris') {
      ctx.fillStyle = INK; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
      ctx.fillStyle = '#' + ('000000' + f.col.toString(16)).slice(-6); ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    } else if (f.type === 'ring') {
      const r = 6 + age * 3.2;
      ctx.strokeStyle = 'rgba(255,214,90,' + Math.max(0, f.life / 14) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * .55, 0, 0, 7); ctx.stroke();
    } else if (f.type === 'food') {
      const fr = P.food[f.food];
      if (fr) { const k = 1 + age * .02; ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 22)); ctx.drawImage(R.A.propsImg, fr.x, fr.y, fr.w, fr.h, Math.round(x - fr.w * k / 2), Math.round(y - fr.h * k), fr.w * k, fr.h * k); ctx.globalAlpha = 1; }
    } else if (f.type === 'glow') {
      ctx.globalAlpha = Math.min(1, f.life / 12);
      ctx.fillStyle = 'rgba(255,214,90,.35)'; ctx.beginPath(); ctx.arc(x, y, 18 + age, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    } else if (f.type === 'text') {
      ctx.globalAlpha = Math.min(1, f.life / 14);
      T(ctx, f.s, x, y, 7, GREEN, 'center', INK);
      ctx.globalAlpha = 1;
    }
  }
};

/* ---------------- HUD ---------------- */
R.hud = function (g, ctx) {
  const tr = (k) => g.tr(k);
  g.players.forEach((p, i) => {
    const x = 6, y = 5 + i * 34, w = 138;
    const pf = R.A.meta.kits[p.kitId].portrait;
    panel(ctx, x, y, w, 30, i ? BLUE : GOLD, PANEL);
    if (pf) { ctx.drawImage(R.A.fighters, pf.x, pf.y, pf.w, pf.h, x + 1, y + 1, 28, 28); }
    T(ctx, i ? 'P2' : 'P1', x + 3, y + 21, 7, i ? BLUE : GOLD2, 'left', INK);
    T(ctx, p.def.name.toUpperCase(), x + 32, y + 9, 7, CREAM);
    gauge(ctx, x + 32, y + 12, 68, 6, p.hp / p.maxhp, p.hp / p.maxhp < .3 && ((g.t >> 3) & 1) ? '#ff6a4a' : '#ffd23a', '#4a0f12');
    gauge(ctx, x + 32, y + 21, 68, 4, p.hype / 100, p.state === 'special' ? '#9be6ff' : '#38b6ff', '#0d2a55');
    T(ctx, 'H', x + 103, y + 10, 7, '#9be6ff');
    T(ctx, 'X' + Math.max(0, g.lives), x + 103, y + 21, 7, CREAM);
  });
  T(ctx, tr('hud_score'), LW - 8, 12, 7, DIM, 'right');
  T(ctx, String(g.score).padStart(7, '0'), LW - 8, 22, 7, CREAM, 'right');
  if (g.best) T(ctx, 'BEST ' + g.best, LW - 8, 32, 7, DIM, 'right');
  if (g.players.length === 2) {
    const p2 = g.players[1];
    T(ctx, p2.def.name.toUpperCase(), LW - 46, 44, 7, BLUE, 'right');
    gauge(ctx, LW - 102, 48, 94, 4, p2.hp / p2.maxhp, '#5fd0ff', '#102a3a');
  }
  if (g.combo.n >= 2) {
    const pop = Math.max(0, g.combo.pop || 0);
    T(ctx, g.combo.n + ' HITS', 8, 82, 14 + pop, g.combo.n >= 8 ? GOLD2 : CREAM, 'left', INK);
  }
  if (g.boss && g.boss.state !== 'spawn') {
    panel(ctx, 120, LH - 24, 240, 18, '#b0407a', '#2a1020');
    const pf = R.A.meta.kits[g.boss.kitId].portrait;
    if (pf) ctx.drawImage(R.A.fighters, pf.x, pf.y, pf.w, pf.h, 122, LH - 23, 16, 16);
    T(ctx, g.boss.def.name.toUpperCase(), 142, LH - 17, 7, CREAM);
    gauge(ctx, 142, LH - 10, 212, 4, g.boss.hp / g.boss.maxhp, '#ff5aa8', '#3a0f2a');
  }
  if (g.screen === 'play') {
    if (g.banner > 0 && g.stage) {
      const a = Math.min(1, g.banner / 24, (160 - g.banner) / 10 + .2);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(14,7,22,.86)'; ctx.fillRect(0, 96, LW, 44);
      ctx.fillStyle = MAG; ctx.fillRect(0, 96, LW, 2); ctx.fillRect(0, 138, LW, 2);
      T(ctx, g.stage.tour, LW / 2, 108, 7, MAG, 'center');
      T(ctx, g.stage.name.toUpperCase(), LW / 2, 128, 14, GOLD, 'center');
      ctx.globalAlpha = 1;
    }
    if (g.bossBanner > 0 && ((g.bossBanner >> 3) & 1)) T(ctx, tr('toast_warning'), LW / 2, 78, 14, RED, 'center', INK);
    if (g.waveState === 'walk' && g.waveIdx > 0 && ((g.goT >> 4) & 1)) {
      T(ctx, tr('toast_go'), LW - 24, 214, 14, GOLD2, 'right', INK);
      ctx.fillStyle = GOLD2;
      ctx.beginPath(); ctx.moveTo(LW - 16, 198); ctx.lineTo(LW - 6, 204); ctx.lineTo(LW - 16, 210); ctx.closePath(); ctx.fill();
    }
    if (g.flashT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (g.flashT / 12) + ')'; ctx.fillRect(0, 0, LW, LH); }
    if (g.training) R.trainingPanel(g, ctx);
    if (g.toast) {
      ctx.fillStyle = 'rgba(14,7,22,.8)';
      const w = Math.min(LW - 20, tw(g.toast, 7) + 12);
      ctx.fillRect((LW - w) / 2, LH - 58, w, 14);
      T(ctx, g.toast, LW / 2, LH - 55, 7, CREAM, 'center');
    }
  }
};
R.trainingPanel = function (g, ctx) {
  panel(ctx, LW - 106, 56, 100, 82, MAG, 'rgba(20,10,28,.85)');
  T(ctx, g.tr('train_title'), LW - 56, 64, 7, GOLD, 'center');
  const rows = [['MOVE', 'ARROWS'], ['COMBO', 'ATTACK X3'], ['LAUNCH', 'ATTACK X3'], ['SPECIAL', 'HOLD SPECIAL'], ['GRAB', 'GRAB'], ['THROW', 'GRAB TWICE'], ['DUMMY', 'UP+GRAB']];
  rows.forEach((r, i) => { T(ctx, r[0], LW - 100, 76 + i * 8, 7, CREAM); T(ctx, r[1], LW - 12, 76 + i * 8, 7, DIM, 'right'); });
};

/* ---------------- screens ---------------- */
R.screen = function (g, ctx) {
  const tr = (k) => g.tr(k);
  ctx.imageSmoothingEnabled = false;
  if (g.screen === 'title') return R.title(g, ctx);
  if (g.screen === 'main') return R.main(g, ctx);
  if (g.screen === 'select') return R.select(g, ctx);
  if (g.screen === 'online' || g.screen === 'join' || g.screen === 'lobby') return R.online(g, ctx);
  if (g.screen === 'settings') return R.settings(g, ctx);
  if (g.screen === 'howto') return R.howto(g, ctx);
  if (g.screen === 'credits') return R.credits(g, ctx);
  if (g.screen === 'pause') return R.pause(g, ctx);
  if (g.screen === 'clear') return R.clear(g, ctx);
  if (g.screen === 'over') return R.over(g, ctx);
  if (g.screen === 'victory') return R.victory(g, ctx);
};
R.backdrop = function (g, ctx, stageIdx, dim) {
  const imgs = R.A.stages[stageIdx] || R.A.stages[0];
  const t = g.t * .35;
  if (imgs) {
    ctx.drawImage(imgs.far, Math.round(Math.sin(t * .0009) * 20), 0);
    ctx.drawImage(imgs.mid, Math.round(Math.sin(t * .0006) * 30), 0);
    ctx.drawImage(imgs.floor, Math.round(Math.sin(t * .0004) * 40), 0);
  }
  ctx.fillStyle = 'rgba(12,6,20,' + (dim === undefined ? .5 : dim) + ')'; ctx.fillRect(0, 0, LW, LH);
};
R.heroLine = function (g, ctx, y, scale) {
  const ids = ['ricky', 'vv', 'johnny'];
  ids.forEach((id, i) => {
    const x = LW / 2 + (i - 1) * 96;
    shadow(ctx, x, y + 2, 44, .35);
    drawSprite(ctx, id, 'idle', Math.floor(g.t / 16 + i * 1.5) % 4, x, y, i === 1 ? -1 : 1);
  });
};
R.bigTitle = function (ctx, x, y, s) {
  T(ctx, 'GREASE & GOLD', x + 2, y + 2, s, MAG, 'center');
  T(ctx, 'GREASE & GOLD', x, y, s, GOLD, 'center', INK);
};
R.menuList = function (g, ctx, rows, labels, x, y, gap, w) {
  rows.forEach((id, i) => {
    const sel = g.menu === i;
    const yy = y + i * gap;
    if (sel) { ctx.fillStyle = GOLD; ctx.fillRect(x - 6, yy - 4, w, gap - 2); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x - 6, yy - 4, w, 2); }
    T(ctx, (sel ? '> ' : '  ') + labels[i], x, yy, 7, sel ? INK : CREAM);
    g.hot.push({ x: x - 6, y: yy - 6, w: w, h: gap, act: 'row', i: i });
  });
};
R.title = function (g, ctx) {
  R.backdrop(g, ctx, 0, .45);
  R.heroLine(g, ctx, 230);
  R.bigTitle(ctx, LW / 2, 50, 21);
  ctx.fillStyle = MAG; ctx.fillRect(LW / 2 - 110, 80, 220, 18);
  ctx.fillStyle = INK; ctx.fillRect(LW / 2 - 110, 80, 220, 2); ctx.fillRect(LW / 2 - 110, 96, 220, 2);
  T(ctx, 'WORLD TOUR', LW / 2, 84, 14, CREAM, 'center');
  if ((g.t >> 5) & 1) T(ctx, tr(g, 'press_start'), LW / 2, 120, 7, CREAM, 'center', INK);
  T(ctx, tr(g, 'insert_coin'), LW / 2, 258, 7, DIM, 'center');
  T(ctx, 'BEST ' + String(g.best || 0).padStart(7, '0'), LW / 2, 246, 7, GOLD2, 'center');
  g.hot.push({ x: 0, y: 0, w: LW, h: LH, act: 'confirm' });
};
R.main = function (g, ctx) {
  R.backdrop(g, ctx, 3, .6);
  panel(ctx, 20, 24, 226, 224, GOLD, 'rgba(20,11,30,.9)');
  T(ctx, 'GREASE & GOLD', 34, 44, 14, GOLD);
  T(ctx, 'WORLD TOUR', 34, 58, 7, MAG);
  const rows = ['mode_solo', 'mode_local', 'mode_online', 'main_training', 'main_howto', 'main_settings', 'main_credits'];
  R.menuList(g, ctx, rows, rows.map(k => tr(g, k)), 42, 84, 20, 200);
  panel(ctx, 256, 24, 204, 224, '#4a3558', 'rgba(20,11,30,.78)');
  const id = ['ricky', 'vv', 'johnny'][g.menu % 3];
  if (g.menu < 3) {
    drawSprite(ctx, id, 'idle', Math.floor(g.t / 18) % 4, 348, 200, 1);
    T(ctx, G.CH[id].name.toUpperCase(), 358, 214, 7, CREAM, 'center');
    T(ctx, G.CH[id].weapon.toUpperCase(), 358, 224, 7, DIM, 'center');
  } else if (g.menu === 2) {
    T(ctx, tr(g, 'online_hint'), 358, 150, 7, CREAM, 'center');
  } else {
    T(ctx, 'GREASE & GOLD RECORDS', 358, 130, 7, CREAM, 'center');
    T(ctx, 'A BROWSER ARCADE', 358, 142, 7, DIM, 'center');
    T(ctx, 'BEAT EM UP', 358, 152, 7, DIM, 'center');
    T(ctx, 'V' + G.VERSION, 358, 200, 7, DIM, 'center');
  }
  T(ctx, 'ARROWS / WASD  SELECT      ENTER  CONFIRM', LW / 2, 258, 7, DIM, 'center');
};
R.select = function (g, ctx) {
  R.backdrop(g, ctx, g.settings.stage | 0, .62);
  T(ctx, tr(g, 'select_title'), LW / 2, 14, 14, GOLD, 'center', INK);
  T(ctx, g.mode === 'local' ? 'P1 ARROWS   P2 WASD' : tr(g, 'select_p1'), LW / 2, 32, 7, MAG, 'center');
  G.CH_ORDER.forEach((id, i) => {
    const d = G.CH[id], x = 12 + i * 156, y = 44, w = 148, h = 194, sel = g.sel === i, sel2 = g.mode === 'local' && g.selP2 === i;
    panel(ctx, x, y, w, h, sel ? GOLD : sel2 ? BLUE : '#4a3558', 'rgba(20,11,30,.9)');
    shadow(ctx, x + w / 2, y + 176, 60, .4);
    drawSprite(ctx, id, 'idle', sel ? Math.floor(g.t / 16) % 4 : 0, x + w / 2, y + 176, i === 2 ? -1 : 1);
    T(ctx, d.name.toUpperCase(), x + w / 2, y + 186, 7, sel ? GOLD2 : CREAM, 'center');
    T(ctx, d.special.toUpperCase(), x + w / 2, y + 12, 7, MAG, 'center');
    T(ctx, d.weapon.toUpperCase(), x + 8, y + 22, 7, DIM);
    const stats = [['POW', d.stats.power], ['SPD', d.stats.speed], ['RCH', d.stats.reach], ['HP', d.stats.health]];
    stats.forEach((s, k) => {
      const sy = y + 36 + k * 9;
      T(ctx, s[0], x + 8, sy, 7, CREAM);
      for (let b = 0; b < 5; b++) { ctx.fillStyle = b < s[1] ? (sel ? GOLD : MAG) : '#3a2a4a'; ctx.fillRect(x + 34 + b * 12, sy, 9, 5); }
    });
    wrap(ctx, d.blurb, x + w / 2, y + 74, w - 18, 7, CREAM, 'center');
    if (sel) T(ctx, 'P1', x + 6, y + 170, 7, GOLD2, 'left', INK);
    if (sel2) T(ctx, 'P2', x + w - 6, y + 170, 7, BLUE, 'right', INK);
    g.hot.push({ x: x, y: y, w: w, h: h, act: 'pick', i: i });
  });
  T(ctx, tr(g, 'select_confirm') + '      ' + tr(g, 'select_back'), LW / 2, 252, 7, DIM, 'center');
};
R.online = function (g, ctx) {
  R.backdrop(g, ctx, 1, .68);
  panel(ctx, 70, 30, 340, 208, GOLD, 'rgba(20,11,30,.92)');
  T(ctx, tr(g, 'online_title'), LW / 2, 48, 14, GOLD, 'center');
  if (g.screen === 'online') {
    const rows = ['online_host', 'online_join', 'online_local', 'mode_back'];
    R.menuList(g, ctx, rows, rows.map(k => tr(g, k)), 100, 82, 22, 280);
    T(ctx, tr(g, 'online_hint'), LW / 2, 196, 7, CREAM, 'center');
    T(ctx, 'RELAY: ' + (G.relayFromUrl().indexOf('localhost') >= 0 ? 'LOCAL (TOOLS/RELAY.JS)' : G.relayFromUrl()), LW / 2, 210, 7, DIM, 'center');
    T(ctx, 'ROOMS ARE UNLISTED, NOT PRIVATE. NO ACCOUNTS.', LW / 2, 222, 7, DIM, 'center');
  } else if (g.screen === 'join') {
    T(ctx, tr(g, 'online_code'), LW / 2, 80, 7, CREAM, 'center');
    const code = (g.joinCode || '');
    for (let i = 0; i < 5; i++) {
      panel(ctx, LW / 2 - 96 + i * 40, 94, 32, 40, code[i] ? GOLD : '#4a3558', '#120b18');
      T(ctx, code[i] || '_', LW / 2 - 80 + i * 40, 106, 14, code[i] ? GOLD2 : DIM, 'center');
    }
    if (g.joinError) T(ctx, g.joinError, LW / 2, 150, 7, RED, 'center');
    T(ctx, 'TYPE THE 5 CHARACTER CODE THEN ENTER', LW / 2, 166, 7, DIM, 'center');
    T(ctx, 'ESC  BACK', LW / 2, 180, 7, DIM, 'center');
  } else if (g.screen === 'lobby') {
    const L = g.lobby || { code: g.code, host: g.p1, guest: g.p2, guestHere: false, guestReady: false, diff: g.diff, stage: g.settings.stage };
    T(ctx, tr(g, 'lobby_code'), LW / 2, 72, 7, DIM, 'center');
    T(ctx, L.code || '-----', LW / 2, 90, 21, GOLD2, 'center', INK);
    T(ctx, 'INVITE: ' + (g.invite || G.inviteUrl(L.code || '')), LW / 2, 104, 7, DIM, 'center');
    const slots = [['P1', L.host, true, true], ['P2', L.guest, L.guestHere, L.guestReady]];
    slots.forEach((s, i) => {
      const x = 96 + i * 146, y = 116;
      panel(ctx, x, y, 136, 56, s[2] ? (i ? BLUE : GOLD) : '#3a2a4a', '#160f22');
      T(ctx, s[0], x + 6, y + 12, 7, i ? BLUE : GOLD2);
      T(ctx, G.CH[s[1]] ? G.CH[s[1]].name.toUpperCase() : '-', x + 6, y + 26, 7, CREAM);
      T(ctx, i === 0 ? tr(g, 'lobby_host') : s[2] ? (s[3] ? tr(g, 'lobby_ready') : tr(g, 'lobby_notready')) : tr(g, 'lobby_waiting'), x + 6, y + 42, 7, s[2] ? (s[3] ? GREEN : DIM) : DIM);
      if (s[2]) { shadow(ctx, x + 108, y + 48, 30, .3); drawSprite(ctx, s[1], 'idle', Math.floor(g.t / 18) % 4, x + 108, y + 48, i ? -1 : 1, .8); }
    });
    T(ctx, tr(g, 'difficulty') + ': ' + tr(g, ['easy', 'normal', 'hard'][g.diff]), 100, 188, 7, CREAM);
    T(ctx, tr(g, 'stage') + ': ' + (G.STAGES[g.settings.stage | 0].name.toUpperCase()), 100, 200, 7, CREAM);
    const canStart = g.isHost() && L.guestHere && L.guestReady;
    T(ctx, g.isHost() ? (canStart && ((g.t >> 4) & 1) ? 'ENTER  ' + tr(g, 'lobby_start') : tr(g, 'lobby_waiting')) : (g.ready ? tr(g, 'lobby_ready') : 'ENTER  ' + tr(g, 'lobby_ready')),
      100, 216, 7, canStart ? GOLD2 : DIM);
    T(ctx, 'C  COPY INVITE      ESC  ' + tr(g, 'lobby_leave'), 100, 228, 7, DIM);
  }
};
R.settings = function (g, ctx) {
  R.backdrop(g, ctx, 2, .72);
  panel(ctx, 50, 20, 380, 232, GOLD, 'rgba(20,11,30,.94)');
  T(ctx, g.cfg ? tr(g, 'keys_title') : tr(g, 'settings_title'), LW / 2, 36, 14, GOLD, 'center');
  const s = g.settings;
  const val = (k) => {
    if (k === 'set_music') return Math.round(s.music * 10) + '/10';
    if (k === 'set_sfx') return Math.round(s.sfx * 10) + '/10';
    if (k === 'set_shake') return tr(g, s.shake ? 'on' : 'off');
    if (k === 'set_flash') return tr(g, s.flash ? 'on' : 'off');
    if (k === 'set_scan') return tr(g, s.scanlines ? 'on' : 'off');
    if (k === 'set_lang') return s.lang.toUpperCase();
    if (k === 'set_keys') return '>';
    return '';
  };
  if (!g.cfg) {
    const rows = ['set_music', 'set_sfx', 'set_shake', 'set_flash', 'set_scan', 'set_lang', 'set_keys', 'set_back'];
    rows.forEach((k, i) => {
      const y = 56 + i * 22, sel = g.menu === i;
      if (sel) { ctx.fillStyle = GOLD; ctx.fillRect(64, y - 5, 352, 20); }
      T(ctx, tr(g, k), 72, y, 7, sel ? INK : CREAM);
      T(ctx, val(k), 404, y, 7, sel ? INK : GOLD2, 'right');
      g.hot.push({ x: 64, y: y - 5, w: 352, h: 20, act: 'row', i: i });
    });
    T(ctx, 'LEFT / RIGHT TO CHANGE', LW / 2, 238, 7, DIM, 'center');
  } else R.remap(g, ctx);
};
R.remap = function (g, ctx) {
  const c = g.cfg, keys = g.settings.keys[c.player ? 'p2' : 'p1'];
  T(ctx, c.player ? tr(g, 'keys_p2') : tr(g, 'keys_p1'), LW / 2, 54, 7, c.player ? BLUE : GOLD2, 'center');
  ACT_ROWS.forEach((a, i) => {
    const y = 68 + i * 14, sel = c.row === i;
    if (sel) { ctx.fillStyle = '#2a1d3a'; ctx.fillRect(120, y - 4, 240, 13); }
    T(ctx, tr(g, 'act_' + a), 130, y, 7, sel ? GOLD2 : CREAM);
    const label = c.waiting && sel ? tr(g, 'keys_press') : G.KEYLABEL(keys[a]);
    T(ctx, label, 350, y, 7, c.waiting && sel ? MAG : CREAM, 'right');
  });
  T(ctx, 'UP/DOWN  SELECT    ENTER  REBIND    LEFT/RIGHT  PLAYER', LW / 2, 222, 7, DIM, 'center');
  T(ctx, tr(g, 'keys_reset') + ': ' + (c.resetHint ? 'OK' : 'HOLD BACKSPACE'), LW / 2, 234, 7, DIM, 'center');
};
var ACT_ROWS = ['left', 'right', 'up', 'down', 'attack', 'jump', 'special', 'grab', 'start', 'pause'];
R.howto = function (g, ctx) {
  R.backdrop(g, ctx, 0, .8);
  panel(ctx, 24, 16, 432, 238, GOLD, 'rgba(20,11,30,.95)');
  T(ctx, tr(g, 'howto_title'), LW / 2, 34, 14, GOLD, 'center');
  const rows = [['howto_move', 'howto_move_d'], ['howto_atk', 'howto_atk_d'], ['howto_spec', 'howto_spec_d'], ['howto_jump', 'howto_jump_d'], ['howto_grab', 'howto_grab_d'], ['howto_food', 'howto_food_d'], ['howto_coop', 'howto_coop_d']];
  rows.forEach((r, i) => {
    const y = 52 + i * 24;
    T(ctx, tr(g, r[0]), 36, y, 7, MAG);
    wrap(ctx, tr(g, r[1]), 36, y + 9, 400, 7, CREAM);
  });
  T(ctx, 'ESC  ' + tr(g, 'set_back'), LW / 2, 242, 7, DIM, 'center');
};
function wrap(ctx, str, x, y, w, size, col, align) {
  const words = String(str).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (tw(test, size) > w && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => T(ctx, l, x, y + i * (size + 3), size, col, align));
  return lines.length;
}
R.credits = function (g, ctx) {
  R.backdrop(g, ctx, 3, .82);
  panel(ctx, 60, 20, 360, 230, GOLD, 'rgba(20,11,30,.95)');
  T(ctx, tr(g, 'credits_title'), LW / 2, 38, 14, GOLD, 'center');
  const lines = g.tr('credits_text');
  lines.forEach((l, i) => { if (i > 13) return; T(ctx, l, LW / 2, 54 + i * 11, 7, i === 0 ? GOLD2 : i < 3 ? CREAM : DIM, 'center'); });
  T(ctx, 'ESC  ' + tr(g, 'set_back'), LW / 2, 240, 7, DIM, 'center');
};
R.pause = function (g, ctx) {
  ctx.fillStyle = 'rgba(12,6,20,.8)'; ctx.fillRect(0, 0, LW, LH);
  panel(ctx, 132, 54, 216, 158, GOLD, 'rgba(24,14,36,.97)');
  T(ctx, tr(g, 'pause_title'), LW / 2, 74, 14, GOLD, 'center', INK);
  const rows = ['pause_resume', 'pause_restart', 'pause_settings', 'pause_howto', 'pause_quit'];
  const isHost = g.isHost();
  rows.forEach((k, i) => {
    const y = 96 + i * 18, sel = g.menu === i;
    if (sel) { ctx.fillStyle = GOLD; ctx.fillRect(144, y - 5, 192, 16); }
    T(ctx, tr(g, k), 152, y, 7, sel ? INK : isHost ? CREAM : DIM);
    g.hot.push({ x: 144, y: y - 5, w: 192, h: 16, act: 'row', i: i });
  });
  if (!isHost) T(ctx, tr(g, 'pause_waiting'), LW / 2, 200, 7, DIM, 'center');
  else T(ctx, 'ENTER  SELECT       ESC  RESUME', LW / 2, 200, 7, DIM, 'center');
};
R.clear = function (g, ctx) {
  NINE(g, ctx, tr(g, 'clear_title'), [g.stage.name.toUpperCase(), tr(g, 'hud_score') + ' ' + String(g.score).padStart(7, '0'), tr(g, 'hud_lives') + ' ' + g.lives], tr(g, 'clear_next') + ': ENTER', GOLD);
};
R.over = function (g, ctx) {
  R.backdrop(g, ctx, g.stageIdx, .7);
  panel(ctx, 120, 60, 240, 150, RED, 'rgba(24,8,16,.96)');
  T(ctx, tr(g, 'over_title'), LW / 2, 88, 21, RED, 'center', INK);
  T(ctx, tr(g, 'over_score') + ' ' + String(g.score).padStart(7, '0'), LW / 2, 112, 7, CREAM, 'center');
  T(ctx, 'BEST ' + String(g.best || 0).padStart(7, '0'), LW / 2, 124, 7, DIM, 'center');
  ['over_continue', 'over_title_btn'].forEach((k, i) => {
    const y = 148 + i * 20, sel = g.menu === i;
    if (sel) { ctx.fillStyle = GOLD; ctx.fillRect(150, y - 5, 180, 17); }
    T(ctx, tr(g, k), 162, y, 7, sel ? INK : CREAM);
    g.hot.push({ x: 150, y: y - 5, w: 180, h: 17, act: 'row', i: i });
  });
  T(ctx, 'ENTER  SELECT', LW / 2, 198, 7, DIM, 'center');
};
R.victory = function (g, ctx) {
  R.backdrop(g, ctx, 3, .55);
  R.heroLine(g, ctx, 216);
  T(ctx, tr(g, 'victory_title'), LW / 2, 78, 21, GOLD, 'center', INK);
  T(ctx, tr(g, 'victory_sub'), LW / 2, 98, 7, CREAM, 'center');
  T(ctx, tr(g, 'over_score') + ' ' + String(g.score).padStart(7, '0'), LW / 2, 118, 7, GOLD2, 'center');
  if ((g.t >> 5) & 1) T(ctx, 'ENTER  TITLE', LW / 2, 140, 7, CREAM, 'center');
};
function NINE(g, ctx, title, lines, hint, col) {
  ctx.fillStyle = 'rgba(12,6,20,.84)'; ctx.fillRect(0, 0, LW, LH);
  T(ctx, title, LW / 2 + 2, 80 + 2, 21, MAG, 'center');
  T(ctx, title, LW / 2, 80, 21, col, 'center');
  lines.forEach((l, i) => T(ctx, l, LW / 2, 116 + i * 14, 7, CREAM, 'center'));
  if ((g.t >> 5) & 1) T(ctx, hint, LW / 2, 200, 7, GOLD2, 'center');
}
R.loading = function (ctx, pct, label) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, LW, LH);
  R.bigTitle(ctx, LW / 2, 108, 14);
  ctx.fillStyle = '#3a2a4a'; ctx.fillRect(120, 140, 240, 8);
  ctx.fillStyle = GOLD; ctx.fillRect(120, 140, Math.round(240 * pct), 8);
  T(ctx, label || 'LOADING', LW / 2, 160, 7, CREAM, 'center');
};
R.scanlines = function (ctx) {
  ctx.fillStyle = 'rgba(0,0,0,.16)';
  for (let y = 0; y < LH; y += 2) ctx.fillRect(0, y, LW, 1);
};
})(globalThis.GG = globalThis.GG || {});
