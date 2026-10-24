/* Einfache Trainings-CPU / Dummy für Solo-Testmodus. v1.3 */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};

  var idle = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };

  function copy(inp) {
    return { l: !!inp.l, r: !!inp.r, u: !!inp.u, d: !!inp.d, a: !!inp.a, b: !!inp.b, c: !!inp.c };
  }

  /** @param {object} st Kampfstate @param {number} seite CPU-Seite (meist 1) @param {object} [opts] */
  function denk(st, seite, opts) {
    opts = opts || {};
    var aggressiv = opts.aggressiv != null ? opts.aggressiv : 0.55;
    var me = st.p[seite];
    var foe = st.p[1 - seite];
    if (!me || !foe) return copy(idle);
    if (st.phase !== 'kampf') return copy(idle);

    var inp = copy(idle);
    var dx = foe.x - me.x;
    var dist = Math.abs(dx);
    var tick = st.tick | 0;
    var rng = ((tick * 1103515245 + seite * 12345) >>> 0) % 1000;

    // Facing: nach innen laufen
    var nachRechts = dx > 0;

    // Block wenn Gegner angreift und nah
    var foeAtk = foe.atk;
    var foeThreat = foeAtk && dist < 70;
    if (foeThreat || (foe.stun <= 0 && dist < 36 && (rng % 7) === 0)) {
      if (nachRechts) inp.l = true; else inp.r = true;
      // gelegentlich Duck-Block gegen Lows
      if (foeAtk && foeAtk.m && foeAtk.m.low) inp.d = true;
      else if ((rng % 5) === 0) inp.d = true;
      return inp;
    }

    // Abstand halten / annähern
    if (dist > 58) {
      if (nachRechts) inp.r = true; else inp.l = true;
    } else if (dist < 22) {
      // leicht zurückweichen
      if (nachRechts) inp.l = true; else inp.r = true;
    } else if ((rng % 11) < 3) {
      if (nachRechts) inp.r = true; else inp.l = true;
    }

    // Jump selten
    if (dist > 40 && dist < 90 && (rng % 90) === 0 && me.grounded) inp.u = true;

    // Angriffe — nur wenn idle und im Range
    if (me.stun <= 0 && !me.atk && me.grounded && dist < 72) {
      var roll = rng % 100;
      var thresh = Math.floor(aggressiv * 100);
      if (roll < thresh * 0.45 && dist < 34) inp.a = true;
      else if (roll < thresh * 0.65 && dist < 42) inp.b = true;
      else if (roll < thresh * 0.78 && dist < 70) inp.c = true;
      else if (roll < thresh * 0.85) inp.d = true; // duck bait
    }

    // Dummy-Modus: wenig Angriff, mehr stehen/blocken
    if (opts.dummy) {
      inp.a = false; inp.b = false; inp.u = false;
      if ((rng % 40) !== 0) inp.c = false;
      if (dist < 50 && (rng % 3) !== 0) {
        if (nachRechts) { inp.l = true; inp.r = false; }
        else { inp.r = true; inp.l = false; }
      }
    }

    return inp;
  }

  function zufallsGegner(meinId) {
    var liste = Plaza.Chars.LISTE || [];
    var pool = [];
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].id !== meinId) pool.push(liste[i].id);
    }
    if (!pool.length) return meinId || 'toni';
    var t = (Date.now() + (Math.random() * 1000) | 0) % pool.length;
    return pool[t];
  }

  Plaza.KI = { denk: denk, zufallsGegner: zufallsGegner, idle: idle };
})(typeof window !== 'undefined' ? window : globalThis);
