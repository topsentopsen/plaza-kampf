/* Pixel-Canvas v0.3: Plaza-Arena mit Tiefe, Silhouetten, FX, HUD. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};
  var W = 320, H = 180;
  var SCHRIFT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
  var layers = null;
  var fx = [];
  var delayHp = [1, 1];
  var flash = [0, 0];
  var prevSnap = null;
  var camX = 0;

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

  function erstelle(canvas) {
    var ctx = canvas.getContext('2d');
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = false;
    canvas.width = W; canvas.height = H;
    layers = backeLayers();
    return { canvas: canvas, ctx: ctx, w: W, h: H };
  }

  function backeLayers() {
    var LW = 360; // extra for parallax
    var pal = P();
    var L0 = backe(LW, H, function (x, w, h) {
      var BAND = pal.himmel || ['#6bb8d8', '#7ec8e3', '#93d2e8', '#aadcec', '#c8e9f5', '#e8f0c8', '#f6e3b4', '#f3cf9a'];
      var bh = Math.ceil(h / BAND.length);
      for (var i = 0; i < BAND.length; i++) {
        x.fillStyle = BAND[i];
        x.fillRect(0, i * bh, w, bh + 1);
        if (i) {
          x.fillStyle = BAND[i - 1];
          for (var px = 0; px < w; px += 2) {
            x.fillRect(px + (i % 2), i * bh + ((px / 2) % 2), 1, 1);
          }
        }
      }
      // Sonne
      x.fillStyle = pal.sonneGlow || '#ffe9a8';
      x.beginPath(); x.arc(300, 34, 22, 0, Math.PI * 2); x.fill();
      x.fillStyle = pal.sonne || '#ffd36e';
      x.beginPath(); x.arc(300, 34, 14, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff8ee';
      x.fillRect(296, 30, 3, 3);
    });

    var L1 = backe(LW, H, function (x, w, h) {
      // Meer
      x.fillStyle = pal.meer || '#5aa8c8';
      x.fillRect(0, 78, w, 18);
      x.fillStyle = '#8ec8dc';
      for (var sx = 0; sx < w; sx += 10) x.fillRect(sx, 80 + (sx % 6), 4, 1);
      // Hügel
      x.fillStyle = pal.huegel2 || '#6a9a6e';
      x.beginPath(); x.moveTo(0, 96); x.quadraticCurveTo(80, 70, 160, 92); x.quadraticCurveTo(240, 68, 360, 94); x.lineTo(360, 110); x.lineTo(0, 110); x.fill();
      x.fillStyle = pal.huegel || '#8fbf8a';
      x.beginPath(); x.moveTo(0, 100); x.quadraticCurveTo(100, 82, 200, 98); x.quadraticCurveTo(280, 78, 360, 100); x.lineTo(360, 112); x.lineTo(0, 112); x.fill();
      // Boote
      x.fillStyle = '#fff8ee';
      x.fillRect(40, 84, 10, 3); x.fillRect(44, 78, 2, 6);
      x.fillStyle = '#ff8a4d'; x.fillRect(46, 78, 5, 3);
      x.fillStyle = '#fff8ee';
      x.fillRect(280, 86, 12, 3); x.fillRect(285, 80, 2, 6);
    });

    var L2 = backe(LW, H, function (x, w, h) {
      function haus(hx, hy, hw, hh, dachC, fasC) {
        x.fillStyle = fasC;
        x.fillRect(hx, hy, hw, hh);
        x.fillStyle = dachC;
        x.beginPath();
        x.moveTo(hx - 2, hy);
        x.lineTo(hx + hw / 2, hy - Math.floor(hw * 0.35));
        x.lineTo(hx + hw + 2, hy);
        x.fill();
        // Fenster
        x.fillStyle = '#4a8ec8';
        x.fillRect(hx + 4, hy + 8, 5, 6);
        x.fillRect(hx + hw - 9, hy + 8, 5, 6);
        x.fillStyle = '#fff8ee';
        x.fillRect(hx + 5, hy + 9, 1, 2);
        // Tür
        x.fillStyle = '#7a4a32';
        x.fillRect(hx + hw / 2 - 3, hy + hh - 12, 6, 12);
      }
      // Häuserreihe
      haus(8, 78, 36, 42, '#c45a40', '#fff8ee');
      haus(48, 82, 30, 38, '#a84830', '#f0e4d0');
      haus(82, 76, 40, 44, '#c45a40', '#fff8ee');
      // Kirchturm
      x.fillStyle = '#e8d8c0';
      x.fillRect(128, 55, 22, 65);
      x.fillStyle = '#c45a40';
      x.beginPath(); x.moveTo(125, 55); x.lineTo(139, 38); x.lineTo(153, 55); x.fill();
      x.fillStyle = '#4a3560';
      x.fillRect(134, 62, 10, 12); // Glockennische
      x.fillStyle = '#ffd36e';
      x.fillRect(137, 66, 4, 4);
      // Bogen-Arkade
      x.fillStyle = '#e8d8c0';
      x.fillRect(158, 88, 70, 32);
      x.fillStyle = '#c8b8a0';
      for (var a = 0; a < 4; a++) {
        x.beginPath();
        x.arc(168 + a * 16, 104, 7, Math.PI, 0);
        x.fill();
        x.fillStyle = '#3a2e48';
        x.fillRect(161 + a * 16, 104, 14, 16);
        x.fillStyle = '#c8b8a0';
      }
      // Rechte Häuser
      haus(240, 80, 34, 40, '#9580dc', '#f4efff');
      haus(280, 76, 38, 44, '#c45a40', '#fff8ee');
      haus(320, 84, 28, 36, '#a84830', '#f0e4d0');
      // Wäscheleine
      x.strokeStyle = '#4a3560';
      x.beginPath(); x.moveTo(50, 86); x.lineTo(110, 84); x.stroke();
      x.fillStyle = '#ff9fc0'; x.fillRect(60, 86, 6, 8);
      x.fillStyle = '#5ec8b8'; x.fillRect(78, 85, 7, 9);
      x.fillStyle = '#ffd36e'; x.fillRect(95, 86, 5, 7);
    });

    var L3 = backe(LW, H, function (x, w, h) {
      // Café links
      x.fillStyle = '#7a4a32';
      x.fillRect(14, 118, 3, 22); // Schirmstange
      // gestreifter Schirm
      for (var s = 0; s < 8; s++) {
        x.fillStyle = s % 2 ? '#ff8a4d' : '#fff8ee';
        x.beginPath();
        x.moveTo(16, 118);
        x.lineTo(4 + s * 3, 108);
        x.lineTo(7 + s * 3, 108);
        x.fill();
      }
      x.fillStyle = '#c79f74';
      x.fillRect(6, 128, 14, 5); // Tisch
      x.fillRect(8, 133, 3, 6); x.fillRect(16, 133, 3, 6);
      x.fillRect(24, 130, 12, 4);
      x.fillRect(26, 134, 2, 5); x.fillRect(32, 134, 2, 5);
      // Stühle
      x.fillStyle = '#9a6a4a';
      x.fillRect(4, 130, 4, 8); x.fillRect(34, 132, 4, 7);

      // Brunnen Mitte
      var bx = 170;
      x.fillStyle = '#a89880';
      x.fillRect(bx - 18, 128, 36, 8);
      x.fillStyle = '#c8b8a0';
      x.fillRect(bx - 12, 120, 24, 8);
      x.fillStyle = '#e8d8c0';
      x.fillRect(bx - 6, 112, 12, 8);
      x.fillStyle = '#7ec8e3';
      x.fillRect(bx - 14, 126, 28, 3);
      x.fillRect(bx - 8, 118, 16, 2);
      x.fillStyle = '#fff8ee';
      x.fillRect(bx - 1, 108, 2, 6); // Fontäne
      // Becken-Rand
      x.fillStyle = '#4a3560';
      x.fillRect(bx - 18, 135, 36, 2);

      // Palmen rechts
      function palme(px, py) {
        x.fillStyle = '#9a6a4a';
        x.fillRect(px, py, 5, 36);
        x.fillStyle = '#7ed492';
        for (var i = 0; i < 6; i++) {
          var ang = i * 0.9;
          x.beginPath();
          x.ellipse(px + 2 + Math.cos(ang) * 3, py + 2, 12, 4, ang, 0, Math.PI * 2);
          x.fill();
        }
        x.fillStyle = '#5eaf6e';
        x.beginPath();
        x.ellipse(px + 2, py, 8, 3, 0.4, 0, Math.PI * 2);
        x.fill();
      }
      palme(300, 100);
      palme(330, 108);

      // Kiosk
      x.fillStyle = '#ffd36e';
      x.fillRect(250, 118, 28, 20);
      x.fillStyle = '#e0ad3e';
      x.fillRect(248, 114, 32, 5);
      x.fillStyle = '#4a3560';
      x.fillRect(256, 124, 16, 10);
      x.fillStyle = '#ff8a4d';
      x.fillRect(252, 116, 8, 2);

      // Passanten-Silhouetten (statisch)
      x.fillStyle = 'rgba(74,53,96,0.35)';
      x.fillRect(100, 122, 3, 10); x.fillRect(100, 120, 3, 3);
      x.fillRect(210, 124, 3, 9); x.fillRect(210, 122, 3, 3);
      x.fillRect(70, 126, 2, 8); x.fillRect(70, 124, 2, 2);
    });

    var L4 = backe(LW, H, function (x, w, h) {
      var BODEN = 148;
      // Pflaster perspektivisch
      var y = BODEN - 4;
      for (var r = 0; y < h; r++) {
        var th = 2 + Math.min(r, 6);
        var tw = 12 + r * 3;
        for (var tx = -((r * 5) % tw); tx < w; tx += tw) {
          x.fillStyle = ((Math.floor(tx / tw) + r) & 1) ? '#e6c79c' : '#dcb98e';
          x.fillRect(tx, y, tw - 1, th - 1);
          x.fillStyle = '#c79f74';
          x.fillRect(tx + tw - 1, y, 1, th);
        }
        y += th;
      }
      // Plaza-Linie / Bordstein
      x.fillStyle = '#fff8ee';
      x.fillRect(0, BODEN + 1, w, 2);
      x.fillStyle = '#c79f74';
      x.fillRect(0, BODEN + 3, w, 1);
      // Medaillon Mitte
      var mx = 180, my = BODEN + 12;
      x.fillStyle = '#ffd36e';
      x.beginPath(); x.ellipse(mx, my, 28, 8, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#e0ad3e';
      x.beginPath(); x.ellipse(mx, my, 22, 6, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff8ee';
      x.beginPath(); x.ellipse(mx, my, 10, 3, 0, 0, Math.PI * 2); x.fill();
      // Flecken
      x.fillStyle = 'rgba(122,74,50,0.2)';
      x.fillRect(40, BODEN + 8, 8, 3);
      x.fillRect(260, BODEN + 14, 12, 2);
      x.fillRect(120, BODEN + 20, 6, 4);
    });

    var L5 = backe(LW, H, function (x, w, h) {
      // Topfpflanze links
      x.fillStyle = '#c45a40';
      x.fillRect(2, 158, 12, 10);
      x.fillStyle = '#5eaf6e';
      x.beginPath(); x.ellipse(8, 154, 8, 6, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#7ed492';
      x.beginPath(); x.ellipse(10, 150, 5, 4, 0.3, 0, Math.PI * 2); x.fill();
      // Bank rechts
      x.fillStyle = '#7a4a32';
      x.fillRect(330, 150, 28, 4);
      x.fillRect(332, 154, 3, 8);
      x.fillRect(354, 154, 3, 8);
      x.fillRect(330, 146, 28, 3);
      // Laterne
      x.fillStyle = '#4a3560';
      x.fillRect(20, 130, 3, 40);
      x.fillStyle = '#ffd36e';
      x.fillRect(16, 126, 11, 8);
      x.fillStyle = '#fff8ee';
      x.fillRect(19, 128, 3, 3);
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
    // Sonne pulsiert
    if ((tick % 120) < 8) {
      ctx.fillStyle = 'rgba(255,233,168,0.25)';
      ctx.beginPath(); ctx.arc(280 - camX * 0, 34, 28, 0, Math.PI * 2); ctx.fill();
    }
    drawLayer(ctx, layers.L1, 0.1, tick);
    drawLayer(ctx, layers.L2, 0.25, tick);
    drawLayer(ctx, layers.L3, 0.5, tick);
    // Brunnen-Wasser-Glitzer (animiert)
    var f = ((tick / 8) | 0) % 4;
    var bx = 150 - Math.round(camX * 0.5);
    ctx.fillStyle = '#fff8ee';
    if (f === 0) { ctx.fillRect(bx, 114, 2, 2); ctx.fillRect(bx + 6, 122, 1, 1); }
    if (f === 1) { ctx.fillRect(bx + 3, 116, 2, 2); ctx.fillRect(bx - 4, 124, 1, 1); }
    if (f === 2) { ctx.fillRect(bx + 1, 112, 1, 3); ctx.fillRect(bx + 8, 120, 2, 1); }
    if (f === 3) { ctx.fillRect(bx - 2, 118, 2, 1); ctx.fillRect(bx + 5, 126, 1, 1); }
    drawLayer(ctx, layers.L4, 1.0, tick);
  }

  function fg(ctx, tick) {
    if (!layers) return;
    drawLayer(ctx, layers.L5, 1.15, tick);
  }

  /* ---- Figuren-Silhouetten ---- */
  function schatten(ctx, x, yBoden, w, hoch) {
    var sc = Math.max(0.35, 1 - hoch / 60);
    ctx.fillStyle = 'rgba(74,53,96,0.28)';
    var rw = Math.max(4, w * 0.55 * sc);
    ctx.fillRect(Math.round(x - rw), yBoden + 1, Math.round(rw * 2), 3);
    ctx.fillRect(Math.round(x - rw * 0.7), yBoden + 2, Math.round(rw * 1.4), 2);
  }

  function konturRect(ctx, x, y, w, h, fill, outline) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (outline !== false) {
      ctx.fillStyle = '#4a3560';
      ctx.fillRect(x, y, w, 1);
      ctx.fillRect(x, y + h - 1, w, 1);
      ctx.fillRect(x, y, 1, h);
      ctx.fillRect(x + w - 1, y, 1, h);
    }
  }

  function fig(ctx, p, blink, invert) {
    var c = Plaza.Chars.finde(p.charId);
    var x = Math.round(p.x), y = Math.round(p.y);
    var f = p.facing || 1;
    var h = c.h, w = c.w;
    if (blink && p.invuln > 0 && (p.invuln % 2 === 0)) return;
    if (flash[p.id] > 0) { /* white flash handled below */ }

    var farbe = invert ? c.farbe2 : c.farbe;
    var farbe2 = invert ? c.farbe : c.farbe2;
    var haut = c.haut || '#ffd7b8';
    var idle = ((p.x * 0) + (Date.now ? 0 : 0)); // use stun/atk for pose
    var breath = (p.atk || p.stun > 0) ? 0 : (((Math.floor((p.x + (p.id || 0) * 7) + (flash[0] /*tick via y*/)) ) % 2));
    // better breath from global tick stored on p via y jitter — use stun
    var bob = (!p.atk && p.stun <= 0 && p.grounded) ? (((Math.floor(x + y) + (p.id || 0)) % 2)) : 0;
    if (p.stun > 0) bob = 0;

    var hoch = Math.max(0, Plaza.Kampf.BODEN - y);
    schatten(ctx, x, Plaza.Kampf.BODEN, w, hoch);

    var hurtLean = p.stun > 0 ? -f * 2 : 0;
    var bx = x - w / 2 + hurtLean;
    var by = y - h + (bob ? -1 : 0);
    if (p.stun > 0) by += 1;

    // Body per character
    var id = c.id;
    if (id === 'toni') {
      // breit, kurze Beine, Schürze
      konturRect(ctx, bx, by + 7, w, h - 12, farbe);
      konturRect(ctx, bx + 2, by + 12, w - 4, 10, '#7a4a32', false); // Schürze
      konturRect(ctx, bx + 4, by, w - 8, 10, haut); // Kopf
      // Schnurrbart
      ctx.fillStyle = '#4a3560';
      ctx.fillRect(bx + 6, by + 6, w - 12, 2);
      // Hammer am Gürtel
      ctx.fillStyle = '#9a6a4a';
      ctx.fillRect(bx + w - 4, by + 14, 3, 8);
      ctx.fillStyle = '#888';
      ctx.fillRect(bx + w - 6, by + 13, 7, 3);
    } else if (id === 'lola') {
      // schmal oben, Rock unten, Dutt+Rose
      konturRect(ctx, bx + 2, by + 8, w - 4, 8, farbe); // torso
      // Rock
      ctx.fillStyle = farbe2;
      ctx.beginPath();
      ctx.moveTo(bx, by + 16);
      ctx.lineTo(bx - 3, y - 2);
      ctx.lineTo(bx + w + 3, y - 2);
      ctx.lineTo(bx + w, by + 16);
      ctx.fill();
      // Punkte auf Rock
      ctx.fillStyle = '#fff0f6';
      ctx.fillRect(bx + 2, by + 20, 2, 2);
      ctx.fillRect(bx + w - 4, by + 22, 2, 2);
      konturRect(ctx, bx + 3, by, w - 6, 9, haut);
      // Dutt
      ctx.fillStyle = farbe2;
      ctx.fillRect(bx + 5, by - 5, 6, 5);
      // Rose
      ctx.fillStyle = '#d94a6a';
      ctx.fillRect(bx + 10, by - 4, 3, 3);
      // Fächer wenn idle
      if (!p.atk) {
        ctx.fillStyle = c.accent;
        var fanX = f > 0 ? bx + w : bx - 8;
        ctx.fillRect(fanX, by + 10, 8, 5);
        ctx.fillStyle = '#d94a6a';
        ctx.fillRect(fanX + 1, by + 11, 2, 3);
      }
    } else if (id === 'rocco') {
      konturRect(ctx, bx, by + 6, w, h - 10, farbe);
      // hoher Kragen / Schulterpolster
      konturRect(ctx, bx - 2, by + 8, w + 4, 6, farbe2, false);
      konturRect(ctx, bx + 3, by, w - 6, 10, haut);
      // Sonnenbrille
      ctx.fillStyle = '#3a2e48';
      ctx.fillRect(bx + 4, by + 3, w - 8, 3);
      ctx.fillStyle = '#888';
      ctx.fillRect(bx + 5, by + 4, 3, 1);
      ctx.fillRect(bx + w - 8, by + 4, 3, 1);
      // Stiernacken
      ctx.fillStyle = haut;
      ctx.fillRect(bx + 5, by + 9, w - 10, 3);
    } else if (id === 'nina') {
      konturRect(ctx, bx + 1, by + 7, w - 2, h - 12, farbe);
      konturRect(ctx, bx + 3, by, w - 6, 9, haut);
      // Pferdeschwanz asymmetrisch
      ctx.fillStyle = farbe2;
      ctx.fillRect(bx + (f > 0 ? -2 : w - 2), by + 2, 4, 10);
      // Kopfhörer
      ctx.fillStyle = '#4a3560';
      ctx.fillRect(bx + 1, by + 2, 3, 5);
      ctx.fillRect(bx + w - 4, by + 2, 3, 5);
      ctx.fillRect(bx + 2, by, w - 4, 2);
      // Schal
      ctx.fillStyle = '#5ec8b8';
      ctx.fillRect(bx + 2, by + 9, w - 4, 3);
      ctx.fillRect(f > 0 ? bx + w - 2 : bx - 4, by + 10, 5, 8);
    } else {
      // Biel default — Mütze, Bart, Netz
      konturRect(ctx, bx, by + 6, w, h - 10, farbe);
      konturRect(ctx, bx + 3, by, w - 6, 10, haut);
      // Mütze
      ctx.fillStyle = farbe2;
      ctx.fillRect(bx + 2, by - 3, w - 4, 5);
      ctx.fillRect(bx + 1, by + 1, w - 2, 2);
      // Dreitagebart
      ctx.fillStyle = '#8a6a55';
      ctx.fillRect(bx + 5, by + 6, w - 10, 3);
      // Netz über Schulter
      ctx.fillStyle = '#c79f74';
      ctx.fillRect(f > 0 ? bx - 2 : bx + w - 2, by + 10, 4, 10);
      ctx.fillStyle = '#fff8ee';
      ctx.fillRect(f > 0 ? bx - 1 : bx + w - 1, by + 12, 2, 2);
      ctx.fillRect(f > 0 ? bx - 1 : bx + w - 1, by + 16, 2, 2);
    }

    // Augen
    ctx.fillStyle = p.stun > 0 ? '#4a3560' : '#4a3560';
    if (p.stun > 0) {
      // X eyes
      if (f > 0) {
        ctx.fillRect(bx + w - 9, by + 3, 3, 1);
        ctx.fillRect(bx + w - 13, by + 3, 3, 1);
      } else {
        ctx.fillRect(bx + 6, by + 3, 3, 1);
        ctx.fillRect(bx + 10, by + 3, 3, 1);
      }
    } else if (f > 0) {
      ctx.fillRect(bx + w - 8, by + 3, 2, 2);
      ctx.fillRect(bx + w - 12, by + 3, 2, 2);
    } else {
      ctx.fillRect(bx + 6, by + 3, 2, 2);
      ctx.fillRect(bx + 10, by + 3, 2, 2);
    }

    // Beine
    ctx.fillStyle = farbe2;
    var legGap = p.atk ? 2 : (bob ? 1 : 0);
    ctx.fillRect(bx + 2 - legGap, y - 8, 5, 8);
    ctx.fillRect(bx + w - 7 + legGap, y - 8, 5, 8);

    // Angriffs-Arm / Prop
    if (p.atk) {
      var mv = c.moves[p.atk.art];
      var reach = Math.min(mv.reach, 40);
      var armW = Math.max(8, Math.floor(reach * 0.42));
      var armY = y - (mv.high || 14) - 4;
      if (p.atk.art === 'special' && id === 'lola') {
        // Rosen
        ctx.fillStyle = '#d94a6a';
        for (var ri = 0; ri < 3; ri++) {
          var rx = x + f * (10 + ri * 6);
          ctx.fillRect(rx, armY - 2 + ri * 3, 4, 4);
        }
      } else if (p.atk.art === 'special' && id === 'toni') {
        ctx.fillStyle = '#888';
        ctx.fillRect(f > 0 ? x + 4 : x - armW - 4, armY, armW, 6);
        ctx.fillStyle = '#9a6a4a';
        ctx.fillRect(f > 0 ? x + armW : x - armW - 2, armY - 4, 4, 14);
      } else if (p.atk.art === 'special' && id === 'biel') {
        ctx.fillStyle = '#fff8ee';
        ctx.fillRect(f > 0 ? x + 6 : x - 18, armY, 14, 6);
        ctx.fillStyle = '#5ec8b8';
        ctx.fillRect(f > 0 ? x + 8 : x - 16, armY + 1, 4, 4);
      } else {
        ctx.fillStyle = c.accent;
        if (f > 0) ctx.fillRect(x + 4, armY, armW, 5);
        else ctx.fillRect(x - 4 - armW, armY, armW, 5);
      }
      // Trail
      ctx.fillStyle = farbe;
      ctx.globalAlpha = 0.35;
      if (f > 0) ctx.fillRect(x + 2, armY + 1, Math.floor(armW * 0.6), 3);
      else ctx.fillRect(x - 2 - Math.floor(armW * 0.6), armY + 1, Math.floor(armW * 0.6), 3);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = farbe;
      if (f > 0) ctx.fillRect(x + w / 2 - 2, y - 18, 6, 4);
      else ctx.fillRect(x - w / 2 - 4, y - 18, 6, 4);
    }

    // White flash
    if (flash[p.id] > 0) {
      ctx.fillStyle = 'rgba(255,248,238,0.55)';
      ctx.fillRect(bx - 1, by - 2, w + 2, h + 2);
    }

    // P2 marker bei Invert
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
        if (b.hp < a.hp) {
          flash[i] = 4;
          spawnFx('spark', b.x, b.y - 16, Plaza.Chars.finde(b.charId).farbe);
          if (a.hp - b.hp >= 10) spawnFx('spark', b.x + 4, b.y - 20, '#fff8ee');
        }
        if (!a.grounded && b.grounded) spawnFx('dust', b.x, Plaza.Kampf.BODEN, '#c79f74');
        if (a.grounded && !b.grounded) spawnFx('dust', b.x, Plaza.Kampf.BODEN, '#dcb98e');
      }
    }
    prevSnap = {
      p: snap.p.map(function (p) {
        return { hp: p.hp, grounded: p.grounded, x: p.x, y: p.y, charId: p.charId };
      })
    };
  }

  function drawFx(ctx) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var e = fx[i];
      e.t++;
      if (e.kind === 'spark') {
        var s = e.t < 2 ? 3 : e.t < 4 ? 7 : e.t < 6 ? 5 : 0;
        if (s <= 0) { fx.splice(i, 1); continue; }
        ctx.fillStyle = e.col;
        ctx.fillRect(e.x - 1, e.y - s, 2, s * 2);
        ctx.fillRect(e.x - s, e.y - 1, s * 2, 2);
        ctx.fillStyle = '#fff8ee';
        ctx.fillRect(e.x - 1, e.y - 1, 2, 2);
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

      // Rahmen Kapsel
      ctx.fillStyle = '#4a3560';
      ctx.fillRect(x - 2, 10, bw + 4, bh + 6);
      ctx.fillStyle = '#2a1e38';
      ctx.fillRect(x, 12, bw, bh + 2);
      // Delay
      ctx.fillStyle = '#ffd36e';
      var dw = bw * delayHp[idx];
      if (mirror) ctx.fillRect(x + bw - dw, 13, dw, bh);
      else ctx.fillRect(x, 13, dw, bh);
      // HP
      var low = pct <= 0.3;
      ctx.fillStyle = low && ((Date.now() / 80) | 0) % 2 ? '#ff5f8a' : c.farbe;
      var fw = bw * pct;
      if (mirror) ctx.fillRect(x + bw - fw, 13, fw, bh);
      else ctx.fillRect(x, 13, fw, bh);
      // Highlight-Zeile
      ctx.fillStyle = 'rgba(255,248,238,0.35)';
      if (mirror) ctx.fillRect(x + bw - fw, 13, fw, 2);
      else ctx.fillRect(x, 13, fw, 2);
      // Ticks
      ctx.fillStyle = 'rgba(58,46,72,0.45)';
      for (var t = 1; t < 10; t++) ctx.fillRect(x + (bw * t) / 10, 12, 1, bh + 2);

      // Mini-Porträt
      var px = mirror ? x + bw + 4 : x - 16;
      ctx.fillStyle = '#4a3560';
      ctx.fillRect(px - 1, 8, 14, 14);
      ctx.fillStyle = c.farbe;
      ctx.fillRect(px, 9, 12, 12);
      ctx.fillStyle = c.haut || '#ffd7b8';
      ctx.fillRect(px + 3, 10, 6, 5);
      ctx.fillStyle = c.farbe2;
      ctx.fillRect(px + 2, 9, 8, 2);

      // Name + Spitzname
      ctx.fillStyle = '#fff8ee';
      ctx.font = 'bold 9px ' + SCHRIFT;
      ctx.textAlign = mirror ? 'right' : 'left';
      ctx.fillText(p.name, mirror ? x + bw : x, 9);
    }
    balken(28, snap.p[0], false);
    balken(W - 146, snap.p[1], true);

    // Zeit-Medaillon
    ctx.fillStyle = '#4a3560';
    ctx.beginPath();
    ctx.arc(W / 2, 18, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd36e';
    ctx.beginPath();
    ctx.arc(W / 2, 18, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = snap.zeit <= 10 ? '#c45a40' : '#3a2e48';
    ctx.font = 'bold 11px ' + SCHRIFT;
    ctx.textAlign = 'center';
    ctx.fillText(String(snap.zeit), W / 2, 22);

    if (snap.phase === 'countdown') {
      ctx.fillStyle = 'rgba(58,46,72,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff8ee';
      ctx.font = 'bold 48px ' + SCHRIFT;
      ctx.fillText(snap.countdown > 0 ? String(snap.countdown) : 'LOS!', W / 2, H / 2 + 8);
    }
    if (snap.phase === 'ende') {
      ctx.fillStyle = 'rgba(58,46,72,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffd36e';
      ctx.font = 'bold 20px ' + SCHRIFT;
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
    updateFxFromDiff(snap);
    if (Plaza.Sound && Plaza.Sound.fromSnap) Plaza.Sound.fromSnap(snap);
    arena(ctx, snap.tick || 0, snap);

    var i;
    for (i = 0; i < (snap.projektil || []).length; i++) {
      var pr = snap.projektil[i];
      ctx.fillStyle = pr.farbe || '#ffd36e';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8ee';
      ctx.fillRect(pr.x - 2, pr.y - 2, 4, 4);
      // Schweif
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = pr.farbe || '#ffd36e';
      ctx.fillRect(pr.x - 8, pr.y - 1, 6, 2);
      ctx.globalAlpha = 1;
    }

    // Spiegelmatch: gleiche charId → P2 invertieren
    var same = snap.p[0] && snap.p[1] && snap.p[0].charId === snap.p[1].charId;
    for (i = 0; i < snap.p.length; i++) {
      fig(ctx, snap.p[i], true, same && i === 1);
    }
    drawFx(ctx);
    fg(ctx, snap.tick || 0);
    hud(ctx, snap, ich);
    ctx.restore();
  }

  function menueHint(r, text) {
    var ctx = r.ctx;
    if (!layers) layers = backeLayers();
    // Zeige Arena auch im Menü
    camX = Math.sin(Date.now() / 3000) * 6;
    arena(ctx, (Date.now() / 50) | 0, null);
    fg(ctx, 0);
    ctx.fillStyle = 'rgba(58,46,72,0.55)';
    ctx.fillRect(0, 0, W, 40);
    ctx.fillStyle = '#fff8ee';
    ctx.font = 'bold 16px ' + SCHRIFT;
    ctx.textAlign = 'center';
    ctx.fillText('Plaza-Kampf', W / 2, 20);
    ctx.fillStyle = '#ffd36e';
    ctx.font = '10px ' + SCHRIFT;
    ctx.fillText('la Pelea de la Plaza', W / 2, 34);
    ctx.fillStyle = 'rgba(58,46,72,0.65)';
    ctx.fillRect(40, H / 2 - 16, W - 80, 28);
    ctx.fillStyle = '#ffd36e';
    ctx.font = '12px ' + SCHRIFT;
    ctx.fillText(text || '', W / 2, H / 2 + 4);
  }

  function resetFx() {
    fx = []; delayHp = [1, 1]; flash = [0, 0]; prevSnap = null;
  }

  Plaza.Render = {
    W: W, H: H, erstelle: erstelle, zeichne: zeichne, menueHint: menueHint, resetFx: resetFx
  };
})(typeof window !== 'undefined' ? window : globalThis);
