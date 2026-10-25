/* Plaza-Kampf Levels v3.1+: Dschungel, Brücke, Zerstörte Stadt.
 * Wird von render.js über Plaza.Levels.bake(id, api) aufgerufen.
 * api: { backe, werkzeug, rng, LW, H, P, GLUT_DEF }
 */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};

  function commonExtras(api, tSeed) {
    var backe = api.backe, werkzeug = api.werkzeug, rng = api.rng, LW = api.LW, H = api.H;
    var daemon = function (arms) {
      return backe(40, 56, function (x) {
        var t = werkzeug(x);
        t.R(12, 8, 16, 14, '#1a1018');
        t.R(14, 12, 4, 4, '#ff3a08'); t.R(22, 12, 4, 4, '#ff3a08');
        t.R(10, 22, 20, 18, '#140c14');
        if (arms) { t.R(2, 24, 8, 4, '#1a1018'); t.R(30, 20, 8, 4, '#1a1018'); }
        else { t.R(2, 26, 8, 4, '#1a1018'); t.R(30, 26, 8, 4, '#1a1018'); }
      });
    };
    var kegel = backe(240, 220, function (x) {
      var t = werkzeug(x);
      x.globalAlpha = 0.25; t.poly([[110, 0], [130, 0], [240, 220], [0, 220]], '#ff7a28');
      x.globalAlpha = 0.45; t.poly([[114, 0], [126, 0], [190, 220], [50, 220]], '#ff7a28');
      x.globalAlpha = 0.8; t.ell(120, 10, 40, 24, '#ff9a38');
    });
    var L4r = [0, 1, 2].map(function (k) {
      return backe(LW, 168, function (x) {
        var t = werkzeug(x), r = rng(tSeed + 40 + k), i;
        for (i = 0; i < 30; i++) {
          t.R(Math.round(r() * LW / 2) * 2, Math.round(r() * 80) * 2, 2 + (k % 2) * 2, 2, 'rgba(255,80,20,' + (0.15 + r() * 0.2) + ')');
        }
      });
    });
    var L5f = backe(80, 248, function (x) {
      var t = werkzeug(x);
      t.R(30, 40, 20, 200, '#2a1810');
      t.R(34, 20, 12, 30, '#3a2010');
    });
    return { L4r: L4r, L5f: L5f, daemon: [daemon(false), daemon(true)], kegel: kegel };
  }

  function bakeDschungel(api) {
    var backe = api.backe, werkzeug = api.werkzeug, rng = api.rng, LW = api.LW, H = api.H;
    var G = ['#040806', '#0a1410', '#102018', '#183028', '#1e4030', '#285038',
      '#3a6840', '#4a8050', '#60a060', '#88c070', '#b0e090', '#e8ffc0'];
    var L0 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(501), i;
      var BAND = ['#061018', '#0a1820', '#102828', '#183830', '#204038', '#285040', '#306048', '#387050'];
      for (i = 0; i < 8; i++) {
        t.R(0, i * 45, w, 45, BAND[i]);
        if (i) { t.R(0, i * 45, w, 8, t.pat(BAND[i - 1], 50)); t.R(0, i * 45 + 8, w, 8, t.pat(BAND[i - 1], 25)); }
      }
      // Nebel-Bänder
      for (i = 0; i < 6; i++) t.ell(200 + i * 220, 280 + (i % 3) * 30, 160, 28, t.pat('#204038', 25));
      // Sonne hinter Blätterdach
      t.ell(1080, 160, 70, 70, t.pat('#c0a040', 25));
      t.ell(1080, 160, 44, 44, '#e8c060');
      t.ell(1080, 160, 22, 22, '#fff0a0');
      // Vögel / Blätter-Silhouetten
      for (i = 0; i < 40; i++) {
        var sx = Math.round(r() * w / 2) * 2, sy = 40 + Math.round(r() * 180) * 2;
        t.R(sx, sy, 2, 2, r() < 0.3 ? G[8] : G[4]);
      }
    });
    var L1 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(502), i;
      function berg(cx, top, bw) {
        t.poly([[cx - bw, 430], [cx - bw * 0.3, top + 40], [cx, top], [cx + bw * 0.35, top + 50], [cx + bw, 430]], '#0c1a14');
        t.poly([[cx - bw * 0.3, top + 40], [cx, top], [cx - 10, top + 80], [cx - bw * 0.5, 430]], '#142820');
      }
      berg(260, 210, 220); berg(700, 170, 280); berg(1200, 230, 200);
      // ferner Dschungel-Saum
      var pts = [[0, 460]];
      for (i = 0; i <= w; i += 36) pts.push([i, 400 - Math.abs(Math.sin(i / 90)) * 50 - (r() * 20)]);
      pts.push([w, 460]); t.poly(pts, '#102818');
      t.R(0, 450, w, h - 450, '#0a1810');
      t.toene(200, 460, 0.12, 0.05, '#061018');
    });
    var L2 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(503), i;
      function baum(bx, base, th, hh, seed) {
        var q = rng(seed);
        t.R(bx - th / 2, base - hh, th, hh, '#2a1810');
        t.R(bx - th / 2, base - hh, 4, hh, '#3a2818');
        // Krone
        t.ell(bx, base - hh - 10, 70 + q() * 40, 50 + q() * 30, '#1a4028');
        t.ell(bx - 30, base - hh + 10, 50, 36, '#245830');
        t.ell(bx + 28, base - hh + 4, 46, 34, '#2a6838');
        t.ell(bx, base - hh - 20, 36, 28, '#388048');
        // Lianen
        var lx = bx + th, ly = base - hh + 20;
        for (var s = 0; s < 40; s++) { lx += Math.round((q() - 0.45) * 4); ly += 6; t.R(lx, ly, 2, 6, '#2a5030'); }
      }
      baum(120, 520, 28, 220, 11); baum(340, 520, 36, 280, 12); baum(560, 520, 24, 200, 13);
      baum(820, 520, 40, 300, 14); baum(1040, 520, 30, 240, 15); baum(1280, 520, 34, 260, 16);
      baum(1480, 520, 26, 210, 17);
      // Tempelruine mittig
      t.kR(600, 300, 160, 220, '#3a3428');
      t.R(620, 320, 40, 60, '#0a1810'); t.R(700, 320, 40, 60, '#0a1810');
      t.R(660, 400, 50, 120, '#0a1810');
      t.R(600, 300, 160, 8, '#5a5040');
      for (i = 0; i < 5; i++) t.R(610 + i * 30, 280, 16, 20, '#3a3428');
      // Neon-ish Moos-Schild
      t.kR(640, 250, 80, 28, '#0a2010');
    });
    var L3 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(504), i;
      // Balustrade aus Wurzeln / Steinen
      t.R(0, 500, w, 40, '#1a2818');
      for (i = 0; i < 24; i++) {
        var px = i * 70 + 20;
        t.R(px, 470, 50, 40, '#243828');
        t.R(px + 8, 455, 34, 20, '#2a4030');
        t.ell(px + 25, 455, 20, 10, '#1a3020');
      }
      // Wasserfall links
      for (i = 0; i < 18; i++) {
        t.R(180 + (i % 3) * 6, 300 + i * 12, 4, 14, i % 2 ? '#60a0c0' : '#88c0e0');
      }
      t.ell(190, 520, 50, 12, '#4080a0');
      // Pilze / Farn
      for (i = 0; i < 14; i++) {
        var mx = 80 + i * 100 + Math.round(r() * 30);
        t.R(mx, 530, 6, 16, '#3a2820');
        t.ell(mx + 3, 528, 14, 8, r() < 0.5 ? '#c04060' : '#e0a040');
      }
    });
    var L4 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(505), i;
      // Boden: Moos / Erde / Wurzeln
      t.R(0, 600, w, h - 600, '#1a2010');
      t.R(0, 600, w, 8, '#2a3820');
      for (i = 0; i < 80; i++) {
        t.R(Math.round(r() * w / 2) * 2, 610 + Math.round(r() * 70) * 2, 4 + Math.round(r() * 8) * 2, 2, r() < 0.4 ? '#2a3828' : '#3a4830');
      }
      // große Wurzeln
      for (i = 0; i < 8; i++) {
        var rx = 100 + i * 180, ry = 620;
        for (var s = 0; s < 20; s++) {
          rx += Math.round((r() - 0.4) * 6); ry += 4;
          t.R(rx, ry, 10, 6, '#2a1810');
        }
      }
      // Medaillon-Platz Mitte
      t.ell(800, 700, 160, 40, '#243020');
      t.ell(800, 700, 80, 20, '#3a5040');
      t.ell(800, 700, 30, 8, '#88c070');
    });
    var L5 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(506), i;
      // Vordergrund-Blätter / Farn
      for (i = 0; i < 10; i++) {
        var fx = i * 160 - 20;
        t.poly([[fx, h], [fx + 20, 520], [fx + 60, 540], [fx + 40, h]], '#0c2010');
        t.poly([[fx + 30, h], [fx + 70, 500], [fx + 110, 530], [fx + 80, h]], '#143018');
      }
      // Lianen vorne
      for (i = 0; i < 6; i++) {
        var lx = 100 + i * 250, ly = 0;
        for (var s = 0; s < 30; s++) { lx += Math.round((r() - 0.5) * 5); ly += 8; t.R(lx, ly, 3, 8, '#1a4028'); }
      }
    });
    var ex = commonExtras(api, 500);
    return { L0: L0, L1: L1, L2: L2, L3: L3, L4: L4, L5: L5, lw: LW, L4r: ex.L4r, L5f: ex.L5f, daemon: ex.daemon, kegel: ex.kegel };
  }

  function bakeBruecke(api) {
    var backe = api.backe, werkzeug = api.werkzeug, rng = api.rng, LW = api.LW, H = api.H;
    var G = ['#060810', '#0c1018', '#141820', '#1c2430', '#283040', '#3a4858',
      '#506070', '#688090', '#80a0b0', '#a0c0d0', '#c0e0f0', '#e8f4ff'];
    var L0 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(601), i;
      var BAND = ['#0a0c18', '#101428', '#181c38', '#202448', '#2a3058', '#3a4068', '#4a5080', '#5a6090'];
      for (i = 0; i < 8; i++) {
        t.R(0, i * 45, w, 45, BAND[i]);
        if (i) t.R(0, i * 45, w, 10, t.pat(BAND[i - 1], 50));
      }
      // Mond
      t.ell(200, 140, 50, 50, t.pat('#c0d0e0', 25));
      t.ell(200, 140, 36, 36, '#e0e8f0');
      t.ell(210, 148, 36, 36, '#101428'); // Sichel
      for (i = 0; i < 60; i++) t.R(Math.round(r() * w / 2) * 2, Math.round(r() * 200) * 2, 2, 2, G[8 + (r() < 0.2 ? 2 : 0)]);
      // Wolken
      for (i = 0; i < 5; i++) t.ell(150 + i * 280, 180 + (i % 2) * 40, 120, 28, t.pat('#283048', 50));
    });
    var L1 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(602), i;
      // ferne Stadt-Silhouette
      for (i = 0; i < 20; i++) {
        var hx = i * 80, hh = 280 + Math.round(r() * 80) * 2, hw = 40 + Math.round(r() * 40);
        t.R(hx, hh, hw, 420 - hh, '#12161e');
        if (r() < 0.4) t.R(hx + 10, hh - 40, 12, 40, '#12161e');
      }
      // Nebel über Schlucht
      t.R(0, 400, w, 60, t.pat('#1c2430', 50));
      t.R(0, 440, w, h - 440, '#0c1018');
    });
    var L2 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(603), i;
      // Schluchtwände
      t.poly([[0, 200], [180, 240], [220, 520], [0, 520]], '#1a1520');
      t.poly([[w, 180], [w - 200, 220], [w - 240, 520], [w, 520]], '#1a1520');
      // Pfeiler fern
      for (i = 0; i < 4; i++) {
        var px = 300 + i * 280;
        t.R(px, 320, 36, 200, '#2a2430');
        t.R(px - 10, 320, 56, 16, '#3a3440');
      }
      // Nebel in der Tiefe
      for (i = 0; i < 8; i++) t.ell(400 + i * 100, 480, 80, 20, t.pat('#283040', 25));
    });
    var L3 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(604), i;
      // Brücken-Geländer hinten
      t.R(0, 470, w, 14, '#3a4048');
      for (i = 0; i < 40; i++) t.R(20 + i * 40, 430, 8, 50, '#2a3038');
      // Ketten / Seile
      for (i = 0; i < 12; i++) {
        var cx = 80 + i * 120;
        for (var s = 0; s < 16; s++) t.R(cx + Math.round(Math.sin(s / 3) * 6), 300 + s * 10, 4, 8, '#5a4830');
      }
      // Laternen
      for (i = 0; i < 6; i++) {
        var lx = 160 + i * 240;
        t.R(lx, 400, 6, 50, '#2a2018');
        t.R(lx - 10, 390, 26, 20, '#3a2810');
        t.R(lx - 6, 394, 18, 12, '#ff9a38');
      }
    });
    var L4 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(605), i;
      // Brückenboden Platten
      t.R(0, 600, w, h - 600, '#2a2830');
      t.R(0, 600, w, 6, '#4a4850');
      for (i = 0; i < 20; i++) {
        t.R(i * 80, 606, 76, 100, i % 2 ? '#323038' : '#2a2830');
        t.R(i * 80, 606, 76, 2, '#1a181e');
        // Risse
        if (r() < 0.4) {
          var rx = i * 80 + 20, ry = 620;
          for (var s = 0; s < 8; s++) { t.R(rx, ry, 2, 8, '#0a0810'); rx += Math.round((r() - 0.5) * 4); ry += 8; }
        }
      }
      // fehlende Platte (Loch mit Glut-Tiefe)
      t.R(700, 640, 90, 50, '#0a0810');
      t.R(710, 650, 70, 30, '#1a1020');
      t.ell(800, 700, 140, 36, '#3a3840');
      t.ell(800, 700, 50, 12, '#ff6020');
    });
    var L5 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(606), i;
      // Vordergrund-Geländer / Seile
      t.R(0, 640, w, 8, '#1a181e');
      for (i = 0; i < 16; i++) {
        t.R(40 + i * 100, 560, 10, 100, '#242028');
        t.R(40 + i * 100 - 8, 560, 26, 8, '#3a3440');
      }
      // hängende Flaggen
      for (i = 0; i < 5; i++) {
        var fx = 200 + i * 280;
        t.R(fx, 0, 4, 120, '#2a2018');
        t.poly([[fx, 40], [fx + 40, 55], [fx, 80]], i % 2 ? '#8a2010' : '#204060');
      }
    });
    var ex = commonExtras(api, 600);
    return { L0: L0, L1: L1, L2: L2, L3: L3, L4: L4, L5: L5, lw: LW, L4r: ex.L4r, L5f: ex.L5f, daemon: ex.daemon, kegel: ex.kegel };
  }

  function bakeStadt(api) {
    var backe = api.backe, werkzeug = api.werkzeug, rng = api.rng, LW = api.LW, H = api.H;
    var G = ['#050208', '#0c0a10', '#161018', '#221820', '#302028', '#403038',
      '#5a4048', '#7a5050', '#a06050', '#c08040', '#e0a060', '#ffd0a0'];
    var L0 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(701), i;
      var BAND = ['#08060c', '#100c14', '#1a1018', '#24141c', '#2e1820', '#3a1c24', '#4a2028', '#5a2830'];
      for (i = 0; i < 8; i++) {
        t.R(0, i * 45, w, 45, BAND[i]);
        if (i) t.R(0, i * 45, w, 10, t.pat(BAND[i - 1], 50));
      }
      // smog / Asche-Sonne
      t.ell(900, 180, 80, 80, t.pat('#a04020', 25));
      t.ell(900, 180, 48, 48, '#c05028');
      t.ell(900, 180, 24, 24, '#e08040');
      // Rauch
      for (i = 0; i < 4; i++) {
        for (var s = 0; s <= 20; s++) {
          var q = s / 20;
          t.ell(300 + i * 320 + q * 80, 320 - q * 140, 20 + q * 40, 12 + q * 16, t.pat('#1a1018', 50));
        }
      }
      for (i = 0; i < 50; i++) t.R(Math.round(r() * w / 2) * 2, Math.round(r() * 220) * 2, 2, 2, G[6]);
    });
    var L1 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(702), i;
      // Skyline zerstört
      for (i = 0; i < 18; i++) {
        var hx = i * 90, hw = 50 + Math.round(r() * 50), top = 220 + Math.round(r() * 100) * 2;
        var jagged = [];
        jagged.push([hx, 460]);
        for (var zx = 0; zx <= hw; zx += 12) jagged.push([hx + zx, top + Math.round(r() * 30) * 2]);
        jagged.push([hx + hw, 460]);
        t.poly(jagged, '#141018');
        // Fenster-Leuchten
        for (var fy = top + 20; fy < 420; fy += 28) {
          for (var fx = hx + 8; fx + 10 < hx + hw; fx += 18) {
            if (r() < 0.35) t.R(fx, fy, 8, 12, r() < 0.5 ? '#ff6020' : '#4060a0');
          }
        }
      }
      t.R(0, 450, w, h - 450, '#0c0a10');
      t.toene(200, 460, 0.15, 0.06, '#1a0a10');
    });
    var L2 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(703), i;
      function ruin(x0, top, hw, seed) {
        var q = rng(seed);
        t.kR(x0, top, hw, 520 - top, '#221820');
        // abgebrochene Kante
        t.poly([[x0, top], [x0 + hw * 0.4, top - 20], [x0 + hw * 0.7, top + 10], [x0 + hw, top], [x0 + hw, top + 20], [x0, top + 20]], '#221820');
        for (var fy = top + 30; fy < 480; fy += 40) {
          for (var fx = x0 + 12; fx + 16 < x0 + hw; fx += 28) {
            t.R(fx, fy, 14, 22, q() < 0.4 ? '#ff4a18' : '#0a0608');
          }
        }
        // Graffiti-Streifen
        t.R(x0 + 10, top + 80, hw - 20, 8, '#ff3a08');
      }
      ruin(40, 280, 140, 21); ruin(220, 310, 120, 22); ruin(400, 260, 160, 23);
      ruin(700, 290, 130, 24); ruin(900, 270, 180, 25); ruin(1180, 300, 150, 26); ruin(1400, 280, 120, 27);
      // umgestürzter Kran
      t.linie(500, 200, 900, 360, 6, '#3a3038');
      t.linie(900, 360, 1100, 300, 4, '#3a3038');
      t.R(880, 350, 40, 16, '#5a4850');
    });
    var L3 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(704), i;
      // Barrikaden / Autos
      t.R(0, 490, w, 30, '#1a1218');
      for (i = 0; i < 8; i++) {
        var ax = 80 + i * 180;
        t.kR(ax, 470, 90, 36, i % 2 ? '#2a2030' : '#3a2820');
        t.R(ax + 10, 478, 30, 14, '#0a0608'); t.R(ax + 50, 478, 30, 14, '#0a0608');
        t.ell(ax + 18, 510, 12, 12, '#1a1010'); t.ell(ax + 72, 510, 12, 12, '#1a1010');
        if (r() < 0.4) t.R(ax + 20, 455, 40, 20, '#ff4a18'); // Feuer
      }
      // Mülltonnen / Trümmer
      for (i = 0; i < 20; i++) {
        t.R(40 + i * 75, 520, 20 + Math.round(r() * 20), 14, '#2a1c20');
      }
    });
    var L4 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(705), i;
      t.R(0, 600, w, h - 600, '#161018');
      t.R(0, 600, w, 6, '#2a2028');
      // Asphalt-Risse mit Glut
      for (i = 0; i < 12; i++) {
        var rx = 60 + i * 120, ry = 620;
        for (var s = 0; s < 14; s++) {
          t.R(rx, ry, 3, 6, '#ff3a08');
          rx += Math.round((r() - 0.5) * 8); ry += 6;
        }
      }
      for (i = 0; i < 60; i++) t.R(Math.round(r() * w / 2) * 2, 610 + Math.round(r() * 80) * 2, 4, 2, r() < 0.3 ? '#3a2830' : '#221820');
      // Plaza-Medaillon zerbrochen
      t.ell(800, 700, 150, 40, '#2a1c24');
      t.ell(800, 700, 70, 18, '#4a3038');
      t.R(760, 690, 80, 4, '#ff3a08');
      t.R(790, 680, 4, 40, '#ff3a08');
    });
    var L5 = backe(LW, H, function (x, w, h) {
      var t = werkzeug(x), r = rng(706), i;
      // Vordergrund-Trümmer / Zaun
      for (i = 0; i < 12; i++) {
        var fx = i * 140 - 30;
        t.poly([[fx, h], [fx + 30, 580], [fx + 70, 600], [fx + 50, h]], '#0c0810');
        t.R(fx + 40, 560, 8, 80, '#2a2030');
      }
      // Stacheldraht
      for (i = 0; i < w; i += 20) {
        t.R(i, 620 + Math.round(Math.sin(i / 30) * 6), 16, 2, '#5a5058');
      }
    });
    var ex = commonExtras(api, 700);
    return { L0: L0, L1: L1, L2: L2, L3: L3, L4: L4, L5: L5, lw: LW, L4r: ex.L4r, L5f: ex.L5f, daemon: ex.daemon, kegel: ex.kegel };
  }

  Plaza.Levels = {
    LISTE: [
      { id: 'hoelle', name: 'Hölle', emoji: '🌋', desc: 'Vulkane & Feuerplaza' },
      { id: 'dschungel', name: 'Dschungel', emoji: '🌴', desc: 'Tempel & Lianen' },
      { id: 'bruecke', name: 'Brücke', emoji: '🌉', desc: 'Nacht-Schlucht' },
      { id: 'stadt', name: 'Stadt', emoji: '🏙️', desc: 'Zerstörte Metropole' }
    ],
    bake: function (id, api) {
      if (id === 'dschungel') return bakeDschungel(api);
      if (id === 'bruecke') return bakeBruecke(api);
      if (id === 'stadt') return bakeStadt(api);
      return null; // hoelle bleibt in render.js
    },
    weatherBias: function (id) {
      if (id === 'dschungel') return 'regen';
      if (id === 'bruecke') return 'gewitter';
      if (id === 'stadt') return 'klar';
      return 'klar';
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
