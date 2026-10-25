/* Pixel-Canvas v3.7: Landscape Overlay (Arena/Chars unverändert). */
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
  var levelId = 'hoelle';

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
    var ctx = canvas.getContext('2d', { alpha: false });   // v1.8: Arena deckt immer alles ab
    canvas.width = W * BUF;
    canvas.height = H * BUF;
    applyBuf(ctx);
    layers = backeLayers();
    return { canvas: canvas, ctx: ctx, w: W, h: H, buf: BUF };
  }

  /* ---- Arena v1.6: nativ, 1 Layer-Pixel = 1 Canvas-Pixel ---- */
  var LW = 1600;                 // 1280 + 2×160 — mehr Kamera-Spiel für spürbares Parallax
  var CAM_PAD = 160;             // (LW - W) / 2
  var CAM_MAX = 120;             // ±120: L5 (×1.28) bleibt innerhalb CAM_PAD
  var PAR = { L0: 0.04, L1: 0.15, L2: 0.35, L3: 0.58, L4: 1.0, L5: 1.28 };
  // Eigenbewegung der Ebenen (nicht starr): sin-Sway + langsamer Drift
  var DRIFT = { L0: 0.010, L1: 0.022, L2: 0.014, L3: 0.006, L4: 0.0, L5: 0.028 };
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
  var FACKELN = [160, 1440];                                  // L5-x, Flamme bei y 572 (LW=1600)
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

  function bakeHoelle() {
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

  function levelApi() {
    return { backe: backe, werkzeug: werkzeug, rng: rng, LW: LW, H: H, P: P, GLUT_DEF: GLUT_DEF };
  }
  function backeLayers() {
    var extra = Plaza.Levels && Plaza.Levels.bake ? Plaza.Levels.bake(levelId, levelApi()) : null;
    if (extra) return extra;
    return bakeHoelle();
  }
  function setLevel(id) {
    if (!id) return levelId;
    var ok = false;
    if (Plaza.Levels && Plaza.Levels.LISTE) {
      for (var i = 0; i < Plaza.Levels.LISTE.length; i++) if (Plaza.Levels.LISTE[i].id === id) ok = true;
    }
    if (!ok && id !== 'hoelle') return levelId;
    if (id === levelId && layers) return levelId;
    levelId = id;
    layers = null;
    camX = 0;
    // Wetter-Bias beim Levelwechsel (next erst nach erstem Tick gesetzt)
    if (typeof wetter !== 'undefined') {
      var bias = (Plaza.Levels && Plaza.Levels.weatherBias) ? Plaza.Levels.weatherBias(id) : 'klar';
      wetter.typ = bias || 'klar';
      wetter.blend = 0;
      wetter.blitz = 0;
      wetter.next = -1; // wetterTick setzt beim nächsten Aufruf
    }
    return levelId;
  }
  function applyWetter(st) {
    if (!st || typeof st !== 'object') return;
    if (st.typ) wetter.typ = st.typ;
    if (typeof st.blitz === 'number') wetter.blitz = st.blitz;
    if (typeof st.next === 'number') wetter.next = st.next;
    if (typeof st.blend === 'number') wetter.blend = st.blend;
  }
  function getLevel() { return levelId; }


  function driftOf(key, tick) {
    if (key == null || tick == null || !DRIFT[key]) return 0;
    var d = DRIFT[key];
    // Sway + kontinuierlicher Drift (modulo, damit Layer nicht abwandern)
    var sway = Math.sin(tick * d * 2.4) * (8 + d * 280);
    var slide = ((tick * d * 18) % 48) - 24;
    return sway + slide;
  }
  function ofs(par, key, tick) {
    return Math.round(-camX * par - driftOf(key, tick)) - CAM_PAD;
  }

  // v1.8 Perf: Zeilenläufe pro Layer [[y0, y1], …], einmalig aus den Alphawerten berechnet
  var LAYER_ORDER = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'];
  function layerRuns() {
    var inh = [], deck = [], k, y, i, L, d, w4, a, e, al, any, voll;
    for (k = 0; k < LAYER_ORDER.length; k++) {
      L = layers && layers[LAYER_ORDER[k]];
      inh[k] = null; deck[k] = null;
      if (!L) continue;
      try { d = L.getContext('2d').getImageData(0, 0, L.width, L.height).data; } catch (err) { d = null; }
      if (!d) continue;
      inh[k] = new Uint8Array(L.height); deck[k] = new Uint8Array(L.height); w4 = L.width * 4;
      for (y = 0; y < L.height; y++) {
        any = 0; voll = 1;
        for (i = y * w4 + 3, e = i + w4; i < e; i += 4) {
          al = d[i];
          if (al) any = 1;
          if (al !== 255) { voll = 0; if (any) break; }
        }
        inh[k][y] = any; deck[k][y] = voll;
      }
    }
    for (k = 0; k < LAYER_ORDER.length; k++) {
      L = layers && layers[LAYER_ORDER[k]];
      if (!L) continue;
      if (!inh[k]) { L._runs = null; continue; }
      var runs = [], s0 = -1, letzte = -99, j, zu;
      for (y = 0; y < L.height; y++) {
        zu = false;
        for (j = k + 1; j <= 4 && !zu; j++) if (deck[j] && deck[j][y]) zu = true;   // L1–L4 decken
        if (!inh[k][y] || zu) continue;
        if (s0 >= 0 && y - letzte <= 16) { letzte = y; continue; }   // Lücken ≤ 16 Zeilen mitnehmen
        if (s0 >= 0) runs.push([s0, letzte + 1]);
        s0 = y; letzte = y;
      }
      if (s0 >= 0) runs.push([s0, letzte + 1]);
      L._runs = runs;
    }
  }
  function drawLayer(ctx, layer, par, tick, key) {
    if (!layer) return;
    if (layer._runs === undefined) layerRuns();
    var rs = layer._runs, x0 = ofs(par, key, tick), i, a, hh;
    if (!rs) { ctx.drawImage(layer, x0, 0); return; }
    for (i = 0; i < rs.length; i++) {
      a = rs[i][0]; hh = rs[i][1] - a;
      ctx.drawImage(layer, 0, a, layer.width, hh, x0, a, layer.width, hh);
    }
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


  /* ---- Wetter v3.0: klar → regen → gewitter → sonne (zyklisch, performant) ---- */
  var WETTER_PHASEN = ['klar', 'regen', 'gewitter', 'sonne'];
  var wetter = { typ: 'klar', next: 900, blend: 0, blitz: 0, wind: 1 };
  function wetterTick(tick) {
    if (wetter.next < 0) {
      // frischer Level-Start: Phase halten, ersten Wechsel planen
      wetter.next = tick + 1080 + ((tick * 17) % 1320);
      wetter.blend = 1;
    } else if (tick >= wetter.next) {
      var i = WETTER_PHASEN.indexOf(wetter.typ);
      wetter.typ = WETTER_PHASEN[(i + 1) % WETTER_PHASEN.length];
      // 18–40 s bei 60 Hz
      wetter.next = tick + 1080 + ((tick * 17) % 1320);
      wetter.blend = 0;
    }
    if (wetter.blend < 1) wetter.blend = Math.min(1, wetter.blend + 0.02);
    if (wetter.typ === 'gewitter') {
      // seltener Blitz
      if (wetter.blitz > 0) wetter.blitz--;
      else if (((tick * 13) % 97) === 0) wetter.blitz = 8 + (tick % 5);
    } else wetter.blitz = 0;
    wetter.wind = 0.6 + 0.5 * Math.sin(tick / 90);
  }
  function drawWetter(ctx, tick) {
    var t = wetter.typ, a = wetter.blend, i, x, y, len;
    if (t === 'regen' || t === 'gewitter') {
      ctx.fillStyle = t === 'gewitter' ? 'rgba(20,30,50,' + (0.18 * a).toFixed(3) + ')' : 'rgba(30,40,60,' + (0.12 * a).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      var n = t === 'gewitter' ? 70 : 48;
      var wind = wetter.wind * 10;
      for (i = 0; i < n; i++) {
        x = ((i * 89 + tick * (4 + (i % 3))) + wind * 8) % (W + 40) - 20;
        y = ((i * 53 + tick * (14 + (i % 5))) % (H + 60)) - 30;
        len = 10 + (i % 5) * 3;
        ctx.strokeStyle = t === 'gewitter' ? 'rgba(180,200,255,' + (0.35 * a).toFixed(2) + ')' : 'rgba(160,180,220,' + (0.28 * a).toFixed(2) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + wind, y + len);
        ctx.stroke();
      }
    }
    if (t === 'gewitter' && wetter.blitz > 0) {
      var flash = wetter.blitz > 5 ? 0.55 : 0.22;
      ctx.fillStyle = 'rgba(220,230,255,' + flash.toFixed(2) + ')';
      ctx.fillRect(0, 0, W, H);
      // Blitz-Zacken
      var bx = 200 + ((tick * 7) % 880);
      ctx.strokeStyle = 'rgba(255,255,240,0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + 30, 140);
      ctx.lineTo(bx - 20, 160);
      ctx.lineTo(bx + 40, 320);
      ctx.lineTo(bx - 10, 340);
      ctx.lineTo(bx + 25, 520);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(180,200,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx + 8, 0);
      ctx.lineTo(bx + 38, 150);
      ctx.lineTo(bx - 8, 180);
      ctx.stroke();
    }
    if (t === 'sonne') {
      // warme Sonne / Godrays trotz Hölle
      var gx = 960, gy = 120;
      ctx.fillStyle = 'rgba(255,200,80,' + (0.10 * a).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(gx, gy, 90 + Math.sin(tick / 20) * 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,140,' + (0.16 * a).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(gx, gy, 40, 0, Math.PI * 2); ctx.fill();
      for (i = 0; i < 7; i++) {
        var ang = -0.9 + i * 0.28 + Math.sin(tick / 40 + i) * 0.03;
        ctx.fillStyle = 'rgba(255,180,60,' + (0.045 * a).toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + Math.cos(ang) * 900, gy + Math.sin(ang) * 900);
        ctx.lineTo(gx + Math.cos(ang + 0.08) * 900, gy + Math.sin(ang + 0.08) * 900);
        ctx.closePath();
        ctx.fill();
      }
      // leichter Warmton über der Arena
      ctx.fillStyle = 'rgba(255,140,40,' + (0.05 * a).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (t === 'klar' && a < 1) {
      // sanfter Übergang zurück
    }
  }

  function arena(ctx, tick, snap) {
    if (!layers) layers = backeLayers();
    var G = P().glut || GLUT_DEF, o, i, f;
    arenaSnap = snap || null;
    // Kamera v2.9: stärkerer Follow → spürbarer Perspektivwechsel beim Laufen
    if (snap && snap.p && snap.p.length === 2) {
      var target = ((snap.p[0].x + snap.p[1].x) / 2 - W / 2) * 0.72;
      target = Math.max(-CAM_MAX, Math.min(CAM_MAX, target));
      camX += (target - camX) * 0.18;
      publikumHit(snap);
    }
    if (hopT > 0) hopT--;
    wetterTick(tick);

    // L0
    drawLayer(ctx, layers.L0, PAR.L0, tick, 'L0');
    if (levelId === 'hoelle') {
      // Blutmond-Puls
      if ((tick % 90) < 10) {
        ctx.fillStyle = 'rgba(255,60,20,0.14)';
        ctx.beginPath(); ctx.arc(MOND.x + ofs(PAR.L0, 'L0', tick), MOND.y, MOND.r + 24, 0, Math.PI * 2); ctx.fill();
      }
    }

    // L1
    drawLayer(ctx, layers.L1, PAR.L1, tick, 'L1');
    if (levelId === 'hoelle') {
      o = ofs(PAR.L1, 'L1', tick);
      var vf = ((tick / 6) | 0) % 4;
      for (i = 0; i < KRATER.length; i++) {
        var kx = KRATER[i][0] + o, ky = KRATER[i][1], v = (vf + i) % 4;
        ctx.fillStyle = v < 2 ? G[9] : G[10];
        ctx.fillRect(kx - 8, ky - 6 - v * 2, 16, 4 + v * 2);
        ctx.fillStyle = G[10];
        ctx.fillRect(kx - 4 + ((v * 3) % 7), ky - 14 - v * 6, 2, 4);
      }
    }

    // L2
    drawLayer(ctx, layers.L2, PAR.L2, tick, 'L2');
    if (levelId === 'hoelle') {
      o = ofs(PAR.L2, 'L2', tick);
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
    } else if (levelId === 'stadt') {
      // Neon-Flicker in der Ruinenstadt
      o = ofs(PAR.L2, 'L2', tick);
      if ((tick % 50) < 32) {
        ctx.fillStyle = 'rgba(255,58,8,0.18)';
        ctx.fillRect(310 + o, 360, 90, 20);
        ctx.fillStyle = 'rgba(64,160,255,0.18)';
        ctx.fillRect(990 + o, 340, 110, 20);
      }
    }

    // Publikum nur Hölle (Dämonen)
    o = ofs(PAR.L3, 'L3', tick);
    if (levelId === 'hoelle' && layers.daemon) {
      for (i = 0; i < PUBLIKUM.length; i++) {
        var pu = PUBLIKUM[i], dy = ((tick / 20 + i * 1.7) | 0) % 2 * 2;
        if (hopT > 0) dy += Math.round(Math.abs(Math.sin((20 - hopT) * 0.45 + i * 0.9)) * 14);
        ctx.drawImage(layers.daemon[hopT > 0 ? 1 - pu[2] : pu[2]], pu[0] + o - 20, pu[1] - dy);
      }
    }

    // L3 + hell-only Brunnen/Kiosk
    drawLayer(ctx, layers.L3, PAR.L3, tick, 'L3');
    if (levelId === 'hoelle') {
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
      var sd = (tick % 30) * 3;
      ctx.fillRect(bx - 56, 440 + sd, 2, 6);
      ctx.fillRect(bx + 54, 440 + ((sd + 40) % 90), 2, 6);
      var kf = ((tick / 4) | 0) % 3, kxx = KIOSK.x + o;
      ctx.fillStyle = G[8]; ctx.fillRect(kxx - 12, KIOSK.y - 12 - kf * 2, 24, 12 + kf * 2);
      ctx.fillStyle = G[10]; ctx.fillRect(kxx - 6 + kf * 2, KIOSK.y - 22 + kf * 2, 8, 20 - kf * 2);
      ctx.fillStyle = G[11]; ctx.fillRect(kxx - 2, KIOSK.y - 10, 4, 8);
    } else if (levelId === 'bruecke') {
      // Laternen-Puls (Positionen analog bakeBruecke)
      o = ofs(PAR.L3, 'L3', tick);
      for (i = 0; i < 6; i++) {
        var lx = 160 + i * 240 + o;
        var pul = 0.35 + 0.25 * Math.sin(tick / 12 + i);
        ctx.fillStyle = 'rgba(255,154,56,' + pul.toFixed(2) + ')';
        ctx.fillRect(lx - 6, 394, 18, 12);
      }
    } else if (levelId === 'dschungel') {
      // Glühwürmchen
      o = ofs(PAR.L3, 'L3', tick);
      for (i = 0; i < 16; i++) {
        var fx = ((i * 97 + tick * 0.4) % LW) + o;
        var fy = 280 + ((i * 53 + tick) % 220);
        var fa = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(tick / 8 + i));
        ctx.fillStyle = (i % 3 === 0) ? 'rgba(200,255,120,' + fa.toFixed(2) + ')' : 'rgba(255,230,80,' + fa.toFixed(2) + ')';
        ctx.fillRect(Math.round(fx), Math.round(fy), 3, 3);
      }
    }

    // L4
    drawLayer(ctx, layers.L4, PAR.L4, tick, 'L4');
    o = ofs(PAR.L4, 'L4', tick);
    if (levelId === 'hoelle') {
      var rl = layers.L4r && layers.L4r[((tick / 16) | 0) % 3];
      if (rl) ctx.drawImage(rl, o, 600);
      var pulse = 0.10 + 0.08 * Math.sin(tick / 14);
      ctx.fillStyle = 'rgba(255,58,8,' + pulse.toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(720 + o, 704, 150, 44, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,176,64,' + (pulse * 0.8).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(720 + o, 704, 30, 9, 0, 0, Math.PI * 2); ctx.fill();
      for (i = 0; i < 24; i++) {
        var life = 220 + (i * 37) % 120, ph = (tick + i * 53) % life;
        var ey = 768 - ph * (1.6 + (i % 5) * 0.3);
        if (ey < 120) continue;
        var ex = ((i * 197 + 61) % LW) + Math.sin((tick + i * 20) / 18) * 10 + ofs(PAR.L4, 'L4', tick);
        ctx.fillStyle = (ey > 480 && ey < 640) ? G[6] : (ph < life * 0.4 ? G[10] : G[8]);
        ctx.fillRect(Math.round(ex), Math.round(ey), 2, 2);
      }
      for (i = 0; i < 18; i++) {
        var ax = ((i * 71 + tick * 0.55) % LW) + ofs(PAR.L1, 'L1', tick);
        var ay = 200 + ((i * 97 + tick) % 280);
        ctx.fillStyle = 'rgba(40,20,30,' + (0.18 + (i % 3) * 0.06).toFixed(2) + ')';
        ctx.fillRect(Math.round(ax), Math.round(ay), 3 + (i % 2), 2);
      }
      // Heat-Shimmer am Boden — dynamisch, nicht starr (v2.9)
      var shim = Math.sin(tick / 9) * 3;
      ctx.fillStyle = 'rgba(255,120,40,0.045)';
      for (i = 0; i < 5; i++) {
        var sy = 560 + i * 18 + Math.round(Math.sin(tick / 7 + i) * 4);
        ctx.fillRect(0, sy, W, 3);
        ctx.fillRect(Math.round(shim * (i + 1)), sy + 6, W, 2);
      }
    } else if (levelId === 'stadt') {
      // Asche / Glut-Funken
      for (i = 0; i < 20; i++) {
        var life2 = 180 + (i * 41) % 100, ph2 = (tick + i * 47) % life2;
        var ey2 = 720 - ph2 * 1.4;
        if (ey2 < 200) continue;
        var ex2 = ((i * 163 + 40) % LW) + Math.sin((tick + i) / 20) * 8 + o;
        ctx.fillStyle = ph2 < 40 ? '#ff6020' : '#5a3030';
        ctx.fillRect(Math.round(ex2), Math.round(ey2), 2, 2);
      }
    } else if (levelId === 'dschungel') {
      // fallende Blätter
      for (i = 0; i < 12; i++) {
        var ly = ((tick * 1.2 + i * 70) % (H + 40)) - 20;
        var lx = ((i * 130 + tick * 0.3) % LW) + o + Math.sin(tick / 15 + i) * 12;
        ctx.fillStyle = (i % 2) ? '#2a6838' : '#1a4028';
        ctx.fillRect(Math.round(lx), Math.round(ly), 5, 3);
      }
    }
  }

  function fg(ctx, tick) {
    if (!layers) return;
    drawLayer(ctx, layers.L5, PAR.L5, tick, 'L5');
    if (levelId !== 'hoelle') return; // Fackeln/Kegel nur Hölle
    var o = ofs(PAR.L5, 'L5', tick), f = ((tick / 5) | 0) % 3;
    var ps = arenaSnap && arenaSnap.p;
    for (var i = 0; i < FACKELN.length; i++) {
      var fx = FACKELN[i] + o, a = 1;
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

  // v1.8: Memo. Wird pro Figur und Frame ~150× mit denselben Paletten-Werten gerufen
  var HEX_MEMO = {};
  function hexShade(hex, amt) {
    var k = hex + '|' + amt, v = HEX_MEMO[k];
    if (v === undefined) v = HEX_MEMO[k] = hexShade0(hex, amt);
    return v;
  }
  function hexShade0(hex, amt) {
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
    // v1.8 Win-Pose-Timing (p._winT = Render-Frames seit Rundenende, Fallback tick):
    // 0–9 Auftakt (geduckt, Arme halb), 10–17 Pop mit Überschwinger, ab 18 Halten, Pulse alle 48 Frames
    var winT = win ? (p._winT != null ? p._winT | 0 : tick) : 0;
    var wAuf = win && winT < 10, wPop = win && winT >= 10 && winT < 18;
    var wPh = (win && winT >= 18) ? (winT - 18) % 48 : 99;
    var wSin = win ? Math.sin(winT * 0.13) : 0;
    var wk = wAuf ? 0.3 : (wPop ? 1.2 - 0.2 * (winT - 10) / 7 : 1);
    if (win) dipY = wAuf ? 4 : (wPop ? (id === 'nina' ? -8 : -3) : Math.round(wSin));
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
    // v1.8: Haltung im Sieg (Rocco/Lola/Toni zurückgelehnt, Nina nach vorn)
    if (win) leanL = id === 'rocco' ? -4 : (id === 'lola' ? -3 : (id === 'toni' ? -2 : (id === 'nina' ? 2 : 0)));
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
      var r = t / 2, i, sx, sy;
      var T = Math.round(t);
      if (T < 2 || ctx.globalAlpha < 1) {
        for (i = 0; i <= n; i++) M(Math.round(x0 + dx * i / n - r), Math.round(y0 + dy * i / n - r), t, t, col);
        return;
      }
      // v1.8: Läufe mit gleicher Spalte/Zeile zu einem Rechteck verschmelzen (pixelgleich)
      var steil = Math.abs(dy) >= Math.abs(dx), qa = 0, lo = 0, hi = 0, on = false, fa, fb;
      for (i = 0; i <= n; i++) {
        sx = Math.round(x0 + dx * i / n - r); sy = Math.round(y0 + dy * i / n - r);
        fa = steil ? sx : sy; fb = steil ? sy : sx;
        if (on && fa === qa && fb >= lo - T && fb <= hi + T) { if (fb < lo) lo = fb; if (fb > hi) hi = fb; continue; }
        if (on) { if (steil) M(qa, lo, T, hi - lo + T, col); else M(lo, qa, hi - lo + T, T, col); }
        on = true; qa = fa; lo = hi = fb;
      }
      if (steil) M(qa, lo, T, hi - lo + T, col); else M(lo, qa, hi - lo + T, T, col);
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
    // v1.7: Impact-Stern für Faust/Hammer, erst alle Konturen, dann Farbe
    function glutStern(lx, ly, s, col) {
      var d = Math.round(s * 0.55), q;
      M(lx - s - 2, ly - 5, s * 2 + 4, 10, ink);
      M(lx - 5, ly - s - 2, 10, s * 2 + 4, ink);
      for (q = 0; q < 4; q++) M(lx + (q & 1 ? d : -d) - 5, ly + (q & 2 ? d : -d) - 5, 10, 10, ink);
      M(lx - s, ly - 3, s * 2, 6, col);
      M(lx - 3, ly - s, 6, s * 2, col);
      for (q = 0; q < 4; q++) M(lx + (q & 1 ? d : -d) - 3, ly + (q & 2 ? d : -d) - 3, 6, 6, col);
      M(lx - 5, ly - 5, 10, 10, '#fff8ee');
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
    var winPulse = win && wPh < 3;                       // 3 Frames alle 48: Arm zuckt 4 px, Prop glänzt
    if (win) {
      // v1.8: Pose pro Char [Ellbogen x, y, Hand x, y], aus der Grundhaltung mit wk eingeblendet
      var wp = winPulse ? 4 : 0, winF, winB, wi0;
      if (id === 'lola') {            // Flamenco: Arm im Bogen über dem Kopf, andere Hand in der Hüfte
        winF = [shF + 8, shY - 30, shB + 4, shY - 52]; winB = [shB - 14, shY + 18, shB + 4, tb - 10];
      } else if (id === 'toni') {     // Hammer senkrecht hoch, hinterer Arm zeigt den Bizeps
        winF = [shF + 6, shY - 22, shF + 8, shY - 46]; winB = [shB - 20, shY + 4, shB - 14, shY - 22];
      } else if (id === 'rocco') {    // Türsteher: Arme vor der Brust verschränkt
        winF = [shF + 14, shY + 20, shB + 14, shY + 16]; winB = [shB + 4, shY + 24, shF + 2, shY + 12];
      } else if (id === 'nina') {     // Faust zur Sonne, hinterer Arm im V nach hinten oben
        winF = [shF + 12, shY - 20, shF + 24, shY - 46]; winB = [shB - 18, shY - 8, shB - 32, shY - 26];
      } else {                         // Biel: Fang hoch, andere Hand in der Hüfte
        winF = [shF + 12, shY - 16, shF + 18, shY - 42]; winB = [shB - 16, shY + 16, shB + 6, tb - 10];
      }
      if (id !== 'rocco') { winF[1] -= wp >> 1; winF[3] -= wp; }
      for (wi0 = 0; wi0 < 4; wi0++) {
        aF[wi0] = Math.round(aF[wi0] + (winF[wi0] - aF[wi0]) * wk);
        aB[wi0] = Math.round(aB[wi0] + (winB[wi0] - aB[wi0]) * wk);
      }
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
      else if (win) {                           // v1.8: Stand pro Char
        if (id === 'lola') { ax = 2; al = 4; ak = 6; bx = -18; bk = 2; }            // Fuß gekreuzt, auf der Spitze
        else if (id === 'toni') { ax = 22; ak = 4; bx = -22; bk = 4; }               // breit, schwer
        else if (id === 'rocco') { ax = 20; ak = 2; bx = -22; bk = 2; }              // breit, steif
        else if (id === 'nina') { ax = 8; al = 14; ak = 12; bx = -12; bk = 2; }      // Knie hoch
        else { ax = 12; ak = 2; bx = -16; bk = 2; }
        if (wAuf) { ax = ax >> 1; bx = -((-bx) >> 1); al = 0; ak = 6; bk = 6; }
      }
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
      if (hot) {
        alpha(0.22); M(kx - 16, ky - 16, kw + 32, kh + 32, '#ff4a18');
        alpha(0.45); M(kx - 8, ky - 8, kw + 16, kh + 16, '#ff6a20');
        alpha(1);
      }
      P(kx, ky, kw, kh, '#4a4a52');
      var face = hot ? '#ff4a18' : '#7a7a84';
      if (vert) { M(kx + kw - 6, ky + 2, 4, kh - 4, face); M(kx + 2, ky + 2, 4, kh - 4, '#2a2a30'); }
      else { M(kx + 2, ky + kh - 6, kw - 4, 4, face); M(kx + 2, ky + 2, kw - 4, 4, '#2a2a30'); }
      M(kx + (kw >> 1) - 2, ky + (kh >> 1) - 2, 4, 4, '#c09048');
      if (hot && impact) glutStern(Math.round(ex + dx * 20), Math.round(eyy + dy * 20), 18 + wt * 3, '#ffe080');
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
      hammer(aF[2], aF[3], hdx, hdy, hot || (win && !wAuf));   // v1.8: glüht in der ganzen Siegerpose
      if (art === 'special' && phase !== 'wind') {
        var gx = aF[2] + 18;
        alpha(0.9);
        M(gx - 42, h - 6, 84, 8, ink); M(gx - 40, h - 4, 80, 4, '#ff4a18');
        M(gx - 24, h - 14, 8, 10, ink); M(gx - 22, h - 12, 4, 8, '#ffb040');
        M(gx + 14, h - 12, 8, 8, ink); M(gx + 16, h - 10, 4, 6, '#ffb040');
        // Rissglut unter dem Pflaster (BODEN + 8 = 648, wie die Arena-Risse)
        M(gx - 32, h + 8, 22, 4, '#ff3a08'); M(gx - 14, h + 8, 4, 12, '#ff3a08');
        M(gx + 8, h + 10, 26, 4, '#ff3a08'); M(gx + 30, h + 10, 4, 10, '#ff6020');
        for (var i = 0; i < 6; i++) {
          var ey0 = h - 12 - ((atkF * 5 + i * 7) % 34);
          M(gx + (i - 3) * 14 - 2, ey0 - 2, 8, 8, ink);
          M(gx + (i - 3) * 14, ey0, 4, 4, i % 2 ? '#ffb040' : '#ffe080');
        }
        alpha(0.4);
        M(gx - 46, h - 18, 92, 12, '#5a3020');
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
      for (yy = ny; yy <= ny + nh; yy += 9) M(nx - 1, yy - 1, nw + 2, 4, ink);
      for (xx = nx; xx <= nx + nw; xx += 9) M(xx - 1, ny - 1, 4, nh + 2, ink);
      for (yy = ny; yy <= ny + nh; yy += 9) M(nx, yy, nw, 2, '#b08050');
      for (xx = nx; xx <= nx + nw; xx += 9) M(xx, ny, 2, nh, '#b08050');
      for (yy = ny; yy <= ny + nh; yy += 18) for (xx = nx; xx <= nx + nw; xx += 18) K(xx - 3, yy - 3, 8, 8, '#5ec8b8');
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
      var ig = 18 + wt * 4;
      alpha(0.3); M(aF[2] - ig, aF[3] - ig, ig * 2, ig * 2, '#ff4a18');
      alpha(0.7); M(aF[2] - 12, aF[3] - 12, 24, 24, '#fff8ee'); alpha(1);
      if (id !== 'toni') glutStern(aF[2] + 14, aF[3], 16 + wt * 4, '#ffe080');   // Toni: Stern sitzt am Hammer (F3b)
    }

    // Block-Schild
    if (blk) {
      var bL = Math.round(tw / 2) + 22;
      alpha(0.5); M(bL, tt - 6, 6, tb - tt + 12, accent);
      alpha(0.85); M(bL + 2, tt - 2, 2, tb - tt + 4, '#ffb040');
      for (var cy2 = tt; cy2 < tb; cy2 += 12) M(bL - 5, cy2, 4, 4, '#ffe080');
      alpha(1);
    }

    // v1.8 Win-Pose: Krone (Kontur) + Char-Flair. Auftakt ohne Flair, Pop mit fallender Krone, Pulse alle 48 Frames
    if (win && !wAuf) {
      var wy = Math.round(wSin * 2) - (wPop ? 18 - winT : 0), kx2 = Math.round(kopfX), wi;
      // Krone sitzt knapp über Hut/Haar: Biel Mütze −14, Lola Peineta −20, Toni Glatze 0, Rocco Flat-Top −6, Nina Bügel −10
      var ky0 = wy + (id === 'lola' ? -36 : (id === 'biel' ? -30 : (id === 'nina' ? -26 : (id === 'rocco' ? -22 : -16))));
      K(kx2 - 18, ky0 - 10, 8, 12, '#ffe080'); K(kx2 - 4, ky0 - 15, 8, 17, '#ffe080'); K(kx2 + 10, ky0 - 10, 8, 12, '#ffe080');
      K(kx2 - 20, ky0, 40, 12, '#ffb040');
      M(kx2 - 18, ky0 + 2, 36, 2, '#fff0c0');
      M(kx2 - 11, ky0 + 5, 4, 4, accent); M(kx2 - 2, ky0 + 5, 4, 4, '#ff3a08'); M(kx2 + 7, ky0 + 5, 4, 4, accent);
      if (winPulse) M(kx2 - 2, ky0 - 22, 4, 6, '#fff8ee');
      if (id === 'biel') {                     // Fisch am Schwanz gepackt, zappelt
        var fx2 = aF[2], fy2 = aF[3] - 4, zp = (winPulse ? 4 : 0) + Math.round(wSin * 2);
        K(fx2 - 8, fy2 - 12 - zp, 10, 9, '#4a7888'); K(fx2 - 8, fy2 + 3 + zp, 10, 9, '#4a7888');
        K(fx2 + 2, fy2 - 9, 46, 18, '#6a98a8');
        M(fx2 + 6, fy2 + 1, 38, 5, '#c8e0e8'); M(fx2 + 6, fy2 - 7, 30, 2, '#9ac0cc');
        for (wi = 0; wi < 4; wi++) M(fx2 + 10 + wi * 7, fy2 - 3, 3, 3, '#4a7888');   // Schuppen
        K(fx2 + 14, fy2 - 15, 16, 8, '#4a7888');
        M(fx2 + 36, fy2 - 5, 5, 5, '#fff8ee'); M(fx2 + 38, fy2 - 4, 2, 2, ink); M(fx2 + 44, fy2 + 2, 4, 2, ink);
        faust(aF[2], aF[3], LK.hand, false);
        if (winPulse) { K(fx2 - 16, fy2 - 26, 6, 8, '#80d8ff'); K(fx2 + 50, fy2 - 22, 6, 8, '#80d8ff'); stern(fx2 + 24, fy2 - 24, 9, '#fff8ee'); }
      } else if (id === 'lola') {              // Rosenblätter-Regen
        for (wi = 0; wi < 12; wi++) {
          var pyl = -70 + ((winT * 2 + wi * 37) % 220), pxl = ((wi * 53) % 170) - 85 + Math.round(Math.sin((winT + wi * 20) * 0.08) * 8);
          K(pxl, pyl, 10, 8, wi % 3 ? '#d01838' : '#ff5a70'); M(pxl + 2, pyl + 2, 3, 2, '#ff8090');
        }
      } else if (id === 'toni') {              // Funkenkranz um den glühenden Hammerkopf
        var hx2 = aF[2] + 7, hy2 = aF[3] - 44;
        for (wi = 0; wi < 6; wi++) {
          var ang = wi * 1.047 + winT * 0.05, rr2 = 22 + ((winT * 3 + wi * 11) % 30);
          var sxp = Math.round(hx2 + Math.cos(ang) * rr2), syp = Math.round(hy2 + Math.sin(ang) * rr2 * 0.7);
          M(sxp - 3, syp - 3, 7, 7, ink); M(sxp - 1, syp - 1, 3, 3, wi % 2 ? '#ffb040' : '#ffe080');
        }
        if (winPulse) glutStern(hx2, hy2, 22, '#ffe080');
      } else if (id === 'rocco') {             // zweiter Unterarm über dem ersten, Glanz wandert über die Brille
        glied([shB + 6, shY + 28, shF + 16, shY + 26], LK.t, hexShade(LK.armU, -10));
        faust(shF + 18, shY + 26, LK.hand, false);
        var gl = winT % 48;
        if (gl < 12) M(kL + hw - 26 + gl * 2, ey - 2, 2, 7, '#fff8ee');
        if (winPulse) stern(kL + hw - 6, ey, 10, '#fff8ee');
      } else if (id === 'nina') {              // Sonne über der Faust, Strahlenkranz dreht sich
        var sr = 10 + (winPulse ? 4 : 0) + Math.round(wSin), scx = aF[2], scy = aF[3] - 28;
        sonne(scx, scy, sr);
        for (wi = 0; wi < 8; wi++) {
          var a8 = wi * 0.785 + winT * 0.06;
          var rx8 = Math.round(scx + Math.cos(a8) * (sr + 12)), ry8 = Math.round(scy + Math.sin(a8) * (sr + 12));
          M(rx8 - 3, ry8 - 3, 7, 7, ink); M(rx8 - 1, ry8 - 1, 3, 3, '#ffe080');
        }
      }
      ctx.fillStyle = winPulse ? 'rgba(255,200,96,0.5)' : 'rgba(255,176,64,0.35)';
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
  /* ==== Plaza-Kampf v1.7 — FX-Drop-in (render.js) ===================================
   * ANKER: ersetzt in js/render.js alles ab der Zeile
   *            "  /* ---- FX ---- *\/"
   *        bis AUSSCHLIESSLICH zur Zeile
   *            "  function hud(ctx, snap, ich) {"
   *        (also spawnFx, updateFxFromDiff, nametag, drawFx). nametag ist unverändert.
   *        Neu im Block: zeichneProjektile(ctx, snap). Den Aufruf in zeichne() setzt
   *        fig-patch-v1.7.js (Patch Z1), dort steht auch der resetFx-Zusatz (Patch Z2).
   * Regeln: rein visuell. Lebensdauern (e.t-Grenzen), shake, flash und kampf.js bleiben
   *        unverändert, die Projektil-Hitboxen auch. Keine Math.random, damit Screenshots und
   *        beide MP-Clients identisch bleiben. 2-px-Kontur überall in FX_INK.
   * Partikel-Budget (fx-Einträge pro Ereignis, v1.6 → v1.7): Treffer 3 → 6, Heavy 6 → 10,
   *        Special 6 → 9, Heavy+Special 9 → 13 (Obergrenze 2× = 18), Block 1 → 2, Armor 1 → 2,
   *        Landung 1 → 1. Höchstens 2× pro Ereignis.
   * ================================================================================= */
  var FX_INK = '#1a0606';
  var FX_R = [];                 // Scratch-Liste [x, y, w, h, …], wird pro Effekt geleert
  var fxSeq = 0;
  var projAlt = [];              // Projektil-Positionen des Vorframes (für die Trail-Richtung)

  function fxHash(n) {
    n = (n ^ 61) ^ (n >>> 16);
    n = Math.imul(n, 0x27d4eb2d);
    return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
  }

  // Alle Rechtecke erst als Kontur (+2 px), dann in Farbe → keine Tinte in Überlappungen
  function fxKontur(ctx, R, col) {
    var k;
    ctx.fillStyle = FX_INK;
    for (k = 0; k < R.length; k += 4) ctx.fillRect(Math.round(R[k]) - 2, Math.round(R[k + 1]) - 2, Math.round(R[k + 2]) + 4, Math.round(R[k + 3]) + 4);
    ctx.fillStyle = col;
    for (k = 0; k < R.length; k += 4) ctx.fillRect(Math.round(R[k]), Math.round(R[k + 1]), Math.round(R[k + 2]), Math.round(R[k + 3]));
    R.length = 0;
  }

  // Zentriertes Quadrat in die Liste
  function fxQ(R, cx, cy, s) { R.push(cx - s / 2, cy - s / 2, s, s); }

  // Kreis mit 2-px-Kontur
  function fxKreis(ctx, x, y, r, col) {
    ctx.fillStyle = FX_INK;
    ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  var FX_MAX = 48; /* v2.6 Perf-Cap */
  function spawnFx(kind, x, y, col, vx, vy) {
    if (fx.length >= FX_MAX) fx.splice(0, fx.length - FX_MAX + 1);
    fx.push({ kind: kind, x: x, y: y, t: 0, col: col || '#fff8ee', vx: vx || 0, vy: vy || 0, seed: (fxSeq++) * 977 + (x | 0) });
  }

  // n Splitter in Rückstoßrichtung (dir = ±1), Fächer nach oben
  function splitter(n, x, y, dir, col, kraft) {
    for (var k = 0; k < n; k++) {
      var h = fxHash(fxSeq * 31 + k * 7 + (x | 0));
      var ang = -0.25 - h * 1.1;                       // 15°–78° über der Horizontalen
      var v = kraft * (0.75 + 0.5 * fxHash(fxSeq * 17 + k));
      spawnFx('shard', x, y, k === 0 ? '#fff8ee' : col, dir * Math.cos(ang) * v, Math.sin(ang) * v);
    }
  }

  function updateFxFromDiff(snap) {
    if (!snap || !snap.p) return;
    var BODEN = Plaza.Kampf.BODEN;
    if (prevSnap && prevSnap.p) {
      for (var i = 0; i < 2; i++) {
        var a = prevSnap.p[i], b = snap.p[i];
        if (!a || !b) continue;
        var kind = b.hitKind || '';
        var seqGrew = (b.hitSeq | 0) > (a.hitSeq | 0);
        var gg = snap.p[1 - i];
        var dir = gg && gg.x > b.x ? -1 : 1;           // weg vom Angreifer
        if (b.hp < a.hp || seqGrew) {
          if (kind === 'heavy' || kind === 'throw') shake = 5;
          else if (kind === 'block') shake = 1;
          flash[i] = kind === 'armor' ? 6 : 4;
          if (kind === 'block') {
            spawnFx('block', b.x, b.y - 56, '#ffe080');
            splitter(1, b.x - dir * 24, b.y - 72, -dir, '#ffe080', 8);
          } else if (kind === 'armor') {
            spawnFx('armor', b.x, b.y - 64, '#ffb040');
            splitter(1, b.x - dir * 36, b.y - 80, -dir, '#ffb040', 9);
          } else {
            var col = Plaza.Chars.finde(b.charId).accent || '#ff3a08';
            spawnFx('spark', b.x, b.y - 64, col);
            spawnFx('spark', b.x + 20, b.y - 80, '#fff0c0');
            spawnFx('ember', b.x - 12, b.y - 48, '#ff6020');
            splitter(3, b.x, b.y - 68, dir, col, 11);
            if (kind === 'special' || (b.hitKind === 'special')) {
              spawnFx('fireball', b.x + 16, b.y - 72, col);
              spawnFx('ice', b.x - 24, b.y - 56, '#80d8ff');
              spawnFx('knife', b.x, b.y - 80, '#ff2a4a');
            }
            if (a.hp - b.hp >= 10 || kind === 'heavy') {
              spawnFx('slash', b.x, b.y - 72, col);
              spawnFx('spark', b.x - 16, b.y - 88, '#fff8ee');
              spawnFx('fireball', b.x, b.y - 88, col);
              if (b.grounded || kind === 'throw') spawnFx('shock', b.x, BODEN, col);
            }
          }
        }
        if (!a.grounded && b.grounded) spawnFx('dust', b.x, BODEN, '#5a3020');
        if (a.grounded && !b.grounded) spawnFx('dust', b.x, BODEN, '#3a2010');
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

  // v1.8: gebackene Kapsel (hud-v1.8.js nametagBild), ganzzahlig, Pfeil zur Figur
  function nametag(ctx, p) {
    if (!p || !p.name) return;
    var label = String(p.name);
    if (label.length > 12) label = label.slice(0, 12);
    var c = Plaza.Chars.finde(p.charId);
    var top = Math.round(p.y) - (p.crouch ? 144 : 200);
    var b = nametagBild(label, (c && c.accent) || '#ff6020');
    if (b) { ctx.drawImage(b, Math.round(p.x) - (b.width >> 1), top - 30); return; }
    ctx.font = 'bold 28px ' + SCHRIFT;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe080';
    ctx.fillText(label, p.x, top);
  }

  // Bodenriss-Glut: 4 gezackte Spalten ab BODEN nach unten in den Rissbereich (≥ 648)
  function rissGlut(ctx, x, y0, t, life, seed, col) {
    var reach = Math.min(1, (t + 1) / 4);              // wachsen 4 Ticks, dann ausglühen
    ctx.globalAlpha = Math.max(0, 1 - t / life);
    for (var r = 0; r < 4; r++) {
      var sx = r < 2 ? -1 : 1, cx = x + sx * (8 + r % 2 * 10), cy = y0 + 8, n = Math.round(6 * reach);
      for (var s = 0; s < n; s++) {
        var h = fxHash(seed + r * 101 + s * 13);
        var dx = sx * (8 + Math.round(h * 4) * 2), dy = (h < 0.5 ? 2 : 4);
        if (cy + dy > y0 + 40) dy = -2;
        R_push(cx, cy, dx, dy);
        cx += dx; cy += dy;
      }
    }
    fxKontur(ctx, FX_R, t < 4 ? '#ffb040' : col);
    ctx.globalAlpha = 1;
  }
  function R_push(cx, cy, dx, dy) {
    FX_R.push(Math.min(cx, cx + dx), cy, Math.abs(dx) + 4, 4);
    FX_R.push(cx + dx, Math.min(cy, cy + dy), 4, Math.abs(dy) + 4);
  }

  function drawFx(ctx) {
    var R = FX_R, k, d, s;
    for (var i = fx.length - 1; i >= 0; i--) {
      var e = fx[i];
      e.t++;
      if (e.kind === 'spark') {
        // 8-Strahl-Stern, v1.6: 16/32/20 → v1.7: 24/44/28 Halbgröße, Kern 8 px + Kontur
        s = e.t < 2 ? 24 : e.t < 4 ? 44 : e.t < 7 ? 28 : 0;
        if (s <= 0) { fx.splice(i, 1); continue; }
        d = s * 0.6;
        R.push(e.x - 4, e.y - s, 8, s * 2, e.x - s, e.y - 4, s * 2, 8);
        for (k = 0; k < 4; k++) {
          var sx = k & 1 ? 1 : -1, sy = k & 2 ? 1 : -1;
          fxQ(R, e.x + sx * d * 0.4, e.y + sy * d * 0.4, 8);
          fxQ(R, e.x + sx * d * 0.7, e.y + sy * d * 0.7, 6);
          fxQ(R, e.x + sx * d, e.y + sy * d, 4);
        }
        fxKontur(ctx, R, e.col);
        ctx.fillStyle = '#fff8ee';
        ctx.fillRect(Math.round(e.x - 2), Math.round(e.y - s * 0.6), 4, Math.round(s * 1.2));
        ctx.fillRect(Math.round(e.x - s * 0.6), Math.round(e.y - 2), Math.round(s * 1.2), 4);
        ctx.fillRect(Math.round(e.x - 6), Math.round(e.y - 6), 12, 12);
      } else if (e.kind === 'shard') {
        if (e.t > 10) { fx.splice(i, 1); continue; }
        e.x += e.vx; e.y += e.vy; e.vy += 0.9; e.vx *= 0.92;
        s = e.t < 4 ? 8 : e.t < 7 ? 6 : 4;
        // kurzer Schweif gegen die Flugrichtung
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ff3a08';
        ctx.fillRect(Math.round(e.x - e.vx * 1.4 - 2), Math.round(e.y - e.vy * 1.4 - 2), 4, 4);
        ctx.globalAlpha = 1;
        fxQ(R, e.x, e.y, s);
        fxKontur(ctx, R, e.t < 5 ? e.col : '#ff6020');
      } else if (e.kind === 'slash') {
        // Sichel aus 9 Segmenten statt 3 Balken, wandert wie v1.6 mit 4 px/Tick
        if (e.t > 6) { fx.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - e.t / 6;
        var ox = e.x - 8 + e.t * 4;
        for (k = 0; k <= 8; k++) {
          var an = -2.5 + k * 0.33, th = 4 + Math.round(8 * Math.sin(k / 8 * Math.PI));
          R.push(ox + Math.cos(an) * 52 - 6, e.y + 26 + Math.sin(an) * 40 - th / 2, 12, th);
        }
        fxKontur(ctx, R, e.col);
        ctx.fillStyle = '#fff8ee';
        for (k = 2; k <= 6; k++) {
          var an2 = -2.5 + k * 0.33;
          ctx.fillRect(Math.round(ox + Math.cos(an2) * 52 - 4), Math.round(e.y + 26 + Math.sin(an2) * 40 - 1), 8, 3);
        }
        ctx.globalAlpha = 1;
      } else if (e.kind === 'block') {
        if (e.t > 7) { fx.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - e.t / 7;
        s = e.t < 2 ? 0 : 4;                           // Klammer springt nach Tick 2 kurz auf
        R.push(e.x - 32 - s, e.y - 40, 64 + s * 2, 8);
        R.push(e.x - 36 - s, e.y - 32, 8, 52, e.x + 28 + s, e.y - 32, 8, 52);
        R.push(e.x - 28 - s, e.y + 20, 16, 6, e.x + 12 + s, e.y + 20, 16, 6);
        fxKontur(ctx, R, '#ffe080');
        // Raute im Zentrum
        R.push(e.x - 4, e.y - 20, 8, 32, e.x - 12, e.y - 8, 24, 8);
        fxKontur(ctx, R, '#fff8ee');
        ctx.fillStyle = '#ffb040';
        for (k = 0; k < 4; k++) ctx.fillRect(Math.round(e.x + (k & 1 ? 1 : -1) * (20 + e.t * 6) - 3), Math.round(e.y + (k & 2 ? 8 : -32) - e.t * 2), 6, 6);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'armor') {
        if (e.t > 8) { fx.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, 0.85 - e.t / 10);
        s = e.t * 2;
        R.push(e.x - 44 - s, e.y - 56 - s, 88 + s * 2, 8, e.x - 44 - s, e.y + 32 + s, 88 + s * 2, 8);
        R.push(e.x - 44 - s, e.y - 56 - s, 8, 96 + s * 2, e.x + 36 + s, e.y - 56 - s, 8, 96 + s * 2);
        fxKontur(ctx, R, '#ffb040');
        ctx.fillStyle = '#fff0c0';
        ctx.fillRect(e.x - 42 - s, e.y - 54 - s, 12, 4);
        ctx.fillRect(e.x + 30 + s, e.y + 34 + s, 12, 4);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'fireball') {
        if (e.t > 10) { fx.splice(i, 1); continue; }
        var fr = 32 - e.t * 2.2, fy = e.y - e.t * 4;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ff4a18';
        ctx.beginPath(); ctx.arc(e.x, fy, fr + 12, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        fxKreis(ctx, e.x, fy, fr, '#ff3a08');
        ctx.fillStyle = '#ffb040';
        ctx.beginPath(); ctx.arc(e.x - 2, fy - 2, fr * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = e.t < 3 ? '#fff8ee' : '#ffe080';
        ctx.fillRect(Math.round(e.x - 8), Math.round(fy - 10), 12, 12);
      } else if (e.kind === 'ice') {
        if (e.t > 9) { fx.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - e.t / 9;
        R.push(e.x - 4 - e.t * 4, e.y - 32, 8, 64, e.x - 32, e.y - 4, 64, 8);
        for (k = 0; k < 4; k++) fxQ(R, e.x + (k & 1 ? 1 : -1) * (18 + e.t * 2), e.y + (k & 2 ? 1 : -1) * (18 + e.t * 2), 8);
        fxKontur(ctx, R, '#80d8ff');
        ctx.fillStyle = '#e8ffff';
        ctx.fillRect(e.x - 8, e.y - 8, 16, 16);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'knife') {
        if (e.t > 8) { fx.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - e.t / 8;
        var kx = e.x + e.t * 4;
        R.push(kx - 32, e.y - 4, 52, 8, kx - 40, e.y - 2, 8, 4);
        fxKontur(ctx, R, '#c0c8d0');
        R.push(kx + 20, e.y - 10, 14, 20);
        fxKontur(ctx, R, '#ff2a4a');
        ctx.fillStyle = '#fff8ee';
        ctx.fillRect(kx - 28, e.y - 4, 44, 2);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'ember') {
        if (e.t > 12) { fx.splice(i, 1); continue; }
        var exx = e.x + (e.t % 3) * 4 - 4, eyy = e.y - e.t * 4;
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = '#ff3a08';
        ctx.fillRect(exx, eyy + 12, 4, 8);
        ctx.globalAlpha = 1;
        R.push(exx - 1, eyy, 6, 10);
        fxKontur(ctx, R, e.t < 4 ? '#ffb040' : '#ff3a08');
      } else if (e.kind === 'dust') {
        // je Seite 2 Staubballen (wachsen + driften), Unterkante auf BODEN
        if (e.t > 8) { fx.splice(i, 1); continue; }
        ctx.globalAlpha = 1 - e.t / 8;
        for (k = 0; k < 4; k++) {
          var sd = k & 1 ? 1 : -1, big = k < 2;
          s = (big ? 20 : 12) + e.t * 2;
          var dx = sd * ((big ? 20 : 44) + e.t * (big ? 5 : 7));
          R.push(e.x + dx - s / 2, e.y - s + 2 - (big ? 0 : e.t), s, s);
        }
        fxKontur(ctx, R, e.col);
        ctx.fillStyle = hexShade(e.col, 40);
        for (k = 0; k < 2; k++) {
          var sd2 = k ? 1 : -1;
          s = 20 + e.t * 2;
          ctx.fillRect(Math.round(e.x + sd2 * (20 + e.t * 5) - s / 2 + 2), Math.round(e.y - s + 4), s - 6, 4);
        }
        ctx.globalAlpha = 1;
      } else if (e.kind === 'shock') {
        // Boden-Schockwelle: flache Ellipse an BODEN + Glutspalten in den Rissbereich (≥ 648)
        if (e.t > 12) { fx.splice(i, 1); continue; }
        var rr = 28 + e.t * 12;
        ctx.globalAlpha = Math.max(0, 1 - e.t / 12);
        ctx.lineWidth = 8; ctx.strokeStyle = FX_INK;
        ctx.beginPath(); ctx.ellipse(e.x, e.y + 6, rr, rr * 0.18 + 4, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 4; ctx.strokeStyle = e.t < 4 ? '#ffe080' : '#ff4a18';
        ctx.beginPath(); ctx.ellipse(e.x, e.y + 6, rr, rr * 0.18 + 4, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.globalAlpha = 1;
        rissGlut(ctx, e.x, e.y, e.t, 12, e.seed, '#ff3a08');
      }
    }
    for (var j = 0; j < 2; j++) if (flash[j] > 0) flash[j]--;
  }

  /* ---- Projektile (v1.7): größer, 2-px-Kontur, Trail gegen die Flugrichtung ----
   * Hitboxen (kampf.js, unverändert): Ball 40×32·scale um (x, y); Fächer 32×32;
   * Bodenwelle 56×32 um (x, BODEN−16) → Grafik steht auf BODEN = y + h/2. */
  function projRichtung(pr, snap) {
    var best = null, bd = 64 * 64, k;
    for (k = 0; k < projAlt.length; k++) {
      var q = projAlt[k];
      if (q.owner !== pr.owner || q.typ !== pr.typ) continue;
      var dx = pr.x - q.x, dy = pr.y - q.y, dd = dx * dx + dy * dy;
      if (dd < bd && dd > 0) { bd = dd; best = q; }
    }
    var vx, vy;
    if (best) { vx = pr.x - best.x; vy = pr.y - best.y; }
    else {
      var o = snap.p && snap.p[pr.owner];
      vx = o && o.x > pr.x ? -10 : 10; vy = 0;
    }
    var l = Math.sqrt(vx * vx + vy * vy) || 1;
    return [vx / l, vy / l];
  }

  function zeichneProjektile(ctx, snap) {
    var list = snap.projektil || [], tck = snap.tick || 0, BODEN = Plaza.Kampf.BODEN;
    var R = FX_R, i, k;
    for (i = 0; i < list.length; i++) {
      var pr = list[i];
      var typ = pr.typ || 'ball';
      var px = pr.x | 0, py = pr.y | 0;
      var u = projRichtung(pr, snap), ux = u[0], uy = u[1];
      if (typ === 'bodenwelle') {
        // Lava-Erdstoß: Unterkante exakt BODEN, Zacken bis 40 px hoch, Glutspur dahinter
        var gy = Math.round(py + (pr.h || 32) / 2);
        if (Math.abs(gy - BODEN) > 2) gy = BODEN;
        var ww = 80 + ((tck + i) % 3) * 4;
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ff3a08';
        ctx.beginPath(); ctx.ellipse(px, gy + 6, ww * 0.8, 12, 0, 0, Math.PI * 2); ctx.fill();
        for (k = 1; k <= 3; k++) {             // Glutspur auf dem Pflaster
          ctx.globalAlpha = 0.5 - k * 0.12;
          ctx.fillRect(Math.round(px - ux * (ww / 2 + k * 22) - 10), gy + 2, 20, 6);
        }
        ctx.globalAlpha = 1;
        R.push(px - ww / 2, gy - 8, ww, 16);
        fxKontur(ctx, R, '#5a0800');
        for (var zw = -3; zw <= 3; zw++) {
          var zh = 20 + ((tck + zw + i) % 4) * 6 - Math.abs(zw) * 2;
          R.push(px + zw * 12 - 5, gy - zh, 10, zh);
        }
        fxKontur(ctx, R, '#ff3a08');
        ctx.fillStyle = '#ffb040';
        for (zw = -2; zw <= 2; zw++) {
          var zh2 = 10 + ((tck + zw + i + 2) % 3) * 6;
          ctx.fillRect(px + zw * 12 - 3, gy - zh2, 6, zh2 - 4);
        }
        ctx.fillStyle = '#fff0c0';
        ctx.fillRect(px - 4, gy - 30 - ((tck >> 1) % 3) * 4, 8, 8);
        // Risse unter der Welle glühen mit (y ≥ 648)
        ctx.fillStyle = '#ff6020';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(px - 30, gy + 10, 22, 4); ctx.fillRect(px - 10, gy + 10, 4, 10);
        ctx.fillRect(px + 12, gy + 12, 26, 4); ctx.fillRect(px + 34, gy + 12, 4, 8);
        ctx.globalAlpha = 1;
      } else if (typ === 'fächer' || typ === 'faecher') {
        // Rosenmesser ~44 px (v1.6: 10 px), Klinge in Flugrichtung, Blüten-Trail
        var spin = ((tck + i * 7) >> 2) % 2;
        for (k = 3; k >= 1; k--) {
          ctx.globalAlpha = 0.6 - k * 0.13;
          ctx.fillStyle = k === 1 ? '#ff6080' : '#d01838';
          var bs = 12 - k * 2;
          ctx.fillRect(Math.round(px - ux * (8 + k * 14) - bs / 2), Math.round(py - uy * (8 + k * 14) - bs / 2 + (k & 1) * 4 - 2), bs, bs);
        }
        ctx.globalAlpha = 1;
        // Klinge: 5 Quadrate entlang u, zur Spitze schmaler
        for (k = 0; k < 5; k++) fxQ(R, px + ux * (6 + k * 6), py + uy * (6 + k * 6), k < 2 ? 8 : (k < 4 ? 6 : 4));
        fxKontur(ctx, R, '#c0c8d0');
        ctx.fillStyle = '#fff8ee';
        for (k = 1; k < 4; k++) ctx.fillRect(Math.round(px + ux * (6 + k * 6) - 1), Math.round(py + uy * (6 + k * 6) - 2), 2, 2);
        // Blüte: Kern + 4 Blätter, wechselt alle 4 Ticks zwischen + und × (Drehung)
        var bx = px - ux * 6, by = py - uy * 6;
        fxQ(R, bx, by, 12);
        for (k = 0; k < 4; k++) {
          var pa = k * Math.PI / 2 + spin * Math.PI / 4;
          fxQ(R, bx + Math.cos(pa) * 9, by + Math.sin(pa) * 9, 10);
        }
        fxKontur(ctx, R, '#b01030');
        ctx.fillStyle = '#ff2a4a';
        ctx.fillRect(Math.round(bx - 6), Math.round(by - 6), 12, 12);
        ctx.fillStyle = '#ff8090';
        ctx.fillRect(Math.round(bx - 5), Math.round(by - 5), 6, 3);
        ctx.fillStyle = '#80081c';
        ctx.fillRect(Math.round(bx - 1), Math.round(by - 1), 4, 4);
        // Eis-/Glanzkante an der Spitze
        ctx.fillStyle = '#a0e8ff';
        ctx.globalAlpha = 0.85;
        ctx.fillRect(Math.round(px + ux * 30 - 1), Math.round(py + uy * 30 - 3), 2, 6);
        ctx.globalAlpha = 1;
      } else {
        // Feuerball / Sonnenball: Glow-Hof, Kontur, rotierende Strahlen, 4-Kreis-Trail
        var rad = Math.max(10, (pr.w || 40) / 2);
        for (k = 4; k >= 1; k--) {
          ctx.globalAlpha = 0.5 - k * 0.1;
          ctx.fillStyle = k > 2 ? '#ff3a08' : '#ff8020';
          ctx.beginPath();
          ctx.arc(px - ux * rad * 0.8 * k, py - uy * rad * 0.8 * k + ((tck + k) % 2) * 2, rad * (1 - k * 0.17), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#ffb040';
        ctx.beginPath(); ctx.arc(px, py, rad + 12, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // Strahlen (8, rotieren alle 3 Ticks um 1/16)
        var rot = ((tck / 3) | 0) * Math.PI / 8;
        for (k = 0; k < 8; k++) {
          var a = rot + k * Math.PI / 4, rl = rad + 6 + (k & 1) * 4;
          fxQ(R, px + Math.cos(a) * rl, py + Math.sin(a) * rl, k & 1 ? 6 : 8);
        }
        fxKontur(ctx, R, '#ffb040');
        fxKreis(ctx, px, py, rad, pr.farbe || '#ff6a20');
        ctx.fillStyle = '#ffb040';
        ctx.beginPath(); ctx.arc(px - 2, py - 2, rad * 0.68, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff0c0';
        ctx.beginPath(); ctx.arc(px - 3, py - 3, rad * 0.36, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff8ee';
        ctx.fillRect(px - 8, py - 9, 6, 6);
        // Flammenzungen gegen die Flugrichtung
        ctx.fillStyle = '#ff3a08';
        for (k = 0; k < 4; k++) {
          var wob = ((tck + k * 3) % 5) - 2;
          var fl = 10 + ((tck + k) % 3) * 4 + k * 2;
          ctx.fillRect(Math.round(px - ux * (rad + 2) - (ux > 0 ? fl : 0)), Math.round(py - 7 + k * 4 + wob), fl, 4);
        }
      }
    }
    projAlt = list.map(function (p) { return { x: p.x, y: p.y, owner: p.owner, typ: p.typ || 'ball' }; });
  }

  /* ==== Plaza-Kampf v1.8 — HUD-Drop-in (render.js) ==================================
   * ANKER: ersetzt in js/render.js alles ab
   *            "  function hud(ctx, snap, ich) {"
   *        bis AUSSCHLIESSLICH
   *            "  function zeichne(r, snap, ich) {"
   * Inhalt: Text-Cache (textBild/textZeichne), gebackene HUD-Platten, hud(), nametagBild().
   * Regeln: Alle Koordinaten ganzzahlig (knackig bei 1280×768, keine halben Pixel an
   *        Balkenkanten). Statisches (Rahmen, Namen, Ticks, Medaillon, Vignette, Texte) wird
   *        einmal gebacken und per drawImage gesetzt. Pro Frame bleiben ~10 fillRects
   *        (Balkenfüllung) statt ~42 fillRects + 9 fillText + 3 arc-Fills.
   *        Keine Date.now/Math.random im Kampf-HUD → Host und Client zeigen dasselbe.
   *        Alle Texte/Strings wie v1.7 (Combo, SPECIAL!, Countdown, GEWONNEN/VERLOREN, Rematch).
   * ================================================================================= */
  var TXT = {}, TXT_N = 0, TXT_MESS = null;
  var hudHit = [0, 0], hudHpAlt = [1, 1];          // Treffer-Blitz am Balken + Porträt-Wackeln
  var hudCombo = [0, 0], hudComboPop = [0, 0];      // Combo-Zähler-Pop
  var hudZeit = null, hudZeitPop = 0, hudCd = null, hudCdPop = 0;
  var winFrames = 0;                                // Render-Frames seit Rundenende (Win-Pose, auch auf dem MP-Client flüssig)
  var HUD_PLATTE = {}, HUD_MEDAILLON = null, HUD_VIGNETTE = null;
  var HUD_BW = 472, HUD_BH = 32, HUD_BY = 50, HUD_BX = 108;   // Balken: x 108..580 / 700..1172

  // Text als Bild: Füllung (Farbe oder [oben, unten] als Verlauf), runde Kontur, 3-px-Schlagschatten
  function textBild(text, px, bold, fill, stroke) {
    text = String(text == null ? '' : text);
    var fk = (typeof fill === 'string') ? fill : fill.join('/');
    var key = px + (bold ? 'b' : 'n') + fk + '|' + (stroke || '') + '|' + text;
    var b = TXT[key];
    if (b !== undefined) return b;
    if (TXT_N > 300) { TXT = {}; TXT_N = 0; }
    if (typeof document === 'undefined') return (TXT[key] = null);
    var font = (bold ? 'bold ' : '') + px + 'px ' + SCHRIFT;
    if (!TXT_MESS) TXT_MESS = document.createElement('canvas').getContext('2d');
    TXT_MESS.font = font;
    var tw = Math.ceil(TXT_MESS.measureText(text).width);
    var lw = stroke ? Math.max(4, Math.round(px / 6)) : 0, pad = (lw >> 1) + 4;
    var base = pad + Math.round(px * 0.95);
    b = backe(tw + pad * 2, base + Math.round(px * 0.28) + pad + 3, function (x) {
      x.font = font; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
      if (stroke) {
        x.lineJoin = 'round'; x.strokeStyle = stroke;
        x.lineWidth = lw; x.strokeText(text, pad, base + 3);   // Schatten
        x.strokeText(text, pad, base);
      } else {
        x.fillStyle = 'rgba(0,0,0,0.8)'; x.fillText(text, pad, base + 2);
      }
      if (typeof fill === 'string') x.fillStyle = fill;
      else {
        var g = x.createLinearGradient(0, base - px * 0.75, 0, base);
        g.addColorStop(0, fill[0]); g.addColorStop(1, fill[1]);
        x.fillStyle = g;
      }
      x.fillText(text, pad, base);
    });
    if (b) { b._base = base; b._pad = pad; b._tw = tw; b._txt = text; b._font = font; b._fill = (typeof fill === 'string') ? fill : fill[1]; }
    TXT[key] = b; TXT_N++;
    return b;
  }
  // y = Grundlinie wie bei fillText; sc ≠ 1 → weich skaliert (nur kurze Pops)
  function textZeichne(ctx, b, x, y, align, sc) {
    if (!b) return;
    sc = sc || 1;
    var ox = b._pad + (align === 'center' ? b._tw / 2 : (align === 'right' ? b._tw : 0));
    if (sc === 1) { ctx.drawImage(b, Math.round(x - ox), Math.round(y - b._base)); return; }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(b, Math.round(x - ox * sc), Math.round(y - b._base * sc), Math.round(b.width * sc), Math.round(b.height * sc));
    ctx.imageSmoothingEnabled = false;
  }
  function text(ctx, s, px, bold, fill, stroke, x, y, align, sc) {
    var b = textBild(s, px, bold, fill, stroke);
    if (b) { textZeichne(ctx, b, x, y, align, sc); return; }
    ctx.font = (bold ? 'bold ' : '') + px + 'px ' + SCHRIFT;       // Fallback ohne document
    ctx.textAlign = align || 'left';
    ctx.fillStyle = (typeof fill === 'string') ? fill : fill[1];
    ctx.fillText(String(s), x, y);
  }

  // Statische Balken-Platte (unter der Füllung) + Overlay (Ticks/Schatten, über der Füllung).
  // Platten-Koordinaten: x = Balken-x − 8, y = Bildschirm-y (Balken liegt bei HUD_BY).
  function hudPlatte(c, name, mirror) {
    var key = c.id + '|' + name + '|' + (mirror ? 1 : 0);
    if (HUD_PLATTE[key] !== undefined) return HUD_PLATTE[key];
    var bw = HUD_BW, bh = HUD_BH, ox = 8, by = HUD_BY, PW = bw + ox * 2, PH = by + bh + 8;
    var acc = c.accent || '#ff6020';
    var unten = backe(PW, PH, function (x) {
      // Kapsel: 2 schwarz, 2 Akzent dunkel, 2 schwarz, Rinne mit dunkler Oberkante
      x.fillStyle = '#000'; x.fillRect(ox - 6, by - 6, bw + 12, bh + 12);
      x.fillStyle = hexShade(acc, -50); x.fillRect(ox - 4, by - 4, bw + 8, bh + 8);
      x.fillStyle = hexShade(acc, -10); x.fillRect(mirror ? ox + bw - 60 : ox - 4, by - 4, 64, 2);
      x.fillStyle = '#000'; x.fillRect(ox - 2, by - 2, bw + 4, bh + 4);
      x.fillStyle = '#1e0806'; x.fillRect(ox, by, bw, bh);
      x.fillStyle = '#2c0c08'; x.fillRect(ox, by, bw, 4);
    });
    var oben = backe(PW, PH, function (x) {
      x.fillStyle = 'rgba(0,0,0,0.5)';
      for (var t = 1; t < 10; t++) x.fillRect(ox + Math.round(bw * t / 10) - 1, by, 2, bh);
      x.fillStyle = 'rgba(0,0,0,0.28)'; x.fillRect(ox, by + bh - 4, bw, 4);
    });
    var p = { unten: unten, oben: oben, ox: ox,
      name: textBild(name, 30, true, ['#fff0c0', '#e8b070'], '#000'),
      spitz: textBild(c.spitzname || '', 20, false, '#c88a50', '#000') };
    HUD_PLATTE[key] = p;
    return p;
  }

  function hudMedaillon() {
    if (HUD_MEDAILLON) return HUD_MEDAILLON;
    HUD_MEDAILLON = backe(128, 128, function (x) {
      x.imageSmoothingEnabled = true;
      var ringe = [[60, '#000'], [55, '#ff3a08'], [51, '#ffb040'], [49, '#000'], [46, '#2a0c08'], [40, '#1a0606']];
      for (var i = 0; i < ringe.length; i++) {
        x.fillStyle = ringe[i][1]; x.beginPath(); x.arc(64, 64, ringe[i][0], 0, Math.PI * 2); x.fill();
      }
      x.fillStyle = 'rgba(255,200,120,0.18)'; x.beginPath(); x.arc(64, 56, 34, Math.PI * 1.1, Math.PI * 1.9); x.fill();
    });
    return HUD_MEDAILLON;
  }
  function hudVignette() {
    if (HUD_VIGNETTE) return HUD_VIGNETTE;
    // 1 px breit, per drawImage auf 1280 gestreckt: billiger als ein Vollbild-Verlauf pro Frame
    HUD_VIGNETTE = backe(1, H, function (x) {
      var grd = x.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, 'rgba(0,0,0,0.88)');
      grd.addColorStop(0.45, 'rgba(0,0,0,0.55)');
      grd.addColorStop(1, 'rgba(0,0,0,0.15)');
      x.fillStyle = grd; x.fillRect(0, 0, 1, H);
    });
    return HUD_VIGNETTE;
  }

  // Nametag als Bild: Kapsel 2 px Kontur, Akzent-Unterkante, Pfeil zur Figur
  function nametagBild(name, acc) {
    var key = 'tag|' + name + '|' + acc;
    if (TXT[key] !== undefined) return TXT[key];
    var t = textBild(name, 24, true, '#ffe080', null);
    if (!t) return (TXT[key] = null);
    var w = t._tw + 28, h = 48;
    var b = backe(w, h, function (x) {
      x.fillStyle = '#000'; x.fillRect(0, 0, w, 38); x.fillRect((w >> 1) - 8, 36, 16, 6); x.fillRect((w >> 1) - 4, 40, 8, 6);
      x.fillStyle = 'rgba(26,8,8,0.92)'; x.fillRect(2, 2, w - 4, 34);
      x.fillStyle = acc; x.fillRect(2, 32, w - 4, 4); x.fillRect((w >> 1) - 6, 36, 12, 2); x.fillRect((w >> 1) - 2, 38, 4, 4);
      x.fillStyle = hexShade(acc, 50); x.fillRect(2, 32, w - 4, 1);
      x.drawImage(t, 14 - t._pad, 27 - t._base);
    });
    TXT[key] = b; TXT_N++;
    return b;
  }

  function hud(ctx, snap, ich) {
    var tick = snap.tick || 0;
    var same = snap.p[0] && snap.p[1] && snap.p[0].charId === snap.p[1].charId;
    function balken(p, mirror) {
      var c = Plaza.Chars.finde(p.charId);
      var bw = HUD_BW, bh = HUD_BH, idx = p.id & 1;
      var bx = mirror ? W - HUD_BX - bw : HUD_BX, by = HUD_BY;
      var pct = Math.max(0, Math.min(1, p.hp / p.maxHp));
      // Delay-Balken (wie v1.7)
      if (delayHp[idx] < pct) delayHp[idx] = pct;
      else delayHp[idx] += (pct - delayHp[idx]) * 0.08;
      if (Math.abs(delayHp[idx] - pct) < 0.002) delayHp[idx] = pct;
      if (pct < hudHpAlt[idx] - 0.001) hudHit[idx] = 12;
      hudHpAlt[idx] = pct;
      if (hudHit[idx] > 0) hudHit[idx]--;

      var pl = hudPlatte(c, String(p.name || c.name), mirror);
      var px0 = bx - pl.ox;
      if (pl.unten) ctx.drawImage(pl.unten, px0, 0);
      else { ctx.fillStyle = '#000'; ctx.fillRect(bx - 6, by - 6, bw + 12, bh + 12); ctx.fillStyle = '#1e0806'; ctx.fillRect(bx, by, bw, bh); }

      // Füllungen: ganzzahlig
      var dw = Math.round(bw * delayHp[idx]), fw = Math.round(bw * pct);
      var dx0 = mirror ? bx + bw - dw : bx, fx0 = mirror ? bx + bw - fw : bx;   // wie v1.7: P1 ab links, P2 ab rechts
      if (dw > fw) {
        ctx.fillStyle = hudHit[idx] > 6 ? '#fff0c0' : '#c05810';
        ctx.fillRect(dx0, by, dw, bh);
      }
      if (fw > 0) {
        var acc = c.accent || '#ff3a08', low = pct <= 0.3;
        var base = low ? (((tick >> 2) & 1) ? '#ff2a40' : '#c01830') : hexShade(acc, 40);
        ctx.fillStyle = base; ctx.fillRect(fx0, by, fw, bh);
        ctx.fillStyle = low ? '#ff8a90' : hexShade(acc, 90); ctx.fillRect(fx0, by + 4, fw, 4);
        ctx.fillStyle = low ? '#ffd0d0' : hexShade(acc, 130); ctx.fillRect(fx0, by + 4, fw, 1);
        ctx.fillStyle = low ? '#700818' : hexShade(acc, -20); ctx.fillRect(fx0, by + bh - 10, fw, 6);
        // helle Kante an der Schnittstelle
        ctx.fillStyle = '#fff0c0'; ctx.fillRect(mirror ? fx0 : fx0 + fw - 2, by, 2, bh);
      }
      if (pl.oben) ctx.drawImage(pl.oben, px0, 0);

      // Porträt: außen neben dem Balken, schaut zur Mitte; Treffer → 2 px Wackeln + roter Blitz
      var pb = portraitBild(c.id, mirror ? -1 : 1, same && idx === 1);
      var ppx = mirror ? W - 24 - PORT_S : 24, ppy = 22;
      if (hudHit[idx] > 0) ppx += ((hudHit[idx] & 2) ? 2 : -2);
      if (pb) ctx.drawImage(pb, ppx, ppy);
      if (hudHit[idx] > 6 || p.hp <= 0) {
        ctx.fillStyle = p.hp <= 0 ? 'rgba(10,4,6,0.55)' : 'rgba(255,60,20,0.35)';
        ctx.fillRect(ppx + 4, ppy + 4, PORT_S - 8, PORT_S - 8);
      }
      // Name über, Spitzname unter dem Balken (zur Außenkante bündig)
      var nx = mirror ? bx + bw : bx;
      if (pl.name) textZeichne(ctx, pl.name, nx, by - 12, mirror ? 'right' : 'left');
      else text(ctx, p.name, 30, true, '#e8c090', '#000', nx, by - 12, mirror ? 'right' : 'left');
      if (pl.spitz) textZeichne(ctx, pl.spitz, nx, by + bh + 26, mirror ? 'right' : 'left');
    }
    balken(snap.p[0], false);
    balken(snap.p[1], true);

    // Zeit-Medaillon (gebacken) + Ziffern; ≤ 10 s rot mit Pop beim Wechsel
    var med = hudMedaillon();
    if (med) ctx.drawImage(med, (W >> 1) - 64, 72 - 64);
    if (hudZeit !== snap.zeit) { hudZeitPop = snap.zeit <= 10 ? 10 : 0; hudZeit = snap.zeit; }
    if (hudZeitPop > 0) hudZeitPop--;
    var zr = snap.zeit <= 10;
    text(ctx, String(snap.zeit), 44, true, zr ? ['#ff8080', '#ff2a40'] : ['#fff0c0', '#e8b070'], '#000',
      W >> 1, 88, 'center', 1 + hudZeitPop * 0.03);

    if (snap.phase === 'countdown') {
      ctx.fillStyle = 'rgba(58,46,72,0.45)';
      ctx.fillRect(0, 0, W, H);
      var cdT = snap.countdown > 0 ? String(snap.countdown) : 'LOS!';
      if (hudCd !== cdT) { hudCd = cdT; hudCdPop = 12; }
      if (hudCdPop > 0) hudCdPop--;
      text(ctx, cdT, 160, true, ['#fff0c0', '#ff9a38'], '#000', W >> 1, (H >> 1) + 32, 'center', 1 + hudCdPop * 0.025);
      text(ctx, 'A leicht · B schwer · C special · ▼ duck', 28, false, '#ffe080', '#000', W >> 1, (H >> 1) + 88, 'center');
    } else hudCd = null;

    // Combo: pro Spieler unter dem eigenen Balken, Zahl poppt bei jedem neuen Treffer
    for (var ci = 0; ci < snap.p.length; ci++) {
      var cp = snap.p[ci], cn = cp.combo | 0, cix = cp.id & 1;
      if (cn !== hudCombo[cix]) { if (cn > hudCombo[cix]) hudComboPop[cix] = 8; hudCombo[cix] = cn; }
      if (hudComboPop[cix] > 0) hudComboPop[cix]--;
      if (cn < 2 || snap.phase !== 'kampf') continue;
      var rechts = cix === 1, cx = rechts ? W - HUD_BX : HUD_BX, sup = cn >= 5;
      var sc = 1 + hudComboPop[cix] * 0.04;
      text(ctx, (sup ? 'SUPER ' : '') + cn + ' HIT!', 52, true, sup ? ['#fff0a0', '#ffb020'] : ['#ffd080', '#ff6020'], '#000',
        cx, 182, rechts ? 'right' : 'left', sc);
      var cd = cp.comboDmg | 0;
      text(ctx, cp.name + (cd ? (' · ' + cd + ' DMG') : ''), 26, true, '#ffe080', '#000', cx, 216, rechts ? 'right' : 'left');
    }
    // Special-Callout
    for (var si = 0; si < snap.p.length; si++) {
      if (snap.p[si].hitKind === 'special' && snap.phase === 'kampf' && (tick % 20) < 12) {
        text(ctx, 'SPECIAL!', 48, true, ['#e0f8ff', '#40b8ff'], '#000', W >> 1, 186, 'center');
        break;
      }
    }

    if (snap.phase === 'ende') {
      var vg = hudVignette();
      if (vg) ctx.drawImage(vg, 0, 0, W, H);
      var won = (ich === 0 || ich === 1) && snap.sieger === ich;
      var lost = (ich === 0 || ich === 1) && snap.sieger != null && snap.sieger !== ich;
      if (won) text(ctx, 'GEWONNEN!', 72, true, ['#c0ffd0', '#40ff80'], '#000', W >> 1, 92, 'center');
      else if (lost) text(ctx, 'VERLOREN!', 72, true, ['#ffb0a0', '#ff4040'], '#000', W >> 1, 92, 'center');
      var sp = snap.sieger != null ? snap.p[snap.sieger] : null;
      var wc = sp ? Plaza.Chars.finde(sp.charId) : null;
      // Sieger-Porträt 2× (crisp), schaut zur Mitte seiner Seite
      var wb = wc ? portraitBild(wc.id, 1, same && snap.sieger === 1) : null;
      if (wb) {
        ctx.drawImage(wb, (W >> 1) - PORT_S, 112, PORT_S * 2, PORT_S * 2);
      }
      var ty = wb ? 300 : 180;
      text(ctx, snap.nachricht || 'Ende', 48, true, ['#ffd080', '#ff6020'], '#000', W >> 1, ty, 'center');
      if (wc && wc.winLine) text(ctx, '„' + wc.winLine + '“', 34, false, '#ffb040', '#000', W >> 1, ty + 50, 'center');
      text(ctx, 'Rematch → Knopf unten', 32, false, '#e8c090', '#000', W >> 1, ty + 98, 'center');
    }
    if (ich === 0 || ich === 1) {
      text(ctx, 'Du: P' + (ich + 1), 28, true, 'rgba(232,192,144,0.9)', '#000', 24, H - 24, 'left');
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
    winFrames = snap.phase === 'ende' ? winFrames + 1 : 0;   // v1.8: Win-Pose läuft in Render-Frames
    zeichneProjektile(ctx, snap);

    // Spiegelmatch: gleiche charId → P2 invertieren
    var same = snap.p[0] && snap.p[1] && snap.p[0].charId === snap.p[1].charId;
    for (i = 0; i < snap.p.length; i++) {
      snap.p[i]._winPose = (snap.phase === 'ende' && snap.sieger === snap.p[i].id);
      snap.p[i]._tick = snap.tick || 0;
      snap.p[i]._winT = winFrames;
      fig(ctx, snap.p[i], true, same && i === 1);
    }
    for (i = 0; i < snap.p.length; i++) nametag(ctx, snap.p[i]);
    drawFx(ctx);
    fg(ctx, snap.tick || 0);
    drawWetter(ctx, snap.tick || 0);
    hud(ctx, snap, ich);
    ctx.restore();
  }

  function menueHint(r, text0) {
    var ctx = r.ctx;
    applyBuf(ctx);
    if (!layers) layers = backeLayers();
    // Zeige Arena auch im Menü
    camX = Math.sin(Date.now() / 2800) * 48;
    var mt = (Date.now() / 50) | 0;
    arena(ctx, mt, null);
    fg(ctx, mt);
    drawWetter(ctx, mt);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, W, 140);
    // v1.8: Titel mit Kontur + Verlauf (gebacken), Hinweis-Kapsel mit Akzentkanten
    ctx.fillStyle = '#ff3a08'; ctx.fillRect(0, 140, W, 2);
    text(ctx, 'Plaza-Kampf', 60, true, ['#fff0c0', '#e8a060'], '#000', W >> 1, 76, 'center');
    var ln = (Plaza.Levels && Plaza.Levels.LISTE || []).filter(function (L) { return L.id === levelId; })[0];
    text(ctx, (ln ? (ln.emoji + ' ' + ln.name + ' · ') : '') + 'la Pelea del Infierno', 28, false, '#ff6020', '#000', W >> 1, 122, 'center');
    ctx.fillStyle = '#000'; ctx.fillRect(156, (H >> 1) - 60, W - 312, 104);
    ctx.fillStyle = 'rgba(20,6,6,0.9)'; ctx.fillRect(160, (H >> 1) - 56, W - 320, 96);
    ctx.fillStyle = '#ff6020'; ctx.fillRect(160, (H >> 1) - 56, W - 320, 2); ctx.fillRect(160, (H >> 1) + 38, W - 320, 2);
    text(ctx, text0 || '', 40, false, '#ff7a30', '#000', W >> 1, (H >> 1) + 12, 'center');
  }

  /* ==== Plaza-Kampf v1.8 — Porträt-Drop-in (render.js) ==============================
   * ANKER: ersetzt in js/render.js alles ab
   *            "  function portrait(canvas, charId) {"
   *        bis AUSSCHLIESSLICH
   *            "  function banner(r, text) {"
   * Idee: Das Porträt wird aus fig() selbst gebacken (Idle-Pose, Tick 40: Augen offen,
   *        Blick geradeaus). Damit ist die Silhouette per Definition die der Kampf-Köpfe,
   *        auch Hüte, Dutt, Brille und Kopfhörer. Darum kommen 2 px Außenkontur (#000),
   *        ein Glut-Hintergrund in der Char-Akzentfarbe und ein 4-px-Rahmen (2 schwarz + 2 Akzent).
   * Größe: PORT_S = 72 (64 Ausschnitt + 2×4 Rahmen). HUD zeichnet 1:1, Char-Select bei
   *        144×144 crisp 2× (ui-patch-v1.8.js), bei jeder anderen Größe weich skaliert.
   * Cache: pro charId/facing/invert ein Canvas, gebacken beim ersten Aufruf (~1 ms).
   *        fig-interner Zustand (FIG_PY/PT/VY, flash) wird gesichert und zurückgesetzt.
   * ================================================================================= */
  var PORT_S = 72, PORT_C = 64, PORT_CACHE = {};

  function portraitBild(charId, facing, invert) {
    var f = facing === -1 ? -1 : 1;
    var key = charId + '|' + f + '|' + (invert ? 1 : 0);
    if (PORT_CACHE[key] !== undefined) return PORT_CACHE[key];
    var c = Plaza.Chars && Plaza.Chars.finde(charId);
    if (!c || typeof document === 'undefined' || !Plaza.Kampf) return (PORT_CACHE[key] = null);
    var acc = c.accent || '#ff6020';
    // 1) Figur in eine Arbeitsfläche, Füße bei y = 200, Mitte x = 120
    var FW = 240, by = 200 - c.h;
    var roh = backe(FW, FW, function (x) {
      var s0 = FIG_PY[0], s1 = FIG_PT[0], s2 = FIG_VY[0], s3 = flash[0];
      flash[0] = 0;
      fig(x, { id: 0, charId: c.id, x: 120, y: 200, facing: f, grounded: true, stun: 0, invuln: 0,
        hp: 1, maxHp: 1, vx: 0, crouch: false, blk: false, atk: null, _tick: 40, _winPose: false }, false, !!invert);
      FIG_PY[0] = s0; FIG_PT[0] = s1; FIG_VY[0] = s2; flash[0] = s3;
    });
    if (!roh) return (PORT_CACHE[key] = null);
    // 2) Ausschnitt 64×64: Hut/Peineta (bis −20) oben, Schultern unten; Kopf 2 px nach vorn versetzt
    var sx = 120 - PORT_C / 2 + f * 2, sy = by - 22;
    var aus = backe(PORT_C, PORT_C, function (x) { x.drawImage(roh, sx, sy, PORT_C, PORT_C, 0, 0, PORT_C, PORT_C); });
    // Silhouette schwarz einfärben (für die 2-px-Außenkontur)
    var sil = backe(PORT_C, PORT_C, function (x) {
      x.drawImage(aus, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = '#000'; x.fillRect(0, 0, PORT_C, PORT_C);
    });
    var bild = backe(PORT_S, PORT_S, function (x) {
      var i, o = 4;
      // Hintergrund: dunkel, Glut-Hof hinter dem Kopf in Stufen (keine Verläufe, Pixel-Look)
      x.fillStyle = '#0a0608'; x.fillRect(0, 0, PORT_S, PORT_S);
      var hof = [[30, hexShade(acc, -70)], [22, hexShade(acc, -50)], [14, hexShade(acc, -30)]];
      for (i = 0; i < hof.length; i++) {
        var r = hof[i][0];
        x.fillStyle = hof[i][1];
        x.fillRect(36 - r, 30 - r + 4, r * 2, r * 2 - 8);
        x.fillRect(36 - r + 4, 30 - r, r * 2 - 8, r * 2);
      }
      x.fillStyle = hexShade(c.farbe2 || '#200808', -6); x.fillRect(o, PORT_S - 16, PORT_C, 12); // Boden
      for (i = 0; i < 6; i++) { x.fillStyle = 'rgba(255,176,64,' + (0.18 + (i % 3) * 0.1) + ')'; x.fillRect(o + 4 + i * 11, 10 + (i * 23) % 40, 2, 2); }
      // Außenkontur: Silhouette 2 px in alle Richtungen, dann Figur
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) if (dx || dy) x.drawImage(sil, o + dx, o + dy);
      x.drawImage(aus, o, o);
      // Rahmen: 2 schwarz außen, 2 Akzent innen, Lichtkante oben-links
      x.fillStyle = acc;
      x.fillRect(2, 2, PORT_S - 4, 2); x.fillRect(2, PORT_S - 4, PORT_S - 4, 2);
      x.fillRect(2, 2, 2, PORT_S - 4); x.fillRect(PORT_S - 4, 2, 2, PORT_S - 4);
      x.fillStyle = hexShade(acc, 60); x.fillRect(2, 2, 18, 2); x.fillRect(2, 2, 2, 18);
      x.fillStyle = '#000';
      x.fillRect(0, 0, PORT_S, 2); x.fillRect(0, PORT_S - 2, PORT_S, 2);
      x.fillRect(0, 0, 2, PORT_S); x.fillRect(PORT_S - 2, 0, 2, PORT_S);
    });
    return (PORT_CACHE[key] = bild);
  }

  // Öffentlich (ui.js Char-Select): zeichnet das Porträt formatfüllend in canvas.
  // opt.facing (-1 = schaut nach links), opt.invert (Spiegelmatch-Farben)
  function portrait(canvas, charId, opt) {
    if (!canvas) return;
    opt = opt || {};
    var b = portraitBild(charId, opt.facing, opt.invert);
    var ctx = canvas.getContext('2d');
    var s = canvas.width, sh = canvas.height || s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s, sh);
    if (!b) return;
    var crisp = (s % PORT_S) === 0;      // 72, 144, 216 → ganzzahlig, sonst weich (z. B. alte 48er)
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = !crisp;
    if (!crisp && 'imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b, 0, 0, s, sh);
    if ('imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = false;
  }

  function banner(r, s) {
    var ctx = r.ctx;
    applyBuf(ctx);
    var y0 = (H >> 1) - 64;
    ctx.fillStyle = '#000'; ctx.fillRect(76, y0 - 4, W - 152, 136);
    ctx.fillStyle = 'rgba(26,6,6,0.92)'; ctx.fillRect(80, y0, W - 160, 128);
    ctx.fillStyle = '#ff4040'; ctx.fillRect(80, y0, W - 160, 4); ctx.fillRect(80, y0 + 124, W - 160, 4);
    text(ctx, s || '…', 40, true, ['#ffb0a0', '#ff4040'], '#000', W >> 1, (H >> 1) + 14, 'center');
  }

  function resetFx() {
    fx = []; delayHp = [1, 1]; flash = [0, 0]; prevSnap = null; shake = 0; projAlt = [];
    hudHit = [0, 0]; hudHpAlt = [1, 1]; hudCombo = [0, 0]; hudComboPop = [0, 0];
    hudZeit = null; hudZeitPop = 0; hudCd = null; hudCdPop = 0; winFrames = 0;
  }

  Plaza.Render = {
    W: W, H: H,
    puffer: function () { return BUF; },
    erstelle: erstelle, setzePuffer: setzePuffer,
    zeichne: zeichne, menueHint: menueHint, banner: banner, portrait: portrait, resetFx: resetFx,
    wetterState: function () { return { typ: wetter.typ, blitz: wetter.blitz, next: wetter.next, blend: wetter.blend }; },
    applyWetter: applyWetter,
    setLevel: setLevel, getLevel: getLevel,
    levels: function () { return (Plaza.Levels && Plaza.Levels.LISTE) || [{ id: 'hoelle', name: 'Hölle' }]; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
