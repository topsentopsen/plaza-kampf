/* Client-Snapshot-Interpolation v4.2 — flüssig trotz MQTT-Bursts.
   v4.1 hat Einzelframe-Teleports entfernt, den Puffer aber auf 50 ms gelassen und
   bei Unterlauf eingefroren. Öffentliche MQTT-Broker liefern 60-Hz-Snapshots in
   Klumpen (oft 80–150 ms). Der Gast stand deshalb ständig und holte danach nur
   kriechend auf — das hakelige Bild. Jetzt folgt die Verzögerung der gemessenen
   Burst-Lücke, die Geschwindigkeit bleibt nahe 1×, Pose wechselt weiter erst am
   Tick-Rand, und es gibt keinen vx-Vorlauf über das letzte Snapshot hinaus. */
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

  function smoothAxis(p0, p1, v0, v1, t, span) {
    if (!(span > 0) || span > 4) return lerp(p0, p1, t);
    var tt = t * t, ttt = tt * t;
    var h00 = 2 * ttt - 3 * tt + 1;
    var h10 = ttt - 2 * tt + t;
    var h01 = -2 * ttt + 3 * tt;
    var h11 = ttt - tt;
    var h = h00 * p0 + h10 * (v0 * span) + h01 * p1 + h11 * (v1 * span);
    var lo = Math.min(p0, p1) - 6;
    var hi = Math.max(p0, p1) + 6;
    if (h < lo) return lo;
    if (h > hi) return hi;
    return h;
  }

  /** Ein Frame darf höchstens maxStep auf das Ziel zugehen — kein Teleport. */
  function schritt(current, goal, maxStep) {
    if (current == null || current !== current) return goal;
    var d = goal - current;
    if (d > maxStep) d = maxStep;
    if (d < -maxStep) d = -maxStep;
    return current + d;
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
        var span = (typeof b.tick === 'number' && typeof a.tick === 'number') ? (b.tick - a.tick) : 1;
        return {
          id: bp.id, charId: bp.charId, name: bp.name,
          x: smoothAxis(ap.x, bp.x, ap.vx || 0, bp.vx || 0, t, span),
          y: smoothAxis(ap.y, bp.y, ap.vy || 0, bp.vy || 0, t, span),
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
   * delayMs startet bei ~90 ms und folgt der Lücke zwischen Snapshot-Klumpen
   * (Untergrenze 60 ms, Obergrenze 150 ms). So reicht der Puffer für einen
   * MQTT-Burst, ohne den Gast eine halbe Sekunde hinterherlaufen zu lassen.
   */
  function erstelle(opts) {
    opts = opts || {};
    var delayMs = opts.delayMs != null ? opts.delayMs : 90;
    var buf = [];
    var playTick = null;
    var lastT = null;
    var lastBurstAt = null;
    var emaGap = 100;
    var holding = false;
    var arrivals = [];
    var pushed = 0;
    var underruns = 0;
    var MAX = 48;

    function now() {
      return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    }

    function delayTicks() {
      return Math.max(2, delayMs * (60 / 1000));
    }

    function noteArrival(t) {
      pushed++;
      arrivals.push(t);
      var cut = t - 1000;
      while (arrivals.length && arrivals[0] < cut) arrivals.shift();
      if (lastBurstAt == null) { lastBurstAt = t; return; }
      var gap = t - lastBurstAt;
      lastBurstAt = t;
      if (gap < 12 || gap > 500) return;
      emaGap = emaGap * 0.72 + gap * 0.28;
      if (emaGap < 45) emaGap = 45;
      if (emaGap > 180) emaGap = 180;
      var want = Math.round(emaGap * 1.1);
      if (want < 70) want = 70;
      if (want > 150) want = 150;
      if (want >= delayMs) delayMs = want;
      else delayMs = delayMs * 0.85 + want * 0.15;
      if (delayMs < 60) delayMs = 60;
      if (delayMs > 150) delayMs = 150;
    }

    function trim() {
      var guard = playTick == null ? -1e9 : playTick - 1;
      while (buf.length > MAX && buf[0].tick < guard) buf.shift();
    }

    function push(snap) {
      if (!snap || typeof snap !== 'object') return;
      var t = now();
      if (buf.length) {
        var last = buf[buf.length - 1];
        if (typeof snap.tick === 'number' && typeof last.tick === 'number' && snap.tick < last.tick) {
          if (snap.phase === 'countdown') {
            buf = [];
            playTick = null;
            lastT = null;
            lastBurstAt = null;
            holding = false;
          } else {
            return;
          }
        }
      }
      if (buf.length && buf[buf.length - 1].tick === snap.tick) buf[buf.length - 1] = snap;
      else buf.push(snap);
      noteArrival(t);
      trim();
      if (lastT == null) lastT = t;
      if (playTick == null) playTick = snap.tick - delayTicks();
    }

    function reset() {
      buf = [];
      playTick = null;
      lastT = null;
      lastBurstAt = null;
      holding = false;
    }

    function latest() {
      return buf.length ? buf[buf.length - 1] : null;
    }

    function takeDt(t) {
      if (lastT == null) { lastT = t; return 0; }
      var dt = t - lastT;
      if (dt < 0) dt = 0;
      if (dt > 80) dt = 80;
      lastT = t;
      return dt;
    }

    function sample(tOpt) {
      var t = tOpt != null ? tOpt : now();
      if (!buf.length) return null;
      var latestSnap = buf[buf.length - 1];
      var dt = takeDt(t);
      if (latestSnap.phase === 'ende' || latestSnap.phase === 'countdown') {
        playTick = latestSnap.tick - delayTicks();
        return latestSnap;
      }
      if (playTick == null) playTick = latestSnap.tick - delayTicks();

      var newest = latestSnap.tick;
      var want = delayTicks();
      var depth = newest - playTick;
      var speed = 1;
      if (depth > want + 3) speed = 1.08;
      else if (depth < want * 0.45) speed = 0.92;
      var step = dt * (60 / 1000) * speed;
      if (step > 3.2) step = 3.2;
      playTick += step;
      if (playTick > newest) {
        if (!holding && step > 0.2) {
          underruns++;
          if (delayMs < 150) delayMs = Math.min(150, delayMs + 8);
        }
        holding = true;
        playTick = newest;
      } else if (newest - playTick > 0.8) {
        holding = false;
      }
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

    function stats() {
      var newest = buf.length ? buf[buf.length - 1].tick : 0;
      return {
        pushed: pushed,
        underruns: underruns,
        delayMs: Math.round(delayMs),
        depth: playTick == null ? 0 : (newest - playTick),
        burstGapMs: Math.round(emaGap),
        recvHz: arrivals.length
      };
    }

    return {
      push: push,
      sample: sample,
      reset: reset,
      latest: latest,
      stats: stats,
      setDelay: function (ms) { delayMs = ms; }
    };
  }

  Plaza.Interp = {
    erstelle: erstelle,
    lerpSnap: lerpSnap,
    extrapolate: extrapolate,
    schritt: schritt
  };
})(typeof window !== 'undefined' ? window : globalThis);
