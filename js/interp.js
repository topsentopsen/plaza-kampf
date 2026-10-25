/* Client-Snapshot-Interpolation v4.1 — keine Einzelframe-Sprünge.
   v4.0 spielte schon im Sim-Takt, warf den Playhead aber bei einem tiefen Puffer
   in einem Frame nach vorn (Burst) und extrapolierte bei Unterlauf mit vx über
   das letzte Snapshot hinaus (ein Frame zu weit, danach zurück). Pose/Facing/Atk
   sprangen außerdem bei t=0.5 mitten im Intervall. Jetzt: Playhead nur stetig,
   bei Unterlauf stehenbleiben, Diskretes erst am Tick-Rand, veraltete Ticks verwerfen. */
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
    // Erst am Tick-Rand wechseln — nicht bei t=0.5, sonst ein Pose-Frame mitten in der Bewegung.
    return t >= 1 ? b : a;
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
      phase: b.phase,
      countdown: b.countdown,
      zeit: b.zeit,
      sieger: b.sieger,
      endeTimer: b.endeTimer,
      nachricht: b.nachricht,
      tick: t >= 1 ? b.tick : a.tick,
      p: (b.p || []).map(function (bp, i) {
        var ap = (a.p && a.p[i]) || bp;
        var disc = discOf(ap, bp, t);
        var atk = disc.atk || null;
        var af = disc.af || 0;
        if (ap.atk && bp.atk && ap.atk.art === bp.atk.art) {
          af = lerp(ap.atk.frame || ap.af || 0, bp.atk.frame || bp.af || 0, t);
          atk = { art: ap.atk.art, frame: af };
        }
        return {
          id: bp.id, charId: bp.charId, name: bp.name,
          x: lerp(ap.x, bp.x, t),
          y: lerp(ap.y, bp.y, t),
          facing: disc.facing,
          grounded: disc.grounded,
          hp: disc.hp, maxHp: disc.maxHp, stun: disc.stun,
          atk: atk, invuln: disc.invuln,
          crouch: disc.crouch, blk: disc.blk,
          hitSeq: disc.hitSeq, hitKind: disc.hitKind,
          combo: disc.combo, comboDmg: disc.comboDmg,
          vx: lerp(ap.vx || 0, bp.vx || 0, t),
          vy: lerp(ap.vy || 0, bp.vy || 0, t),
          af: af,
          bn: disc.bn || '',
          bt: disc.bt || 0
        };
      }),
      projektil: lerpProjectiles(a.projektil, b.projektil, t)
    };
    return out;
  }

  function lerpProjectiles(aList, bList, t) {
    var out = [];
    var i, bp, ap;
    aList = aList || [];
    bList = bList || [];
    for (i = 0; i < bList.length; i++) {
      bp = bList[i];
      ap = findProj(aList, bp);
      if (!ap) {
        // Neues Projektil erst am Tick-Rand — nicht eine Frame lang an der Zukunftsposition.
        if (t >= 1) out.push(bp);
        continue;
      }
      out.push({
        i: bp.i, x: lerp(ap.x, bp.x, t), y: lerp(ap.y, bp.y, t),
        vx: bp.vx, vy: bp.vy,
        w: bp.w, h: bp.h, farbe: bp.farbe, owner: bp.owner, typ: bp.typ
      });
    }
    if (t < 1) {
      for (i = 0; i < aList.length; i++) {
        ap = aList[i];
        if (!findProj(bList, ap)) out.push(ap);
      }
    }
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

    function trim() {
      // Nur Frames hinter dem Playhead wegwerfen. Ein Burst bleibt liegen,
      // sonst springt die Figur in einem Frame auf den neuesten Tick.
      var guard = playTick == null ? -1e9 : playTick - 1;
      while (buf.length > MAX && buf[0].tick < guard) buf.shift();
    }

    function push(snap) {
      if (!snap || typeof snap !== 'object') return;
      var t = now();
      if (buf.length) {
        var last = buf[buf.length - 1];
        if (typeof snap.tick === 'number' && typeof last.tick === 'number' && snap.tick < last.tick) {
          // Nur ein echter Rematch (Countdown) leert den Puffer.
          // Veraltete / out-of-order Ticks im laufenden Kampf verwerfen — nicht eine Frame lang anzeigen.
          if (snap.phase === 'countdown') {
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
      trim();
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
        // Zahl sofort zeigen, Uhr aber hinter dem Tick lassen (Kampf startet mit Puffer, nicht am Rand).
        playTick = latestSnap.tick - delayTicks();
        return latestSnap;
      }
      if (playTick == null) playTick = latestSnap.tick - delayTicks();

      var newest = latestSnap.tick;
      var want = delayTicks();
      // dt ist oben auf 50 ms gedeckelt (~3 Ticks). Kein zusätzlicher Hard-Snap:
      // ein tiefer Puffer holt nur Bruchteile eines Ticks auf, nie in einem Frame zum Ziel.
      var step = dt * (60 / 1000);
      playTick += step;
      var depth = newest - playTick;
      if (depth > want + 2) playTick += Math.min(0.35, depth - want);
      // Unterlauf: stehenbleiben. Nicht mit vx über das letzte Snapshot hinausschießen.
      if (playTick > newest) playTick = newest;
      if (playTick < buf[0].tick) {
        var hole = buf[0].tick - playTick;
        playTick += hole > 2 ? 1 : hole;
      }

      if (playTick >= newest - 1e-4) return latestSnap;
      if (playTick <= buf[0].tick + 1e-4) return buf[0];

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
