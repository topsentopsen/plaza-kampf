/* Client-Snapshot-Interpolation v4.0 — Wiedergabe nach Sim-Tick, nicht nach Paket-Lücken.
   v3.9 hat zwischen Ankunftszeiten gelinpt. MQTT/rAF bündelt oft 2–3 Ticks in 1 ms,
   der Gast sprang dann und wartete: der Host (lokal 60 Hz) blieb glatt, der Gast ruckelte.
   Jetzt läuft ein Playback-Tick mit ~60 Hz; der Puffer glättet Jitter. Diskrete Flags
   (Pose, Block, HP) wechseln in der Mitte des Intervalls, Positionen laufen linear. */
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

  function discOf(a, b, t) {
    return t >= 0.5 ? b : a;
  }

  function findProj(list, bp) {
    if (!list || !bp) return null;
    var i, ap, best = null, bestD = 1e9, d;
    for (i = 0; i < list.length; i++) {
      ap = list[i];
      if (!ap) continue;
      if (bp.i != null && ap.i != null) {
        if (ap.i === bp.i) return ap;
        continue;
      }
      if (ap.typ !== bp.typ || ap.owner !== bp.owner) continue;
      d = Math.abs((ap.x || 0) - (bp.x || 0)) + Math.abs((ap.y || 0) - (bp.y || 0));
      if (d < bestD) { bestD = d; best = ap; }
    }
    return best;
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
        var disc = discOf(ap, bp, t);
        return {
          id: bp.id, charId: bp.charId, name: bp.name,
          x: lerp(ap.x, bp.x, t),
          y: lerp(ap.y, bp.y, t),
          facing: disc.facing,
          grounded: disc.grounded,
          hp: disc.hp, maxHp: disc.maxHp, stun: disc.stun,
          atk: disc.atk, invuln: disc.invuln,
          crouch: disc.crouch, blk: disc.blk,
          hitSeq: disc.hitSeq, hitKind: disc.hitKind,
          combo: disc.combo, comboDmg: disc.comboDmg,
          vx: lerp(ap.vx || 0, bp.vx || 0, t),
          vy: lerp(ap.vy || 0, bp.vy || 0, t),
          af: disc.af,
          bn: disc.bn || '',
          bt: disc.bt || 0
        };
      }),
      projektil: (b.projektil || []).map(function (bp) {
        var ap = findProj(a.projektil, bp);
        if (!ap) return bp;
        return {
          i: bp.i, x: lerp(ap.x, bp.x, t), y: lerp(ap.y, bp.y, t),
          vx: bp.vx, vy: bp.vy,
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
        if (!p.grounded) o.y = p.y + (p.vy || 0) * dt;
        return o;
      }),
      projektil: (snap.projektil || []).map(function (p) {
        var o = {};
        for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) o[k] = p[k];
        o.x = p.x + (p.vx || 0) * dt;
        o.y = p.y + (p.vy || 0) * dt;
        return o;
      })
    };
  }

  /**
   * delayMs: wie weit die gezeichnete Sim-Zeit hinter dem neuesten Tick liegt.
   * 50 ms ≈ 3 Ticks — genug, um ein gebündeltes Paket zu entzerren, ohne den Gast träge zu machen.
   */
  function erstelle(opts) {
    opts = opts || {};
    var delayMs = opts.delayMs != null ? opts.delayMs : 50;
    var buf = [];
    var playTick = null;
    var lastT = null;
    var MAX = 24;

    function now() {
      return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    }

    function delayTicks() {
      return Math.max(1, delayMs * (60 / 1000));
    }

    function push(snap) {
      if (!snap || typeof snap !== 'object') return;
      var t = now();
      if (buf.length) {
        var last = buf[buf.length - 1];
        if (typeof snap.tick === 'number' && typeof last.tick === 'number' && snap.tick < last.tick) {
          var rematch = snap.phase === 'countdown' || snap.tick < 10 || (last.tick - snap.tick) > 45;
          if (rematch) {
            buf = [];
            playTick = null;
            lastT = null;
          } else {
            return;
          }
        }
      }
      if (buf.length && buf[buf.length - 1].tick === snap.tick) buf[buf.length - 1] = snap;
      else buf.push(snap);
      if (buf.length > MAX) buf.splice(0, buf.length - MAX);
      if (lastT == null) lastT = t;
      if (playTick == null) playTick = snap.tick - delayTicks();
    }

    function reset() {
      buf = [];
      playTick = null;
      lastT = null;
    }

    function latest() {
      return buf.length ? buf[buf.length - 1] : null;
    }

    function takeDt(t) {
      if (lastT == null) { lastT = t; return 0; }
      var dt = t - lastT;
      if (dt < 0) dt = 0;
      if (dt > 50) dt = 50;
      lastT = t;
      return dt;
    }

    function sample(tOpt) {
      var t = tOpt != null ? tOpt : now();
      if (!buf.length) return null;
      var latestSnap = buf[buf.length - 1];
      var dt = takeDt(t);
      if (latestSnap.phase === 'ende' || latestSnap.phase === 'countdown') {
        playTick = latestSnap.tick;
        return latestSnap;
      }
      if (playTick == null) playTick = latestSnap.tick - delayTicks();
      var newest = latestSnap.tick;
      if (newest - playTick > 18) playTick = newest - delayTicks();
      var want = delayTicks();
      var depth = newest - playTick;
      var speed = 1;
      if (depth > want + 1.5) speed = 1.06;
      else if (depth < want - 1.2) speed = 0.94;
      playTick += dt * (60 / 1000) * speed;
      if (playTick > newest + 3) playTick = newest + 3;

      if (playTick >= newest) {
        var over = (playTick - newest) * (1000 / 60);
        if (over > 0.5 && latestSnap.phase === 'kampf') return extrapolate(latestSnap, over);
        return latestSnap;
      }
      if (playTick <= buf[0].tick) return buf[0];

      var older = buf[0], newer = latestSnap, i, span, alpha;
      for (i = 0; i < buf.length - 1; i++) {
        if (buf[i].tick <= playTick && buf[i + 1].tick >= playTick) {
          older = buf[i];
          newer = buf[i + 1];
          break;
        }
      }
      span = newer.tick - older.tick;
      alpha = span > 0 ? (playTick - older.tick) / span : 1;
      return lerpSnap(older, newer, clamp01(alpha));
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
