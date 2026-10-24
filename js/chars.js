/* Fünf Kämpfer mit Movesets. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};

  var CHARS = [
    {
      id: 'biel', name: 'Biel', farbe: '#5ec8b8', farbe2: '#3fa597', accent: '#fff8ee',
      hp: 100, speed: 2.2, jump: 6.2, w: 18, h: 28,
      moves: {
        light: { name: 'Knuff', dmg: 6, startup: 4, active: 3, recovery: 8, knock: 2.2, reach: 22, high: 14 },
        heavy: { name: 'Sonnenhieb', dmg: 14, startup: 9, active: 4, recovery: 14, knock: 4.5, reach: 26, high: 16 },
        special: { name: 'Pa amb oli', dmg: 18, startup: 12, active: 5, recovery: 18, knock: 5.5, reach: 34, high: 18, projectile: false }
      }
    },
    {
      id: 'lola', name: 'Lola', farbe: '#ff9fc0', farbe2: '#e07aa0', accent: '#fff0f6',
      hp: 90, speed: 2.8, jump: 6.8, w: 16, h: 26,
      moves: {
        light: { name: 'Tipp', dmg: 5, startup: 3, active: 2, recovery: 6, knock: 1.8, reach: 20, high: 12 },
        heavy: { name: 'Wirbeltritt', dmg: 12, startup: 7, active: 5, recovery: 12, knock: 3.8, reach: 28, high: 10 },
        special: { name: 'Rosenregen', dmg: 10, startup: 10, active: 8, recovery: 14, knock: 2.5, reach: 48, high: 20, projectile: true }
      }
    },
    {
      id: 'toni', name: 'Toni', farbe: '#ff8a4d', farbe2: '#e06a2a', accent: '#fff4e8',
      hp: 120, speed: 1.7, jump: 5.6, w: 22, h: 30,
      moves: {
        light: { name: 'Schlag', dmg: 8, startup: 5, active: 3, recovery: 10, knock: 2.8, reach: 24, high: 16 },
        heavy: { name: 'Amboss', dmg: 20, startup: 14, active: 4, recovery: 18, knock: 6.5, reach: 28, high: 18 },
        special: { name: 'Erdstoß', dmg: 22, startup: 16, active: 6, recovery: 22, knock: 7, reach: 30, high: 12, projectile: false }
      }
    },
    {
      id: 'rocco', name: 'Rocco', farbe: '#b9a3f5', farbe2: '#9580dc', accent: '#f4efff',
      hp: 110, speed: 1.9, jump: 5.8, w: 20, h: 29,
      moves: {
        light: { name: 'Greif', dmg: 7, startup: 5, active: 3, recovery: 9, knock: 2.4, reach: 21, high: 14 },
        heavy: { name: 'Schulter', dmg: 15, startup: 10, active: 4, recovery: 15, knock: 5, reach: 24, high: 16 },
        special: { name: 'Plaza-Wurf', dmg: 16, startup: 8, active: 4, recovery: 16, knock: 8, reach: 20, high: 18, throw: true }
      }
    },
    {
      id: 'nina', name: 'Nina', farbe: '#ffd36e', farbe2: '#e0ad3e', accent: '#fff9e6',
      hp: 95, speed: 2.4, jump: 6.4, w: 17, h: 27,
      moves: {
        light: { name: 'Stich', dmg: 5, startup: 3, active: 3, recovery: 7, knock: 2, reach: 23, high: 13 },
        heavy: { name: 'Blitzkick', dmg: 13, startup: 8, active: 4, recovery: 13, knock: 4, reach: 30, high: 14 },
        special: { name: 'Sonnenball', dmg: 12, startup: 11, active: 10, recovery: 16, knock: 3.2, reach: 56, high: 16, projectile: true }
      }
    }
  ];

  function finde(id) {
    for (var i = 0; i < CHARS.length; i++) if (CHARS[i].id === id) return CHARS[i];
    return CHARS[0];
  }

  Plaza.Chars = { LISTE: CHARS, finde: finde };
})(typeof window !== 'undefined' ? window : globalThis);
