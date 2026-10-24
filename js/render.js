/* Pixel-Canvas v1.4: 1280×768, detaillierte 4×-Sprites, Hölle. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};
  var W = 1280, H = 768;
  var BUF = 1;
  var SX = 4, SY = 768 / 180; // interne Puffer-Skala (2×/3× → schärfer auf Retina)
  var bufCanvas = null;
  var SCHRIFT = 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
  var layers = null;
  var fx = [];
  var delayHp = [1, 1];
  var flash = [0, 0];
  var prevSnap = null;
  var camX = 0;
  var shake = 0;

  /* ==== v1.6 Arena — Drop-in für js/render.js ====
   * Ersetzt in render.js den Block von `function P()` (Z. 18) bis direkt vor
   * `/* ---- Figuren` (Z. 422). P/backe/applyBuf/setzePuffer/erstelle sind
   * unverändert übernommen, alles ab `backeLayers` ist neu und nativ 1280×768.
   * Benutzt aus dem Modul-Scope: W, H, BUF, SCHRIFT, layers, camX, Plaza.
   */
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
    buf = Math.max(1, Math.min(2, buf | 0));
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
    // v1.4: logische 1280×768 — Puffer 1× (Retina-Upscale macht CSS)
    BUF = 1; void dpr;
    var ctx = canvas.getContext('2d');
    canvas.width = W * BUF;
    canvas.height = H * BUF;
    applyBuf(ctx);
    layers = backeLayers();
    return { canvas: canvas, ctx: ctx, w: W, h: H, buf: BUF };
  }

  /* ---- Arena v1.6: nativ, 1 Layer-Pixel = 1 Canvas-Pixel ---- */
  var LW = 1440;                 // 1280 + 2×80 Kamera-Spiel
  var CAM_MAX = 64;              // ±64 (nicht 80): L5 (×1.15) deckt sonst den Rand nicht
  var PAR = { L0: 0.10, L1: 0.25, L2: 0.45, L3: 0.70, L4: 1.0, L5: 1.15 };
  // 12-Stufen-Glutrampe (Plaza.Palette.glut überschreibt, falls vorhanden)
  var GLUT_DEF = ['#050208', '#0c0510', '#160810', '#220a0c', '#34100a', '#4a1808',
    '#6a1c08', '#9a2408', '#d03010', '#ff4a18', '#ff9a38', '#fff0c0'];
  var MOND = { x: 1120, y: 200, r: 100 };                     // L0
  var KRATER = [[280, 270], [780, 196], [1300, 286]];         // L1, Vulkan-Spitzen
  var GLOCKE = { x: 875, y: 236 };                            // L2
  var NEON = { x: 540, y: 300 };                              // L2, Schild „PLAZA“
  var BRUNNEN = { x: 600, top: 362, schale: 431 };            // L3
  var KIOSK = { x: 1120, y: 432 };                            // L3, Feuerbecken
  var PUBLIKUM = [[404, 468, 0], [446, 474, 1], [748, 470, 1], [790, 466, 0], [836, 474, 1],
    [960, 468, 0], [1010, 472, 1], [1214, 466, 0], [1262, 474, 1]];  // L3: x, y-oben, Sprite
  var FACKELN = [130, 1310];                                  // L5-x, Flamme bei y 572
  var FLAMME = [
    [[-10, -22, 20, 22, '#d03010'], [-6, -34, 12, 30, '#ff7a28'], [-2, -24, 6, 18, '#fff0c0']],
    [[-12, -20, 22, 20, '#d03010'], [-4, -38, 10, 34, '#ff7a28'], [0, -26, 6, 18, '#fff0c0']],
    [[-8, -24, 18, 24, '#d03010'], [-8, -32, 12, 28, '#ff7a28'], [-4, -28, 6, 20, '#fff0c0']]
  ];
  var arenaSnap = null, hopT = 0, hitSeqAlt = null;

  function rng(seed) {
    return function () {
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Pixel-Werkzeuge für einen Back-Kontext: alles auf 2-px-Raster, keine AA-Kanten
  function werkzeug(x) {
    var pats = {};
    function R(px, py, w, h, c) { if (c) x.fillStyle = c; x.fillRect(Math.round(px), Math.round(py), Math.round(w), Math.round(h)); }
    function pat(c, lvl) {
      var k = c + lvl;
      if (pats[k]) return pats[k];
      var n = lvl === 12 ? 8 : 4;
      var cv = backe(n, n, function (q) {
        q.fillStyle = c;
        q.fillRect(0, 0, 2, 2);
        if (lvl !== 25) q.fillRect(n / 2, n / 2, 2, 2);
      });
      pats[k] = x.createPattern(cv, 'repeat');
      return pats[k];
    }
    function ell(cx, cy, rx, ry, c) {
      x.fillStyle = c;
      for (var yy = -ry; yy < ry; yy += 2) {
        var t = (yy + 1) / ry;
        var hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)) / 2) * 2;
        if (hw > 0) x.fillRect(Math.round(cx - hw), Math.round(cy + yy), hw * 2, 2);
      }
    }
    function ellPfad(cx, cy, rx, ry) {
      x.beginPath();
      for (var yy = -ry; yy < ry; yy += 2) {
        var t = (yy + 1) / ry;
        var hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)) / 2) * 2;
        if (hw > 0) x.rect(Math.round(cx - hw), Math.round(cy + yy), hw * 2, 2);
      }
    }
    function poly(pts, c) {
      x.fillStyle = c;
      var y0 = 1e9, y1 = -1e9, i, j;
      for (i = 0; i < pts.length; i++) { y0 = Math.min(y0, pts[i][1]); y1 = Math.max(y1, pts[i][1]); }
      for (var yy = Math.floor(y0 / 2) * 2; yy < y1; yy += 2) {
        var sy = yy + 1, xs = [];
        for (i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          var a = pts[i], b = pts[j];
          if ((a[1] > sy) !== (b[1] > sy)) xs.push(a[0] + (sy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        xs.sort(function (m, n) { return m - n; });
        for (var k = 0; k + 1 < xs.length; k += 2) {
          var xa = Math.round(xs[k] / 2) * 2, xb = Math.round(xs[k + 1] / 2) * 2;
          if (xb > xa) x.fillRect(xa, yy, xb - xa, 2);
        }
      }
    }
    // 2-px-Kontur: Form 4× versetzt in Schwarz, dann gefüllt
    function kpoly(pts, c) {
      var d = [[-2, 0], [2, 0], [0, -2], [0, 2]];
      for (var i = 0; i < 4; i++) poly(pts.map(function (p) { return [p[0] + d[i][0], p[1] + d[i][1]]; }), '#000');
      poly(pts, c);
    }
    function kR(px, py, w, h, c) { R(px - 2, py - 2, w + 4, h + 4, '#000'); R(px, py, w, h, c); }
    // Linie aus 2-px-Blöcken (Treppen-Look)
    function linie(x0, y0, x1, y1, d, c) {
      x.fillStyle = c;
      var n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2));
      for (var i = 0; i <= n; i++) {
        var t = i / n;
        x.fillRect(Math.round((x0 + (x1 - x0) * t) / 2) * 2, Math.round((y0 + (y1 - y0) * t) / 2) * 2, d, d);
      }
    }
    // Abdunkeln/Tönen nur auf bereits gemalten Pixeln, in 8-px-Stufen
    function toene(y0, y1, a0, a1, c) {
      x.save();
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = c || '#050208';
      for (var yy = y0; yy < y1; yy += 8) {
        x.globalAlpha = Math.max(0, Math.min(1, a0 + (a1 - a0) * (yy - y0) / Math.max(1, y1 - y0)));
        x.fillRect(0, yy, x.canvas.width, 8);
      }
      x.restore();
    }
    return { R: R, pat: pat, ell: ell, ellPfad: ellPfad, poly: poly, kpoly: kpoly, kR: kR, linie: linie, toene: toene, x: x };
  }

  function backeLayers() {
    var pal = P();
    var G = pal.glut || GLUT_DEF;

    /* L0 Himmel (Faktor 0.10): Glutbänder, Blutmond, Funken-Sterne, Rauch */
    var L0 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(100);
      var BAND = pal.himmel || ['#050208', '#0a0612', '#120810', '#1a0a0c', '#220c0a', '#2a1008', '#3a1408', '#4a1808'];
      var bh = 45, i;
      for (i = 0; i < 8; i++) {
        t.R(0, i * bh, w, bh, BAND[i]);
        if (i) {   // 4-px-Dither-Übergang: 50 % → 25 % → 12 %
          t.R(0, i * bh, w, 8, t.pat(BAND[i - 1], 50));
          t.R(0, i * bh + 8, w, 8, t.pat(BAND[i - 1], 25));
          t.R(0, i * bh + 16, w, 8, t.pat(BAND[i - 1], 12));
        }
      }
      t.R(0, 360, w, h - 360, G[5]);                 // Horizont-Glut
      t.R(0, 360, w, 8, t.pat(BAND[7], 50));
      t.R(0, 368, w, 8, t.pat(BAND[7], 25));
      t.R(0, 392, w, 8, t.pat(G[6], 12));
      t.R(0, 400, w, 8, t.pat(G[6], 25));
      // Funken-Sterne
      for (i = 0; i < 90; i++) {
        var sx = Math.round(r() * w / 2) * 2, sy = Math.round(r() * 160) * 2;
        var dx = sx - MOND.x, dy = sy - MOND.y;
        if (dx * dx + dy * dy < 170 * 170) continue;
        var k = r();
        if (k < 0.12) {   // Kreuz-Funke
          t.R(sx, sy - 2, 2, 6, G[8]); t.R(sx - 2, sy, 6, 2, G[8]); t.R(sx, sy, 2, 2, G[10]);
        } else t.R(sx, sy, 2, 2, k < 0.5 ? G[6] : (k < 0.85 ? G[7] : '#ff6020'));
      }
      // Rauchfahnen (3), knapp über Himmelston
      function rauch(x0, y0, x1, y1, r0, r1, ph) {
        for (var s = 0; s <= 24; s++) {
          var q = s / 24, rr = r0 + (r1 - r0) * q;
          var cx = x0 + (x1 - x0) * q, cy = y0 + (y1 - y0) * q + Math.sin(q * 6 + ph) * 14;
          t.ell(cx, cy, rr * 1.6, rr * 0.7, t.pat('#140a14', 50));
          t.ell(cx + 4, cy + 2, rr * 1.1, rr * 0.45, '#120812');
        }
      }
      rauch(250, 300, 640, 120, 14, 40, 0);
      rauch(720, 230, 1000, 70, 18, 46, 2);
      rauch(1330, 310, 1440, 210, 12, 30, 4);
      // Blutmond r≈104: Halo, Körper, Krater, Schatten-Sichel
      var mx = MOND.x, my = MOND.y, mr = MOND.r;
      t.ell(mx, my, mr + 50, mr + 50, t.pat(G[5], 25));
      t.ell(mx, my, mr + 26, mr + 26, t.pat(G[6], 50));
      t.ell(mx, my, mr + 8, mr + 8, G[6]);
      t.ell(mx, my, mr, mr, '#c02a08');
      x.save();
      t.ellPfad(mx, my, mr, mr); x.clip();
      t.ell(mx - 16, my - 16, mr - 16, mr - 16, G[8]);
      t.ell(mx - 34, my - 38, 44, 40, t.pat(G[9], 50));
      t.ell(mx - 40, my - 44, 22, 20, G[9]);
      var KR = [[-50, -10, 16], [-10, -50, 12], [20, 10, 22], [-30, 40, 14], [40, -30, 10], [10, 60, 10], [-64, 30, 8], [60, 40, 12]];
      for (i = 0; i < KR.length; i++) {
        var kx = mx + KR[i][0], ky = my + KR[i][1], kr = KR[i][2];
        t.ell(kx - 2, ky - 2, kr, kr * 0.8, '#ff6a28');
        t.ell(kx, ky, kr, kr * 0.8, G[7]);
        t.ell(kx + 2, ky + 2, kr * 0.7, kr * 0.55, G[6]);
      }
      t.ell(mx + 46, my + 18, mr, mr, t.pat('#3a0c08', 50));
      t.ell(mx + 62, my + 26, mr - 4, mr - 4, '#2a0808');
      t.ell(mx + 70, my + 30, mr - 10, mr - 10, t.pat('#1a0606', 50));
      x.restore();
    });

    /* L1 Fern (0.25): Vulkane mit Krater-Glow + Rinnsal, Lava-Meer, Aschehügel */
    var L1 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(200), i;
      function vulkan(vx, py, bw, cw) {
        var hh = 420 - py;
        t.ell(vx, py - 14, cw + 40, 34, t.pat(G[6], 25));       // Glow über Krater
        t.ell(vx, py - 6, cw + 18, 16, t.pat(G[7], 50));
        var pts = [[vx - bw, 424], [vx - bw * 0.42, 420 - hh * 0.5], [vx - cw - 6, py + 8], [vx - cw, py],
          [vx + cw, py], [vx + cw + 6, py + 8], [vx + bw * 0.4, 420 - hh * 0.52], [vx + bw, 424]];
        t.poly(pts, '#12070c');
        // Lichtflanke links (Mond/Glut), Rinnen
        t.poly([[vx - bw * 0.42, 420 - hh * 0.5], [vx - cw - 6, py + 8], [vx - cw, py], [vx - cw + 10, py + 6],
          [vx - bw * 0.2, 420 - hh * 0.35], [vx - bw * 0.6, 424], [vx - bw, 424]], '#1e0c0e');
        for (var g = -2; g <= 2; g++) {
          if (!g) continue;
          t.linie(vx + g * cw * 0.5, py + 10, vx + g * bw * 0.35, 420, 2, '#0a0408');
        }
        // Krater
        t.ell(vx, py, cw, 6, G[8]);
        t.ell(vx, py - 2, cw - 8, 3, G[10]);
        // Rinnsal
        var lx = vx + 4, len = hh * 0.85;
        for (var s = 0; s < len; s += 4) {
          lx += Math.round((r() - 0.45) * 2) * 2;
          var c = s < len * 0.35 ? G[8] : (s < len * 0.7 ? G[7] : G[6]);
          t.R(lx, py + 4 + s, s < len * 0.5 ? 4 : 2, 4, c);
          if (s < 40) t.R(lx + 1, py + 4 + s, 2, 4, G[10]);
        }
      }
      vulkan(280, KRATER[0][1], 230, 18);
      vulkan(780, KRATER[1][1], 320, 26);
      vulkan(1300, KRATER[2][1], 210, 16);
      // Lava-Meer am Horizont
      t.R(0, 404, w, 30, G[3]);
      t.R(0, 404, w, 2, G[6]);
      for (i = 0; i < 220; i++) {
        var sy = 406 + Math.round(r() * 12) * 2, sl = 8 + Math.round(r() * 16) * 2;
        var q = r();
        t.R(Math.round(r() * w / 2) * 2, sy, sl, 2, q < 0.6 ? G[5] : (q < 0.9 ? G[6] : G[7]));
      }
      for (i = 0; i < 12; i++) {   // Mondspiegelung
        var rw = 60 - i * 4;
        t.R(MOND.x + 20 - rw / 2 + (i % 2) * 6, 406 + i * 2, rw, 2, i < 4 ? G[8] : G[7]);
      }
      // Aschehügel, 2 Ketten
      function huegel(yb, amp, ph, c) {
        var pts = [[0, h]];
        for (var hx = 0; hx <= w; hx += 40) pts.push([hx, yb - Math.abs(Math.sin(hx / 170 + ph)) * amp - Math.sin(hx / 57 + ph) * 4]);
        pts.push([w, h]);
        t.poly(pts, c);
      }
      huegel(436, 20, 0.4, '#1a0a0e');
      huegel(452, 14, 2.1, '#120810');
      t.R(0, 470, w, h - 470, '#0c0610');
      // atmosphärische Tiefe: Richtung Himmelston entsättigen
      t.toene(180, 440, 0.16, 0.08, G[5]);
    });

    /* L2 Stadt (0.45): Häuserreihen, Arkaden, Kirchenruine mit Glocke, Ketten- und Knochen-Leinen */
    var L2 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(300), i;
      // hintere Reihe, durchgehend
      var pts = [[0, 530]];
      for (var hx = 0; hx <= w; hx += 48) {
        var top = 380 + Math.round(r() * 20) * 2;
        pts.push([hx, top]); pts.push([hx + 40, top]); pts.push([hx + 44, top + 8 + Math.round(r() * 6) * 2]);
      }
      pts.push([w, 530]);
      t.poly(pts, '#120c12');
      for (i = 0; i < 40; i++) t.R(Math.round(r() * w / 4) * 4, 400 + Math.round(r() * 30) * 2, 4, 6, r() < 0.5 ? G[4] : G[5]);

      function fenster(fx, fy, fw, fh, an) {
        t.R(fx - 2, fy - 2, fw + 4, fh + 4, '#08060a');
        if (!an) { t.R(fx, fy, fw, fh, '#0e0a10'); return; }
        t.R(fx, fy, fw, fh, G[7]);
        t.R(fx, fy + fh - 4, fw, 4, G[8]);
        t.R(fx + 2, fy + 2, 2, Math.max(2, fh - 8), G[9]);
        t.R(fx + fw / 2 - 1, fy, 2, fh, '#08060a');      // Sprosse
      }
      function haus(hx0, top, hw, seed) {
        var q = rng(seed);
        t.kR(hx0, top, hw, 530 - top, '#1a1218');
        t.R(hx0, top, 4, 530 - top, '#221820');            // Lichtkante
        t.R(hx0, top + 10, hw, 4, '#100a10');
        for (var z = 0; z < hw; z += 16) {                // Zinnen, z. T. abgebrochen
          var zh = q() < 0.3 ? 4 : 12;
          t.R(hx0 + z, top - zh, 10, zh, '#1a1218');
        }
        for (var fy = top + 26; fy < 470; fy += 46) {
          for (var fx = hx0 + 12; fx + 18 < hx0 + hw; fx += 30) fenster(fx, fy, 16, 24, q() < 0.55);
        }
        // Risse
        var rx = hx0 + hw * (0.3 + q() * 0.4), ry = top + 14;
        for (var s = 0; s < 10; s++) { t.R(rx, ry, 2, 8, '#06040a'); rx += Math.round((q() - 0.5) * 3) * 2; ry += 8; }
      }
      haus(40, 306, 96, 1);
      haus(150, 336, 84, 2);
      haus(246, 290, 110, 3);
      // Arkaden-Gebäude
      var ax0 = 380, ax1 = 720;
      t.kR(ax0, 320, ax1 - ax0, 210, '#1c1418');
      t.R(ax0, 320, ax1 - ax0, 6, '#2c1e22');
      t.R(ax0, 404, ax1 - ax0, 8, '#2c1e22');              // Gesims
      t.R(ax0, 412, ax1 - ax0, 2, '#08060a');
      for (i = 0; i < 9; i++) fenster(ax0 + 16 + i * 36, 346, 18, 40, (i * 7 + 3) % 5 > 1);
      for (i = 0; i < 6; i++) {                           // Arkadenbögen
        var bx = ax0 + 14 + i * 54;
        t.R(bx, 424, 12, 106, '#2a1e22');                 // Pfeiler
        t.R(bx - 2, 420, 16, 6, '#34262a');               // Kapitell
        var cx = bx + 12 + 21;
        t.R(cx - 21, 446, 42, 84, '#08060a');
        t.ell(cx, 446, 21, 22, '#08060a');
        t.R(cx - 21, 446, 42, 2, '#08060a');
        t.R(cx - 14, 470, 28, 30, i % 2 ? G[4] : G[3]);    // Glut tief im Gang
        t.R(cx - 6, 488, 12, 12, i % 2 ? G[5] : G[4]);
      }
      t.R(ax0 + 14 + 6 * 54, 424, 12, 106, '#2a1e22');
      // Neon-Halter (Schrift selbst animiert)
      t.kR(NEON.x - 96, 262, 192, 50, '#0e0a10');
      t.R(NEON.x - 80, 312, 4, 8, '#2a1e22'); t.R(NEON.x + 76, 312, 4, 8, '#2a1e22');
      // Kirche: Turm (Ruine) + Schiff mit Rosette
      var tx = 830, tw = 90;
      t.kpoly([[tx, 530], [tx, 176], [tx + 14, 162], [tx + 26, 172], [tx + 40, 150], [tx + 58, 168], [tx + 70, 158], [tx + tw, 180], [tx + tw, 530]], '#18121a');
      t.R(tx, 180, 6, 350, '#221a24');
      for (i = 0; i < 6; i++) t.R(tx, 260 + i * 44, tw, 2, '#100a12');
      t.R(tx + 10, 200, 28, 56, '#060408');                // Schallöffnungen
      t.ell(tx + 24, 200, 14, 12, '#060408');
      t.R(tx + 52, 200, 28, 56, '#060408');
      t.ell(tx + 66, 200, 14, 12, '#060408');
      t.ell(GLOCKE.x, GLOCKE.y - 6, 10, 12, G[7]);         // Glocke glüht
      t.R(GLOCKE.x - 12, GLOCKE.y, 24, 8, G[7]);
      t.R(GLOCKE.x - 8, GLOCKE.y - 14, 4, 18, G[9]);
      t.R(GLOCKE.x - 2, GLOCKE.y + 8, 4, 4, G[10]);
      t.ell(tx + 45, 312, 20, 20, '#2a1e22');              // Uhr, zerbrochen
      t.ell(tx + 45, 312, 16, 16, '#0a070c');
      t.linie(tx + 45, 312, tx + 52, 300, 2, G[6]);
      t.linie(tx + 45, 312, tx + 36, 318, 2, G[6]);
      fenster(tx + 36, 360, 18, 44, true);
      // Schiff mit Giebel (rechts abgebrochen)
      var sx0 = 920, sx1 = 1190, gm = 1052;
      t.kpoly([[sx0, 530], [sx0, 340], [gm, 266], [gm + 40, 290], [gm + 54, 280], [gm + 70, 306], [sx1 - 30, 330], [sx1, 352], [sx1, 530]], '#1a121a');
      t.poly([[sx0, 340], [gm, 266], [gm, 278], [sx0 + 12, 346]], '#2c1e22');
      t.R(sx0, 340, sx1 - sx0, 4, '#100a12');
      var rx0 = gm, ry0 = 380;                            // Rosette
      t.ell(rx0, ry0, 46, 46, '#000');
      t.ell(rx0, ry0, 44, 44, '#2c1e22');
      t.ell(rx0, ry0, 36, 36, G[7]);
      t.ell(rx0, ry0, 28, 28, t.pat(G[8], 50));
      for (i = 0; i < 8; i++) {
        var a = i * Math.PI / 4;
        t.linie(rx0, ry0, rx0 + Math.cos(a) * 36, ry0 + Math.sin(a) * 36, 4, '#140c12');
      }
      t.ell(rx0, ry0, 8, 8, G[9]);
      t.ell(rx0, ry0, 4, 4, G[10]);
      t.R(gm - 30, 452, 60, 78, '#08060a');                // Portal
      t.ell(gm, 452, 30, 28, '#08060a');
      t.R(gm - 20, 474, 40, 56, G[3]);
      t.R(gm - 2, 452, 4, 78, '#08060a');
      fenster(sx0 + 30, 380, 20, 56, true); fenster(sx1 - 50, 390, 20, 50, false);
      // rechte Häuser
      haus(1200, 318, 96, 4);
      haus(1308, 298, 120, 5);
      // Ketten- und Knochen-Leinen
      function leine(x0, y0, x1, y1, sag) {
        var n = Math.round((x1 - x0) / 4);
        for (var s = 0; s <= n; s++) {
          var q = s / n, lx = x0 + (x1 - x0) * q, ly = y0 + (y1 - y0) * q + Math.sin(q * Math.PI) * sag;
          t.R(Math.round(lx / 2) * 2, Math.round(ly / 2) * 2, s % 2 ? 4 : 2, 2, s % 2 ? '#3a2a20' : '#2a1e18');
          if (s % 9 === 4 && s < n - 2) {
            if (s % 18 === 4) {   // Schädel
              t.R(lx - 4, ly + 6, 10, 8, '#4a3a30'); t.R(lx - 2, ly + 14, 6, 2, '#4a3a30');
              t.R(lx - 2, ly + 8, 2, 2, '#0a0606'); t.R(lx + 2, ly + 8, 2, 2, '#0a0606');
              t.R(lx, ly, 2, 6, '#2a1e18');
            } else {             // Knochen
              t.R(lx, ly + 2, 2, 12, '#4a3a30'); t.R(lx - 2, ly + 12, 6, 2, '#4a3a30');
            }
          }
        }
      }
      leine(136, 330, 380, 334, 40);
      leine(720, 330, 830, 290, 30);
      leine(1190, 360, 1308, 316, 26);
      leine(246, 310, 150, 340, 14);
      // unten zum Kampfstreifen hin ruhig/dunkel
      t.toene(430, 530, 0, 0.7);
    });

    /* L3 Plaza (0.70): Balustrade, Lava-Brunnen, Café-Ruine, tote Palmen, Feuer-Kiosk */
    var L3 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(400), i;
      // ferner Platzboden
      t.R(0, 520, w, 80, '#100a0e');
      for (i = 0; i < 6; i++) t.R(0, 526 + i * 12 + i * i, w, 2, '#0a060a');
      // Balustrade (Publikum steht dahinter)
      t.R(0, 512, w, 6, '#1e1418');
      t.R(0, 510, w, 2, '#000');
      for (var bx = 0; bx < w; bx += 16) { t.R(bx + 4, 518, 8, 22, '#18101a'); t.R(bx + 6, 524, 4, 8, '#120a12'); }
      t.R(0, 540, w, 6, '#1a1016');

      // Café-Ruine links
      t.kR(40, 352, 320, 248, '#1a1016');
      t.R(40, 352, 320, 6, '#2a1c20');
      t.R(56, 372, 150, 26, '#0c080c');                    // Schild
      x.font = 'bold 22px ' + SCHRIFT; x.textAlign = 'center';
      x.fillStyle = G[7]; x.fillText('CAFÉ', 131, 393);
      x.fillStyle = '#4a3a30'; x.fillText('del infierno', 288, 392);
      for (i = 0; i < 3; i++) {                            // Fenster/Tür
        t.R(64 + i * 96, 460, 64, 140, '#08060a');
        t.R(70 + i * 96, 470, 52, 40, i === 1 ? G[5] : G[4]);
        t.R(70 + i * 96, 498, 52, 12, i === 1 ? G[6] : G[5]);
      }
      // Markise in Fetzen (cafeSchirm A/B)
      var sA = pal.cafeSchirmA || '#5a1008', sB = pal.cafeSchirmB || '#2a0808';
      t.R(36, 404, 328, 6, '#2a1e22');
      for (var m = 0; m < 14; m++) {
        if (m === 4 || m === 10) continue;                 // fehlende Bahnen
        var len = 22 + Math.round(r() * 14) * 2;
        var mx = 38 + m * 23;
        t.R(mx, 410, 22, len, m % 2 ? sB : sA);
        t.R(mx, 410, 22, 4, '#000');
        for (var f = 0; f < 22; f += 6) t.R(mx + f, 410 + len, 4, 2 + Math.round(r() * 5) * 2, m % 2 ? sB : sA);
        if (m % 3 === 0) t.R(mx + 8, 410 + len - 6, 6, 6, G[6]);   // Glutrand
      }
      t.linie(38 + 4 * 23, 410, 38 + 4 * 23 + 10, 456, 2, sA);     // hängender Fetzen
      // Bistro-Tische, umgekippte Stühle (sehr dunkel)
      function tisch(tx0) {
        t.ell(tx0, 552, 22, 4, '#0c080c'); t.R(tx0 - 2, 554, 4, 30, '#0c080c'); t.R(tx0 - 12, 582, 24, 4, '#0c080c');
      }
      tisch(110); tisch(270);
      t.linie(150, 590, 176, 566, 4, '#0c080c'); t.linie(160, 590, 150, 572, 4, '#0c080c');

      // Lava-Brunnen (Blickfang, links der Mitte)
      var B = BRUNNEN.x;
      t.ell(B, 434, 90, 30, t.pat(G[5], 25));             // Glow-Halo
      t.kR(B - 130, 528, 260, 62, '#1a1214');              // Becken-Front
      for (var ry = 528; ry < 590; ry += 14) {
        t.R(B - 130, ry, 260, 2, '#0e0a0c');
        for (var rx = B - 130 + ((ry / 14) % 2) * 14; rx < B + 130; rx += 28) t.R(rx, ry, 2, 14, '#0e0a0c');
        t.R(B - 130, ry + 2, 260, 2, '#221a1e');
      }
      t.ell(B, 528, 136, 16, '#000');
      t.ell(B, 528, 134, 14, '#2a1e22');
      t.ell(B, 528, 122, 9, G[4]);
      for (i = 0; i < 16; i++) t.R(B - 110 + Math.round(r() * 110) * 2, 522 + Math.round(r() * 5) * 2, 6 + Math.round(r() * 6) * 2, 2, G[5]);
      t.kR(B - 12, 444, 24, 84, '#221820');                // Säule
      for (i = 0; i < 4; i++) t.R(B - 14, 458 + i * 18, 28, 4, '#2c2026');
      t.kpoly([[B - 60, BRUNNEN.schale], [B + 60, BRUNNEN.schale], [B + 30, 450], [B - 30, 450]], '#261c22');
      t.ell(B, BRUNNEN.schale, 62, 10, '#2c2026');
      t.ell(B, BRUNNEN.schale, 52, 6, G[8]);
      t.ell(B, BRUNNEN.schale - 2, 34, 3, G[10]);
      t.R(B - 56, 438, 2, 86, G[7]); t.R(B + 54, 438, 2, 86, G[7]);   // Überlauf
      t.R(B - 54, 438, 2, 20, G[9]); t.R(B + 52, 438, 2, 20, G[9]);
      t.R(B - 6, 392, 12, 40, '#221820');                  // obere Schale
      t.ell(B, 390, 28, 6, '#2c2026');
      t.ell(B, 389, 22, 3, G[8]);
      // Dämonenkopf-Speier
      t.kR(B - 10, 366, 20, 18, '#2a1e22');
      t.R(B - 14, 360, 4, 8, '#2a1e22'); t.R(B + 10, 360, 4, 8, '#2a1e22');
      t.R(B - 6, 372, 4, 2, G[9]); t.R(B + 2, 372, 4, 2, G[9]);
      t.R(B - 4, 378, 8, 4, G[8]);

      // tote Palmen
      function palme(px, py, lean, seed) {
        var q = rng(seed), top = 318, n = Math.round((py - top) / 10), cx = px, cy = py;
        for (var s = 0; s < n; s++) {
          var k = s / n;
          cx = px + lean * k * k * 60; cy = py - s * 10;
          t.R(cx - 8, cy - 10, 16, 10, '#000');
          t.R(cx - 6, cy - 10, 12, 10, s % 3 === 2 ? '#120a08' : '#2a1810');
          t.R(cx - 6, cy - 2, 12, 2, '#1a0e08');
          t.R(cx - 6, cy - 10, 2, 8, '#3a2216');
        }
        var kx = cx, ky = cy - 10;
        t.ell(kx, ky, 10, 8, '#1a0e08');
        for (var fr = 0; fr < 7; fr++) {                   // hängende Wedel
          var a = -Math.PI + fr * Math.PI / 6 + (q() - 0.5) * 0.3;
          var lenF = 60 + q() * 40, ex = kx, ey = ky;
          for (var s2 = 0; s2 < lenF; s2 += 4) {
            var p = s2 / lenF;
            ex = kx + Math.cos(a) * s2;
            ey = ky + Math.sin(a) * s2 * 0.6 + p * p * 70;
            var d = p < 0.5 ? 6 : (p < 0.8 ? 4 : 2);
            t.R(ex, ey, d, d, '#1a1008');
            if (s2 % 8 === 0 && p > 0.2) t.R(ex, ey + d, 2, 6 + Math.round(q() * 4) * 2, '#140c06');
          }
          t.R(ex, ey, 2, 2, q() < 0.6 ? G[7] : G[6]);       // Glut-Spitze
        }
      }
      palme(880, 600, 0.6, 7);
      palme(1330, 600, -0.5, 9);

      // Feuer-Kiosk
      var kx0 = 1060, kx1 = 1180;
      t.kR(kx0, 470, kx1 - kx0, 130, '#1c1012');
      t.R(kx0 + 10, 488, kx1 - kx0 - 20, 30, G[4]);
      t.R(kx0 + 10, 510, kx1 - kx0 - 20, 8, G[5]);
      t.R(kx0, 518, kx1 - kx0, 6, '#2a1c20');
      t.kpoly([[kx0 - 14, 472], [kx1 + 14, 472], [kx1 - 4, 446], [kx0 + 4, 446]], pal.dach || '#3a1010');
      for (i = 0; i < 6; i++) t.R(kx0 - 8 + i * 22, 466, 12, 6, pal.dach2 || '#2a0c0c');
      t.kR(KIOSK.x - 18, KIOSK.y, 36, 14, '#2a1e22');       // Feuerbecken
      t.R(KIOSK.x - 14, KIOSK.y, 28, 4, G[8]);
      x.font = 'bold 14px ' + SCHRIFT; x.fillStyle = G[6]; x.fillText('FUEGO', 1120, 506);

      // zum Kampfstreifen hin ruhig/dunkel
      t.toene(470, 600, 0.05, 0.62);
    });

    /* L4 Boden (1.0): Pflaster mit Perspektive, 3-Ton-Fugen, Medaillon, Asche; Risse separat */
    var VX = 720, VY = 260, ROWS = [6, 8, 10, 8, 8, 14, 16, 18, 20, 22, 24, 26, 30];
    var RISSE = (function () {
      var q = rng(4040), out = [], starts = [[150, 652], [360, 690], [520, 648], [960, 660], [1120, 700], [1290, 650], [860, 740]];
      for (var c = 0; c < starts.length; c++) {
        var cx = starts[c][0], cy = starts[c][1], dir = q() < 0.5 ? -1 : 1;
        for (var s = 0; s < 14; s++) {
          var dx = dir * (6 + Math.round(q() * 6) * 2), dy = Math.round(q() * 4) * 2 - 2;
          if (cy + dy < 648 || cy + dy > 760) dy = -dy;
          out.push([Math.min(cx, cx + dx), cy, Math.abs(dx) + 4, 4, 1]);
          out.push([cx + dx, Math.min(cy, cy + dy), 4, Math.abs(dy) + 4, 1]);
          if (q() < 0.2) out.push([cx + dx, cy + 4, 2, 10 + Math.round(q() * 6) * 2, 0]);  // Ast
          cx += dx; cy += dy;
          if (q() < 0.15) dir = -dir;
        }
      }
      return out;
    })();
    var L4 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(500), i;
      var STEIN = ['#1c1210', '#170f0d', '#221612'];
      t.R(0, 600, w, h - 600, '#0a0606');
      var y = 600;
      for (var ri = 0; ri < ROWS.length && y < h; ri++) {
        var rh = ROWS[ri], sc = (y + rh / 2 - VY) / (768 - VY), u = 44;
        var kmin = Math.floor((-VX / sc) / u) - 2, kmax = Math.ceil(((w - VX) / sc) / u) + 2;
        for (var k = kmin; k < kmax; k++) {
          var off = (ri % 2) * 0.5;
          var xa = Math.round((VX + (k + off) * u * sc) / 2) * 2, xb = Math.round((VX + (k + 1 + off) * u * sc) / 2) * 2;
          var c = STEIN[Math.floor(r() * 3)];
          t.R(xa, y + 2, xb - xa, rh - 2, c);
          if (rh >= 8) t.R(xa, y + 2, xb - xa - 2, 2, ri === 5 ? '#3a2018' : '#2a1a14');   // Licht-Oberkante
          if (rh >= 10) t.R(xa, y + rh - 2, xb - xa, 2, '#120a08');                         // Schattenkante
          t.R(xb - 4, y + 2, 2, rh - 2, '#140c0a');                                           // Fuge, Mittelton
          t.R(xb - 2, y, 2, rh, '#0a0606');                                                   // Fuge, dunkel
          if (rh >= 14 && r() < 0.18) t.R(xa + 6 + Math.round(r() * 4) * 2, y + 6, 6, 2, '#0e0806');  // Abplatzer
        }
        y += rh;
      }
      // Medaillon (perspektivisch flach)
      var mx = 720, my = 704;
      t.ell(mx, my, 152, 46, '#0a0606');
      t.ell(mx, my, 146, 42, G[6]);
      t.ell(mx, my, 136, 38, '#1a0c0a');
      t.ell(mx, my, 128, 34, '#221210');
      for (i = 0; i < 8; i++) {
        var a = i * Math.PI / 4 + Math.PI / 8;
        t.poly([[mx, my], [mx + Math.cos(a - 0.2) * 34, my + Math.sin(a - 0.2) * 10],
          [mx + Math.cos(a) * 122, my + Math.sin(a) * 32], [mx + Math.cos(a + 0.2) * 34, my + Math.sin(a + 0.2) * 10]], i % 2 ? G[4] : G[5]);
      }
      t.ell(mx, my, 26, 8, '#0a0606');
      t.ell(mx, my, 22, 7, G[7]);
      t.ell(mx, my, 12, 4, G[8]);
      // Glut-Halo um Risse (statisch), Ascheflecken
      for (i = 0; i < RISSE.length; i += 3) t.ell(RISSE[i][0] + 4, RISSE[i][1] + 2, 14, 6, t.pat(G[3], 50));
      for (i = 0; i < 16; i++) {
        t.ell(40 + Math.round(r() * 680) * 2, 652 + Math.round(r() * 50) * 2, 20 + r() * 30, 4 + r() * 6, t.pat('#050208', 50));
      }
      // ferne Reihen (600–640) dunkler, Pflasterkante bei BODEN bleibt hell
      t.toene(600, 640, 0.6, 0.2);
    });
    // Risse in 3 Rottönen (Rotation alle 16 Ticks), nur y 600–768
    function risse(c, kern) {
      return backe(LW, 168, function (x) {
        x.translate(0, -600);
        for (var i = 0; i < RISSE.length; i++) {
          var s = RISSE[i];
          x.fillStyle = c; x.fillRect(s[0], s[1], s[2], s[3]);
          if (s[4] && s[2] > 6) { x.fillStyle = kern; x.fillRect(s[0] + 2, s[1] + 1, s[2] - 4, 2); }
        }
      });
    }
    var L4r = [risse(G[7], G[8]), risse(G[8], G[9]), risse(G[6], G[7])];

    /* L5 Vorder (1.15): Schädel, verkohlte Bank; Fackeln separat (L5f, Transparenz pro Seite) */
    var L5 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x);
      var K = pal.knochen || '#4a3a30';
      function schaedel(sx, sy, s) {
        t.kR(sx, sy, 22 * s, 18 * s, K);
        t.R(sx + 4 * s, sy + 18 * s, 14 * s, 6 * s, K);
        t.R(sx + 2 * s, sy + 2 * s, 8 * s, 4 * s, '#6a5848');
        t.R(sx + 4 * s, sy + 8 * s, 6 * s, 6 * s, '#0a0606'); t.R(sx + 12 * s, sy + 8 * s, 6 * s, 6 * s, '#0a0606');
        t.R(sx + 6 * s, sy + 10 * s, 2, 2, G[7]); t.R(sx + 14 * s, sy + 10 * s, 2, 2, G[7]);
        t.R(sx + 10 * s, sy + 16 * s, 2 * s, 2 * s, '#0a0606');
        for (var z = 0; z < 4; z++) t.R(sx + (5 + z * 3) * s, sy + 20 * s, 2, 4 * s, '#1a1010');
      }
      t.kR(80, 752, 120, 8, '#3a2a20');                   // Knochenhaufen
      t.linie(84, 748, 150, 760, 4, K); t.linie(120, 744, 196, 756, 4, '#3a2a20');
      schaedel(96, 712, 2);
      schaedel(150, 736, 1);
      schaedel(60, 744, 1);
      // verkohlte Bank
      t.kR(1220, 694, 150, 10, '#1a1008');
      t.kR(1220, 708, 150, 10, '#160c06');
      t.R(1240, 698, 40, 2, G[6]); t.R(1310, 712, 30, 2, G[5]);
      t.kR(1230, 718, 10, 46, '#120a06'); t.kR(1350, 718, 10, 46, '#120a06');
      t.kR(1226, 664, 150, 8, '#1a1008');                 // Lehne, schief
      t.R(1300, 664, 20, 8, '#000');
    });
    var L5f = backe(LW, H, function (x) {
      var t = werkzeug(x);
      for (var i = 0; i < FACKELN.length; i++) {
        var fx = FACKELN[i];
        t.kR(fx - 4, 590, 8, 178, '#1a1018');
        t.R(fx - 4, 590, 2, 178, '#2a2028');
        for (var b = 0; b < 4; b++) t.R(fx - 6, 620 + b * 36, 12, 4, '#2a1e22');
        t.kpoly([[fx - 16, 568], [fx + 16, 568], [fx + 8, 590], [fx - 8, 590]], '#2a1e22');
        t.R(fx - 12, 568, 24, 4, G[7]);
        t.R(fx - 6, 568, 12, 2, G[9]);
      }
    });
    // Publikum-Sprites: Dämonen-Silhouetten, Rim-Light von hinten
    function daemon(armHoch) {
      return backe(40, 60, function (x) {
        var t = werkzeug(x), S = '#050208', L = G[3];
        t.R(4, 0, 4, 4, S); t.R(6, 2, 4, 6, S); t.R(8, 6, 4, 6, S);
        t.R(32, 0, 4, 4, S); t.R(30, 2, 4, 6, S); t.R(28, 6, 4, 6, S);
        t.R(13, 6, 14, 2, S); t.R(11, 8, 18, 16, S);
        t.R(8, 24, 24, 6, S); t.R(2, 28, 36, 32, S);
        if (armHoch) { t.R(0, 8, 6, 22, S); t.R(0, 4, 4, 6, S); }
        t.R(13, 6, 14, 2, L); t.R(2, 28, 6, 2, L); t.R(32, 28, 6, 2, L); t.R(4, 0, 2, 2, L); t.R(34, 0, 2, 2, L);
        t.R(15, 14, 4, 2, G[9]); t.R(21, 14, 4, 2, G[9]);
      });
    }
    var kegel = backe(240, 220, function (x) {
      var t = werkzeug(x);
      x.globalAlpha = 0.25; t.poly([[110, 0], [130, 0], [240, 220], [0, 220]], '#ff7a28');
      x.globalAlpha = 0.45; t.poly([[114, 0], [126, 0], [190, 220], [50, 220]], '#ff7a28');
      x.globalAlpha = 0.8; t.ell(120, 10, 40, 24, '#ff9a38');
    });

    return { L0: L0, L1: L1, L2: L2, L3: L3, L4: L4, L5: L5, lw: LW,
      L4r: L4r, L5f: L5f, daemon: [daemon(false), daemon(true)], kegel: kegel };
  }

  function ofs(par) { return Math.round(-camX * par) - 80; }

  function drawLayer(ctx, layer, par, tick) {
    if (!layer) return;
    ctx.drawImage(layer, ofs(par), 0);
  }

  // Publikum hüpft 20 Frames bei schweren Treffern (rein clientseitig aus dem Snapshot)
  function publikumHit(snap) {
    var neu = [snap.p[0].hitSeq | 0, snap.p[1].hitSeq | 0];
    if (hitSeqAlt) {
      for (var i = 0; i < 2; i++) {
        if (neu[i] !== hitSeqAlt[i] && (snap.p[i].hitKind === 'heavy' || snap.p[i].hitKind === 'throw')) hopT = 20;
      }
    }
    hitSeqAlt = neu;
  }

  function arena(ctx, tick, snap) {
    if (!layers) layers = backeLayers();
    var G = P().glut || GLUT_DEF, o, i, f;
    arenaSnap = snap || null;
    // Kamera: Spielermitte, Clamp ±CAM_MAX, Lerp 0.12 (ohne Snap: camX vom Aufrufer, z. B. Menü)
    if (snap && snap.p && snap.p.length === 2) {
      var target = ((snap.p[0].x + snap.p[1].x) / 2 - W / 2) * 0.15;
      target = Math.max(-CAM_MAX, Math.min(CAM_MAX, target));
      camX += (target - camX) * 0.12;
      publikumHit(snap);
    }
    if (hopT > 0) hopT--;

    // L0 + Blutmond-Puls
    drawLayer(ctx, layers.L0, PAR.L0, tick);
    if ((tick % 90) < 10) {
      ctx.fillStyle = 'rgba(255,60,20,0.14)';
      ctx.beginPath(); ctx.arc(MOND.x + ofs(PAR.L0), MOND.y, MOND.r + 24, 0, Math.PI * 2); ctx.fill();
    }
    // L1 + Krater-Flackern
    drawLayer(ctx, layers.L1, PAR.L1, tick);
    o = ofs(PAR.L1);
    var vf = ((tick / 6) | 0) % 4;
    for (i = 0; i < KRATER.length; i++) {
      var kx = KRATER[i][0] + o, ky = KRATER[i][1], v = (vf + i) % 4;
      ctx.fillStyle = v < 2 ? G[9] : G[10];
      ctx.fillRect(kx - 8, ky - 6 - v * 2, 16, 4 + v * 2);
      ctx.fillStyle = G[10];
      ctx.fillRect(kx - 4 + ((v * 3) % 7), ky - 14 - v * 6, 2, 4);
    }
    // L2 + Glocke + Neon „PLAZA“
    drawLayer(ctx, layers.L2, PAR.L2, tick);
    o = ofs(PAR.L2);
    ctx.globalAlpha = 0.18 + 0.12 * Math.sin(tick / 11);
    ctx.fillStyle = G[9];
    ctx.fillRect(GLOCKE.x + o - 16, GLOCKE.y - 20, 32, 34);
    ctx.globalAlpha = 1;
    var glow = (tick % 40) < 28;
    if (glow) {
      ctx.fillStyle = 'rgba(255,58,8,0.22)';
      ctx.fillRect(NEON.x + o - 92, 266, 184, 42);
    }
    ctx.fillStyle = glow ? '#ff3a08' : '#801808';
    ctx.font = 'bold 40px ' + SCHRIFT;
    ctx.textAlign = 'center';
    ctx.fillText('PLAZA', NEON.x + o, NEON.y);
    // Publikum (hinter der Balustrade von L3)
    o = ofs(PAR.L3);
    for (i = 0; i < PUBLIKUM.length; i++) {
      var pu = PUBLIKUM[i], dy = ((tick / 20 + i * 1.7) | 0) % 2 * 2;
      if (hopT > 0) dy += Math.round(Math.abs(Math.sin((20 - hopT) * 0.45 + i * 0.9)) * 14);
      ctx.drawImage(layers.daemon[hopT > 0 ? 1 - pu[2] : pu[2]], pu[0] + o - 20, pu[1] - dy);
    }
    // L3 + Brunnen (Tropfen auf Parabeln, Glitzer, Strahl) + Kiosk-Feuer
    drawLayer(ctx, layers.L3, PAR.L3, tick);
    var bx = BRUNNEN.x + o;
    f = ((tick / 5) | 0) % 4;
    ctx.fillStyle = f % 2 ? G[9] : '#ff6020';
    ctx.fillRect(bx - 2, BRUNNEN.top - 10 - f * 2, 4, 10 + f * 2);
    ctx.fillStyle = G[10];
    ctx.fillRect(bx - 1, BRUNNEN.top - 4, 2, 4);
    for (i = 0; i < 8; i++) {
      var ft = (tick + i * 3) % 24, vx = (i % 2 ? 1 : -1) * (0.8 + (i % 4) * 0.45);
      var dx = bx + vx * ft, dyy = BRUNNEN.top - 6 - 4 * ft + 0.3 * ft * ft;
      ctx.fillStyle = G[8];
      ctx.fillRect(Math.round(dx - vx * 2), Math.round(dyy + 3), 2, 2);
      ctx.fillStyle = ft < 16 ? G[10] : G[9];
      ctx.fillRect(Math.round(dx), Math.round(dyy), 4, 4);
    }
    ctx.fillStyle = G[11];
    var gs = (tick >> 2);
    for (i = 0; i < 6; i++) {
      var gh = (gs * 7 + i * 13) % 17;
      ctx.fillRect(bx - 40 + ((gh * 5 + i * 11) % 80), BRUNNEN.schale - 2 + (i % 3) * 2, 2, 2);
    }
    ctx.fillStyle = G[9];
    var sd = (tick % 30) * 3;                         // Tropfen im Überlauf
    ctx.fillRect(bx - 56, 440 + sd, 2, 6);
    ctx.fillRect(bx + 54, 440 + ((sd + 40) % 90), 2, 6);
    var kf = ((tick / 4) | 0) % 3, kxx = KIOSK.x + o;
    ctx.fillStyle = G[8]; ctx.fillRect(kxx - 12, KIOSK.y - 12 - kf * 2, 24, 12 + kf * 2);
    ctx.fillStyle = G[10]; ctx.fillRect(kxx - 6 + kf * 2, KIOSK.y - 22 + kf * 2, 8, 20 - kf * 2);
    ctx.fillStyle = G[11]; ctx.fillRect(kxx - 2, KIOSK.y - 10, 4, 8);
    // L4 + pulsierende Risse + Medaillon-Glut
    drawLayer(ctx, layers.L4, PAR.L4, tick);
    o = ofs(PAR.L4);
    var rl = layers.L4r && layers.L4r[((tick / 16) | 0) % 3];
    if (rl) ctx.drawImage(rl, o, 600);
    var pulse = 0.10 + 0.08 * Math.sin(tick / 14);
    ctx.fillStyle = 'rgba(255,58,8,' + pulse.toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(720 + o, 704, 150, 44, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,176,64,' + (pulse * 0.8).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(720 + o, 704, 30, 9, 0, 0, Math.PI * 2); ctx.fill();
    // Funkenregen: 24 Partikel, rein aus tick berechnet (keine Allokation)
    for (i = 0; i < 24; i++) {
      var life = 220 + (i * 37) % 120, ph = (tick + i * 53) % life;
      var ey = 768 - ph * (1.6 + (i % 5) * 0.3);
      if (ey < 120) continue;
      var ex = ((i * 197 + 61) % LW) + Math.sin((tick + i * 20) / 18) * 10 + ofs(PAR.L4);
      ctx.fillStyle = (ey > 480 && ey < 640) ? G[6] : (ph < life * 0.4 ? G[10] : G[8]);
      ctx.fillRect(Math.round(ex), Math.round(ey), 2, 2);
    }
  }

  function fg(ctx, tick) {
    if (!layers) return;
    drawLayer(ctx, layers.L5, PAR.L5, tick);
    var o = ofs(PAR.L5), f = ((tick / 5) | 0) % 3;
    var ps = arenaSnap && arenaSnap.p;
    for (var i = 0; i < FACKELN.length; i++) {
      var fx = FACKELN[i] + o, a = 1;
      // halbtransparent, wenn ein Spieler dahinter steht
      for (var j = 0; ps && j < ps.length; j++) if (Math.abs(ps[j].x - fx) < 56) a = 0.4;
      ctx.globalAlpha = a;
      if (layers.L5f) ctx.drawImage(layers.L5f, FACKELN[i] - 40, 520, 80, 248, fx - 40, 520, 80, 248);
      var fr = FLAMME[(f + i) % 3];
      for (var k = 0; k < 3; k++) {
        ctx.fillStyle = fr[k][4];
        ctx.fillRect(fx + fr[k][0], 568 + fr[k][1], fr[k][2], fr[k][3]);
      }
      ctx.globalAlpha = (0.13 + 0.03 * ((tick + i * 7) % 3)) * a;
      if (layers.kegel) ctx.drawImage(layers.kegel, fx - 120, 548);
      ctx.globalAlpha = 1;
    }
  }

  /* ---- Figuren (v1.4 detailliert, 4×) ---- */
  function schatten(ctx, x, yBoden, w, hoch) {
    var sc = Math.max(0.35, 1 - hoch / 240);
    var rw = Math.max(20, w * 0.62 * sc);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(Math.round(x - rw - 8), yBoden + 4, Math.round(rw * 2 + 16), 6);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(Math.round(x - rw), yBoden + 2, Math.round(rw * 2), 10);
    ctx.fillStyle = 'rgba(40,10,8,0.4)';
    ctx.fillRect(Math.round(x - rw * 0.7), yBoden + 4, Math.round(rw * 1.4), 6);
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
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  // Rechteck mit 2px-Kontur (bei 4× sonst unsichtbar dünn)
  function konturRect(ctx, x, y, w, h, fill, outline) {
    rct(ctx, x, y, w, h, fill);
    if (outline !== false) {
      var o = (typeof outline === 'string') ? outline : '#000';
      rct(ctx, x, y, w, 2, o);
      rct(ctx, x, y + h - 2, w, 2, o);
      rct(ctx, x, y, 2, h, o);
      rct(ctx, x + w - 2, y, 2, h, o);
    }
  }

  // 3-Ton-Block: Basis / Licht oben / Schatten unten, Kontur links+rechts
  function bodyBlock(ctx, x, y, w, h, col, ink) {
    var hi = hexShade(col, 28);
    var sh = hexShade(col, -32);
    rct(ctx, x, y, w, h, col);
    rct(ctx, x + 2, y + 2, Math.max(2, w - 4), 4, hi);
    rct(ctx, x + 2, y + h - 7, Math.max(2, w - 4), 5, sh);
    rct(ctx, x, y, 2, h, ink || '#000');
    rct(ctx, x + w - 2, y, 2, h, ink || '#000');
  }

  var FIG_INK = '#0a0406';
  // hw/hh = Kopf, tw = Torsobreite, lw = Beindicke, lg = Beinlänge, boot = Schuhhöhe
  var FIG_L = {
    biel:  { hw: 40, hh: 36, tw: 60, lw: 18, lg: 46, boot: 14 },
    lola:  { hw: 34, hh: 34, tw: 46, lw: 14, lg: 46, boot: 10 },
    toni:  { hw: 44, hh: 38, tw: 84, lw: 24, lg: 44, boot: 14 },
    rocco: { hw: 42, hh: 38, tw: 74, lw: 22, lg: 48, boot: 16 },
    nina:  { hw: 36, hh: 34, tw: 50, lw: 16, lg: 50, boot: 18 }
  };
  // Moves, die als Tritt (Bein statt Arm) gezeichnet werden
  var FIG_KICK = { lola: { heavy: 1, air: 1 }, nina: { heavy: 1, air: 1 } };
  var FIG_TRAIL = { biel: '#5ec8b8', lola: '#ff5a70', toni: '#ff4a18', rocco: '#a070e0', nina: '#ffe080' };
  // v1.5: Snapshot hat kein vy -> pro Spieler aus y-Differenz schätzen (nur Zahlen, keine Allokation)
  var FIG_PY = [0, 0], FIG_PT = [-1, -1], FIG_VY = [0, 0];
  // Walk 6 Frames, je Fuß [x rel., lift, knieVor]; Stand 0-3, Schwung 4-5. 12 px pro Frame = kein Sliding
  var FIG_WALK = [[18, 0, 3], [6, 0, 4], [-6, 0, 4], [-18, 3, 2], [-4, 12, 12], [10, 7, 8]];
  var FIG_WDIP = [3, -1, -1, 3, -1, -1];          // Kontakt-Dip (Doppelstand) / Passing hoch
  var FIG_WARM = [-10, -4, 4, 10, 4, -4];         // Armschwung gegenläufig zum vorderen Bein
  function figVy(p, tick) {
    var i = p.id & 1;
    if (p.grounded) { FIG_VY[i] = 0; }
    else if (tick !== FIG_PT[i]) {
      var dt = tick - FIG_PT[i];
      FIG_VY[i] = (FIG_PT[i] >= 0 && dt > 0 && dt < 6) ? (p.y - FIG_PY[i]) / dt : 0;
    }
    if (tick !== FIG_PT[i]) { FIG_PY[i] = p.y; FIG_PT[i] = tick; }
    return FIG_VY[i];
  }

  function fig(ctx, p, blink, invert) {
    var c = Plaza.Chars.finde(p.charId);
    var BODEN = Plaza.Kampf.BODEN;
    var id = c.id;
    var L = FIG_L[id] || FIG_L.biel;
    var x = Math.round(p.x), y = Math.round(p.y);
    var f = p.facing || 1;
    var w = c.w, h = c.h;
    var win = !!p._winPose;
    var crouch = !!p.crouch && !win;
    if (crouch) h = Math.floor(c.h * 0.62);
    var tick = p._tick | 0;
    var stun = p.stun > 0;
    var air = !p.grounded;
    var blk = !!p.blk && !stun;
    var art = p.atk ? p.atk.art : '';
    var mv = p.atk ? (c.moves[art] || c.moves.light) : null;
    var atkF = p.atk ? ((p.atk.frame != null) ? (p.atk.frame | 0) : (p.af | 0)) : 0;

    // Angriffs-Phase: wind (Ausholen) / hit (aktiv) / rec (Erholung)
    var phase = '', ext = 0, prog = 0;
    if (mv) {
      if (atkF < mv.startup) {
        phase = 'wind'; prog = (atkF + 1) / Math.max(1, mv.startup); ext = -0.35 * prog;
      } else if (atkF < mv.startup + mv.active) {
        phase = 'hit'; prog = (atkF - mv.startup) / Math.max(1, mv.active); ext = 1;
      } else {
        phase = 'rec'; prog = (atkF - mv.startup - mv.active) / Math.max(1, mv.recovery);
        ext = Math.max(0, 1 - prog * 1.2);
      }
    }
    var kick = !!(mv && FIG_KICK[id] && FIG_KICK[id][art]);
    var impact = !!(mv && phase === 'hit' && atkF === mv.startup);   // 1 Tick Stretch
    // Gewicht pro Move: Light schnell, Heavy schwer, Special theatralisch
    var wt = !mv ? 0 : (art === 'special' ? 3 : (art === 'heavy' ? 2 : 1));
    var moving = Math.abs(p.vx || 0) > 0.6 && !air && !crouch && !mv && !stun;
    // Walk: lokale Vorwärts-Position -> Rückwärtslauf spielt den Zyklus korrekt rückwärts
    var walk = moving ? ((Math.floor(x * f / 12) % 6) + 6) % 6 : 0;
    var wDir = moving ? ((p.vx || 0) * f > 0 ? 1 : -1) : 0;
    var vy = figVy(p, tick);

    // Idle: Atmen (Brust/Schultern), Gewichtswechsel, Look-around — Füße bleiben am Boden
    var idleOn = !mv && !stun && !air && !crouch && !blk && !moving && !win;
    var br = 0, idleX = 0, dipY = 0, look = 0, wsK = 0;
    var tp = tick + p.id * 23;
    if (idleOn) {
      var bs = Math.sin(tp * 0.075);                       // ~84 Ticks pro Atemzug
      br = Math.round(1.5 + 1.5 * bs);                     // 0..3 px Brust hoch
      var ws = Math.sin(tp * Math.PI / 40);                // alle ~40 Ticks Gewicht wechseln
      wsK = ws;
      idleX = Math.round(ws * 3);
      dipY = Math.round(Math.max(0, -bs) * 1);             // beim Ausatmen sackt die Hüfte 1 px
      var lt = (tick + p.id * 61) % 230;                   // gelegentlich umschauen
      if (lt < 34) look = (lt < 5 || lt > 28) ? -1 : -2;
      else if (lt >= 120 && lt < 136) look = 1;
      if (id === 'toni' && (tp % 224) < 16) idleX += 3;     // Schultern rollen
      if (id === 'nina') dipY += ((tp >> 4) % 2) * 2;      // wippt auf den Rollen
      if (id === 'lola') idleX += Math.round(Math.sin(tp * 0.11) * 2); // Hüftschwung
      if (id === 'rocco' && (tp % 160) < 24) br += 1;      // pumpt die Brust
      if (id === 'biel' && (tp % 176) < 16) idleX -= 3;
    }
    if (moving) dipY = FIG_WDIP[walk];
    // Angriffs-Körper: Ausholen lädt (Dip), Impact streckt, Recovery setzt sich
    if (mv) {
      if (phase === 'wind') dipY = Math.round(wt * prog * (kick ? 1 : 1.5));
      else if (impact) dipY = -wt;
      else if (phase === 'rec') dipY = Math.round(wt * (1 - prog));
    }
    if (stun) dipY = 2;
    if (win) { h = c.h; w = c.w + 8; }
    if (blink && p.invuln > 0 && (p.invuln % 2 === 0)) return;
    var lidZu = !stun && !mv && ((tick + p.id * 37) % 150) < 6;

    var farbe = invert ? c.farbe2 : c.farbe;
    var farbe2 = invert ? c.farbe : c.farbe2;
    var accent = c.accent || '#ff6020';
    var haut = c.haut || '#c09070';
    var hautD = hexShade(haut, -30);
    var hautL = hexShade(haut, 24);
    var ink = FIG_INK;

    var LK = {
      biel:  { hose: '#1e2a24', stiefel: '#1c2420', armO: farbe, armU: haut, hand: haut, t: 11 },
      lola:  { hose: '#2a1418', stiefel: '#100408', armO: haut, armU: haut, hand: haut, t: 8 },
      toni:  { hose: '#2a1a12', stiefel: '#1a1210', armO: haut, armU: haut, hand: haut, t: 15 },
      rocco: { hose: '#1a1620', stiefel: '#0e0c10', armO: farbe, armU: farbe, hand: '#d8c8b0', t: 13 },
      nina:  { hose: '#1a1410', stiefel: '#c08020', armO: farbe, armU: farbe, hand: '#1a1410', t: 9 }
    }[id] || { hose: farbe2, stiefel: ink, armO: farbe, armU: haut, hand: haut, t: 10 };

    schatten(ctx, x, BODEN, w, Math.max(0, BODEN - Math.round(p.y)));

    // Lehnen (lokal, + = nach vorn)
    var leanL = idleX;
    var stK = stun ? Math.min(1, p.stun / 10) : 0;          // Knockback klingt mit dem Stun ab
    if (stun) leanL -= Math.round(10 + 8 * stK);
    if (moving) leanL += wDir > 0 ? 3 : -2;
    var hitLean = kick ? -6 : ((id === 'rocco' && art === 'heavy') ? 20 : 6 + wt * 3);
    if (phase === 'wind') leanL -= Math.round((2 + wt * 3) * prog);
    else if (phase === 'hit') leanL += hitLean + (impact ? (kick ? -2 : 4) : 0);
    else if (phase === 'rec') leanL += Math.round((kick ? -2 : hitLean * 0.5) * (1 - prog));
    var by = y - h;

    // ---- Lokale Zeichen-Helfer (gespiegelt nach facing) ----
    var OX = 0, OY = 0;
    function M(lx, ly, ww, hh2, col) {
      if (ww <= 0 || hh2 <= 0) return;
      lx += OX; ly += OY;
      rct(ctx, f > 0 ? x + lx : x - lx - ww, by + ly, ww, hh2, col);
    }
    function K(lx, ly, ww, hh2, col) {
      M(lx, ly, ww, hh2, ink);
      M(lx + 2, ly + 2, ww - 4, hh2 - 4, col);
    }
    function P(lx, ly, ww, hh2, col) {
      K(lx, ly, ww, hh2, col);
      if (ww < 10 || hh2 < 10) return;
      var hi = hexShade(col, 26), sh = hexShade(col, -26);
      M(lx + 2, ly + 2, ww - 4, 3, hi);
      M(lx + ww - 5, ly + 5, 3, hh2 - 10, hi);
      M(lx + 2, ly + 5, 4, hh2 - 7, sh);
      M(lx + 2, ly + hh2 - 6, ww - 4, 4, sh);
    }
    function seg(x0, y0, x1, y1, t, col) {
      var dx = x1 - x0, dy = y1 - y0;
      var n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / Math.max(2, t * 0.5)));
      var r = t / 2;
      for (var i = 0; i <= n; i++) M(Math.round(x0 + dx * i / n - r), Math.round(y0 + dy * i / n - r), t, t, col);
    }
    // Polylinie mit Kontur: erst alle ink, dann Farbe, dann Lichtkante
    function glied(pts, t, col, col2) {
      var i, cc;
      for (i = 0; i + 3 < pts.length; i += 2) seg(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], t + 4, ink);
      for (i = 0; i + 3 < pts.length; i += 2) {
        cc = i === 0 ? col : (col2 || col);
        seg(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], i === 0 ? t : t - 1, cc);
      }
      var th = Math.max(2, (t / 3) | 0);
      for (i = 0; i + 3 < pts.length; i += 2) {
        cc = hexShade(i === 0 ? col : (col2 || col), 24);
        seg(pts[i], pts[i + 1] - t / 4, pts[i + 2], pts[i + 3] - t / 4, th, cc);
      }
    }
    function alpha(a) { ctx.globalAlpha = a; }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function bogen(cx0, cy0, r, a0, a1, t, col) {
      var n = 12;
      for (var i = 0; i <= n; i++) {
        var a = a0 + (a1 - a0) * i / n;
        alpha(0.12 + 0.5 * i / n);
        M(Math.round(cx0 + Math.cos(a) * r - t / 2), Math.round(cy0 + Math.sin(a) * r - t / 2), t, t, col);
      }
      alpha(1);
    }
    function stern(lx, ly, s, col) {
      M(lx - s, ly - 1, s * 2, 3, col);
      M(lx - 1, ly - s, 3, s * 2, col);
      M(lx - (s >> 1), ly - (s >> 1), 3, 3, col);
      M(lx + (s >> 1) - 2, ly + (s >> 1) - 2, 3, 3, col);
      M(lx - 2, ly - 2, 5, 5, '#fff8ee');
    }
    function sonne(cx0, cy0, r) {
      var lagen = [[r + 6, '#ff4a18', 0.35], [r, '#ffb040', 1], [Math.round(r * 0.55), '#fff0c0', 1]];
      for (var k = 0; k < lagen.length; k++) {
        var rr = lagen[k][0];
        alpha(lagen[k][2]);
        for (var dy = -rr; dy < rr; dy += 2) {
          var half = Math.round(Math.sqrt(Math.max(0, rr * rr - dy * dy)));
          M(cx0 - half, cy0 + dy, half * 2, 2, lagen[k][1]);
        }
      }
      alpha(1);
    }
    function rose(lx, ly, s) {
      var r = Math.round(12 * s);
      K(lx, ly, r, r, '#b01030');
      M(lx + 2, ly + 2, r - 4, r - 4, '#d01838');
      M(lx + 3, ly + 3, r >> 1, 2, '#ff5a70');
      M(lx + (r >> 1), ly + (r >> 1) - 1, 3, 3, '#80081c');
      M(lx + 3, ly + (r >> 1), 2, 3, '#ff8090');
      M(lx - 3, ly + r - 4, 5, 3, '#2a5a20');
    }

    // ---- Layout ----
    var hw = L.hw, hh = L.hh, tw = L.tw, lw = L.lw, bootH = L.boot;
    var legH = crouch ? 26 : L.lg;
    var tt = hh - 2 - br, tb = h - legH, hipY = tb - 6;
    var shY = tt + 7, shF = Math.round(tw * 0.18), shB = -Math.round(tw * 0.24);
    var kopfX = (crouch ? 6 : 0) + (stun ? -6 - Math.round(4 * stK) : 0) + (phase === 'hit' && !kick ? 4 : 0) +
      (phase === 'wind' ? -2 - wt : 0) + look + (moving ? wDir : 0);
    var kL = Math.round(kopfX - hw / 2);
    var ey = Math.round(hh * 0.4);

    // ---- Arm-Posen: [ellbogenX, ellbogenY, handX, handY] ----
    var sw = moving ? FIG_WARM[walk] : 0;
    var hb2 = idleOn ? Math.round(1 - br * 0.5 + wsK) : 0;      // Hände sinken beim Einatmen leicht nach
    var aF = [shF + 6 + Math.round(sw * 0.6), shY + 22, shF + 24 + sw, shY + 8 + hb2 - Math.round(Math.max(0, sw) * 0.4)];
    var aB = [shB + 10 - Math.round(sw * 0.6), shY + 24, Math.round(tw / 2) + 6 - sw, shY + 14 + hb2 - Math.round(Math.max(0, -sw) * 0.4)];
    if (id === 'toni' && !mv) aF = [shF + 4 + Math.round(sw * 0.6), shY + 24, shF + 14 + sw, shY + 40 + hb2];
    if (crouch) {
      aF = [shF + 10, shY + 16, shF + 26, shY + 2];
      aB = [shB + 12, shY + 18, Math.round(tw / 2) + 8, shY + 8];
    }
    if (blk) {
      aF = [shF + 16, shY + 20, shF + 20, shY - 6];
      aB = [shB + 14, shY + 18, shF + 14, shY + 2];
    }
    // Luft: steigen = Arme hoch, Apex = kompakt, fallen = Arme seitlich zum Balancieren
    var airK = air ? (vy < -5 ? 0 : (vy > 5 ? 2 : 1)) : 0;
    if (air && !mv && !stun) {
      if (airK === 0) { aF = [shF + 8, shY + 4, shF + 22, shY - 10]; aB = [shB - 6, shY + 6, shB - 16, shY - 6]; }
      else if (airK === 1) { aF = [shF + 12, shY + 14, shF + 22, shY + 2]; aB = [shB + 8, shY + 16, shB + 22, shY + 6]; }
      else { aF = [shF + 14, shY + 2, shF + 28, shY + 4]; aB = [shB - 10, shY + 2, shB - 24, shY - 2]; }
    }
    if (stun) {
      var fl2 = Math.round(6 * stK) + ((tick >> 2) % 2) * 2;
      aF = [shF - 2, shY + 6 - fl2, shF + 6 - fl2, shY - 18 - fl2];
      aB = [shB - 8 - fl2, shY + 4, shB - 14 - fl2, shY - 16 - fl2];
    }
    var winPulse = win && ((tick + p.id * 11) % 30) < 2;   // 1-Tick-Pulse: Arm schnellt hoch, Prop glänzt
    if (win) {
      var wp = winPulse ? 6 : 0;
      aF = [shF + 4, shY - 18 - (wp >> 1), shF + 6, shY - 38 - wp];
      aB = [shB - 4, shY - 18, shB - 6, shY - 38];
    }
    var gwx = 0, gwy = 0;
    if (mv && !kick) {
      var armLy = clamp(h - (mv.high || 56) - 16, shY - 10, shY + 24);
      var R = clamp(mv.reach * 0.5, 34, 72);
      var over = (art === 'heavy' && (id === 'biel' || id === 'toni')) ||
        (art === 'special' && id === 'toni') || (art === 'special' && id === 'biel' && phase === 'wind') ||
        (art === 'air' && id === 'toni');
      var fx, fy;
      // Ausholpunkt (prog = 1) — Startpunkt der Ghost-Spur im Active
      if (over) { gwx = shF - 6 - wt * 2; gwy = shY - 36 - wt * 3; }
      else { gwx = shF - 8 - wt * 5; gwy = shY + 6 - (wt - 1) * 3; }
      if (phase === 'wind') {
        // Ease-out: schnell hoch, kurz halten -> lesbar
        var pe = 1 - (1 - prog) * (1 - prog);
        if (over) { fx = shF - 6 - wt * 2 * pe; fy = shY - 24 - (12 + wt * 3) * pe; }
        else if (art === 'special' && id === 'nina') { fx = shF + 12; fy = shY + 14; }
        else { fx = shF - 4 - (4 + wt * 5) * pe; fy = shY + 6 - (wt - 1) * 3 * pe; }
      } else {
        fx = shF + 8 + R * ext + (impact ? 4 + wt * 2 : 0); fy = armLy;
        if (over) fy = armLy + 10 * ext;
        if (art === 'special' && id === 'toni') { fx = shF + 28; fy = h - 54; }
        if (art === 'air' && id === 'toni') { fx = shF + 18; fy = shY + 30; }
        if (art === 'heavy' && id === 'rocco') { fx = shF + 18; fy = shY + 6; }
        if (art === 'special' && id === 'nina') { fx = shF + 10 + 26 * Math.max(0.3, ext); fy = shY + 12; }
        if (art === 'special' && id === 'lola') fy = shY - 4;
      }
      aF = [Math.round((shF + fx) / 2 - (phase === 'wind' ? 6 : 0)),
        Math.round((shY + fy) / 2 + 6 * (1 - Math.max(0, ext))), Math.round(fx), Math.round(fy)];
      // Hinterer Arm als Gegengewicht: Ausholen = Deckung vor, Treffer = zur Hüfte gerissen
      if (phase === 'wind') aB = [shB + 12, shY + 18, shF + 4, shY + 4];
      else if (phase === 'hit') aB = [shB + 2, shY + 22, shB + 4 - wt * 2, shY + 14];
      else aB = [shB + 8, shY + 20, shB + 20, shY + 10];
      if (art === 'special' && (id === 'rocco' || id === 'nina')) {
        aB = [Math.round((shB + fx) / 2), aF[1] + 6, Math.round(fx) - 6, Math.round(fy) + 8];
      }
    }
    if (kick) {
      var ka = phase === 'hit' ? 6 : (phase === 'wind' ? Math.round(6 * prog) : Math.round(6 * (1 - prog)));
      if (id === 'lola') { aF = [shF + 2, shY - 12 - (ka >> 1), shF - 4, shY - 34 - ka]; aB = [shB - 10 - ka, shY + 8, shB - 24 - ka, shY + 2 - ka]; }
      else { aF = [shF - 8, shY + 14, shF - 24 - ka, shY + 8 - ka]; aB = [shB - 10, shY + 12, shB - 26 - ka, shY + 2 - (ka >> 1)]; }
    }

    // ---- Glieder ----
    function schuh(ax, ay, front) {
      var bw = lw + 10, bx0 = Math.round(ax - lw / 2 - 2);
      var col = front ? LK.stiefel : hexShade(LK.stiefel, -14);
      if (id === 'nina') {
        // Inliner: Schaft, Schnalle, Schiene, 4 Rollen
        K(bx0, ay - 4, bw, bootH - 4, col);
        M(bx0 + 2, ay - 2, bw - 4, 3, hexShade(col, 34));
        M(bx0 + 2, ay + 3, bw - 4, 2, ink);
        M(bx0 + bw - 8, ay + 6, 5, 3, '#fff0c0');
        M(bx0 + 2, ay + bootH - 8, bw - 4, 3, '#2a2a2a');
        for (var r = 0; r < 4; r++) {
          var wx = Math.round(bx0 + 1 + r * ((bw - 8) / 3));
          K(wx, ay + bootH - 7, 7, 7, front ? '#ffb040' : '#c08030');
          M(wx + 2, ay + bootH - 5, 3, 3, '#5a3010');
        }
        return;
      }
      if (id === 'lola') {
        // Flamenco-Schuh mit Absatz + Riemchen
        K(bx0 + 2, ay, bw - 4, bootH - 3, col);
        M(bx0 + 4, ay + 2, bw - 10, 2, accent);
        M(bx0 + 2, ay + bootH - 4, 5, 4, ink);
        M(bx0 + bw - 10, ay + bootH - 3, 8, 3, ink);
        return;
      }
      K(bx0, ay, bw, bootH, col);
      M(bx0 + 2, ay + 2, bw - 6, 2, hexShade(col, 28));
      M(bx0, ay + bootH - 4, bw + 1, 4, ink);
      if (id === 'biel') {
        M(bx0 + 1, ay - 4, bw - 8, 6, '#a89878');            // Wollsocke umgeschlagen
        M(bx0 + 3, ay - 3, bw - 12, 1, '#c8b898');
        M(bx0 + bw - 6, ay + 4, 3, 4, '#3a5048');
      } else if (id === 'toni') {
        K(bx0 + bw - 9, ay + 3, 9, bootH - 6, '#7a7a84');      // Stahlkappe
        M(bx0 + bw - 7, ay + 4, 4, 2, '#b0b0b8');
        for (var tl = 0; tl < 3; tl++) M(bx0 + 6 + tl * 4, ay + 3, 2, 2, '#5a4030');
      } else if (id === 'rocco') {
        for (var rl = 0; rl < 3; rl++) M(bx0 + 6, ay + 3 + rl * 3, bw - 14, 1, '#4a4a50');
        for (var rs = 0; rs < bw; rs += 5) M(bx0 + rs, ay + bootH - 2, 3, 2, '#2a2a30'); // Profil
      }
    }
    function bein(hx0, hy0, kx, ky, ax, ay, col, front) {
      glied([hx0, hy0, kx, ky, ax, ay], lw, col, hexShade(col, -8));
      if (id === 'nina') {
        K(kx - lw / 2 - 1, ky - 6, lw + 2, 12, '#141414');
        M(kx - lw / 2 + 1, ky - 4, lw - 2, 3, accent);
      } else if (id === 'rocco') {
        var tx = Math.round((hx0 + kx) / 2), ty = Math.round((hy0 + ky) / 2);
        K(tx - 4, ty - 4, 12, 11, hexShade(col, 10));
        M(tx - 2, ty - 2, 8, 2, ink);
      } else if (id === 'biel' && front) {
        K(kx - 5, ky - 4, 10, 9, '#2a3a30');
        M(kx - 3, ky - 2, 2, 1, '#5a7068'); M(kx + 1, ky + 2, 2, 1, '#5a7068');
      } else {
        M(kx - lw / 2 + 2, ky - 2, lw - 4, 3, hexShade(col, 22));
      }
      schuh(ax, ay, front);
    }
    function standBein(hx0, fx0, lift, kf, col, front) {
      var ay = h - bootH - lift, hy = hipY + dipY;
      // Dip beugt das Knie nach vorn statt das Bein zu stauchen
      var kx = Math.round((hx0 + fx0) / 2 + kf + Math.max(0, dipY) * 1.5), ky = Math.round(hy + (ay - hy) * 0.5 - lift * 0.4);
      bein(hx0, hy, kx, ky, fx0, ay, col, front);
    }
    function beine() {
      var hf = Math.round(tw * 0.14 + leanL * 0.8), hb = Math.round(-tw * 0.14 + leanL * 0.8);
      var bf = Math.round(tw * 0.14), bb = Math.round(-tw * 0.14);
      var colF = LK.hose, colB = hexShade(LK.hose, -14);
      var hy = hipY + dipY;
      if (crouch) {
        bein(hb, hy, hb + 2, h - lw / 2 - 2, hb - 16, h - bootH, colB, false);
        bein(hf, hy, hf + 22, hy + 2, hf + 12, h - bootH, colF, true);
        return;
      }
      if (air) {
        if (stun || mv || airK === 1) {         // Apex / Treffer: kompakt
          bein(hb, hy, hb + 12, hy + 12, hb - 4, hy + 24, colB, false);
          if (!kick) bein(hf, hy, hf + 20, hy + 2, hf + 6, hy + 18, colF, true);
        } else if (airK === 0) {                // Steigen: Absprungbein lang, vorderes Knie hoch
          bein(hb, hy, hb + 2, hy + 22, hb - 6, hy + 42, colB, false);
          bein(hf, hy, hf + 18, hy + 6, hf + 10, hy + 26, colF, true);
        } else {                                // Fallen: Beine leicht geöffnet, bereit zur Landung
          bein(hb, hy, hb - 6, hy + 20, hb - 14, hy + 38, colB, false);
          bein(hf, hy, hf + 14, hy + 18, hf + 18, hy + 36, colF, true);
        }
        return;
      }
      // je Bein: fussX rel., lift, knieVor
      var ax = 10, al = 0, ak = 4, bx = -10, bl = 0, bk = 4, wa, wb;
      if (moving) {
        wa = FIG_WALK[walk]; wb = FIG_WALK[(walk + 3) % 6];
        ax = wa[0]; al = wa[1]; ak = wa[2]; bx = wb[0]; bl = wb[1]; bk = wb[2];
      } else if (mv) {
        ax = 18 + (phase === 'hit' ? 6 : 0) + (impact ? 4 : 0); ak = 6 + wt;
        bx = -18 - (phase === 'wind' ? Math.round(wt * 2 * prog) : 0); bk = 2;
      }
      else if (blk) { ax = 6; ak = 6; bx = -16; bk = 2; }
      else if (stun) { ax = 16 + Math.round(6 * stK); al = 6; ak = 2; bx = -12 - Math.round(4 * stK); bk = 0; }
      else if (win) { ax = 14; ak = 2; bx = -14; bk = 2; }
      else if (idleOn) {                         // Gewicht auf ein Bein -> dessen Knie beugt
        ak = 4 + Math.round(Math.max(0, wsK) * 3); bk = 4 + Math.round(Math.max(0, -wsK) * 3);
      }
      if (kick) { bx = -4 - (phase === 'hit' ? 4 : 0); bl = 0; bk = 2; }
      standBein(hb, bb + bx, bl, bk, colB, false);
      if (!kick) standBein(hf, bf + ax, al, ak, colF, true);
    }
    function kickBein() {
      var hf = Math.round(tw * 0.14 + leanL * 0.8), hy = hipY + dipY;
      var col = LK.hose, kx, ky, ax, ay, g;
      if (phase === 'wind') {
        // Chamber: Knie zieht hoch, Fuß klappt ein (ease-out, damit die Pose steht)
        var pe = 1 - (1 - prog) * (1 - prog);
        var ay0 = air ? hy + 26 : h - bootH;
        kx = Math.round(hf + 4 + 14 * pe); ky = Math.round(hy + 22 - (art === 'air' ? 28 : 34) * pe);
        ax = Math.round(hf + 8 - 4 * pe); ay = Math.round(ay0 + (hy + 14 - ay0) * pe);
        bein(hf, hy, kx, ky, ax, ay, col, true);
        return;
      }
      var KL0 = clamp(mv.reach * 0.45, 40, 72);
      var tyL = mv.low ? h - 16 : (art === 'air' ? hy + 24 : clamp(h - (mv.high || 48) - 32, hy - 44, hy));
      var a1 = Math.atan2(tyL - hy, KL0);
      // Bogen-Start: aus dem Chamber von unten; Lolas Diagonal-Tritt kommt von oben (Overhead)
      var a0 = (id === 'lola' && art === 'air') ? a1 - 1.1 : 1.1;
      var k = atkF - mv.startup, s, ang, KL;
      if (phase === 'hit') {
        if (mv.hits > 1) { var half = Math.ceil(mv.active / mv.hits); s = Math.min(1, ((k % half) + 1.5) / 2); }
        else s = Math.min(1, (k + 1.5) / 2);
        s = 1 - (1 - s) * (1 - s);
        ang = a0 + (a1 - a0) * s;
        KL = KL0 * (impact ? 1.08 : 1);
      } else {
        s = 1;
        ang = a1 + (1.2 - a1) * (1 - ext);
        KL = KL0 * Math.max(0.45, ext);
      }
      var ca = Math.cos(ang), sa = Math.sin(ang);
      ax = Math.round(hf + ca * KL); ay = Math.round(hy + sa * KL);
      var bend = (1 - s * 0.85) * 14 + (phase === 'rec' ? 10 * (1 - ext) : 0);
      kx = Math.round(hf + ca * KL * 0.5 + sa * bend); ky = Math.round(hy + sa * KL * 0.5 - ca * bend);
      var fw = bootH + 8, fh = lw + 4;
      if (phase === 'hit') {
        var tc = FIG_TRAIL[id];
        bogen(hf, hy, KL + 12, a0, ang, 10, tc);
        // Ghost-Füße entlang des Bogens
        for (g = 1; g <= 3; g++) {
          var ga = ang - (ang - a0) * g * 0.26;
          alpha(0.42 - g * 0.11);
          M(Math.round(hf + Math.cos(ga) * KL) - 4, Math.round(hy + Math.sin(ga) * KL - fh / 2), fw, fh, tc);
        }
        alpha(1);
        if (id === 'nina') { // Blitz-Spur
          alpha(0.8);
          seg(ax - 50, ay - 8, ax - 36, ay + 4, 3, '#ffe080');
          seg(ax - 36, ay + 4, ax - 24, ay - 6, 3, '#ffe080');
          seg(ax - 24, ay - 6, ax - 10, ay + 2, 3, '#fff0c0');
          alpha(1);
        }
      }
      glied([hf, hy, kx, ky, ax, ay], lw, col, hexShade(col, -8));
      K(ax - 4, Math.round(ay - fh / 2), fw, fh, LK.stiefel);
      M(ax - 2, Math.round(ay - fh / 2) + 2, fw - 4, 2, hexShade(LK.stiefel, 28));
      M(ax + fw - 8, Math.round(ay - fh / 2), 4, fh, ink);
      if (id === 'nina') for (var r = 0; r < 3; r++) K(ax + fw - 4, Math.round(ay - fh / 2) + r * 7, 7, 7, '#ffb040');
      if (id === 'lola') { M(ax - 7, Math.round(ay + fh / 2) - 3, 4, 6, ink); M(ax, Math.round(ay - fh / 2) + 3, fw - 10, 2, accent); }
      if (impact) stern(ax + fw + 4, ay, 14, '#ffe080');
    }
    function faust(hx0, hy0, col, open) {
      var s = LK.t >= 13 ? 16 : 14, r = s >> 1;
      if (open) {
        K(hx0 - r, hy0 - r - 1, s - 2, s + 2, col);
        K(hx0 + r - 4, hy0 - r - 1, 12, s, col);
        M(hx0 + r - 2, hy0 - 2, 9, 1, ink); M(hx0 + r - 2, hy0 + 2, 9, 1, ink);
        M(hx0 - r + 2, hy0 + r - 2, 6, 3, hexShade(col, -20));
        return;
      }
      K(hx0 - r, hy0 - r, s, s, col);
      M(hx0 - r + 2, hy0 - r + 2, s - 4, 2, hexShade(col, 26));
      M(hx0 + r - 5, hy0 - r + 3, 2, s - 6, hexShade(col, -30));
      M(hx0 + r - 5, hy0 - 1, 3, 1, hexShade(col, -30));
      M(hx0 - r + 3, hy0 + 2, 6, 3, hexShade(col, -16));
      if (id === 'rocco') { M(hx0 - r + 2, hy0 - 2, s - 4, 1, '#a89880'); M(hx0 - r + 2, hy0 + 3, s - 4, 1, '#a89880'); }
      if (id === 'nina') M(hx0 + r - 4, hy0 - r + 2, 2, s - 4, haut);
    }
    function arm(a, shx, front) {
      var o = LK.armO, u = LK.armU, hc = LK.hand, t = LK.t;
      if (!front) { o = hexShade(o, -22); u = hexShade(u, -22); hc = hexShade(hc, -22); }
      glied([shx, shY, a[0], a[1], a[2], a[3]], t, o, u);
      var wx = Math.round(a[0] + (a[2] - a[0]) * 0.7), wy = Math.round(a[1] + (a[3] - a[1]) * 0.7);
      if (id === 'biel') {
        K(a[0] - (t >> 1) - 1, a[1] - (t >> 1) - 1, t + 2, t + 2, hexShade(farbe2, 14)); // gekrempelter Ärmel
        if (front && !(art === 'special' && phase !== 'wind')) { M(wx - 5, wy - 3, 10, 2, '#8a6040'); M(wx - 5, wy + 1, 10, 2, '#6a4a28'); } // Seilwicklung
      } else if (id === 'toni') {
        K(wx - (t >> 1) - 2, wy - (t >> 1) - 2, t + 4, t + 4, '#3a3a40');
        M(wx - (t >> 1), wy - (t >> 1), t, 2, '#8a8a90');
        M(wx - 1, wy - 1, 3, 3, '#c09048');
        M(a[0] - 3, a[1] - (t >> 1) + 2, 6, 2, hexShade(u, 18)); // Muskel-Licht
      } else if (id === 'lola') {
        M(wx - (t >> 1) - 1, wy - 2, t + 2, 4, '#ffb040');
        M(wx - (t >> 1) + 1, wy - 2, 2, 2, '#fff0c0');
      } else if (id === 'rocco') {
        K(wx - (t >> 1) - 1, wy - (t >> 1) - 1, t + 2, t + 2, farbe2);
        M(wx - (t >> 1) + 1, wy - 1, t - 2, 2, hexShade(farbe2, 24));
      } else if (id === 'nina') {
        seg(shx, shY - 3, a[0], a[1] - 3, 2, accent);
        M(wx - (t >> 1), wy - (t >> 1), t, t, hexShade(farbe, -18));
      }
      var open = id === 'rocco' && (art === 'light' || art === 'special') && phase !== 'wind';
      if (id === 'nina' && art === 'special') open = true;
      if (id === 'lola' && art === 'special' && phase !== 'wind') open = true;
      faust(a[2], a[3], hc, open);
    }

    // ---- Torsi ----
    function torsoBiel() {
      var x0 = -tw / 2, th = tb - tt, yy, xx;
      P(x0, tt, tw, th, farbe);
      for (yy = tt + 10; yy < tb - 10; yy += 5) M(x0 + 6, yy, tw - 12, 1, hexShade(farbe, -16));
      for (xx = x0 + 12; xx < x0 + tw - 8; xx += 9) M(xx, tt + 10, 2, Math.max(0, th - 20), hexShade(farbe, 10));
      if (th > 30) {
        K(x0 + 8, tt + 16, 13, 11, '#3a5048');
        M(x0 + 10, tt + 18, 9, 1, '#5a7068');
        for (xx = 0; xx < 3; xx++) M(x0 + 10 + xx * 4, tt + 24, 2, 1, '#8a9a90');
      }
      P(Math.round(kopfX * 0.5 - tw * 0.3), tt - 4, Math.round(tw * 0.6), 11, farbe2); // Rollkragen
      seg(x0 + 6, tt + 8, x0 + tw - 8, tb - 12, 8, ink);
      seg(x0 + 6, tt + 8, x0 + tw - 8, tb - 12, 4, '#6a4a28');
      for (var i = 0; i < 9; i++) {
        M(Math.round(x0 + 5 + (tw - 14) * i / 9), Math.round(tt + 7 + (th - 20) * i / 9), 3, 2, '#a07848');
      }
      K(x0 - 1, tb - 10, tw + 2, 10, '#2a1a10');
      M(x0 + 1, tb - 8, tw - 2, 2, '#4a3020');
      K(x0 + 4, tb - 6, 9, 18, '#3a2418');           // Messerscheide
      M(x0 + 6, tb - 10, 5, 5, '#8a8a90');
      K(shF - 2, tb - 12, 13, 14, '#c09040');        // Schnalle
      M(shF + 1, tb - 9, 7, 8, '#2a1a10');
    }
    function torsoLola() {
      var x0 = -tw / 2, th = tb - tt, xx, i;
      P(x0 + 2, tt, tw - 4, th, farbe);
      for (xx = x0 + 10; xx < x0 + tw - 10; xx += 9) M(xx, tt + 8, 2, Math.max(0, th - 14), hexShade(farbe, -22));
      var fxL = Math.round(tw / 2) - 12;
      for (i = 0; tt + 8 + i * 5 < tb - 8; i++) M(fxL + (i % 2 ? 0 : 4), tt + 8 + i * 5, 5, 2, '#ffb040');
      K(x0 - 4, tt - 3, tw + 8, 9, farbe2);           // Volant-Schulter
      for (xx = 0; xx < tw + 6; xx += 7) M(x0 - 3 + xx, tt + 5, 5, 3, accent);
      M(Math.round(kopfX - 7), tt + 1, 14, 2, '#ffb040');
      K(Math.round(kopfX), tt + 3, 7, 8, '#ffb040');
      K(x0, tb - 11, tw, 8, accent);                  // Schärpe
      M(x0 + 2, tb - 9, tw - 4, 2, hexShade(accent, 34));
      K(x0 - 8, tb - 9, 10, 18, accent);
      M(x0 - 6, tb + 4, 6, 3, hexShade(accent, -30));
    }
    function rockLola() {
      var x0 = -tw / 2, xx, yy;
      var sway = moving ? Math.round(FIG_WARM[walk] * 0.4) : Math.round(idleX * 0.8);
      var flare = (kick && phase !== 'wind') ? (impact ? 18 : 14) : (stun ? 6 + Math.round(4 * stK) : 0);
      var top = tb - 4, bot = crouch ? h - 2 : (air ? h - 30 : h - 28);
      var t2 = top + Math.round((bot - top) * 0.3), t3 = top + Math.round((bot - top) * 0.58);
      var l3 = x0 - 14 - sway * 2 - (flare >> 1), w3 = tw + 28 + flare * 2;
      P(x0 - 2, top, tw + 4, t2 - top + 3, farbe);
      P(x0 - 8 - sway, t2, tw + 16 + flare, t3 - t2 + 3, farbe2);
      P(l3, t3, w3, bot - t3, farbe);
      for (yy = t3 + 6; yy < bot - 8; yy += 8) {
        for (xx = l3 + 6 + ((yy >> 3) % 2) * 5; xx < l3 + w3 - 6; xx += 10) M(xx, yy, 3, 3, '#ff8090');
      }
      for (xx = 0; xx < tw + 2; xx += 10) M(x0 + 2 + xx, top + 5, 3, 3, '#ff8090');
      for (xx = 0; xx < w3; xx += 8) {
        M(l3 + xx, bot - 3, 6, 5, accent);
        M(l3 + xx + 1, bot + 1, 4, 2, ink);
      }
      M(x0 - 8 - sway, t2 + 1, tw + 16 + flare, 2, accent);
      M(l3, t3 + 1, w3, 2, accent);
    }
    function torsoToni() {
      var x0 = -tw / 2, th = tb - tt, yy, i;
      P(x0 - 4, tt, tw + 8, 22, haut);                // Schultern/Trapez
      M(x0, tt + 2, tw, 3, hautL);
      P(x0 + 4, tt + 10, tw - 8, th - 10, farbe);     // Unterhemd
      for (i = 0; i < 5; i++) M(Math.round(kopfX) - 8 + i * 4, tt + 10 + (i % 2) * 3, 2, 4, '#1a1010');
      K(x0 + 2, tb - 10, tw - 4, 9, '#1a0e08');       // Gürtel
      var ax0 = x0 + Math.round(tw * 0.22), aw = tw - Math.round(tw * 0.22) - 2;
      var aBot = crouch ? h - 6 : tb + Math.round(legH * 0.55);
      P(ax0, tt + 14, aw, aBot - tt - 14, '#3a2014'); // Lederschürze
      for (yy = tt + 20; yy < aBot - 6; yy += 6) { M(ax0 + 4, yy, 2, 2, '#6a4a30'); M(ax0 + aw - 6, yy, 2, 2, '#6a4a30'); }
      K(ax0 + 2, tt + 15, 6, 6, '#c09048'); K(ax0 + aw - 8, tt + 15, 6, 6, '#c09048');
      K(ax0 + 2, aBot - 8, 6, 6, '#c09048'); K(ax0 + aw - 8, aBot - 8, 6, 6, '#c09048');
      M(Math.round(ax0 + aw * 0.4), tt + 28, 7, 4, '#1a0c06');
      M(Math.round(ax0 + aw * 0.6), aBot - 18, 5, 3, '#1a0c06');
      if (aBot - tb > 8) {
        K(ax0 + 8, tb - 6, 22, 14, '#2a160c');        // Tasche + Zange
        M(ax0 + 12, tb - 16, 3, 12, '#6a6a70'); M(ax0 + 18, tb - 14, 3, 10, '#6a6a70');
      }
      seg(ax0 + 4, tt + 15, x0 + 6, tt + 2, 7, ink);
      seg(ax0 + 4, tt + 15, x0 + 6, tt + 2, 3, '#5a3420');
    }
    function torsoRocco() {
      var x0 = -tw / 2, th = tb - tt, yy, xx;
      P(x0 - 4, tt + 2, tw + 8, th + 2, farbe);
      for (yy = tt + 14; yy < tb - 10; yy += 8) {
        M(x0 - 2, yy, tw + 4, 2, hexShade(farbe, -20));
        M(x0 - 2, yy + 2, tw + 4, 1, hexShade(farbe, 14));
      }
      K(x0 - 2, tb - 8, tw + 4, 11, farbe2);          // Strick-Bund
      for (xx = x0; xx < x0 + tw; xx += 4) M(xx, tb - 6, 2, 7, hexShade(farbe2, 18));
      if (th > 26) {
        K(x0 + 8, tb - 28, 18, 15, hexShade(farbe, -14));
        M(x0 + 10, tb - 26, 14, 2, ink);
      }
      M(Math.round(kopfX) - 10, tt, 20, 10, '#101014');
      var zx = Math.round(tw / 2) - 12;
      M(zx, tt + 8, 3, th - 8, ink);
      for (yy = tt + 9; yy < tb - 6; yy += 3) M(zx - 1, yy, 5, 1, '#6a6a7a');
      K(zx - 2, tt + 18, 7, 10, '#8a8a9a');
      K(zx - 20, tt + 12, 15, 9, accent);             // Security-Badge
      M(zx - 18, tt + 14, 11, 2, '#e0c0ff');
      M(zx - 18, tt + 17, 6, 1, '#e0c0ff');
      K(x0 - 6, tt - 4, tw + 12, 13, '#3a2a40');      // Pelzkragen
      for (xx = 0; xx < tw + 8; xx += 4) {
        M(x0 - 4 + xx, tt - 2 + (xx % 8 ? 0 : 2), 3, 3, '#5a4a60');
        M(x0 - 4 + xx + 1, tt + 7, 2, 3 + (xx % 8 ? 0 : 2), '#2a1a30');
      }
      M(Math.round(kopfX) - 12, tt - 2, 3, th - 4, '#2a2a2a'); // Ohrhörer-Kabel
      if (art === 'heavy' && phase !== 'wind') {
        P(shF - 6, shY - 12, 28, 24, farbe2);         // Schulter voraus
        M(shF - 2, shY - 8, 20, 3, hexShade(farbe2, 40));
      }
    }
    function torsoNina() {
      var x0 = -tw / 2, th = tb - tt, i;
      P(x0 - 14, tb - 24, 18, 20, '#1a1008');         // Kuriertasche
      M(x0 - 12, tb - 22, 14, 3, accent);
      M(x0 - 10, tb - 16, 10, 2, '#fff0c0');
      P(x0 + 4, tt + 4, tw - 8, th, '#2a6058');       // Top
      var jh = Math.round(th * 0.72);
      P(x0, tt, tw, jh, farbe);                       // Cropped Jacke
      M(x0 + 6, tt + 4, 3, jh - 8, accent);
      M(x0 + tw - 12, tt + 4, 2, jh - 6, ink);
      M(x0 + tw - 9, tt + 6, 3, jh - 10, hexShade(farbe, 30));
      P(x0 + 2, tb - 8, tw - 4, 16, farbe2);          // Shorts
      M(x0 + 4, tb - 6, tw - 8, 2, hexShade(farbe2, 30));
      seg(x0 + tw - 10, tt + 2, x0 + 4, tb - 12, 7, ink);
      seg(x0 + tw - 10, tt + 2, x0 + 4, tb - 12, 3, '#3a2a18');
      K(Math.round(x0 + tw * 0.45), Math.round((tt + tb) / 2) - 4, 9, 9, '#8a8a90');
      var fl = moving ? 4 + ((tick >> 2) % 2) * 3 : ((tick >> 3) % 2) * 2;
      K(Math.round(kopfX) - 14, tt - 4, 28, 10, '#2a6058'); // Schal
      for (i = 0; i < 3; i++) M(Math.round(kopfX) - 10 + i * 8, tt - 2, 3, 6, '#40a090');
      K(x0 - 8 - fl, tt, 14, 7, '#2a6058');
      K(x0 - 16 - fl * 2, tt + 4, 11, 6, '#2a6058');
    }

    // ---- Köpfe ----
    function xAuge(ex, eyy) {
      for (var i = 0; i < 4; i++) {
        M(ex + i * 2, eyy - 1 + i * 2, 2, 2, '#3a0808');
        M(ex + 6 - i * 2, eyy - 1 + i * 2, 2, 2, '#3a0808');
      }
    }
    function kopfBasis() {
      K(Math.round(kopfX) - 9, hh - 8, 18, 12, hautD); // Hals
      K(kL, 0, hw, hh, haut);
      M(kL + 2, 2, hw - 4, 4, hautL);
      M(kL + 2, 6, 5, hh - 8, hautD);
      M(kL + 2, hh - 7, hw - 4, 5, hautD);
      M(kL + hw - 8, 8, 4, hh - 18, hautL);
      var oy = Math.round(hh * 0.45);
      K(kL + 6, oy, 9, 12, haut); M(kL + 8, oy + 3, 4, 6, hautD);            // Ohr
      var ny = Math.round(hh * 0.42);
      K(kL + hw - 3, ny, 7, 11, haut);                                        // Nase
      M(kL + hw - 2, ny + 8, 4, 2, hautD); M(kL + hw, ny + 2, 2, 4, hautL);
    }
    function gesicht(cfg) {
      var e1 = kL + hw - 13, e2 = kL + hw - 23;
      var my = cfg.my || Math.round(hh * 0.74), mx = kL + hw - 14;
      if (stun) {
        xAuge(e1, ey); xAuge(e2, ey);
        M(e1 - 1, ey - 8, 9, 3, cfg.brow); M(e2, ey - 7, 7, 3, cfg.brow);
        K(mx - 2, my - 2, 12, 8, '#2a0808'); M(mx, my, 8, 2, '#e8e0d0');
        return;
      }
      var weiss = blk ? '#ffe080' : '#f2e4cc';
      for (var i = 0; i < 2; i++) {
        var ex = i ? e2 : e1, ew = i ? 6 : 8;           // hinteres Auge schmaler (3/4-Ansicht)
        if (lidZu) { M(ex, ey + 2, ew, 2, ink); continue; }
        M(ex - 1, ey - 1, ew + 2, 7, ink);
        M(ex, ey, ew, 5, weiss);
        var ix = look < 0 ? ex + 1 : ex + ew - 4, iy = look > 0 ? ey : ey + 1;  // Blick folgt dem Look-around
        M(ix, iy, 3, 4, cfg.iris || '#3a1a0a');
        M(ix + 1, iy + 1, 2, 2, '#050203');
        M(ix, iy, 1, 1, '#ffffff');
      }
      var bd = (mv || blk) ? 2 : 0;
      M(e1 - 1, ey - 6, 5, 3, cfg.brow); M(e1 + 3, ey - 5 + bd, 6, 3, cfg.brow);
      M(e2 - 1, ey - 5, 7, 3, cfg.brow);
      if ((mv && phase !== 'rec') || win) {
        K(mx, my - 2, 10, 7, '#2a0808'); M(mx + 2, my - 1, 6, 2, '#e8e0d0');
      } else {
        M(mx, my, 9, 2, cfg.lip || hexShade(haut, -50));
        M(mx + 7, my - 1, 2, 1, cfg.lip || hexShade(haut, -50));
      }
    }
    function kopfBiel() {
      var xx, yy;
      K(kL - 2, 6, 12, 18, '#2a1a10');                // Haar unter Mütze
      kopfBasis();
      for (yy = Math.round(hh * 0.6); yy < hh - 3; yy += 3) {
        for (xx = kL + 14; xx < kL + hw - 4; xx += 3) if (((xx + yy) & 1) === 0) M(xx, yy, 2, 2, '#3a2418');
      }
      var ny = Math.round(hh * 0.55);
      M(kL + hw - 12, ny, 6, 2, '#6a2818'); M(kL + hw - 10, ny - 2, 2, 6, '#6a2818'); // Narbe
      K(kL - 2, -10, hw + 2, 13, '#0f2420');          // Strickmütze
      K(kL + 4, -14, hw - 14, 6, '#0f2420');
      for (xx = kL + 2; xx < kL + hw - 2; xx += 5) M(xx, -8, 2, 10, '#16302a');
      K(kL - 3, 1, hw + 4, 8, '#1c3c34');
      M(kL - 1, 3, hw, 2, '#2c5a4c');
      gesicht({ brow: '#2a1a10', iris: '#2a5a50' });
    }
    function kopfLola() {
      var i;
      K(kL - 4, 2, 14, hh - 10, '#1a0810');           // Haar hinten
      kopfBasis();
      K(kL - 2, -4, hw + 2, 11, '#1a0810');
      M(kL + 2, -2, hw - 8, 2, '#3a1a28');
      K(kL - 4, 2, 14, hh - 14, '#1a0810');
      K(kL - 14, -10, 18, 18, '#1a0810');             // Dutt
      M(kL - 11, -7, 8, 3, '#3a1a28'); M(kL - 12, -2, 3, 6, '#2a1020');
      for (i = 0; i < 4; i++) M(kL - 12 + i * 4, -17 - ((i === 1 || i === 2) ? 3 : 0), 3, 8, '#c08830'); // Peineta
      M(kL - 13, -10, 16, 2, '#ffb040');
      rose(kL + hw - 16, -10, 1);
      var oy = Math.round(hh * 0.62);
      K(kL + 7, oy, 8, 10, '#ffb040'); M(kL + 9, oy + 2, 4, 6, '#1a0810'); // Creole
      M(kL + hw - 9, Math.round(hh * 0.6), 2, 2, '#2a0a10');
      gesicht({ brow: '#1a0810', lip: '#c02040', iris: '#4a1a10' });
      if (!stun && !lidZu) { M(kL + hw - 6, ey - 3, 3, 2, ink); M(kL + hw - 4, ey - 4, 2, 2, ink); }
    }
    function kopfToni() {
      kopfBasis();
      M(kL + 10, 3, 12, 3, hexShade(haut, 40)); M(kL + 14, 6, 6, 2, hexShade(haut, 40)); // Glatzen-Glanz
      M(kL + hw - 20, 6, 8, 3, '#3a2a24'); M(kL + 18, hh - 12, 5, 3, '#3a2a24');          // Ruß
      K(kL - 2, 8, 10, 18, '#1a1010'); M(kL + 16, 10, 5, 13, '#1a1010');                  // Haarkranz, Kotelette
      M(kL + hw - 14, 8, 2, 10, '#5a2010'); M(kL + hw - 16, 12, 6, 2, '#5a2010');         // Narbe
      gesicht({ brow: '#1a1010', iris: '#5a2a10', my: hh - 6 });
      M(kL + hw - 27, ey - 7, 25, 3, '#1a1010');                                          // Brauenwulst
      var my = Math.round(hh * 0.64);
      K(kL + hw - 26, my, 28, 8, '#1a1010');                                               // Schnurrbart
      M(kL + hw - 24, my + 2, 22, 2, '#3a2a24');
      K(kL + hw - 30, my + 3, 7, 10, '#1a1010'); K(kL + hw, my + 3, 6, 10, '#1a1010');
    }
    function kopfRocco() {
      var xx;
      K(Math.round(kopfX) - 15, hh - 10, 30, 14, hautD); // Stiernacken
      kopfBasis();
      K(kL - 1, -6, hw + 2, 11, '#0a0810');            // Flat-Top
      for (xx = kL + 2; xx < kL + hw - 2; xx += 4) M(xx, -4 + (xx & 2), 2, 2, '#1e1a28');
      M(kL + 14, 4, 4, 10, '#0a0810');
      var oy = Math.round(hh * 0.45);
      M(kL + 8, oy + 2, 6, 3, hexShade(haut, -45));    // Blumenkohlohr
      K(kL + 9, oy + 4, 6, 6, '#2a2a2a');              // Ohrhörer
      M(kL + 11, oy + 9, 2, hh - oy - 6, '#2a2a2a');
      gesicht({ brow: '#0a0810', iris: '#2a1a10' });
      var gy = ey - 2 + (stun ? -9 : 0), gk = stun ? 3 : 0;
      M(kL + 12, gy + 2, hw - 14, 3, ink);             // Bügel
      K(kL + hw - 28, gy + gk, 14, 9, '#1a1a2a');
      K(kL + hw - 13, gy, 15, 9, '#1a1a2a');
      M(kL + hw - 26, gy + gk + 2, 4, 2, '#8a8ab0'); M(kL + hw - 23, gy + gk + 4, 2, 2, '#5a5a80');
      M(kL + hw - 11, gy + 2, 5, 2, '#8a8ab0'); M(kL + hw - 7, gy + 4, 2, 2, '#5a5a80');
      M(kL + hw - 4, hh - 8, 2, 4, hautD);             // Kinnkerbe
    }
    function kopfNina() {
      var i;
      var pz = moving ? ((tick >> 2) % 2) * 3 : ((tick >> 4) % 2) * 2;
      K(kL - 12, 4 + pz, 16, 9, '#e07828');             // Pferdeschwanz
      K(kL - 20 - pz, 10 + pz, 12, 18, '#e07828');
      M(kL - 18 - pz, 12 + pz, 4, 12, '#ffa050');
      K(kL - 4, 3, 7, 9, accent);
      kopfBasis();
      K(kL - 2, -6, hw + 2, 12, '#e07828');
      M(kL, -4, hw - 4, 2, '#ffa050');
      for (i = 0; i < 5; i++) M(kL + hw - 27 + i * 5, 4, 5, 4 + (i % 2) * 4, '#e07828'); // Pony
      var sy = Math.round(hh * 0.58);
      M(kL + hw - 11, sy, 2, 2, hautD); M(kL + hw - 7, sy + 2, 2, 2, hautD); M(kL + hw - 15, sy + 1, 2, 2, hautD);
      M(kL + 3, -10, hw - 6, 4, '#1a1a1a');             // Kopfhörer-Bügel
      M(kL + 1, -8, 4, 14, '#1a1a1a');
      var cy = Math.round(hh * 0.34);
      K(kL + 1, cy, 13, 16, '#222226');
      M(kL + 3, cy + 2, 9, 3, '#4a4a50');
      K(kL + 3, cy + 5, 8, 8, accent); M(kL + 5, cy + 7, 4, 4, '#ffe080');
      K(kL + 14, -1, hw - 12, 7, '#2a2a2a');            // Brille hochgeschoben
      M(kL + 16, 1, hw - 16, 3, '#ffb040'); M(kL + 18, 1, 4, 1, '#fff0c0');
      gesicht({ brow: '#a04810', iris: '#2a5a20' });
    }

    // ---- Props ----
    function hammer(gx, gy, dx, dy, hot) {
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= len; dy /= len;
      var ex = gx + dx * 44, eyy = gy + dy * 44;
      seg(gx - dx * 10, gy - dy * 10, ex, eyy, 9, ink);
      seg(gx - dx * 10, gy - dy * 10, ex, eyy, 5, '#6a4020');
      seg(gx - dx * 10, gy - dy * 10 - 1, ex, eyy - 1, 2, '#9a6838');
      var vert = Math.abs(dy) > Math.abs(dx);
      var kw = vert ? 32 : 20, kh = vert ? 20 : 32;
      var kx = Math.round(ex - kw / 2), ky = Math.round(eyy - kh / 2);
      if (hot) { alpha(0.35); M(kx - 6, ky - 6, kw + 12, kh + 12, '#ff4a18'); alpha(1); }
      P(kx, ky, kw, kh, '#4a4a52');
      var face = hot ? '#ff4a18' : '#7a7a84';
      if (vert) { M(kx + kw - 6, ky + 2, 4, kh - 4, face); M(kx + 2, ky + 2, 4, kh - 4, '#2a2a30'); }
      else { M(kx + 2, ky + kh - 6, kw - 4, 4, face); M(kx + 2, ky + 2, kw - 4, 4, '#2a2a30'); }
      M(kx + (kw >> 1) - 2, ky + (kh >> 1) - 2, 4, 4, '#c09048');
    }
    function toniHammer() {
      // Pendel: Atmen / Gewichtswechsel / Schritt lassen den hängenden Hammer leicht schwingen
      var hdx = 0.35 + (idleOn ? wsK * 0.12 : 0) + (moving ? -sw * 0.025 : 0), hdy = 1, hot = false;
      if (mv) {
        if (art === 'light') { if (phase === 'wind') { hdx = -0.4; hdy = -1; } else { hdx = 1; hdy = 0.15; } }
        else if (art === 'heavy') {
          if (phase === 'wind') { hdx = -0.5 - 0.3 * prog; hdy = -1; }      // weit hinter den Kopf
          else if (phase === 'hit') { hdx = 1; hdy = impact ? 0.9 : 0.7; }
          else { hdx = 0.5; hdy = 1; }
        }
        else if (art === 'special') { if (phase === 'wind') { hdx = -0.2 - 0.2 * prog; hdy = -1; } else { hdx = 0.35; hdy = 1; } }
        else { hdx = 0.2; hdy = 1; }
        hot = phase === 'hit';
      } else if (blk || win) { hdx = 0.15; hdy = -1; }
      else if (stun) { hdx = -0.6; hdy = 0.8; }
      else if (crouch) { hdx = 1; hdy = 0.4; }
      else if (air) { hdx = -0.6; hdy = -0.8; }
      hammer(aF[2], aF[3], hdx, hdy, hot || winPulse);
      if (art === 'special' && phase !== 'wind') {
        var gx = aF[2] + 18;
        alpha(0.9);
        M(gx - 30, h - 3, 60, 3, '#ff4a18');
        M(gx - 18, h - 6, 4, 6, '#ffb040'); M(gx + 12, h - 5, 4, 5, '#ffb040');
        for (var i = 0; i < 6; i++) {
          M(gx + (i - 3) * 11, h - 8 - ((atkF * 5 + i * 7) % 26), 4, 4, i % 2 ? '#ffb040' : '#ffe080');
        }
        alpha(0.4);
        M(gx - 36, h - 14, 72, 10, '#5a3020');
        alpha(1);
      }
    }
    function netzRuecken() {
      var nx = -Math.round(tw / 2) - 12, ny = tt + 2, nw = 20, nh = Math.min(40, tb - tt + 6), yy, xx;
      K(nx, ny, nw, nh, '#2a2014');
      for (yy = ny + 4; yy < ny + nh - 2; yy += 5) M(nx + 2, yy, nw - 4, 1, '#6a5030');
      for (xx = nx + 4; xx < nx + nw - 2; xx += 5) M(xx, ny + 2, 1, nh - 4, '#6a5030');
      for (yy = ny + 6; yy < ny + nh - 4; yy += 10) for (xx = nx + 5; xx < nx + nw - 4; xx += 10) M(xx - 1, yy - 1, 3, 3, '#5ec8b8');
      K(nx + 4, ny - 4, 9, 7, '#c04020'); M(nx + 6, ny - 3, 4, 2, '#ff6a40');
      K(nx + 8, ny + nh - 4, 9, 7, '#c04020');
    }
    function netzWurf(hx0, hy0) {
      var xx, yy;
      if (phase === 'wind') {
        K(hx0 - 10, hy0 - 22, 20, 16, '#2a2014');
        for (xx = hx0 - 7; xx < hx0 + 8; xx += 5) M(xx, hy0 - 20, 1, 12, '#6a5030');
        bogen(hx0, hy0 - 14, 22, -3.1 + prog * 2, -0.6 + prog * 2, 6, '#5ec8b8');
        return;
      }
      var e = Math.max(0.3, ext);
      var nw = Math.round(30 + 80 * e), nh = Math.round(30 + 44 * e);
      var nx = hx0 + 6, ny = Math.round(hy0 - nh / 2);
      alpha(0.92);
      for (yy = ny; yy <= ny + nh; yy += 9) M(nx, yy, nw, 2, '#8a6040');
      for (xx = nx; xx <= nx + nw; xx += 9) M(xx, ny, 2, nh, '#8a6040');
      for (yy = ny; yy <= ny + nh; yy += 9) for (xx = nx; xx <= nx + nw; xx += 9) M(xx - 1, yy - 1, 4, 4, '#5ec8b8');
      for (xx = nx + 4; xx < nx + nw; xx += 18) K(xx, ny - 5, 9, 7, '#c04020');
      for (xx = nx + 8; xx < nx + nw; xx += 18) M(xx, ny + nh, 6, 5, '#5a5a60');
      alpha(1);
      seg(hx0, hy0, nx, ny + (nh >> 1), 3, '#8a6040');
    }
    function propVorne() {
      var hx0 = aF[2], hy0 = aF[3], i;
      if (id === 'biel') {
        if (art === 'special') netzWurf(hx0, hy0);
        else if (art === 'air') {                     // Netz-Haken
          seg(hx0 + 4, hy0, hx0 + 18, hy0, 3, '#9a9aa0');
          seg(hx0 + 18, hy0, hx0 + 18, hy0 + 10, 3, '#9a9aa0');
          seg(hx0 + 18, hy0 + 10, hx0 + 12, hy0 + 8, 3, '#c8c8d0');
        }
      } else if (id === 'lola') {
        if (art === 'special' && phase !== 'wind') {
          var d = (atkF - mv.startup + 1) * 6;
          for (i = 0; i < 3; i++) rose(hx0 + 8 + d + i * 3, hy0 - 6 + (i - 1) * (6 + d * 0.4), 0.9);
          alpha(0.7);
          for (i = 0; i < 5; i++) M(hx0 + 4 + ((d + i * 13) % 40), hy0 - 12 + ((i * 17 + atkF * 3) % 26), 3, 3, '#ff5a70');
          alpha(1);
        } else {
          var rs = idleOn ? Math.round(Math.sin(tp * 0.09) * 2) : (moving ? Math.round(-sw * 0.3) : 0);
          if (phase === 'wind') rs = -Math.round(4 * prog);  // Rose kippt zurück = Ausholen lesbar
          seg(hx0 + 2, hy0 - 4, hx0 + 6 + rs, hy0 - 16, 2, '#2a5a20');
          M(hx0 + 3 + (rs >> 1), hy0 - 12, 4, 2, '#3a7a30');
          rose(hx0 + 1 + rs, hy0 - 27, 1);
          if (winPulse) stern(hx0 + 7 + rs, hy0 - 21, 6, '#fff0c0');
        }
      } else if (id === 'nina') {
        if (art === 'special') {
          var bx0 = Math.max(aF[2], aB[2]) + 14, byy = Math.round((aF[3] + aB[3]) / 2);
          if (phase === 'wind') sonne(bx0, byy, Math.round(4 + 10 * prog));
          else if (phase === 'hit') sonne(bx0, byy, 12 + (atkF % 2) * 3);
        }
      }
    }

    // ===== Zeichnen =====
    var tcol = FIG_TRAIL[id] || accent;
    OX = leanL; OY = dipY;
    // Special-Aura im Ausholen (theatralisch, flackert)
    if (mv && art === 'special' && phase === 'wind') {
      var au = 4 + Math.round(8 * prog) + ((tick >> 1) % 2) * 2, x0a = -Math.round(tw / 2);
      alpha(0.1 + 0.16 * prog); M(x0a - au, tt - au, tw + au * 2, h - tt + au - 6, tcol);
      alpha(0.14 + 0.2 * prog); M(x0a - (au >> 1), tt + 4, tw + au, tb - tt, accent);
      alpha(0.55);
      for (var ai = 0; ai < 3; ai++) M(x0a - 6 + ai * ((tw >> 1) + 6), tb - ((tick * 5 + ai * 23) % 70), 3, 9, '#fff0c0');
      alpha(1);
    }
    if (id === 'biel' && !(art === 'special' && phase !== 'wind')) netzRuecken();
    if (id === 'rocco' && art === 'heavy' && phase === 'hit') {
      alpha(0.45);
      for (var sl = 0; sl < 4; sl++) M(-Math.round(tw / 2) - 24 - sl * 10, tt + 8 + sl * 14, 26 + sl * 4, 3, '#e0c0ff');
      alpha(1);
    }
    arm(aB, shB, false);

    OX = 0; OY = 0;
    beine();
    // Heavy/Special: Staub am Standfuß beim Impact = Gewicht
    if (impact && wt >= 2 && !air) {
      alpha(0.5);
      M(-Math.round(tw * 0.14) - 34, h - 6, 18, 5, '#6a4a30'); M(-Math.round(tw * 0.14) - 46, h - 10, 10, 4, '#5a3a24');
      alpha(1);
    }

    OX = leanL; OY = dipY;
    if (id === 'toni') torsoToni();
    else if (id === 'lola') { torsoLola(); rockLola(); }
    else if (id === 'rocco') torsoRocco();
    else if (id === 'nina') torsoNina();
    else torsoBiel();

    OY = dipY - br;                     // Kopf hebt sich mit dem Brustkorb
    if (id === 'toni') kopfToni();
    else if (id === 'lola') kopfLola();
    else if (id === 'rocco') kopfRocco();
    else if (id === 'nina') kopfNina();
    else kopfBiel();
    OY = dipY;

    if (kick) { OX = 0; OY = 0; kickBein(); OX = leanL; OY = dipY; }

    // Trail hinter dem vorderen Arm + Ghost-Fäuste vom Ausholpunkt zur Faust
    if (mv && !kick && phase === 'hit') {
      var overArc = (art === 'heavy' && (id === 'biel' || id === 'toni')) || (art === 'air' && id === 'toni');
      var gs = LK.t + 6, gi, gx2, gy2;
      if (overArc) {
        var rr = Math.max(30, aF[2] - shF + 10), ga1 = Math.atan2(aF[3] - shY, Math.max(1, aF[2] - shF));
        bogen(shF, shY, rr, -2.2, ga1, 10, tcol);
        for (gi = 1; gi <= 3; gi++) {
          var gang = ga1 + (-2.2 - ga1) * gi * 0.22;
          gx2 = shF + Math.cos(gang) * (rr - 10); gy2 = shY + Math.sin(gang) * (rr - 10);
          alpha(0.4 - gi * 0.1); M(Math.round(gx2 - gs / 2), Math.round(gy2 - gs / 2), gs, gs, tcol);
        }
      } else {
        for (gi = 1; gi <= 3; gi++) {
          var gt = 1 - gi * 0.24;
          gx2 = gwx + (aF[2] - gwx) * gt; gy2 = gwy + (aF[3] - gwy) * gt;
          alpha(0.4 - gi * 0.1); M(Math.round(gx2 - gs / 2), Math.round(gy2 - gs / 2), gs, gs, tcol);
        }
      }
      alpha(0.3); seg(shF, shY, aF[2], aF[3], LK.t + 8, tcol);
      alpha(0.55); M(aF[2] - 26, aF[3] - 3, 16, 4, '#ff4a18'); M(aF[2] - 38, aF[3] + 3, 12, 2, '#ffb040');
      alpha(1);
    }

    if (id === 'toni') toniHammer();
    arm(aF, shF, true);
    propVorne();

    // Impact-Frame: Faust blitzt weiß, Stern skaliert mit Gewicht
    if (impact && !kick && !mv.projectile) {
      alpha(0.6); M(aF[2] - 9, aF[3] - 9, 18, 18, '#fff8ee'); alpha(1);
      stern(aF[2] + 12, aF[3], 12 + wt * 2, '#ffe080');
    }

    // Block-Schild
    if (blk) {
      var bL = Math.round(tw / 2) + 22;
      alpha(0.5); M(bL, tt - 6, 6, tb - tt + 12, accent);
      alpha(0.85); M(bL + 2, tt - 2, 2, tb - tt + 4, '#ffb040');
      for (var cy2 = tt; cy2 < tb; cy2 += 12) M(bL - 5, cy2, 4, 4, '#ffe080');
      alpha(1);
    }

    // Win-Pose: Funken-Krone + Char-Flair (+ 1-Tick-Pulse)
    if (win) {
      var wy = -(((tick / 6) | 0) % 2) * 4, kx2 = Math.round(kopfX);
      M(kx2 - 16, -34 + wy, 32, 12, '#ffb040');
      M(kx2 - 8, -46 + wy, 16, 12, '#ffe080');
      M(kx2 - 22, -26 + wy, 8, 8, accent); M(kx2 + 14, -26 + wy, 8, 8, accent);
      if (id === 'lola') { for (var wi = 0; wi < 3; wi++) rose(-30 + wi * 24, -24 + wy - (wi % 2) * 6, 1.2); }
      else if (id === 'nina') { M(aF[2] - 3, aF[3] - 50, 6, 40, '#ffe080'); M(aF[2] - 16, aF[3] - 36, 32, 6, '#ffb040'); sonne(aF[2], aF[3] - 20, 8); }
      else if (id === 'biel') { K(aB[2] - 14, aB[3] - 10, 28, 16, '#e8c090'); M(aB[2] - 10, aB[3] - 8, 20, 4, '#c03020'); M(aB[2] - 6, aB[3] - 2, 12, 2, '#a0a030'); }
      else if (id === 'rocco') { K(aF[2] - 10, aF[3] - 12, 20, 6, accent); }
      if (winPulse) {
        M(kx2 - 4, -52 + wy, 8, 6, '#fff8ee');
        if (id !== 'lola') stern(aF[2] + 2, aF[3] - 10, 9, '#fff8ee');
      }
      ctx.fillStyle = 'rgba(255,176,64,0.35)';
      ctx.fillRect(x - 72, BODEN - 8, 144, 16);
      ctx.fillStyle = 'rgba(255,224,128,0.25)';
      ctx.fillRect(x - 40, BODEN - 4, 80, 8);
    }

    // Hurt-Flash
    if (flash[p.id] > 0) {
      ctx.fillStyle = 'rgba(255,80,20,0.4)';
      ctx.fillRect(Math.round(x + f * leanL - w / 2 - 8), by - 12, w + 16, h + 16);
    }
    // Stun-Sterne (v1.5: 4 statt 3)
    if (stun) {
      OY = dipY;
      for (var si = 0; si < 4; si++) {
        var sa = tick * 0.15 + si * 1.571;
        stern(Math.round(kopfX + Math.cos(sa) * 26), Math.round(-14 + Math.sin(sa) * 7), si === 3 ? 5 : 6, si % 2 ? '#ffe080' : '#ffb040');
      }
    }
    OX = 0; OY = 0;
    ctx.globalAlpha = 1;

    if (invert) {
      ctx.font = 'bold 28px ' + SCHRIFT;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText('P2', x + 2, by - 30);
      ctx.fillStyle = '#ffd36e';
      ctx.fillText('P2', x, by - 32);
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
            spawnFx('block', b.x, b.y - 56, '#ffe080');
          } else if (kind === 'armor') {
            spawnFx('armor', b.x, b.y - 64, '#ffb040');
          } else {
            var col = Plaza.Chars.finde(b.charId).accent || '#ff3a08';
            spawnFx('spark', b.x, b.y - 64, col);
            spawnFx('spark', b.x + 20, b.y - 80, '#fff0c0');
            spawnFx('ember', b.x - 12, b.y - 48, '#ff6020');
            if (kind === 'special' || (b.hitKind === 'special')) {
              spawnFx('fireball', b.x + 16, b.y - 72, col);
              spawnFx('ice', b.x - 24, b.y - 56, '#80d8ff');
              spawnFx('knife', b.x, b.y - 80, '#ff2a4a');
            }
            if (a.hp - b.hp >= 10 || kind === 'heavy') {
              spawnFx('slash', b.x, b.y - 72, col);
              spawnFx('spark', b.x - 16, b.y - 88, '#fff8ee');
              spawnFx('fireball', b.x, b.y - 88, col);
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
    var top = (p.y | 0) - (p.crouch ? 144 : 200);
    ctx.font = 'bold 28px ' + SCHRIFT;
    ctx.textAlign = 'center';
    var tw = 0;
    try { tw = ctx.measureText(label).width; } catch (e) { tw = label.length * 5; }
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(p.x - tw / 2 - 12, top - 32, tw + 24, 40);
    ctx.fillStyle = '#1a0808';
    ctx.fillRect(p.x - tw / 2 - 12, top + 6, tw + 24, 3);
    ctx.fillStyle = '#ffe080';
    ctx.fillText(label, p.x, top);
  }

  function drawFx(ctx) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var e = fx[i];
      e.t++;
      if (e.kind === 'spark') {
        var s = e.t < 2 ? 16 : e.t < 4 ? 32 : e.t < 7 ? 20 : 0;
        if (s <= 0) { fx.splice(i, 1); continue; }
        ctx.fillStyle = e.col;
        ctx.fillRect(e.x - 4, e.y - s, 8, s * 2);
        ctx.fillRect(e.x - s, e.y - 4, s * 2, 8);
        ctx.fillStyle = '#fff8ee';
        ctx.fillRect(e.x - 4, e.y - 4, 8, 8);
      } else if (e.kind === 'slash') {
        if (e.t > 6) { fx.splice(i, 1); continue; }
        ctx.fillStyle = e.col;
        ctx.globalAlpha = 1 - e.t / 6;
        ctx.fillRect(e.x - 40 + e.t*4, e.y - 8, 56, 8);
        ctx.fillRect(e.x - 32 + e.t*4, e.y - 20, 40, 4);
        ctx.fillStyle = '#fff8ee';
        ctx.fillRect(e.x - 24 + e.t*4, e.y - 4, 24, 4);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'block') {
        if (e.t > 7) { fx.splice(i, 1); continue; }
        ctx.fillStyle = '#ffe080';
        ctx.globalAlpha = 1 - e.t / 7;
        ctx.fillRect(e.x - 24, e.y - 32, 48, 8);
        ctx.fillRect(e.x - 28, e.y - 24, 8, 40);
        ctx.fillRect(e.x + 20, e.y - 24, 8, 40);
        ctx.fillStyle = '#fff8ee';
        ctx.fillRect(e.x - 8, e.y - 16, 16, 16);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'armor') {
        if (e.t > 8) { fx.splice(i, 1); continue; }
        ctx.fillStyle = '#ffb040';
        ctx.globalAlpha = 0.7 - e.t / 12;
        ctx.fillRect(e.x - 36, e.y - 48, 72, 8);
        ctx.fillRect(e.x - 36, e.y + 24, 72, 8);
        ctx.fillRect(e.x - 36, e.y - 48, 8, 80);
        ctx.fillRect(e.x + 28, e.y - 48, 8, 80);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'fireball') {
        if (e.t > 10) { fx.splice(i, 1); continue; }
        var fr = 24 - e.t * 1.6;
        ctx.fillStyle = '#ff3a08';
        ctx.beginPath(); ctx.arc(e.x, e.y - e.t*4, fr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffb040';
        ctx.fillRect(e.x - 8, e.y - e.t*4 - 8, 16, 16);
      } else if (e.kind === 'ice') {
        if (e.t > 9) { fx.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - e.t / 9;
        ctx.fillStyle = '#80d8ff';
        ctx.fillRect(e.x - 4 - e.t*4, e.y - 24, 8, 48);
        ctx.fillRect(e.x - 24, e.y - 4, 48, 8);
        ctx.fillStyle = '#e8ffff';
        ctx.fillRect(e.x - 8, e.y - 8, 16, 16);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'knife') {
        if (e.t > 8) { fx.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - e.t / 8;
        ctx.fillStyle = '#c0c8d0';
        ctx.fillRect(e.x - 24 + e.t*4, e.y - 4, 40, 8);
        ctx.fillStyle = '#ff2a4a';
        ctx.fillRect(e.x + 16 + e.t*4, e.y - 8, 12, 16);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'ember') {
        if (e.t > 12) { fx.splice(i, 1); continue; }
        ctx.fillStyle = e.t < 4 ? '#ffb040' : '#ff3a08';
        ctx.fillRect(e.x + (e.t % 3)*4 - 4, e.y - e.t*4, 4, 8);
      } else if (e.kind === 'dust') {
        if (e.t > 8) { fx.splice(i, 1); continue; }
        ctx.fillStyle = e.col;
        ctx.globalAlpha = 1 - e.t / 8;
        ctx.fillRect(e.x - 16 - e.t*4, e.y - 8, 12, 8);
        ctx.fillRect(e.x + 8 + e.t*4, e.y - 4, 12, 8);
        ctx.globalAlpha = 1;
      }
    }
    for (var j = 0; j < 2; j++) if (flash[j] > 0) flash[j]--;
  }

  function hud(ctx, snap, ich) {
    function balken(x, p, mirror) {
      var c = Plaza.Chars.finde(p.charId);
      var bw = 472, bh = 40;
      var idx = p.id;
      var pct = Math.max(0, p.hp / p.maxHp);
      // Delay-Balken
      if (delayHp[idx] < pct) delayHp[idx] = pct;
      else delayHp[idx] += (pct - delayHp[idx]) * 0.08;
      if (Math.abs(delayHp[idx] - pct) < 0.002) delayHp[idx] = pct;

      // Rahmen Kapsel (schwarz, Feuer-Rand)
      ctx.fillStyle = '#000000';
      ctx.fillRect(x - 8, 40, bw + 16, bh + 24);
      ctx.fillStyle = '#3a1008';
      ctx.fillRect(x, 48, bw, bh + 8);
      // Delay (Bernstein)
      ctx.fillStyle = '#8a4010';
      var dw = bw * delayHp[idx];
      if (mirror) ctx.fillRect(x + bw - dw, 52, dw, bh);
      else ctx.fillRect(x, 52, dw, bh);
      // HP — heller Akzent (Feuer), nicht dunkle Outfitfarbe
      var low = pct <= 0.3;
      ctx.fillStyle = low && ((Date.now() / 80) | 0) % 2 ? '#ff2a40' : (c.accent || '#ff3a08');
      var fw = bw * pct;
      if (mirror) ctx.fillRect(x + bw - fw, 52, fw, bh);
      else ctx.fillRect(x, 52, fw, bh);
      // Highlight-Zeile
      ctx.fillStyle = 'rgba(255,200,120,0.35)';
      if (mirror) ctx.fillRect(x + bw - fw, 52, fw, 8);
      else ctx.fillRect(x, 52, fw, 8);
      // Ticks
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      for (var t = 1; t < 10; t++) ctx.fillRect(x + (bw * t) / 10, 48, 4, bh + 8);

      // Mini-Porträt (Kopf + Schulter + Akzent)
      var px = mirror ? x + bw + 16 : x - 72;
      ctx.fillStyle = '#000';
      ctx.fillRect(px - 8, 28, 64, 64);
      ctx.fillStyle = c.farbe2;
      ctx.fillRect(px - 4, 56, 56, 32);
      ctx.fillStyle = c.farbe;
      ctx.fillRect(px, 48, 48, 24);
      ctx.fillStyle = c.haut || '#ffd7b8';
      ctx.fillRect(px + 8, 32, 32, 28);
      ctx.fillStyle = '#0a0810';
      ctx.fillRect(px + 4, 28, 40, 12);
      ctx.fillStyle = c.accent || '#ff6020';
      ctx.fillRect(px + 12, 44, 8, 8);
      ctx.fillRect(px + 28, 44, 8, 8);

      // Name + Spitzname
      ctx.fillStyle = '#e8c090';
      ctx.font = 'bold 32px ' + SCHRIFT;
      ctx.textAlign = mirror ? 'right' : 'left';
      ctx.fillText(p.name, mirror ? x + bw : x, 36);
    }
    balken(112, snap.p[0], false);
    balken(W - 584, snap.p[1], true);

    // Zeit-Medaillon
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(W / 2, 72, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3a08';
    ctx.beginPath();
    ctx.arc(W / 2, 72, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0808';
    ctx.beginPath();
    ctx.arc(W / 2, 72, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = snap.zeit <= 10 ? '#ff2a40' : '#e8c090';
    ctx.font = 'bold 40px ' + SCHRIFT;
    ctx.textAlign = 'center';
    ctx.fillText(String(snap.zeit), W / 2, 86);

    if (snap.phase === 'countdown') {
      ctx.fillStyle = 'rgba(58,46,72,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e8c090';
      ctx.font = 'bold 160px ' + SCHRIFT;
      ctx.fillText(snap.countdown > 0 ? String(snap.countdown) : 'LOS!', W / 2, H / 2 + 32);
      ctx.fillStyle = '#ffe080';
      ctx.font = '28px ' + SCHRIFT;
      ctx.fillText('A leicht · B schwer · C special · ▼ duck', W / 2, H / 2 + 80);
    }
    // Combo-Anzeige
    var ci, bestC = 0, bestId = -1;
    for (ci = 0; ci < snap.p.length; ci++) {
      if ((snap.p[ci].combo | 0) > bestC) { bestC = snap.p[ci].combo | 0; bestId = ci; }
    }
    if (bestC >= 2 && snap.phase === 'kampf') {
      ctx.fillStyle = bestC >= 5 ? '#ffd040' : '#ff6020';
      ctx.font = 'bold 48px ' + SCHRIFT;
      ctx.textAlign = 'center';
      ctx.fillText((bestC >= 5 ? 'SUPER ' : '') + bestC + ' HIT!', W / 2, 160);
      ctx.fillStyle = '#ffe080';
      ctx.font = '32px ' + SCHRIFT;
      var cd = snap.p[bestId].comboDmg | 0;
      ctx.fillText(snap.p[bestId].name + (cd ? (' · ' + cd + ' DMG') : ''), W / 2, 200);
    }
    // Special-Callout
    for (var si = 0; si < snap.p.length; si++) {
      if (snap.p[si].hitKind === 'special' && snap.phase === 'kampf' && (snap.tick % 20) < 12) {
        ctx.fillStyle = '#80d8ff';
        ctx.font = 'bold 40px ' + SCHRIFT;
        ctx.textAlign = 'center';
        ctx.fillText('SPECIAL!', W / 2, 240);
        break;
      }
    }

    if (snap.phase === 'ende') {
      // Obere Vignette — Kämpfer / Win-Pose unten sichtbar
      var grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, 'rgba(0,0,0,0.88)');
      grd.addColorStop(0.45, 'rgba(0,0,0,0.55)');
      grd.addColorStop(1, 'rgba(0,0,0,0.15)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      var won = (ich === 0 || ich === 1) && snap.sieger === ich;
      var lost = (ich === 0 || ich === 1) && snap.sieger != null && snap.sieger !== ich;
      if (won) {
        ctx.fillStyle = '#40ff80';
        ctx.font = 'bold 72px ' + SCHRIFT;
        ctx.fillText('GEWONNEN!', W / 2, 100);
      } else if (lost) {
        ctx.fillStyle = '#ff4040';
        ctx.font = 'bold 72px ' + SCHRIFT;
        ctx.fillText('VERLOREN!', W / 2, 100);
      }
      ctx.fillStyle = '#ff6020';
      ctx.font = 'bold 48px ' + SCHRIFT;
      ctx.fillText(snap.nachricht || 'Ende', W / 2, 180);
      if (snap.sieger != null && snap.p[snap.sieger]) {
        var wc = Plaza.Chars.finde(snap.p[snap.sieger].charId);
        if (wc && wc.winLine) {
          ctx.fillStyle = '#ffb040';
          ctx.font = '36px ' + SCHRIFT;
          ctx.fillText('„' + wc.winLine + '“', W / 2, 240);
        }
      }
      ctx.fillStyle = '#e8c090';
      ctx.font = '36px ' + SCHRIFT;
      ctx.fillText('Rematch → Knopf unten', W / 2, 300);
    }
    if (ich === 0 || ich === 1) {
      ctx.fillStyle = 'rgba(232,192,144,0.85)';
      ctx.font = '32px ' + SCHRIFT;
      ctx.textAlign = 'left';
      ctx.fillText('Du: P' + (ich + 1), 24, H - 24);
    }
  }

  function zeichne(r, snap, ich) {
    var ctx = r.ctx;
    applyBuf(ctx);
    ctx.save();
    updateFxFromDiff(snap);
    if (Plaza.Sound && Plaza.Sound.fromSnap) Plaza.Sound.fromSnap(snap);
    if (shake > 0) {
      ctx.translate(((shake % 2) ? 1 : -1) * Math.min(8, shake * 4), ((shake % 3) - 1) * 4);
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
        var ww = 72 + ((tck + i) % 3) * 4;
        ctx.fillStyle = '#5a0800';
        ctx.fillRect(px - ww / 2, py - 8, ww, 20);
        ctx.fillStyle = '#ff3a08';
        for (var zw = -3; zw <= 3; zw++) {
          var zh = 12 + ((tck + zw + i) % 4) * 4;
          ctx.fillRect(px + zw * 12, py - zh, 12, zh + 8);
        }
        ctx.fillStyle = '#ffb040';
        ctx.fillRect(px - 16, py - 20, 12, 12);
        ctx.fillRect(px + 8, py - 28, 8, 16);
        ctx.fillStyle = '#fff0c0';
        ctx.fillRect(px - 4, py - 32, 8, 8);
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#ff4a18';
        ctx.fillRect(px - ww, py - 4, 24, 8);
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
    camX = Math.sin(Date.now() / 3000) * 24;
    arena(ctx, (Date.now() / 50) | 0, null);
    fg(ctx, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, 140);
    ctx.fillStyle = '#e8c090';
    ctx.font = 'bold 56px ' + SCHRIFT;
    ctx.textAlign = 'center';
    ctx.fillText('Plaza-Kampf', W / 2, 70);
    ctx.fillStyle = '#ff6020';
    ctx.font = '32px ' + SCHRIFT;
    ctx.fillText('la Pelea del Infierno', W / 2, 120);
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fillRect(160, H / 2 - 56, W - 320, 96);
    ctx.fillStyle = '#ff6020';
    ctx.font = '40px ' + SCHRIFT;
    ctx.fillText(text || '', W / 2, H / 2 + 12);
  }

  function portrait(canvas, charId) {
    if (!canvas) return;
    var c = Plaza.Chars.finde(charId);
    if (!c) return;
    var ctx = canvas.getContext('2d');
    var s = canvas.width;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a0608';
    ctx.fillRect(0, 0, s, s);
    // Bust scale ~3x into 48
    var sc = s / 16;
    function px(x, y, w, h, col) {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x * sc), Math.round(y * sc), Math.max(1, Math.round(w * sc)), Math.max(1, Math.round(h * sc)));
    }
    px(2, 10, 12, 6, c.farbe2);
    px(3, 8, 10, 5, c.farbe);
    px(4, 3, 8, 7, c.haut || '#ffd7b8');
    px(3, 2, 10, 3, '#0a0810');
    px(5, 5, 2, 2, c.accent || '#ff6020');
    px(9, 5, 2, 2, c.accent || '#ff6020');
    px(6, 7, 4, 1, '#3a2018');
    // Char accent
    if (c.id === 'toni') px(12, 6, 3, 5, '#4a4a4a');
    if (c.id === 'lola') { px(1, 4, 2, 2, '#ff2a4a'); px(13, 5, 2, 2, '#ff2a4a'); }
    if (c.id === 'nina') px(7, 1, 2, 2, '#ffe080');
    if (c.id === 'biel') px(0, 9, 3, 2, '#5ec8b8');
    if (c.id === 'rocco') px(12, 8, 3, 3, c.haut || '#ffd7b8');
    // Border
    ctx.strokeStyle = c.accent || '#ff6020';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, s - 2, s - 2);
  }

  function banner(r, text) {
    var ctx = r.ctx;
    applyBuf(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(80, H / 2 - 64, W - 160, 128);
    ctx.fillStyle = '#ff4040';
    ctx.font = 'bold 40px ' + SCHRIFT;
    ctx.textAlign = 'center';
    ctx.fillText(text || '…', W / 2, H / 2 + 14);
  }

  function resetFx() {
    fx = []; delayHp = [1, 1]; flash = [0, 0]; prevSnap = null; shake = 0;
  }

  Plaza.Render = {
    W: W, H: H, puffer: function () { return BUF; },
    erstelle: erstelle, setzePuffer: setzePuffer,
    zeichne: zeichne, menueHint: menueHint, banner: banner, portrait: portrait, resetFx: resetFx
  };
})(typeof window !== 'undefined' ? window : globalThis);
