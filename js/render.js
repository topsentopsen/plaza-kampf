/* Pixel-Canvas v0.9: detaillierte Sprites, Walk/Atk/Hurt, Hölle. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};
  var W = 320, H = 180;
  var BUF = 2; // interne Puffer-Skala (2×/3× → schärfer auf Retina)
  var bufCanvas = null;
  var SCHRIFT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
  var layers = null;
  var fx = [];
  var delayHp = [1, 1];
  var flash = [0, 0];
  var prevSnap = null;
  var camX = 0;
  var shake = 0;

  function P() { return Plaza.Palette || {}; }

  function backe(w, h, fn) {
    var c = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
    if (!c) return null;
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    if ('imageSmoothingEnabled' in x) x.imageSmoothingEnabled = false;
    fn(x, w, h);
    return c;
  }

  function applyBuf(ctx) {
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = false;
    ctx.setTransform(BUF, 0, 0, BUF, 0, 0);
  }

  function setzePuffer(r, buf) {
    buf = Math.max(1, Math.min(3, buf | 0));
    if (!r || !r.canvas) return BUF;
    if (buf === BUF && r.canvas.width === W * BUF) {
      applyBuf(r.ctx);
      return BUF;
    }
    BUF = buf;
    r.canvas.width = W * BUF;
    r.canvas.height = H * BUF;
    r.ctx = r.canvas.getContext('2d');
    applyBuf(r.ctx);
    layers = backeLayers(); // neu backen (logische Koords, Transform skaliert)
    r.w = W; r.h = H; r.buf = BUF;
    return BUF;
  }

  function erstelle(canvas) {
    bufCanvas = canvas;
    var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    BUF = dpr >= 2.5 ? 3 : 2;
    var ctx = canvas.getContext('2d');
    canvas.width = W * BUF;
    canvas.height = H * BUF;
    applyBuf(ctx);
    layers = backeLayers();
    return { canvas: canvas, ctx: ctx, w: W, h: H, buf: BUF };
  }

  function backeLayers() {
    var LW = 360;
    var pal = P();
    var L0 = backe(LW, H, function (x, w, h) {
      var BAND = pal.himmel || ['#050208', '#0a0612', '#120810', '#1a0a0c', '#220c0a', '#2a1008', '#3a1408', '#4a1808'];
      var bh = Math.ceil(h / BAND.length);
      for (var i = 0; i < BAND.length; i++) {
        x.fillStyle = BAND[i];
        x.fillRect(0, i * bh, w, bh + 1);
        if (i) {
          x.fillStyle = BAND[i - 1];
          for (var px = 0; px < w; px += 2) x.fillRect(px + (i % 2), i * bh + ((px / 2) % 2), 1, 1);
        }
      }
      // Blutmond
      x.fillStyle = pal.sonneGlow || '#5a1808';
      x.beginPath(); x.arc(290, 36, 26, 0, Math.PI * 2); x.fill();
      x.fillStyle = pal.sonne || '#ff4a18';
      x.beginPath(); x.arc(290, 36, 16, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#2a0808';
      x.beginPath(); x.arc(296, 32, 10, 0, Math.PI * 2); x.fill(); // Mondschatten
      // Sterne / Funken
      x.fillStyle = '#ff6020';
      for (var s = 0; s < 18; s++) x.fillRect((s * 37 + 11) % w, 8 + (s * 13) % 50, 1, 1);
      // Rauchfahnen
      x.fillStyle = 'rgba(20,10,18,0.55)';
      x.beginPath(); x.ellipse(80, 40, 40, 12, -0.2, 0, Math.PI * 2); x.fill();
      x.beginPath(); x.ellipse(200, 28, 50, 14, 0.1, 0, Math.PI * 2); x.fill();
    });

    var L1 = backe(LW, H, function (x, w, h) {
      // Lava-Meer
      x.fillStyle = pal.meer || '#1a0808';
      x.fillRect(0, 78, w, 22);
      x.fillStyle = pal.lavaDunkel || '#8a1800';
      for (var sx = 0; sx < w; sx += 8) x.fillRect(sx, 82 + (sx % 5), 5, 2);
      x.fillStyle = pal.lava || '#ff3a08';
      for (var sx2 = 0; sx2 < w; sx2 += 14) x.fillRect(sx2 + 2, 84 + (sx2 % 7), 3, 1);
      // Vulkan-Silhouetten
      function vulkan(vx, baseY, bw, peakH, glow) {
        x.fillStyle = '#0c0608';
        x.beginPath();
        x.moveTo(vx - bw, baseY);
        x.lineTo(vx - 8, baseY - peakH);
        x.lineTo(vx + 8, baseY - peakH);
        x.lineTo(vx + bw, baseY);
        x.fill();
        // Krater-Glow
        x.fillStyle = glow || '#ff3a08';
        x.fillRect(vx - 6, baseY - peakH - 2, 12, 4);
        x.fillStyle = '#ffb040';
        x.fillRect(vx - 3, baseY - peakH - 4, 6, 3);
        // Lava-Rinnsal
        x.fillStyle = '#ff3a08';
        x.fillRect(vx - 2, baseY - peakH + 2, 2, peakH - 8);
        x.fillRect(vx + 3, baseY - peakH + 10, 2, peakH - 18);
      }
      vulkan(60, 100, 55, 42, '#ff2a08');
      vulkan(160, 102, 70, 55, '#ff4a18');
      vulkan(280, 100, 48, 38, '#ff3a08');
      // Aschehügel
      x.fillStyle = pal.huegel2 || '#140808';
      x.beginPath(); x.moveTo(0, 100); x.quadraticCurveTo(90, 78, 180, 98); x.quadraticCurveTo(260, 80, 360, 100); x.lineTo(360, 112); x.lineTo(0, 112); x.fill();
      x.fillStyle = pal.huegel || '#1e0c0a';
      x.beginPath(); x.moveTo(0, 104); x.quadraticCurveTo(120, 90, 220, 104); x.quadraticCurveTo(300, 88, 360, 104); x.lineTo(360, 114); x.lineTo(0, 114); x.fill();
    });

    var L2 = backe(LW, H, function (x, w, h) {
      function ruins(hx, hy, hw, hh) {
        x.fillStyle = '#141018';
        x.fillRect(hx, hy, hw, hh);
        x.fillStyle = '#0a080c';
        x.fillRect(hx + 2, hy + 4, hw - 4, 3);
        // gebrochene Zinne
        x.fillStyle = '#1a1018';
        for (var z = 0; z < hw; z += 8) {
          if ((z / 8) % 2 === 0) x.fillRect(hx + z, hy - 5, 5, 5);
        }
        // Glutfenster
        x.fillStyle = '#ff4a18';
        x.fillRect(hx + 5, hy + 12, 5, 7);
        x.fillRect(hx + hw - 10, hy + 14, 5, 6);
        x.fillStyle = '#ffb040';
        x.fillRect(hx + 6, hy + 13, 2, 3);
        // Risse
        x.fillStyle = '#000';
        x.fillRect(hx + hw / 2, hy + 6, 1, hh - 8);
        x.fillRect(hx + 8, hy + hh - 16, 10, 1);
      }
      ruins(6, 82, 34, 40);
      ruins(46, 88, 28, 34);
      ruins(80, 78, 38, 44);
      // dunkler Turm / Obelisk
      x.fillStyle = '#0e0a10';
      x.fillRect(128, 48, 20, 72);
      x.fillStyle = '#1a0c10';
      x.beginPath(); x.moveTo(125, 48); x.lineTo(138, 28); x.lineTo(151, 48); x.fill();
      x.fillStyle = '#ff3a08';
      x.fillRect(134, 58, 8, 14);
      x.fillStyle = '#ffb040';
      x.fillRect(136, 62, 4, 6);
      // Arkade in Schatten
      x.fillStyle = '#120c14';
      x.fillRect(156, 90, 72, 30);
      x.fillStyle = '#08060a';
      for (var a = 0; a < 4; a++) {
        x.fillRect(162 + a * 16, 100, 12, 20);
        x.beginPath(); x.arc(168 + a * 16, 100, 6, Math.PI, 0); x.fill();
      }
      ruins(238, 84, 32, 38);
      ruins(278, 78, 36, 44);
      ruins(320, 90, 26, 32);
      // Ketten / Knochen-Leine
      x.fillStyle = '#3a2a20';
      x.fillRect(52, 90, 50, 1);
      x.fillStyle = '#4a3a30';
      x.fillRect(60, 91, 4, 8);
      x.fillRect(78, 90, 5, 9);
      x.fillRect(94, 91, 3, 7);
    });

    var L3 = backe(LW, H, function (x, w, h) {
      // Lava-Brunnen / Opferaltar
      var bx = 170;
      x.fillStyle = '#1a1010';
      x.fillRect(bx - 20, 128, 40, 10);
      x.fillStyle = '#2a1818';
      x.fillRect(bx - 14, 118, 28, 10);
      x.fillStyle = '#3a2020';
      x.fillRect(bx - 8, 108, 16, 10);
      // Lava oben
      x.fillStyle = '#ff3a08';
      x.fillRect(bx - 12, 124, 24, 4);
      x.fillRect(bx - 6, 116, 12, 3);
      x.fillStyle = '#ffb040';
      x.fillRect(bx - 1, 102, 2, 10);
      x.fillRect(bx - 3, 106, 1, 4);
      x.fillRect(bx + 2, 108, 1, 3);
      x.fillStyle = '#000';
      x.fillRect(bx - 20, 137, 40, 2);

      // Tote Palme / verkohlter Baum
      function toterBaum(px, py) {
        x.fillStyle = '#1a1008';
        x.fillRect(px, py, 4, 38);
        x.fillStyle = '#2a1810';
        x.fillRect(px - 8, py + 4, 10, 2);
        x.fillRect(px + 2, py + 10, 12, 2);
        x.fillRect(px - 6, py + 18, 8, 2);
      }
      toterBaum(300, 100);
      toterBaum(332, 108);

      // Feuer-Kiosk / Schrein
      x.fillStyle = '#2a1008';
      x.fillRect(248, 118, 28, 20);
      x.fillStyle = '#ff3a08';
      x.fillRect(250, 114, 24, 5);
      x.fillStyle = '#ffb040';
      x.fillRect(256, 122, 12, 10);
      x.fillStyle = '#000';
      x.fillRect(258, 124, 8, 6);

      // Café-Ruine links mit Glut
      x.fillStyle = '#1a0c08';
      x.fillRect(8, 120, 36, 18);
      x.fillStyle = '#ff4a18';
      for (var f = 0; f < 5; f++) {
        x.fillRect(12 + f * 6, 112 - (f % 3), 4, 8 + (f % 2));
      }
      x.fillStyle = '#ffb040';
      x.fillRect(18, 110, 3, 6);
      x.fillRect(30, 108, 2, 5);

      // Dämonen-Silhouetten am Rand
      x.fillStyle = 'rgba(0,0,0,0.65)';
      x.fillRect(96, 118, 5, 14); x.fillRect(95, 114, 7, 5); // Hörner
      x.fillRect(96, 112, 2, 3); x.fillRect(100, 112, 2, 3);
      x.fillRect(214, 120, 5, 12); x.fillRect(213, 116, 7, 5);
      x.fillRect(214, 114, 2, 3); x.fillRect(218, 114, 2, 3);
    });

    var L4 = backe(LW, H, function (x, w, h) {
      var BODEN = 148;
      var y = BODEN - 4;
      for (var r = 0; y < h; r++) {
        var th = 2 + Math.min(r, 6);
        var tw = 12 + r * 3;
        for (var tx = -((r * 5) % tw); tx < w; tx += tw) {
          x.fillStyle = ((Math.floor(tx / tw) + r) & 1) ? '#1c1210' : '#120c0a';
          x.fillRect(tx, y, tw - 1, th - 1);
          x.fillStyle = '#0a0606';
          x.fillRect(tx + tw - 1, y, 1, th);
        }
        y += th;
      }
      // Lava-Risse im Pflaster
      x.fillStyle = '#ff3a08';
      x.fillRect(40, BODEN + 6, 2, 18);
      x.fillRect(42, BODEN + 10, 8, 1);
      x.fillRect(250, BODEN + 8, 2, 16);
      x.fillRect(240, BODEN + 14, 12, 1);
      x.fillRect(100, BODEN + 20, 18, 1);
      x.fillStyle = '#ffb040';
      x.fillRect(40, BODEN + 8, 1, 10);
      x.fillRect(251, BODEN + 10, 1, 8);
      // dunkles Medaillon mit Glutring
      var mx = 180, my = BODEN + 12;
      x.fillStyle = '#8a2808';
      x.beginPath(); x.ellipse(mx, my, 28, 8, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#2a0c08';
      x.beginPath(); x.ellipse(mx, my, 22, 6, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ff4a18';
      x.beginPath(); x.ellipse(mx, my, 8, 2, 0, 0, Math.PI * 2); x.fill();
      // Ascheflecken
      x.fillStyle = 'rgba(0,0,0,0.45)';
      x.fillRect(60, BODEN + 8, 10, 3);
      x.fillRect(280, BODEN + 16, 14, 2);
    });

    var L5 = backe(LW, H, function (x, w, h) {
      // Schädel / Knochen links
      x.fillStyle = '#3a2a20';
      x.fillRect(4, 160, 10, 8);
      x.fillStyle = '#1a1010';
      x.fillRect(6, 162, 2, 2); x.fillRect(10, 162, 2, 2);
      x.fillRect(8, 165, 3, 2);
      // verkohlte Bank
      x.fillStyle = '#1a1008';
      x.fillRect(330, 150, 28, 4);
      x.fillRect(332, 154, 3, 8);
      x.fillRect(354, 154, 3, 8);
      // Fackel-Laterne mit Flamme
      x.fillStyle = '#1a1018';
      x.fillRect(18, 128, 3, 42);
      x.fillStyle = '#ff3a08';
      x.fillRect(14, 118, 11, 12);
      x.fillStyle = '#ffb040';
      x.fillRect(17, 114, 5, 8);
      x.fillStyle = '#ffe080';
      x.fillRect(18, 112, 3, 4);
      // rechte Fackel
      x.fillStyle = '#1a1018';
      x.fillRect(340, 132, 3, 38);
      x.fillStyle = '#ff3a08';
      x.fillRect(336, 122, 11, 12);
      x.fillStyle = '#ffb040';
      x.fillRect(339, 118, 5, 8);
    });

    return { L0: L0, L1: L1, L2: L2, L3: L3, L4: L4, L5: L5, lw: LW };
  }

  function drawLayer(ctx, layer, par, tick) {
    if (!layer) return;
    var ox = Math.round(-camX * par) - 20;
    // leichte Ambient-Animation: Brunnen-Glitzer auf L3 per Overlay
    ctx.drawImage(layer, ox, 0);
  }

  function arena(ctx, tick, snap) {
    if (!layers) layers = backeLayers();
    // Kamera aus Spielermitte
    if (snap && snap.p && snap.p.length === 2) {
      var mid = (snap.p[0].x + snap.p[1].x) / 2;
      var target = mid - W / 2;
      camX = Math.max(-12, Math.min(12, target * 0.15));
    } else camX = 0;

    drawLayer(ctx, layers.L0, 0, tick);
    // Blutmond-Puls + Asche
    if ((tick % 90) < 10) {
      ctx.fillStyle = 'rgba(255,60,20,0.18)';
      ctx.beginPath(); ctx.arc(270, 36, 30, 0, Math.PI * 2); ctx.fill();
    }
    drawLayer(ctx, layers.L1, 0.1, tick);
    // Vulkan-Glut-Flicker auf Bergspitzen
    var vf = ((tick / 6) | 0) % 4;
    ctx.fillStyle = vf < 2 ? '#ff3a08' : '#ffb040';
    var ox1 = Math.round(-camX * 0.1) - 20;
    ctx.fillRect(ox1 + 54, 54 - vf, 8, 3 + vf);
    ctx.fillRect(ox1 + 154, 42 - vf, 10, 4 + vf);
    ctx.fillRect(ox1 + 274, 58 - (vf % 2), 7, 3);
    // Funken aus Kratern
    ctx.fillStyle = '#ffb040';
    ctx.fillRect(ox1 + 158 + (vf % 3), 38 - vf * 2, 1, 2);
    ctx.fillRect(ox1 + 60 + vf, 50 - vf, 1, 2);
    drawLayer(ctx, layers.L2, 0.25, tick);
    drawLayer(ctx, layers.L3, 0.5, tick);
    // Lava-Brunnen + Fackel-Flammen (animiert)
    var f = ((tick / 5) | 0) % 4;
    var bx = 150 - Math.round(camX * 0.5);
    ctx.fillStyle = f % 2 ? '#ff3a08' : '#ff6020';
    ctx.fillRect(bx, 104 - f, 2, 6 + f);
    ctx.fillRect(bx + 4, 108 - (f % 3), 1, 4);
    ctx.fillStyle = '#ffb040';
    ctx.fillRect(bx + 1, 102 - f, 1, 3);
    // Fackeln vorne (L5-Nähe, vor Pflaster noch als Ambient)
    var fox = Math.round(-camX * 0.5) - 20;
    ctx.fillStyle = f < 2 ? '#ffb040' : '#ffe080';
    ctx.fillRect(fox + 17, 112 - f, 3, 4 + f);
    ctx.fillRect(fox + 339, 116 - (f % 3), 3, 4);
    // Embers steigen
    ctx.fillStyle = '#ff6020';
    for (var ei = 0; ei < 5; ei++) {
      var ey = 140 - ((tick + ei * 17) % 60);
      var ex = 40 + ei * 55 + ((tick / 3 + ei * 9) % 7) - Math.round(camX);
      if (ey > 70) ctx.fillRect(ex, ey, 1, 1);
    }
    // Asche-Partikel (fallen langsam, horizontal drift)
    ctx.fillStyle = '#5a4038';
    for (var ai = 0; ai < 12; ai++) {
      var ay = ((tick * 0.4 + ai * 23) % 160);
      var ax = (ai * 29 + ((tick / 8) | 0) * ((ai % 3) - 1) - Math.round(camX) + 400) % 360 - 20;
      if ((ai + tick) % 3 === 0) ctx.fillStyle = '#3a2820';
      else ctx.fillStyle = '#6a4840';
      ctx.fillRect(ax, ay, 1, 1);
    }
    // Lava-Glow auf Boden-Medaillon (vor L4 als Overlay nach L4)
    drawLayer(ctx, layers.L4, 1.0, tick);
    var pulse = 0.12 + 0.1 * Math.sin(tick / 14);
    ctx.fillStyle = 'rgba(255,58,8,' + pulse.toFixed(3) + ')';
    var mx = 160 - Math.round(camX);
    ctx.beginPath();
    ctx.arc(mx, 148, 18 + ((tick / 20) | 0) % 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,176,64,' + (pulse * 0.6).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(mx, 148, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  function fg(ctx, tick) {
    if (!layers) return;
    drawLayer(ctx, layers.L5, 1.15, tick);
  }

  /* ---- Figuren (v0.9 detailliert) ---- */
  function schatten(ctx, x, yBoden, w, hoch) {
    var sc = Math.max(0.35, 1 - hoch / 60);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    var rw = Math.max(5, w * 0.58 * sc);
    ctx.fillRect(Math.round(x - rw), yBoden + 1, Math.round(rw * 2), 3);
    ctx.fillStyle = 'rgba(40,10,8,0.35)';
    ctx.fillRect(Math.round(x - rw * 0.75), yBoden + 2, Math.round(rw * 1.5), 2);
  }

  function hexShade(hex, amt) {
    if (!hex || hex[0] !== '#' || hex.length < 7) return hex || '#888';
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function rct(ctx, x, y, w, h, fill) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = fill;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  function konturRect(ctx, x, y, w, h, fill, outline) {
    rct(ctx, x, y, w, h, fill);
    if (outline !== false) {
      rct(ctx, x, y, w, 1, '#000');
      rct(ctx, x, y + h - 1, w, 1, '#000');
      rct(ctx, x, y, 1, h, '#000');
      rct(ctx, x + w - 1, y, 1, h, '#000');
    }
  }

  function bodyBlock(ctx, x, y, w, h, col, ink) {
    var hi = hexShade(col, 28);
    var sh = hexShade(col, -32);
    rct(ctx, x, y, w, h, col);
    rct(ctx, x + 1, y + 1, Math.max(1, w - 2), 2, hi);
    rct(ctx, x + 1, y + h - 3, Math.max(1, w - 2), 2, sh);
    rct(ctx, x, y, 1, h, ink || '#000');
    rct(ctx, x + w - 1, y, 1, h, ink || '#000');
  }

  function fig(ctx, p, blink, invert) {
    var c = Plaza.Chars.finde(p.charId);
    var x = Math.round(p.x), y = Math.round(p.y);
    var f = p.facing || 1;
    var h = c.h, w = c.w;
    if (p.crouch) h = Math.floor(c.h * 0.62);
    var tick = (p._tick | 0);
    var idle = 0, idleX = 0;
    var moving = Math.abs(p.vx || 0) > 0.15 && p.grounded && !p.crouch && !p.atk && p.stun <= 0;
    var walk = moving ? (Math.floor(Math.abs(p.x) / 3) + tick) % 4 : 0;
    var atkF = (p.atk && (p.atk.frame != null)) ? (p.atk.frame | 0) : (p.af | 0);

    if (!p.atk && p.stun <= 0 && p.grounded && !p.crouch && !p.blk) {
      var it = (tick / 8) | 0;
      idle = (it + p.id * 3) % 2;
      y -= idle;
      if (c.id === 'toni' && (it % 28) < 2) idleX = f;
      if (c.id === 'nina' && (it % 4) < 2) y -= 1;
      if (c.id === 'lola') idleX = ((it % 6) < 3) ? f : 0;
      if (c.id === 'rocco' && (it % 20) < 3) h = c.h - 1;
      if (c.id === 'biel' && (it % 22) < 2) idleX = -f;
      x += idleX;
    }
    if (p._winPose) { h = c.h; w = c.w + 2; }
    if (blink && p.invuln > 0 && (p.invuln % 2 === 0)) return;

    var farbe = invert ? c.farbe2 : c.farbe;
    var farbe2 = invert ? c.farbe : c.farbe2;
    var accent = c.accent || '#ff6020';
    var haut = c.haut || '#ffd7b8';
    var hautD = hexShade(haut, -28);
    var hautL = hexShade(haut, 22);
    var ink = '#000000';
    var id = c.id;

    var hoch = Math.max(0, Plaza.Kampf.BODEN - y);
    schatten(ctx, x, Plaza.Kampf.BODEN, w, hoch);

    var hurtLean = p.stun > 0 ? -f * 2 : 0;
    var atkLean = 0;
    if (p.atk) {
      if (atkF < 4) atkLean = -f; // windup back
      else atkLean = f * 2; // commit forward
    }
    var bx = x - w / 2 + hurtLean + atkLean;
    var by = y - h;
    if (p.stun > 0) by += 2;
    if (p.crouch) by += 1;

    // Block-Schild
    if (p.blk) {
      rct(ctx, f > 0 ? bx + w - 1 : bx - 5, by + 5, 8, 14, '#2a1810');
      rct(ctx, f > 0 ? bx + w + 2 : bx - 3, by + 7, 2, 10, accent);
      rct(ctx, f > 0 ? bx + w + 1 : bx - 4, by + 8, 1, 8, '#ffb040');
    }

    // ---- Beine / Walk ----
    var stance = p.atk ? 3 : (p.crouch ? 0 : 2);
    var legLift = 0, legShift = 0;
    if (moving) {
      if (walk === 0) { legLift = 3; legShift = f; }
      else if (walk === 1) { legLift = 0; legShift = f * 2; }
      else if (walk === 2) { legLift = 3; legShift = -f; }
      else { legLift = 0; legShift = -f * 2; }
    }
    if (p.crouch) {
      stance = 4;
      rct(ctx, bx + 1 - stance, y - 8, 7, 8, farbe2);
      rct(ctx, bx + w - 8 + stance, y - 8, 7, 8, farbe2);
      rct(ctx, bx - stance, y - 3, 9, 3, ink);
      rct(ctx, bx + w - 9 + stance, y - 3, 9, 3, ink);
    } else if (!p.grounded) {
      // Air: tucked legs
      rct(ctx, bx + 2, y - 12, 5, 8, farbe2);
      rct(ctx, bx + w - 7, y - 10, 5, 7, farbe2);
      rct(ctx, bx + 1, y - 5, 7, 3, ink);
      rct(ctx, bx + w - 8, y - 4, 7, 3, ink);
    } else {
      // Front / back leg
      rct(ctx, bx + 1 - stance + legShift, y - 11 - (walk === 0 || walk === 2 ? legLift : 0), 6, 11, farbe2);
      rct(ctx, bx + w - 7 + stance - legShift, y - 11 - (walk === 1 || walk === 3 ? 2 : 0), 6, 11, hexShade(farbe2, -18));
      // Knee highlight
      rct(ctx, bx + 2 - stance + legShift, y - 8, 3, 2, hexShade(farbe2, 20));
      // Boots
      rct(ctx, bx - stance + legShift, y - 3, 9, 3, ink);
      rct(ctx, bx + w - 9 + stance - legShift, y - 3, 9, 3, ink);
      rct(ctx, bx - stance + 1 + legShift, y - 2, 3, 1, hexShade(farbe, 10));
    }

    // ---- Torso / Kopf je Charakter ----
    var headY = by - 1;
    var torsoH = h - 14;

    if (id === 'toni') {
      // Schmied: breite Schultern, Lederschürze, Amboss-Armreifen, Narben
      bodyBlock(ctx, bx - 1, by + 8, w + 2, torsoH, farbe, ink);
      bodyBlock(ctx, bx - 4, by + 7, w + 8, 8, farbe2, ink); // Schulterpanzer
      rct(ctx, bx - 3, by + 8, w + 6, 2, hexShade(farbe2, 24));
      // Lederschürze + Nieten
      rct(ctx, bx + 2, by + 15, w - 4, 11, '#2a1810');
      rct(ctx, bx + 3, by + 16, w - 6, 1, '#4a3020');
      rct(ctx, bx + 4, by + 18, 2, 2, '#8a6840');
      rct(ctx, bx + w - 6, by + 18, 2, 2, '#8a6840');
      // Kopf
      bodyBlock(ctx, bx + 3, headY, w - 6, 12, haut, ink);
      rct(ctx, bx + 4, headY + 1, w - 8, 2, hautL);
      rct(ctx, bx + 4, headY + 8, w - 8, 3, hautD); // Kiefer
      // Schnurrbart + Brauen
      rct(ctx, bx + 5, headY + 7, w - 10, 3, '#1a1010');
      rct(ctx, bx + 4, headY + 6, 3, 2, '#1a1010');
      rct(ctx, bx + w - 7, headY + 6, 3, 2, '#1a1010');
      rct(ctx, bx + 5, headY + 2, 3, 1, '#1a1010');
      rct(ctx, bx + w - 8, headY + 2, 3, 1, '#1a1010');
      // Narbe
      rct(ctx, bx + w - 8, headY + 3, 4, 1, '#5a2010');
      // Armreifen
      rct(ctx, f > 0 ? bx + w + 1 : bx - 5, by + 14, 5, 6, '#3a3a3a');
      rct(ctx, f > 0 ? bx + w + 2 : bx - 4, by + 15, 3, 1, '#8a8a8a');
      // Hammer (Idle an Hüfte / Atk vorne)
      if (!p.atk) {
        rct(ctx, f > 0 ? bx + w : bx - 6, by + 12, 5, 12, '#3a3a3a');
        rct(ctx, f > 0 ? bx + w - 2 : bx - 8, by + 11, 9, 4, '#6a6a6a');
        rct(ctx, f > 0 ? bx + w : bx - 6, by + 12, 5, 1, '#9a9a9a');
      }
    } else if (id === 'lola') {
      // Flamenco-Kämpferin: Korsett, Rock-Lagen, Blutrose, Armreif
      bodyBlock(ctx, bx + 1, by + 8, w - 2, 10, farbe, ink);
      rct(ctx, bx + 2, by + 9, w - 4, 2, hexShade(farbe, 30));
      // Korsett-Schnürung
      rct(ctx, bx + w / 2 - 1, by + 10, 2, 7, accent);
      // Rock Lagen
      rct(ctx, bx - 2, by + 17, w + 4, 3, farbe2);
      rct(ctx, bx - 3, by + 20, 6, 7, farbe);
      rct(ctx, bx + w - 3, by + 20, 6, 7, farbe);
      rct(ctx, bx - 1, by + 22, w + 2, 2, hexShade(farbe2, -20));
      // Idle Rock-Swing
      if (idleX) rct(ctx, bx + (f > 0 ? w : -3), by + 19, 4, 5, farbe2);
      // Kopf
      bodyBlock(ctx, bx + 2, headY, w - 4, 11, haut, ink);
      rct(ctx, bx + 3, headY + 1, w - 6, 2, hautL);
      // Haar / Dutt + Stachel
      rct(ctx, bx + 2, headY - 5, w - 4, 6, '#1a0810');
      rct(ctx, bx + 3, headY - 6, w - 6, 2, '#2a1020');
      rct(ctx, f > 0 ? bx + w - 2 : bx - 3, headY - 2, 5, 10, '#1a0810');
      rct(ctx, f > 0 ? bx + w + 1 : bx - 4, headY + 2, 2, 6, '#0a0408');
      // Blutrose
      rct(ctx, bx + (f > 0 ? w - 5 : 2), headY - 4, 4, 4, '#ff2a4a');
      rct(ctx, bx + (f > 0 ? w - 4 : 3), headY - 3, 2, 2, '#ff8090');
      // Lippen
      rct(ctx, bx + w / 2 - 2, headY + 7, 4, 1, '#c02040');
      // Armreif
      rct(ctx, f > 0 ? bx + w - 1 : bx - 3, by + 12, 4, 2, '#ffb040');
      rct(ctx, f > 0 ? bx + w : bx - 2, by + 12, 2, 2, '#fff0c0');
    } else if (id === 'rocco') {
      // Türsteher: Bomberjacke, Pelzkragen, Brille, Bandagen
      bodyBlock(ctx, bx - 1, by + 7, w + 2, torsoH + 1, farbe, ink);
      bodyBlock(ctx, bx - 3, by + 6, w + 6, 9, farbe2, ink);
      rct(ctx, bx - 2, by + 7, w + 4, 2, hexShade(farbe2, 20));
      // Reißverschluss + Taschen
      rct(ctx, bx + w / 2 - 1, by + 12, 2, 12, ink);
      rct(ctx, bx + 3, by + 16, 4, 3, '#1a1018');
      rct(ctx, bx + w - 7, by + 16, 4, 3, '#1a1018');
      // Pelzkragen
      rct(ctx, bx, by + 6, w, 3, '#3a2a40');
      rct(ctx, bx + 1, by + 6, 2, 2, '#5a4a60');
      // Kopf + Stiernacken
      bodyBlock(ctx, bx + 2, headY, w - 4, 11, haut, ink);
      rct(ctx, bx + 4, headY + 9, w - 8, 4, hautD);
      rct(ctx, bx + 3, headY + 1, w - 6, 2, hautL);
      // Kurzhaar
      rct(ctx, bx + 2, headY - 2, w - 4, 3, '#0a0810');
      // Brille
      rct(ctx, bx + 3, headY + 2, w - 6, 4, ink);
      rct(ctx, bx + 4, headY + 3, 4, 2, '#5a5a6a');
      rct(ctx, bx + w - 8, headY + 3, 4, 2, '#5a5a6a');
      rct(ctx, bx + w / 2 - 1, headY + 3, 2, 1, '#8a8a9a');
      // Bandagen
      rct(ctx, f > 0 ? bx + w : bx - 4, by + 14, 5, 6, '#5a2010');
      rct(ctx, f > 0 ? bx + w + 1 : bx - 3, by + 15, 3, 1, '#8a4030');
    } else if (id === 'nina') {
      // Kurierin: Kapuze, Visier, Schal, Pads, scharfe Silhouette
      bodyBlock(ctx, bx, by + 7, w, torsoH, farbe, ink);
      bodyBlock(ctx, bx - 2, by + 6, w + 4, 6, farbe2, ink);
      rct(ctx, bx - 1, by + 7, w + 2, 2, hexShade(farbe2, 26));
      // Gürtel / Mag-Pouch
      rct(ctx, bx + 1, by + 16, w - 2, 3, '#1a1008');
      rct(ctx, bx + 3, by + 16, 3, 3, accent);
      // Kopf
      bodyBlock(ctx, bx + 2, headY + 1, w - 4, 10, haut, ink);
      // Kapuze
      rct(ctx, bx + 1, headY - 4, w - 2, 7, '#0a0810');
      rct(ctx, bx, headY, 3, 9, '#0a0810');
      rct(ctx, bx + w - 3, headY, 3, 9, '#0a0810');
      rct(ctx, bx + 2, headY - 3, w - 4, 2, '#1a1420');
      // Visier
      rct(ctx, bx + 4, headY + 3, w - 8, 3, '#ffb040');
      rct(ctx, bx + 5, headY + 4, w - 10, 1, '#fff0c0');
      // Schal / Kabel
      rct(ctx, bx + 2, by + 9, w - 4, 2, '#2a6058');
      rct(ctx, f > 0 ? bx + w - 1 : bx - 6, by + 10, 7, 8, '#2a6058');
      rct(ctx, f > 0 ? bx + w + 1 : bx - 4, by + 12, 2, 2, '#40a090');
      // Kniepads
      rct(ctx, bx + 2, y - 9, 5, 4, ink);
      rct(ctx, bx + w - 7, y - 9, 5, 4, ink);
      rct(ctx, bx + 3, y - 8, 3, 1, accent);
    } else {
      // Biel — Fischer: Kapuze, Seil, Netz, Bart, Narben
      bodyBlock(ctx, bx, by + 7, w, torsoH, farbe, ink);
      bodyBlock(ctx, bx - 2, by + 7, w + 4, 7, farbe2, ink);
      rct(ctx, bx - 1, by + 8, w + 2, 2, hexShade(farbe2, 22));
      // Seil über Brust
      rct(ctx, bx + 2, by + 12, w - 4, 2, '#5a3a20');
      rct(ctx, bx + 3, by + 13, w - 6, 1, '#8a6040');
      // Kopf
      bodyBlock(ctx, bx + 2, headY, w - 4, 11, haut, ink);
      rct(ctx, bx + 3, headY + 1, w - 6, 2, hautL);
      // Mütze / Kapuze tief
      rct(ctx, bx + 1, headY - 4, w - 2, 6, '#0a1818');
      rct(ctx, bx, headY + 1, w, 2, '#0a1818');
      rct(ctx, bx + 2, headY - 3, w - 4, 2, '#143028');
      // Bart
      rct(ctx, bx + 4, headY + 7, w - 8, 3, '#1a1010');
      rct(ctx, bx + 5, headY + 9, w - 10, 2, '#0a0808');
      // Narbe Wange
      rct(ctx, f > 0 ? bx + w - 7 : bx + 4, headY + 4, 3, 1, '#5a2010');
      // Netz-Prop
      rct(ctx, f > 0 ? bx - 4 : bx + w, by + 10, 4, 13, '#3a2010');
      rct(ctx, f > 0 ? bx - 3 : bx + w + 1, by + 12, 2, 2, '#5ec8b8');
      rct(ctx, f > 0 ? bx - 3 : bx + w + 1, by + 16, 2, 2, '#5ec8b8');
      rct(ctx, f > 0 ? bx - 3 : bx + w + 1, by + 20, 2, 2, '#5ec8b8');
    }

    // Augen (über Körper)
    var eyeY = headY + 3;
    if (p.stun > 0) {
      ctx.fillStyle = '#5a2010';
      if (f > 0) {
        rct(ctx, bx + w - 9, eyeY, 3, 1, '#5a2010');
        rct(ctx, bx + w - 13, eyeY, 3, 1, '#5a2010');
        rct(ctx, bx + w - 8, eyeY - 1, 1, 3, '#5a2010');
        rct(ctx, bx + w - 12, eyeY - 1, 1, 3, '#5a2010');
      } else {
        rct(ctx, bx + 6, eyeY, 3, 1, '#5a2010');
        rct(ctx, bx + 10, eyeY, 3, 1, '#5a2010');
      }
    } else {
      var ec = p.blk ? '#ffe080' : '#ffb040';
      if (f > 0) {
        rct(ctx, bx + w - 8, eyeY, 2, 2, ec);
        rct(ctx, bx + w - 12, eyeY, 2, 2, ec);
        rct(ctx, bx + w - 7, eyeY, 1, 1, '#fff8ee');
      } else {
        rct(ctx, bx + 6, eyeY, 2, 2, ec);
        rct(ctx, bx + 10, eyeY, 2, 2, ec);
        rct(ctx, bx + 6, eyeY, 1, 1, '#fff8ee');
      }
    }

    // Win-Pose
    if (p._winPose) {
      rct(ctx, bx - 5, by + 1, 5, 12, accent);
      rct(ctx, bx + w, by + 1, 5, 12, accent);
      rct(ctx, bx - 5, by, 5, 2, '#ffb040');
      rct(ctx, bx + w, by, 5, 2, '#ffb040');
      rct(ctx, bx + w / 2 - 3, by - 10, 6, 5, '#ffb040');
      rct(ctx, bx + w / 2 - 2, by - 12, 4, 2, '#ffe080');
    }

    // ---- Angriff: Arm / Prop / Trail ----
    if (p.atk) {
      var mv = c.moves[p.atk.art];
      var reach = Math.min(mv.reach, 42);
      var armW = Math.max(8, Math.floor(reach * (atkF < mv.startup ? 0.25 : 0.48)));
      var armY = y - (mv.high || 14) - 4;
      var punchCol = accent;
      if (p.atk.art === 'special' && id === 'lola') {
        for (var ri = 0; ri < 4; ri++) {
          var rx = x + f * (8 + ri * 5 + (atkF % 3));
          rct(ctx, rx, armY - 1 + ri * 2, 5, 5, '#ff2a4a');
          rct(ctx, rx + 1, armY + ri * 2, 2, 2, '#ff8090');
        }
      } else if (p.atk.art === 'special' && id === 'toni') {
        rct(ctx, f > 0 ? x + 4 : x - armW - 4, armY, armW, 7, '#4a4a4a');
        rct(ctx, f > 0 ? x + armW : x - armW - 3, armY - 5, 5, 16, '#ff4a18');
        rct(ctx, f > 0 ? x + armW + 1 : x - armW - 2, armY - 3, 3, 4, '#ffb040');
      } else if (p.atk.art === 'special' && id === 'biel') {
        rct(ctx, f > 0 ? x + 6 : x - 20, armY - 1, 16, 8, '#3a2010');
        for (var ni = 0; ni < 3; ni++) {
          rct(ctx, f > 0 ? x + 8 + ni * 4 : x - 18 + ni * 4, armY + 1, 3, 3, '#5ec8b8');
        }
      } else if (p.atk.art === 'heavy') {
        rct(ctx, f > 0 ? x + 4 : x - 4 - armW, armY - 1, armW, 8, punchCol);
        rct(ctx, f > 0 ? x + 4 : x - 4 - armW, armY, Math.floor(armW * 0.4), 6, hexShade(punchCol, 40));
        // Impact fist
        rct(ctx, f > 0 ? x + armW + 2 : x - armW - 6, armY - 2, 6, 10, haut);
      } else {
        rct(ctx, f > 0 ? x + 4 : x - 4 - armW, armY, armW, 6, punchCol);
        rct(ctx, f > 0 ? x + 4 : x - 4 - armW, armY + 1, Math.floor(armW * 0.35), 3, hexShade(punchCol, 35));
      }
      // Motion trail
      ctx.globalAlpha = 0.35;
      rct(ctx, f > 0 ? x + 1 : x - Math.floor(armW * 0.5) - 1, armY + 1, Math.floor(armW * 0.55), 4, farbe);
      ctx.globalAlpha = 0.5;
      rct(ctx, f > 0 ? x + 2 : x - 6, armY - 1, 4, 8, '#ff4a18');
      ctx.globalAlpha = 1;
    } else if (!p.crouch) {
      // Ruhe-Arm
      rct(ctx, f > 0 ? x + w / 2 - 1 : x - w / 2 - 4, y - 18, 5, 5, farbe);
      rct(ctx, f > 0 ? x + w / 2 : x - w / 2 - 3, y - 17, 3, 2, haut);
    }

    // Hurt flash overlay
    if (flash[p.id] > 0) {
      ctx.fillStyle = 'rgba(255,80,20,0.4)';
      ctx.fillRect(bx - 2, by - 3, w + 4, h + 4);
    }
    // Stun wobble lines
    if (p.stun > 0 && (tick % 4) < 2) {
      rct(ctx, bx + w / 2 - 1, by - 6, 2, 3, '#ffe080');
      rct(ctx, bx + w / 2 + 3, by - 5, 2, 2, '#ffb040');
      rct(ctx, bx + w / 2 - 4, by - 5, 2, 2, '#ffb040');
    }

    if (invert) {
      ctx.fillStyle = '#ffd36e';
      ctx.font = 'bold 7px ' + SCHRIFT;
      ctx.textAlign = 'center';
      ctx.fillText('P2', x, by - 6);
    }
  }

  /* ---- FX ---- */
  function spawnFx(kind, x, y, col) {
    fx.push({ kind: kind, x: x, y: y, t: 0, col: col || '#fff8ee' });
  }

  function updateFxFromDiff(snap) {
    if (!snap || !snap.p) return;
    if (prevSnap && prevSnap.p) {
      for (var i = 0; i < 2; i++) {
        var a = prevSnap.p[i], b = snap.p[i];
        if (!a || !b) continue;
        var kind = b.hitKind || '';
        var seqGrew = (b.hitSeq | 0) > (a.hitSeq | 0);
        if (b.hp < a.hp || seqGrew) {
          if (kind === 'heavy' || kind === 'throw') shake = 5;
          else if (kind === 'block') shake = 1;
          flash[i] = kind === 'armor' ? 6 : 4;
          if (kind === 'block') {
            spawnFx('block', b.x, b.y - 14, '#ffe080');
          } else if (kind === 'armor') {
            spawnFx('armor', b.x, b.y - 16, '#ffb040');
          } else {
            var col = Plaza.Chars.finde(b.charId).accent || '#ff3a08';
            spawnFx('spark', b.x, b.y - 16, col);
            spawnFx('spark', b.x + 5, b.y - 20, '#fff0c0');
            spawnFx('ember', b.x - 3, b.y - 12, '#ff6020');
            if (kind === 'special' || (b.hitKind === 'special')) {
              spawnFx('fireball', b.x + 4, b.y - 18, col);
              spawnFx('ice', b.x - 6, b.y - 14, '#80d8ff');
              spawnFx('knife', b.x, b.y - 20, '#ff2a4a');
            }
            if (a.hp - b.hp >= 10 || kind === 'heavy') {
              spawnFx('slash', b.x, b.y - 18, col);
              spawnFx('spark', b.x - 4, b.y - 22, '#fff8ee');
              spawnFx('fireball', b.x, b.y - 22, col);
            }
          }
        }
        if (!a.grounded && b.grounded) spawnFx('dust', b.x, Plaza.Kampf.BODEN, '#5a3020');
        if (a.grounded && !b.grounded) spawnFx('dust', b.x, Plaza.Kampf.BODEN, '#3a2010');
        // Track hitSeq in prev
        a.hitSeq = b.hitSeq; a.hitKind = b.hitKind;
      }
    }
    prevSnap = {
      p: snap.p.map(function (p) {
        return { hp: p.hp, grounded: p.grounded, x: p.x, y: p.y, charId: p.charId,
          hitSeq: p.hitSeq | 0, hitKind: p.hitKind || '' };
      })
    };
  }

  function nametag(ctx, p) {
    if (!p || !p.name) return;
    var label = String(p.name);
    if (label.length > 12) label = label.slice(0, 12);
    var top = (p.y | 0) - (p.crouch ? 36 : 50);
    ctx.font = 'bold 8px ' + SCHRIFT;
    ctx.textAlign = 'center';
    var tw = 0;
    try { tw = ctx.measureText(label).width; } catch (e) { tw = label.length * 5; }
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(p.x - tw / 2 - 3, top - 9, tw + 6, 12);
    ctx.fillStyle = '#1a0808';
    ctx.fillRect(p.x - tw / 2 - 3, top + 2, tw + 6, 1);
    ctx.fillStyle = '#ffe080';
    ctx.fillText(label, p.x, top);
  }

  function drawFx(ctx) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var e = fx[i];
      e.t++;
      if (e.kind === 'spark') {
        var s = e.t < 2 ? 4 : e.t < 4 ? 8 : e.t < 7 ? 5 : 0;
        if (s <= 0) { fx.splice(i, 1); continue; }
        ctx.fillStyle = e.col;
        ctx.fillRect(e.x - 1, e.y - s, 2, s * 2);
        ctx.fillRect(e.x - s, e.y - 1, s * 2, 2);
        ctx.fillStyle = '#fff8ee';
        ctx.fillRect(e.x - 1, e.y - 1, 2, 2);
      } else if (e.kind === 'slash') {
        if (e.t > 6) { fx.splice(i, 1); continue; }
        ctx.fillStyle = e.col;
        ctx.globalAlpha = 1 - e.t / 6;
        ctx.fillRect(e.x - 10 + e.t, e.y - 2, 14, 2);
        ctx.fillRect(e.x - 8 + e.t, e.y - 5, 10, 1);
        ctx.fillStyle = '#fff8ee';
        ctx.fillRect(e.x - 6 + e.t, e.y - 1, 6, 1);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'block') {
        if (e.t > 7) { fx.splice(i, 1); continue; }
        ctx.fillStyle = '#ffe080';
        ctx.globalAlpha = 1 - e.t / 7;
        ctx.fillRect(e.x - 6, e.y - 8, 12, 2);
        ctx.fillRect(e.x - 7, e.y - 6, 2, 10);
        ctx.fillRect(e.x + 5, e.y - 6, 2, 10);
        ctx.fillStyle = '#fff8ee';
        ctx.fillRect(e.x - 2, e.y - 4, 4, 4);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'armor') {
        if (e.t > 8) { fx.splice(i, 1); continue; }
        ctx.fillStyle = '#ffb040';
        ctx.globalAlpha = 0.7 - e.t / 12;
        ctx.fillRect(e.x - 9, e.y - 12, 18, 2);
        ctx.fillRect(e.x - 9, e.y + 6, 18, 2);
        ctx.fillRect(e.x - 9, e.y - 12, 2, 20);
        ctx.fillRect(e.x + 7, e.y - 12, 2, 20);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'fireball') {
        if (e.t > 10) { fx.splice(i, 1); continue; }
        var fr = 6 - e.t * 0.4;
        ctx.fillStyle = '#ff3a08';
        ctx.beginPath(); ctx.arc(e.x, e.y - e.t, fr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffb040';
        ctx.fillRect(e.x - 2, e.y - e.t - 2, 4, 4);
      } else if (e.kind === 'ice') {
        if (e.t > 9) { fx.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - e.t / 9;
        ctx.fillStyle = '#80d8ff';
        ctx.fillRect(e.x - 1 - e.t, e.y - 6, 2, 12);
        ctx.fillRect(e.x - 6, e.y - 1, 12, 2);
        ctx.fillStyle = '#e8ffff';
        ctx.fillRect(e.x - 2, e.y - 2, 4, 4);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'knife') {
        if (e.t > 8) { fx.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - e.t / 8;
        ctx.fillStyle = '#c0c8d0';
        ctx.fillRect(e.x - 6 + e.t, e.y - 1, 10, 2);
        ctx.fillStyle = '#ff2a4a';
        ctx.fillRect(e.x + 4 + e.t, e.y - 2, 3, 4);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'ember') {
        if (e.t > 12) { fx.splice(i, 1); continue; }
        ctx.fillStyle = e.t < 4 ? '#ffb040' : '#ff3a08';
        ctx.fillRect(e.x + (e.t % 3) - 1, e.y - e.t, 1, 2);
      } else if (e.kind === 'dust') {
        if (e.t > 8) { fx.splice(i, 1); continue; }
        ctx.fillStyle = e.col;
        ctx.globalAlpha = 1 - e.t / 8;
        ctx.fillRect(e.x - 4 - e.t, e.y - 2, 3, 2);
        ctx.fillRect(e.x + 2 + e.t, e.y - 1, 3, 2);
        ctx.globalAlpha = 1;
      }
    }
    for (var j = 0; j < 2; j++) if (flash[j] > 0) flash[j]--;
  }

  function hud(ctx, snap, ich) {
    function balken(x, p, mirror) {
      var c = Plaza.Chars.finde(p.charId);
      var bw = 118, bh = 10;
      var idx = p.id;
      var pct = Math.max(0, p.hp / p.maxHp);
      // Delay-Balken
      if (delayHp[idx] < pct) delayHp[idx] = pct;
      else delayHp[idx] += (pct - delayHp[idx]) * 0.08;
      if (Math.abs(delayHp[idx] - pct) < 0.002) delayHp[idx] = pct;

      // Rahmen Kapsel (schwarz, Feuer-Rand)
      ctx.fillStyle = '#000000';
      ctx.fillRect(x - 2, 10, bw + 4, bh + 6);
      ctx.fillStyle = '#3a1008';
      ctx.fillRect(x, 12, bw, bh + 2);
      // Delay (Bernstein)
      ctx.fillStyle = '#8a4010';
      var dw = bw * delayHp[idx];
      if (mirror) ctx.fillRect(x + bw - dw, 13, dw, bh);
      else ctx.fillRect(x, 13, dw, bh);
      // HP — heller Akzent (Feuer), nicht dunkle Outfitfarbe
      var low = pct <= 0.3;
      ctx.fillStyle = low && ((Date.now() / 80) | 0) % 2 ? '#ff2a40' : (c.accent || '#ff3a08');
      var fw = bw * pct;
      if (mirror) ctx.fillRect(x + bw - fw, 13, fw, bh);
      else ctx.fillRect(x, 13, fw, bh);
      // Highlight-Zeile
      ctx.fillStyle = 'rgba(255,200,120,0.35)';
      if (mirror) ctx.fillRect(x + bw - fw, 13, fw, 2);
      else ctx.fillRect(x, 13, fw, 2);
      // Ticks
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (var t = 1; t < 10; t++) ctx.fillRect(x + (bw * t) / 10, 12, 1, bh + 2);

      // Mini-Porträt (Kopf + Schulter + Akzent)
      var px = mirror ? x + bw + 4 : x - 18;
      ctx.fillStyle = '#000';
      ctx.fillRect(px - 2, 7, 16, 16);
      ctx.fillStyle = c.farbe2;
      ctx.fillRect(px - 1, 14, 14, 8);
      ctx.fillStyle = c.farbe;
      ctx.fillRect(px, 12, 12, 6);
      ctx.fillStyle = c.haut || '#ffd7b8';
      ctx.fillRect(px + 2, 8, 8, 7);
      ctx.fillStyle = '#0a0810';
      ctx.fillRect(px + 1, 7, 10, 3);
      ctx.fillStyle = c.accent || '#ff6020';
      ctx.fillRect(px + 3, 11, 2, 2);
      ctx.fillRect(px + 7, 11, 2, 2);

      // Name + Spitzname
      ctx.fillStyle = '#e8c090';
      ctx.font = 'bold 9px ' + SCHRIFT;
      ctx.textAlign = mirror ? 'right' : 'left';
      ctx.fillText(p.name, mirror ? x + bw : x, 9);
    }
    balken(28, snap.p[0], false);
    balken(W - 146, snap.p[1], true);

    // Zeit-Medaillon
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(W / 2, 18, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3a08';
    ctx.beginPath();
    ctx.arc(W / 2, 18, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0808';
    ctx.beginPath();
    ctx.arc(W / 2, 18, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = snap.zeit <= 10 ? '#ff2a40' : '#e8c090';
    ctx.font = 'bold 11px ' + SCHRIFT;
    ctx.textAlign = 'center';
    ctx.fillText(String(snap.zeit), W / 2, 22);

    if (snap.phase === 'countdown') {
      ctx.fillStyle = 'rgba(58,46,72,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e8c090';
      ctx.font = 'bold 48px ' + SCHRIFT;
      ctx.fillText(snap.countdown > 0 ? String(snap.countdown) : 'LOS!', W / 2, H / 2 + 8);
    }
    // Combo-Anzeige
    var ci, bestC = 0, bestId = -1;
    for (ci = 0; ci < snap.p.length; ci++) {
      if ((snap.p[ci].combo | 0) > bestC) { bestC = snap.p[ci].combo | 0; bestId = ci; }
    }
    if (bestC >= 2 && snap.phase === 'kampf') {
      ctx.fillStyle = '#ff6020';
      ctx.font = 'bold 14px ' + SCHRIFT;
      ctx.textAlign = 'center';
      ctx.fillText(bestC + ' HIT!', W / 2, 42);
      ctx.fillStyle = '#ffe080';
      ctx.font = '9px ' + SCHRIFT;
      ctx.fillText(snap.p[bestId].name, W / 2, 52);
    }
    // Special-Callout
    for (var si = 0; si < snap.p.length; si++) {
      if (snap.p[si].hitKind === 'special' && snap.phase === 'kampf' && (snap.tick % 20) < 12) {
        ctx.fillStyle = '#80d8ff';
        ctx.font = 'bold 11px ' + SCHRIFT;
        ctx.textAlign = 'center';
        ctx.fillText('SPECIAL!', W / 2, 64);
        break;
      }
    }

    if (snap.phase === 'ende') {
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      var won = (ich === 0 || ich === 1) && snap.sieger === ich;
      var lost = (ich === 0 || ich === 1) && snap.sieger != null && snap.sieger !== ich;
      if (won) {
        ctx.fillStyle = '#40ff80';
        ctx.font = 'bold 22px ' + SCHRIFT;
        ctx.fillText('GEWONNEN!', W / 2, H / 2 - 28);
      } else if (lost) {
        ctx.fillStyle = '#ff4040';
        ctx.font = 'bold 22px ' + SCHRIFT;
        ctx.fillText('VERLOREN!', W / 2, H / 2 - 28);
      }
      ctx.fillStyle = '#ff6020';
      ctx.font = 'bold 16px ' + SCHRIFT;
      ctx.fillText(snap.nachricht || 'Ende', W / 2, H / 2 - 6);
      if (snap.sieger != null && snap.p[snap.sieger]) {
        var wc = Plaza.Chars.finde(snap.p[snap.sieger].charId);
        if (wc && wc.winLine) {
          ctx.fillStyle = '#ffb040';
          ctx.font = '10px ' + SCHRIFT;
          ctx.fillText('„' + wc.winLine + '“', W / 2, H / 2 + 12);
        }
      }
      ctx.fillStyle = '#e8c090';
      ctx.font = '12px ' + SCHRIFT;
      ctx.fillText('Rematch → Knopf unten', W / 2, H / 2 + 30);
    }
    if (ich === 0 || ich === 1) {
      ctx.fillStyle = 'rgba(232,192,144,0.85)';
      ctx.font = '9px ' + SCHRIFT;
      ctx.textAlign = 'left';
      ctx.fillText('Du: P' + (ich + 1), 8, H - 6);
    }
  }

  function zeichne(r, snap, ich) {
    var ctx = r.ctx;
    applyBuf(ctx);
    ctx.save();
    updateFxFromDiff(snap);
    if (Plaza.Sound && Plaza.Sound.fromSnap) Plaza.Sound.fromSnap(snap);
    if (shake > 0) {
      ctx.translate(((shake % 2) ? 1 : -1) * Math.min(2, shake), (shake % 3) - 1);
      shake--;
    }
    arena(ctx, snap.tick || 0, snap);

    var i;
    for (i = 0; i < (snap.projektil || []).length; i++) {
      var pr = snap.projektil[i];
      var typ = pr.typ || 'ball';
      var px = pr.x | 0, py = pr.y | 0;
      var tck = snap.tick || 0;
      if (typ === 'bodenwelle') {
        // Lava-Erdstoß: gezackte Feuerwelle + Funken
        var ww = 18 + ((tck + i) % 3);
        ctx.fillStyle = '#5a0800';
        ctx.fillRect(px - ww / 2, py - 2, ww, 5);
        ctx.fillStyle = '#ff3a08';
        for (var zw = -3; zw <= 3; zw++) {
          var zh = 3 + ((tck + zw + i) % 4);
          ctx.fillRect(px + zw * 3, py - zh, 3, zh + 2);
        }
        ctx.fillStyle = '#ffb040';
        ctx.fillRect(px - 4, py - 5, 3, 3);
        ctx.fillRect(px + 2, py - 7, 2, 4);
        ctx.fillStyle = '#fff0c0';
        ctx.fillRect(px - 1, py - 8, 2, 2);
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#ff4a18';
        ctx.fillRect(px - ww, py - 1, 6, 2);
        ctx.globalAlpha = 1;
      } else if (typ === 'fächer' || typ === 'faecher') {
        // Rosenmesser / Eis-Kristall-Fächer
        var spin = ((tck + i * 7) % 8);
        ctx.fillStyle = '#8a1030';
        ctx.fillRect(px - 5, py - 1, 10, 3);
        ctx.fillStyle = '#ff2a4a';
        ctx.fillRect(px - 4 + (spin % 3), py - 4, 3, 8);
        ctx.fillRect(px + 1, py - 5, 3, 9);
        ctx.fillStyle = '#ffe0ee';
        ctx.fillRect(px - 1, py - 2, 2, 5);
        // Eis-/Glanzkante
        ctx.fillStyle = '#a0e8ff';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(px + 3, py - 6, 1, 6);
        ctx.fillRect(px - 5, py - 3, 1, 4);
        ctx.globalAlpha = 1;
        // Trail petals
        ctx.fillStyle = '#ff6080';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(px - 10, py - 2, 4, 3);
        ctx.fillRect(px - 14, py, 3, 2);
        ctx.globalAlpha = 1;
      } else {
        // Feuerball / Sonnenball detailliert
        var rad = Math.max(5, (pr.w || 10) / 2);
        ctx.fillStyle = '#5a1000';
        ctx.beginPath(); ctx.arc(px, py, rad + 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = pr.farbe || '#ff6a20';
        ctx.beginPath(); ctx.arc(px, py, rad, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffb040';
        ctx.beginPath(); ctx.arc(px - 1, py - 1, Math.max(2, rad - 2), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff8ee';
        ctx.fillRect(px - 1, py - 2, 3, 3);
        // Flammenzungen
        ctx.fillStyle = '#ff3a08';
        var fj;
        for (fj = 0; fj < 4; fj++) {
          var ang = ((tck + fj * 3) % 12) - 6;
          ctx.fillRect(px - rad - 3 - (fj % 2), py - 2 + ang % 5, 4 + fj, 2);
        }
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ff8020';
        ctx.fillRect(px - rad - 10, py - 2, 8, 4);
        ctx.globalAlpha = 1;
      }
    }

    // Spiegelmatch: gleiche charId → P2 invertieren
    var same = snap.p[0] && snap.p[1] && snap.p[0].charId === snap.p[1].charId;
    for (i = 0; i < snap.p.length; i++) {
      snap.p[i]._winPose = (snap.phase === 'ende' && snap.sieger === snap.p[i].id);
      snap.p[i]._tick = snap.tick || 0;
      fig(ctx, snap.p[i], true, same && i === 1);
    }
    for (i = 0; i < snap.p.length; i++) nametag(ctx, snap.p[i]);
    drawFx(ctx);
    fg(ctx, snap.tick || 0);
    hud(ctx, snap, ich);
    ctx.restore();
  }

  function menueHint(r, text) {
    var ctx = r.ctx;
    applyBuf(ctx);
    if (!layers) layers = backeLayers();
    // Zeige Arena auch im Menü
    camX = Math.sin(Date.now() / 3000) * 6;
    arena(ctx, (Date.now() / 50) | 0, null);
    fg(ctx, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, 40);
    ctx.fillStyle = '#e8c090';
    ctx.font = 'bold 16px ' + SCHRIFT;
    ctx.textAlign = 'center';
    ctx.fillText('Plaza-Kampf', W / 2, 20);
    ctx.fillStyle = '#ff6020';
    ctx.font = '10px ' + SCHRIFT;
    ctx.fillText('la Pelea del Infierno', W / 2, 34);
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(40, H / 2 - 16, W - 80, 28);
    ctx.fillStyle = '#ff6020';
    ctx.font = '12px ' + SCHRIFT;
    ctx.fillText(text || '', W / 2, H / 2 + 4);
  }

  function banner(r, text) {
    var ctx = r.ctx;
    applyBuf(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(20, H / 2 - 18, W - 40, 36);
    ctx.fillStyle = '#ff4040';
    ctx.font = 'bold 12px ' + SCHRIFT;
    ctx.textAlign = 'center';
    ctx.fillText(text || '…', W / 2, H / 2 + 4);
  }

  function resetFx() {
    fx = []; delayHp = [1, 1]; flash = [0, 0]; prevSnap = null; shake = 0;
  }

  Plaza.Render = {
    W: W, H: H, puffer: function () { return BUF; },
    erstelle: erstelle, setzePuffer: setzePuffer,
    zeichne: zeichne, menueHint: menueHint, banner: banner, resetFx: resetFx
  };
})(typeof window !== 'undefined' ? window : globalThis);
