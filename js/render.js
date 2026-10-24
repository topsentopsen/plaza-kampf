/* Pixel-Canvas: Arena, Figuren, HUD. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};
  var W = 320, H = 180;
  var SCHRIFT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';

  function erstelle(canvas) {
    var ctx = canvas.getContext('2d');
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = false;
    canvas.width = W; canvas.height = H;
    return { canvas: canvas, ctx: ctx, w: W, h: H };
  }

  function fig(ctx, p, blink) {
    var c = Plaza.Chars.finde(p.charId);
    var x = Math.round(p.x), y = Math.round(p.y);
    var f = p.facing || 1;
    var h = c.h, w = c.w;
    if (blink && p.invuln > 0 && (p.invuln % 2 === 0)) return;

    // Schatten
    ctx.fillStyle = 'rgba(74,52,120,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, Plaza.Kampf.BODEN + 2, w * 0.55, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Körper
    var bx = x - w / 2, by = y - h;
    ctx.fillStyle = c.farbe;
    ctx.fillRect(bx, by + 6, w, h - 10);
    // Kopf
    ctx.fillStyle = '#ffd7b8';
    ctx.fillRect(bx + 3, by, w - 6, 10);
    // Haare / Helm
    ctx.fillStyle = c.farbe2;
    ctx.fillRect(bx + 2, by - 2, w - 4, 5);
    // Augen
    ctx.fillStyle = '#4a3560';
    if (f > 0) {
      ctx.fillRect(bx + w - 8, by + 3, 2, 2);
      ctx.fillRect(bx + w - 12, by + 3, 2, 2);
    } else {
      ctx.fillRect(bx + 6, by + 3, 2, 2);
      ctx.fillRect(bx + 10, by + 3, 2, 2);
    }
    // Beine
    ctx.fillStyle = c.farbe2;
    ctx.fillRect(bx + 2, y - 8, 5, 8);
    ctx.fillRect(bx + w - 7, y - 8, 5, 8);
    // Arm / Angriff
    if (p.atk) {
      var reach = Math.min(c.moves[p.atk.art].reach, 36);
      ctx.fillStyle = c.accent;
      if (f > 0) ctx.fillRect(x + 4, y - 20, Math.max(8, reach * 0.45), 5);
      else ctx.fillRect(x - 4 - Math.max(8, reach * 0.45), y - 20, Math.max(8, reach * 0.45), 5);
    } else {
      ctx.fillStyle = c.farbe;
      if (f > 0) ctx.fillRect(x + w / 2 - 2, y - 18, 6, 4);
      else ctx.fillRect(x - w / 2 - 4, y - 18, 6, 4);
    }
    // Kontur-Punkte
    ctx.fillStyle = '#4a3560';
    ctx.fillRect(bx, by + 6, 1, h - 10);
    ctx.fillRect(bx + w - 1, by + 6, 1, h - 10);
  }

  function arena(ctx, t) {
    // Himmel
    var g1 = ctx.createLinearGradient(0, 0, 0, H);
    g1.addColorStop(0, '#7ec8e3');
    g1.addColorStop(0.55, '#c8e9f5');
    g1.addColorStop(1, '#f3e2b8');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    // Sonne
    ctx.fillStyle = '#ffd36e';
    ctx.beginPath(); ctx.arc(270, 36, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,211,110,0.35)';
    ctx.beginPath(); ctx.arc(270, 36, 26, 0, Math.PI * 2); ctx.fill();
    // Häuser Silhouette
    ctx.fillStyle = '#e0785a';
    ctx.fillRect(20, 90, 50, 40);
    ctx.fillStyle = '#c45a40';
    ctx.beginPath(); ctx.moveTo(18, 90); ctx.lineTo(45, 70); ctx.lineTo(72, 90); ctx.fill();
    ctx.fillStyle = '#b9a3f5';
    ctx.fillRect(230, 95, 60, 35);
    ctx.fillStyle = '#9580dc';
    ctx.beginPath(); ctx.moveTo(228, 95); ctx.lineTo(260, 74); ctx.lineTo(292, 95); ctx.fill();
    // Palme
    ctx.fillStyle = '#9a6a4a';
    ctx.fillRect(150, 88, 6, 42);
    ctx.fillStyle = '#7ed492';
    for (var i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(153 + Math.cos(i + t * 0.02) * 2, 88, 14, 5, i * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    // Boden
    ctx.fillStyle = '#dcb98e';
    ctx.fillRect(0, Plaza.Kampf.BODEN + 2, W, H - Plaza.Kampf.BODEN);
    ctx.fillStyle = '#c79f74';
    for (var x = 0; x < W; x += 16) ctx.fillRect(x, Plaza.Kampf.BODEN + 2, 8, 3);
    // Plaza-Linie
    ctx.fillStyle = '#fff8ee';
    ctx.fillRect(0, Plaza.Kampf.BODEN + 1, W, 2);
  }

  function hud(ctx, snap, ich) {
    // HP Balken
    function balken(x, p, mirror) {
      var c = Plaza.Chars.finde(p.charId);
      var bw = 120, bh = 10;
      ctx.fillStyle = '#4a3560';
      ctx.fillRect(x - 2, 10, bw + 4, bh + 4);
      ctx.fillStyle = '#3a2a4e';
      ctx.fillRect(x, 12, bw, bh);
      var pct = Math.max(0, p.hp / p.maxHp);
      ctx.fillStyle = pct > 0.3 ? c.farbe : '#ff5f8a';
      if (mirror) ctx.fillRect(x + bw * (1 - pct), 12, bw * pct, bh);
      else ctx.fillRect(x, 12, bw * pct, bh);
      ctx.fillStyle = '#fff8ee';
      ctx.font = 'bold 9px ' + SCHRIFT;
      ctx.textAlign = mirror ? 'right' : 'left';
      ctx.fillText(p.name, mirror ? x + bw : x, 9);
    }
    balken(12, snap.p[0], false);
    balken(W - 132, snap.p[1], true);

    // Zeit
    ctx.fillStyle = '#4a3560';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(W / 2 - 18, 6, 36, 18, 4) : ctx.fillRect(W / 2 - 18, 6, 36, 18);
    ctx.fill();
    ctx.fillStyle = '#ffd36e';
    ctx.font = 'bold 12px ' + SCHRIFT;
    ctx.textAlign = 'center';
    ctx.fillText(String(snap.zeit), W / 2, 19);

    if (snap.phase === 'countdown') {
      ctx.fillStyle = 'rgba(58,46,72,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff8ee';
      ctx.font = 'bold 48px ' + SCHRIFT;
      ctx.fillText(snap.countdown > 0 ? String(snap.countdown) : 'LOS', W / 2, H / 2);
    }
    if (snap.phase === 'ende') {
      ctx.fillStyle = 'rgba(58,46,72,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffd36e';
      ctx.font = 'bold 22px ' + SCHRIFT;
      ctx.fillText(snap.nachricht || 'Ende', W / 2, H / 2 - 8);
      ctx.fillStyle = '#fff8ee';
      ctx.font = '12px ' + SCHRIFT;
      ctx.fillText('Rematch tippen', W / 2, H / 2 + 16);
    }
    if (ich === 0 || ich === 1) {
      ctx.fillStyle = 'rgba(255,248,238,0.85)';
      ctx.font = '9px ' + SCHRIFT;
      ctx.textAlign = 'left';
      ctx.fillText('Du: P' + (ich + 1), 8, H - 6);
    }
  }

  function zeichne(r, snap, ich) {
    var ctx = r.ctx;
    ctx.save();
    arena(ctx, snap.tick || 0);
    var i;
    for (i = 0; i < (snap.projektil || []).length; i++) {
      var pr = snap.projektil[i];
      ctx.fillStyle = pr.farbe || '#ffd36e';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8ee';
      ctx.fillRect(pr.x - 2, pr.y - 2, 4, 4);
    }
    for (i = 0; i < snap.p.length; i++) fig(ctx, snap.p[i], true);
    hud(ctx, snap, ich);
    ctx.restore();
  }

  function menueHint(r, text) {
    var ctx = r.ctx;
    ctx.fillStyle = '#3a2e48';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#b9a3f5';
    ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = '#fff8ee';
    ctx.font = 'bold 16px ' + SCHRIFT;
    ctx.textAlign = 'center';
    ctx.fillText('Plaza-Kampf', W / 2, 24);
    ctx.font = '12px ' + SCHRIFT;
    ctx.fillStyle = '#ffd36e';
    ctx.fillText(text || '', W / 2, H / 2);
  }

  Plaza.Render = { W: W, H: H, erstelle: erstelle, zeichne: zeichne, menueHint: menueHint };
})(typeof window !== 'undefined' ? window : globalThis);
