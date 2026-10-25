/* Client-Snapshot-Interpolation v3.9 — Gast zeichnet zwischen Host-States glatt. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza || (g.Plaza = {});

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp01(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t;
  }

  /** vx im Sim ist Pixel pro 60Hz-Tick. */
  function ticksFromMs(ms) {
    return ms * (60 / 1000);
  }

  function lerpSnap(a, b, t) {
    if (!a) return b;
    if (!b) return a;
    t = clamp01(t);
    var out = {
      tick: b.tick,
      phase: b.phase,
      countdown: b.countdown,
      zeit: b.zeit,
      sieger: b.sieger,
      endeTimer: b.endeTimer,
      nachricht: b.nachricht,
      p: (b.p || []).map(function (bp, i) {
        var ap = (a.p && a.p[i]) || bp;
        // Diskrete Kampf-Flags immer vom neueren Snap (Treffer/Atk nicht „morphen“)
        var o = {
          id: bp.id, charId: bp.charId, name: bp.name,
          x: lerp(ap.x, bp.x, t),
          y: lerp(ap.y, bp.y, t),
          facing: bp.facing,
          grounded: bp.grounded,
          hp: bp.hp, maxHp: bp.maxHp, stun: bp.stun,
          atk: bp.atk, invuln: bp.invuln,
          crouch: bp.crouch, blk: bp.blk,
          hitSeq: bp.hitSeq, hitKind: bp.hitKind,
          combo: bp.combo, comboDmg: bp.comboDmg,
          vx: bp.vx, af: bp.af
        };
        return o;
      }),
      projektil: (b.projektil || []).map(function (bp, i) {
        var ap = (a.projektil && a.projektil[i]) || null;
        if (!ap || ap.typ !== bp.typ || ap.owner !== bp.owner) return bp;
        return {
          x: lerp(ap.x, bp.x, t), y: lerp(ap.y, bp.y, t),
          w: bp.w, h: bp.h, farbe: bp.farbe, owner: bp.owner, typ: bp.typ
        };
      })
    };
    return out;
  }

  function extrapolate(snap, ms) {
    if (!snap || ms <= 0) return snap;
    var dt = ticksFromMs(Math.min(48, ms)); // max ~3 Ticks voraus
    return {
      tick: snap.tick,
      phase: snap.phase,
      countdown: snap.countdown,
      zeit: snap.zeit,
      sieger: snap.sieger,
      endeTimer: snap.endeTimer,
      nachricht: snap.nachricht,
      p: (snap.p || []).map(function (p) {
        var o = {};
        for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) o[k] = p[k];
        o.x = p.x + (p.vx || 0) * dt;
        return o;
      }),
      projektil: snap.projektil || []
    };
  }

  /**
   * delayMs: Render-Zeit hinter dem letzten Empfang (Puffer gegen Jitter).
   * Typisch 33–50 ms bei ~30 Hz Host-Broadcast.
   */
  function erstelle(opts) {
    opts = opts || {};
    var delayMs = opts.delayMs != null ? opts.delayMs : 40;
    var from = null, to = null;
    var tFrom = 0, tTo = 0;

    function now() {
      return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    }

    function push(snap) {
      if (!snap || typeof snap !== 'object') return;
      var t = now();
      if (to && typeof snap.tick === 'number' && typeof to.tick === 'number' && snap.tick < to.tick) {
        // Rematch: Countdown/Neustart oder großer Tick-Rücksprung → Puffer leeren
        var rematch = snap.phase === 'countdown' || snap.tick < 10 || (to.tick - snap.tick) > 45;
        if (rematch) {
          from = null; to = null; tFrom = 0; tTo = 0;
        } else {
          return; // kleines Reordering
        }
      }
      if (!to) {
        from = snap;
        to = snap;
        tFrom = t;
        tTo = t;
        return;
      }
      from = to;
      tFrom = tTo;
      // Wenn zwei Snaps im selben ms ankommen, span=0 vermeiden
      if (t <= tFrom) t = tFrom + 1;
      to = snap;
      tTo = t;
    }

    function reset() {
      from = null;
      to = null;
      tFrom = 0;
      tTo = 0;
    }

    function latest() {
      return to;
    }

    function sample(tOpt) {
      var t = tOpt != null ? tOpt : now();
      if (!to) return null;
      // Ende / Countdown: nicht extrapolieren, hart zeigen
      if (to.phase === 'ende' || to.phase === 'countdown') return to;
      if (!from || from === to || tTo <= tFrom) return to;

      var renderAt = t - delayMs;
      var span = tTo - tFrom;
      var alpha = (renderAt - tFrom) / span;

      if (alpha <= 0) return from;
      if (alpha >= 1) {
        // Puffer leer: leicht voraus mit vx (statt Springen/Stocken)
        var over = renderAt - tTo;
        if (over > 0 && to.phase === 'kampf') return extrapolate(to, over);
        return to;
      }
      return lerpSnap(from, to, alpha);
    }

    return {
      push: push,
      sample: sample,
      reset: reset,
      latest: latest,
      setDelay: function (ms) { delayMs = ms; }
    };
  }

  Plaza.Interp = {
    erstelle: erstelle,
    lerpSnap: lerpSnap,
    extrapolate: extrapolate
  };
})(typeof window !== 'undefined' ? window : globalThis);
