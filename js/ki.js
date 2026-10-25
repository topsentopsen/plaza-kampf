/* Trainings-CPU / Solo-KI. v4.0 — Praxis-Gegner: härter, kombiert, wirft öfter Specials.
   Kein Ein-Treffer-Kill: Schaden bleibt der der Moves, die CPU spielt nur gemeiner. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};

  var idle = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
  /** Solo/Praxis. Deutlich über dem alten 0.5, unter Dauerfeuer. */
  var PRAXIS = 0.84;

  function copy(inp) {
    return { l: !!inp.l, r: !!inp.r, u: !!inp.u, d: !!inp.d, a: !!inp.a, b: !!inp.b, c: !!inp.c };
  }

  /** @param {object} st Kampfstate @param {number} seite CPU-Seite (meist 1) @param {object} [opts] */
  function denk(st, seite, opts) {
    opts = opts || {};
    var aggressiv = opts.aggressiv != null ? opts.aggressiv : (opts.praxis ? PRAXIS : 0.55);
    var me = st.p[seite];
    var foe = st.p[1 - seite];
    if (!me || !foe) return copy(idle);
    if (st.phase !== 'kampf') return copy(idle);

    var inp = copy(idle);
    var dx = foe.x - me.x;
    var dist = Math.abs(dx);
    var tick = st.tick | 0;
    var rng = ((tick * 1103515245 + seite * 12345) >>> 0) % 1000;
    var nachRechts = dx > 0;
    var scharf = aggressiv >= 0.78;

    function gehHin() { if (nachRechts) inp.r = true; else inp.l = true; }
    function gehWeg() { if (nachRechts) inp.l = true; else inp.r = true; }

    // v2.3: Wakeup — nach eigenem Stun erst blocken, nicht sofort special
    if (me.stun > 0) return copy(idle);
    if (me._kiWakeGuard && me._kiWakeGuard > 0) {
      me._kiWakeGuard--;
      gehWeg();
      if ((rng % 4) === 0) inp.d = true;
      return inp;
    }

    // Anti-Air — springender Gegner: stehen bleiben und treffen, nicht nur zurückweichen
    var foeAir = !foe.grounded && foe.vy < 4;
    if (foeAir && dist < 240) {
      if (dist < 110) gehWeg();
      else gehHin();
      if (me.stun <= 0 && !me.atk && me.grounded && dist < 200) {
        var airChance = scharf ? 8 : 5;
        if ((rng % 10) < airChance) {
          if (dist < 140) inp.a = true; else inp.b = true;
        }
      }
      return inp;
    }

    // Combo: echter Hitstun (Block-Stun ist nur 4 und hitKind block)
    var imHit = foe.stun > 5 && foe.hitKind !== 'block' && foe.hitKind !== 'armor';
    if (imHit && me.stun <= 0 && !me.atk && me.grounded) {
      if (dist > 156) gehHin();
      else {
        gehHin();
        var cdHit = (tick - (me._kiSpecialAt || -999)) > (scharf ? 44 : 80);
        if (cdHit && dist < 200 && (rng % 6) === 0) {
          inp.c = true;
          me._kiSpecialAt = tick;
        } else if ((rng % 4) === 0) inp.b = true;
        else inp.a = true;
      }
      return inp;
    }

    var foeAtk = foe.atk;
    var foeThreat = foeAtk && dist < (scharf ? 250 : 280);
    if (foeThreat || (foe.stun <= 0 && dist < 120 && (rng % (scharf ? 16 : 7)) === 0)) {
      gehWeg();
      if (foeAtk && foeAtk.m && foeAtk.m.low) inp.d = true;
      else if ((rng % 5) === 0) inp.d = true;
      return inp;
    }

    // Whiff: Gegner schlägt ins Leere → reinlaufen statt mitblocken
    if (foeAtk && dist > 200 && dist < 480 && me.grounded) {
      gehHin();
      return inp;
    }

    if (dist > (scharf ? 176 : 232)) gehHin();
    else if (dist < 72 && (rng % 4) === 0) gehWeg();
    else if ((rng % 8) < (scharf ? 5 : 3)) gehHin();

    if (dist > 180 && dist < 340 && (rng % (scharf ? 170 : 90)) === 0 && me.grounded) inp.u = true;

    if (!me.atk && me.grounded && dist < (scharf ? 340 : 288)) {
      var roll = rng % 100;
      var thresh = Math.floor(aggressiv * 100);
      var specialCd = scharf ? 44 : 80;
      var specialReady = (tick - (me._kiSpecialAt || -999)) > specialCd;
      var foeBacking = (nachRechts ? foe.input && foe.input.l : foe.input && foe.input.r);
      if (roll < thresh * 0.42 && dist < 156) inp.a = true;
      else if (roll < thresh * 0.64 && dist < 198) inp.b = true;
      else if (specialReady && roll < thresh * (foeBacking && !scharf ? 0 : 0.8) && dist > 90 && dist < 380) {
        // Praxis wirft Specials auch in den Block (Chip, Low, Wurf). Weichere KI spart sie.
        inp.c = true;
        me._kiSpecialAt = tick;
      }
      else if (!scharf && roll < thresh * 0.85) inp.d = true;
    }

    if (opts.dummy) {
      inp.a = false; inp.b = false; inp.u = false;
      if ((rng % 40) !== 0) inp.c = false;
      if (dist < 200 && (rng % 3) !== 0) {
        if (nachRechts) { inp.l = true; inp.r = false; }
        else { inp.r = true; inp.l = false; }
      }
    }

    return inp;
  }

  // Hook: nach Stun Ende Wake-Guard setzen (vom Tick-Loop via markWake)
  function markWake(p) {
    if (!p) return;
    p._kiWakeGuard = 18; // ~0.3s block-first
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

  Plaza.KI = { denk: denk, zufallsGegner: zufallsGegner, idle: idle, markWake: markWake, PRAXIS: PRAXIS };
})(typeof window !== 'undefined' ? window : globalThis);
