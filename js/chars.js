/* Fünf Plaza-Kämpfer: Stats, Moves, Lore, Look, winLine (v1.0). */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};

  var CHARS = [
    {
      id: 'biel', name: 'Biel', spitzname: 'El Pescador',
      lore: 'Fischer-Sohn. Repariert Netze und schwört auf Pa amb oli.',
      farbe: '#1a3028', farbe2: '#0c1814', accent: '#3a8070',
      haut: '#8a6048',
      hp: 100, speed: 2.2, jump: 6.2, w: 20, h: 32,
      stats: { tempo: 3, kraft: 3, reich: 3 },
      look: { build: 'mittel', hut: 'muetze', bart: 'drei', prop: 'netz' },
      sound: { hitPitch: 1.0 },
      winLine: 'Das Netz hält — du nicht.',
      moves: {
        light: { name: 'Knuff', dmg: 6, startup: 4, active: 3, recovery: 8, knock: 2.2, reach: 22, high: 14, cancel: 'special' },
        heavy: { name: 'Sonnenhieb', dmg: 14, startup: 9, active: 4, recovery: 14, knock: 4.5, reach: 26, high: 16, overhead: true },
        special: { name: 'Pa amb oli', dmg: 18, startup: 12, active: 5, recovery: 18, knock: 5.5, reach: 34, high: 18,
          armor: { von: 1, bis: 10, hits: 1 } },
        air: { name: 'Netz-Haken', dmg: 7, startup: 5, active: 4, recovery: 10, knock: 2.5, reach: 24, high: 14 }
      }
    },
    {
      id: 'lola', name: 'Lola', spitzname: 'La Rosa',
      lore: 'Blumen vom Markt. Flamenco-Tochter — Tritt wie sie tanzt.',
      farbe: '#4a1428', farbe2: '#2a0814', accent: '#c03050',
      haut: '#906050',
      hp: 90, speed: 2.8, jump: 6.8, w: 18, h: 30,
      stats: { tempo: 5, kraft: 2, reich: 4 },
      look: { build: 'schlank', hut: 'dutt', bart: null, prop: 'rose' },
      sound: { hitPitch: 1.2 },
      winLine: 'Die Rose blutet heiß.',
      moves: {
        light: { name: 'Tipp', dmg: 5, startup: 3, active: 2, recovery: 4, knock: 1.8, reach: 20, high: 12, cancel: 'special' },
        heavy: { name: 'Wirbeltritt', dmg: 12, startup: 6, active: 5, recovery: 11, knock: 3.8, reach: 28, high: 10,
          hits: 2, dash: 20 },
        special: { name: 'Rosenregen', dmg: 10, startup: 10, active: 8, recovery: 14, knock: 2.5, reach: 48, high: 20,
          projectile: true, proj: { typ: 'fächer', spd: 2.2, life: 42, angles: [-0.4, 0, 0.4] } },
        air: { name: 'Diagonal-Tritt', dmg: 8, startup: 4, active: 5, recovery: 10, knock: 3, reach: 22, high: 16, overhead: true }
      }
    },
    {
      id: 'toni', name: 'Toni', spitzname: 'El Herrero',
      lore: 'Dorfschmied. Hat den Pokal geschmiedet — und rückt ihn nicht raus.',
      farbe: '#5a1808', farbe2: '#301008', accent: '#e05020',
      haut: '#7a5040',
      hp: 120, speed: 1.7, jump: 5.6, w: 24, h: 34,
      stats: { tempo: 1, kraft: 5, reich: 3 },
      look: { build: 'breit', hut: null, bart: 'schnurr', prop: 'hammer' },
      sound: { hitPitch: 0.8 },
      winLine: 'Der Amboss schweigt. Du auch.',
      moves: {
        light: { name: 'Schlag', dmg: 8, startup: 5, active: 3, recovery: 10, knock: 2.8, reach: 24, high: 16, cancel: 'special' },
        heavy: { name: 'Amboss', dmg: 20, startup: 14, active: 4, recovery: 18, knock: 6.5, reach: 28, high: 18,
          armor: { von: 10, bis: 14, hits: 1 } },
        special: { name: 'Erdstoß', dmg: 20, startup: 15, active: 6, recovery: 22, knock: 6.5, reach: 30, high: 12,
          projectile: true, proj: { typ: 'bodenwelle', vx: 2.2, life: 28, dmg: 20, knock: 6.5 } },
        air: { name: 'Hammerfall', dmg: 12, startup: 8, active: 4, recovery: 14, knock: 4, reach: 20, high: 18, overhead: true }
      }
    },
    {
      id: 'rocco', name: 'Rocco', spitzname: 'El Portero',
      lore: 'Ex-Türsteher der Strandbar. Kennt jeden Griff — und jeden Gast.',
      farbe: '#241838', farbe2: '#140c20', accent: '#7040a0',
      haut: '#6a4838',
      hp: 110, speed: 1.9, jump: 5.8, w: 22, h: 33,
      stats: { tempo: 2, kraft: 4, reich: 2 },
      look: { build: 'kräftig', hut: null, bart: null, prop: 'brille' },
      sound: { hitPitch: 0.9 },
      winLine: 'Raus. Die Tür bleibt zu.',
      moves: {
        light: { name: 'Greif', dmg: 7, startup: 5, active: 3, recovery: 9, knock: 2.4, reach: 21, high: 14, cancel: 'special' },
        heavy: { name: 'Schulter', dmg: 15, startup: 10, active: 4, recovery: 15, knock: 5, reach: 24, high: 16,
          dash: 24, armor: { von: 8, bis: 14, hits: 1, proj: true } },
        special: { name: 'Plaza-Wurf', dmg: 16, startup: 8, active: 4, recovery: 16, knock: 8, reach: 20, high: 18,
          throw: true, unblockbar: true },
        air: { name: 'Körpercheck', dmg: 9, startup: 6, active: 4, recovery: 12, knock: 3.5, reach: 22, high: 16 }
      }
    },
    {
      id: 'nina', name: 'Nina', spitzname: 'La Chispa',
      lore: 'Rollerblade-Kurierin. Immer in Bewegung, immer Kopfhörer.',
      farbe: '#3a2808', farbe2: '#201408', accent: '#c08020',
      haut: '#8a5840',
      hp: 95, speed: 2.4, jump: 6.4, w: 19, h: 31,
      stats: { tempo: 4, kraft: 2, reich: 5 },
      look: { build: 'schlank', hut: 'pony', bart: null, prop: 'kopfhörer' },
      sound: { hitPitch: 1.25 },
      winLine: 'Zu langsam für den Funken.',
      moves: {
        light: { name: 'Stich', dmg: 5, startup: 3, active: 3, recovery: 6, knock: 2, reach: 23, high: 13, cancel: 'special' },
        heavy: { name: 'Blitzkick', dmg: 13, startup: 7, active: 4, recovery: 12, knock: 4, reach: 30, high: 14,
          dash: 32, cancel: 'special' },
        special: { name: 'Sonnenball', dmg: 13, startup: 10, active: 10, recovery: 15, knock: 3.4, reach: 56, high: 16,
          projectile: true, proj: { typ: 'ball', vx: 3.5, life: 58, scale: 1 } },
        air: { name: 'Slide-Kick', dmg: 6, startup: 4, active: 5, recovery: 10, knock: 2.2, reach: 26, high: 10, low: true }
      }
    }
  ];

  function finde(id) {
    for (var i = 0; i < CHARS.length; i++) if (CHARS[i].id === id) return CHARS[i];
    return CHARS[0];
  }

  Plaza.Chars = { LISTE: CHARS, finde: finde };
})(typeof window !== 'undefined' ? window : globalThis);
