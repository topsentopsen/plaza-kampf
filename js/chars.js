/* Fünf Plaza-Kämpfer: Stats, Moves, Lore, Look, winLine (v1.4 — 1280×768, Geometrie ×4). */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};

  // v1.4: w/h/speed/jump sowie reach/high/knock/dash und Projektil-spd/vx ×4.
  // Timing (startup/active/recovery), dmg, hp, life, angles, armor-Frames unverändert.
  var CHARS = [
    {
      id: 'biel', name: 'Biel', spitzname: 'El Pescador',
      lore: 'Fischer-Sohn. Repariert Netze und schwört auf Pa amb oli.',
      farbe: '#1a3028', farbe2: '#0c1814', accent: '#3a8070',
      haut: '#8a6048',
      hp: 100, speed: 8.8, jump: 24.8, w: 80, h: 128,
      stats: { tempo: 3, kraft: 3, reich: 3 },
      look: { build: 'mittel', hut: 'muetze', bart: 'drei', prop: 'netz' },
      sound: { hitPitch: 1.0 },
      winLine: 'Das Netz hält — du nicht.',
      moves: {
        light: { name: 'Knuff', dmg: 6, startup: 4, active: 3, recovery: 8, knock: 8.8, reach: 88, high: 56, cancel: 'special' },
        heavy: { name: 'Sonnenhieb', dmg: 14, startup: 9, active: 4, recovery: 14, knock: 18, reach: 104, high: 64, overhead: true },
        special: { name: 'Pa amb oli', dmg: 18, startup: 12, active: 5, recovery: 18, knock: 22, reach: 136, high: 72,
          armor: { von: 1, bis: 10, hits: 1 } },
        air: { name: 'Netz-Haken', dmg: 7, startup: 5, active: 4, recovery: 10, knock: 10, reach: 96, high: 56 }
      }
    },
    {
      id: 'lola', name: 'Lola', spitzname: 'La Rosa',
      lore: 'Blumen vom Markt. Flamenco-Tochter — Tritt wie sie tanzt.',
      farbe: '#4a1428', farbe2: '#2a0814', accent: '#c03050',
      haut: '#906050',
      hp: 90, speed: 11.2, jump: 27.2, w: 72, h: 120,
      stats: { tempo: 5, kraft: 2, reich: 4 },
      look: { build: 'schlank', hut: 'dutt', bart: null, prop: 'rose' },
      sound: { hitPitch: 1.2 },
      winLine: 'Die Rose blutet heiß.',
      moves: {
        light: { name: 'Tipp', dmg: 5, startup: 3, active: 2, recovery: 4, knock: 7.2, reach: 80, high: 48, cancel: 'special' },
        heavy: { name: 'Wirbeltritt', dmg: 12, startup: 6, active: 5, recovery: 11, knock: 15.2, reach: 112, high: 40,
          hits: 2, dash: 80 },
        special: { name: 'Rosenregen', dmg: 10, startup: 10, active: 8, recovery: 14, knock: 10, reach: 192, high: 80,
          projectile: true, proj: { typ: 'fächer', spd: 8.8, life: 42, angles: [-0.4, 0, 0.4] } },
        air: { name: 'Diagonal-Tritt', dmg: 8, startup: 4, active: 5, recovery: 10, knock: 12, reach: 88, high: 64, overhead: true }
      }
    },
    {
      id: 'toni', name: 'Toni', spitzname: 'El Herrero',
      lore: 'Dorfschmied. Hat den Pokal geschmiedet — und rückt ihn nicht raus.',
      farbe: '#5a1808', farbe2: '#301008', accent: '#e05020',
      haut: '#7a5040',
      hp: 120, speed: 6.8, jump: 22.4, w: 96, h: 136,
      stats: { tempo: 1, kraft: 5, reich: 3 },
      look: { build: 'breit', hut: null, bart: 'schnurr', prop: 'hammer' },
      sound: { hitPitch: 0.8 },
      winLine: 'Der Amboss schweigt. Du auch.',
      moves: {
        light: { name: 'Schlag', dmg: 8, startup: 5, active: 3, recovery: 10, knock: 11.2, reach: 96, high: 64, cancel: 'special' },
        heavy: { name: 'Amboss', dmg: 20, startup: 14, active: 4, recovery: 18, knock: 26, reach: 112, high: 72,
          armor: { von: 10, bis: 14, hits: 1 } },
        special: { name: 'Erdstoß', dmg: 20, startup: 15, active: 6, recovery: 22, knock: 26, reach: 120, high: 48,
          projectile: true, proj: { typ: 'bodenwelle', vx: 8.8, life: 28, dmg: 20, knock: 26 } },
        air: { name: 'Hammerfall', dmg: 12, startup: 8, active: 4, recovery: 14, knock: 16, reach: 80, high: 72, overhead: true }
      }
    },
    {
      id: 'rocco', name: 'Rocco', spitzname: 'El Portero',
      lore: 'Ex-Türsteher der Strandbar. Kennt jeden Griff — und jeden Gast.',
      farbe: '#241838', farbe2: '#140c20', accent: '#7040a0',
      haut: '#6a4838',
      hp: 110, speed: 7.6, jump: 23.2, w: 88, h: 132,
      stats: { tempo: 2, kraft: 4, reich: 2 },
      look: { build: 'kräftig', hut: null, bart: null, prop: 'brille' },
      sound: { hitPitch: 0.9 },
      winLine: 'Raus. Die Tür bleibt zu.',
      moves: {
        light: { name: 'Greif', dmg: 7, startup: 5, active: 3, recovery: 9, knock: 9.6, reach: 84, high: 56, cancel: 'special' },
        heavy: { name: 'Schulter', dmg: 15, startup: 10, active: 4, recovery: 15, knock: 20, reach: 96, high: 64,
          dash: 96, armor: { von: 8, bis: 14, hits: 1, proj: true } },
        special: { name: 'Plaza-Wurf', dmg: 16, startup: 8, active: 4, recovery: 16, knock: 32, reach: 80, high: 72,
          throw: true, unblockbar: true },
        air: { name: 'Körpercheck', dmg: 9, startup: 6, active: 4, recovery: 12, knock: 14, reach: 88, high: 64 }
      }
    },
    {
      id: 'nina', name: 'Nina', spitzname: 'La Chispa',
      lore: 'Rollerblade-Kurierin. Immer in Bewegung, immer Kopfhörer.',
      farbe: '#3a2808', farbe2: '#201408', accent: '#c08020',
      haut: '#8a5840',
      hp: 95, speed: 9.6, jump: 25.6, w: 76, h: 124,
      stats: { tempo: 4, kraft: 2, reich: 5 },
      look: { build: 'schlank', hut: 'pony', bart: null, prop: 'kopfhörer' },
      sound: { hitPitch: 1.25 },
      winLine: 'Zu langsam für den Funken.',
      moves: {
        light: { name: 'Stich', dmg: 5, startup: 3, active: 3, recovery: 6, knock: 8, reach: 92, high: 52, cancel: 'special' },
        heavy: { name: 'Blitzkick', dmg: 13, startup: 7, active: 4, recovery: 12, knock: 16, reach: 120, high: 56,
          dash: 128, cancel: 'special' },
        special: { name: 'Sonnenball', dmg: 13, startup: 10, active: 10, recovery: 15, knock: 13.6, reach: 224, high: 64,
          projectile: true, proj: { typ: 'ball', vx: 14, life: 58, scale: 1 } },
        air: { name: 'Slide-Kick', dmg: 6, startup: 4, active: 5, recovery: 10, knock: 8.8, reach: 104, high: 40, low: true }
      }
    }
  ];

  function finde(id) {
    for (var i = 0; i < CHARS.length; i++) if (CHARS[i].id === id) return CHARS[i];
    return CHARS[0];
  }

  Plaza.Chars = { LISTE: CHARS, finde: finde, SKALA: 4 };
})(typeof window !== 'undefined' ? window : globalThis);
