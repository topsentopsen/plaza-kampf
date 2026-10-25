/* Autoritative Kampfsimulation (Host). v4.2: feste Motion-Specials, Backwalk bleibt.
   Kombis liest nur der Host aus dem Input-Strom (l/r/u/d/a/b/c). Kein Client-Flag „special“. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};

  var ARENA_W = 1280, ARENA_H = 768, BODEN = 640, GRAV = 1.52;
  var TICK = 1 / 60, ROUND_ZEIT = 99;

  function spielerNeu(seite, charId) {
    var c = Plaza.Chars.finde(charId);
    return {
      id: seite, charId: c.id, name: c.name,
      x: seite === 0 ? 320 : 960, y: BODEN, vx: 0, vy: 0,
      facing: seite === 0 ? 1 : -1, grounded: true,
      hp: c.hp, maxHp: c.hp,
      stun: 0, crouch: false, blocking: false,
      atk: null, atkFrame: 0, hitDone: false, hitCount: 0,
      bufA: 0, bufB: 0, bufC: 0, comboDmg: 0,
      invuln: 0, combo: 0, armorLeft: 0,
      hitSeq: 0, hitKind: '',
      bn: '', bt: 0,
      mot: [], _dir: 5,
      input: { l: false, r: false, u: false, d: false, a: false, b: false, c: false },
      prev: { a: false, b: false, c: false, u: false, d: false }
    };
  }

  function sanitizeName(n, fallback) {
    n = (n == null ? '' : String(n)).replace(/[\u0000-\u001f<>]/g, '').trim();
    if (n.length > 14) n = n.slice(0, 14);
    return n || fallback || 'Spieler';
  }

  function neu(charA, charB, nameA, nameB) {
    var a = spielerNeu(0, charA || 'biel');
    var b = spielerNeu(1, charB || 'toni');
    a.name = sanitizeName(nameA, a.name);
    b.name = sanitizeName(nameB, b.name);
    return {
      tick: 0, phase: 'kampf',
      countdown: 3, zeit: ROUND_ZEIT,
      p: [a, b],
      projektil: [],
      _pid: 1,
      sieger: null, endeTimer: 0,
      nachricht: 'Kampf!'
    };
  }

  function setInput(st, seite, inp) {
    var p = st.p[seite];
    if (!p) return;
    p.prev = { a: p.input.a, b: p.input.b, c: p.input.c, u: p.input.u, d: p.input.d };
    p.input = {
      l: !!inp.l, r: !!inp.r, u: !!inp.u, d: !!inp.d,
      a: !!inp.a, b: !!inp.b, c: !!inp.c
    };
    if (p.input.a && !p.prev.a) p.bufA = 5;
    if (p.input.b && !p.prev.b) p.bufB = 5;
    if (p.input.c && !p.prev.c) p.bufC = 5;
  }

  function moveArt(p, taste) {
    // Luft-A: in der Luft Light als air
    if (taste === 'a' && !p.grounded) return 'air';
    return taste === 'a' ? 'light' : taste === 'b' ? 'heavy' : 'special';
  }

  function startAtk(p, art, force) {
    if (p.atk || p.stun > 0) return;
    if (p.blocking && !force) return;
    var c = Plaza.Chars.finde(p.charId);
    var m = c.moves[art];
    if (!m) {
      // Fallback: air → light wenn nicht definiert
      if (art === 'air') m = c.moves.light;
      if (!m) return;
      art = 'light';
    }
    if (force) p.blocking = false;
    p.atk = { art: art, m: m };
    p.atkFrame = 0;
    p.hitDone = false;
    p.hitCount = 0;
    p.armorLeft = (m.armor && m.armor.hits) || (m.armor ? 1 : 0);
    if (art === 'special' || art === 'special2') {
      p.bn = m.name || 'Special';
      p.bt = 50;
    }
  }

  /** Blickrelative Numpad-Note: 6 vor, 4 zurück, 2 unten, 3 unten-vor, 1 unten-zurück. */
  function dirCode(p) {
    var inp = p.input || {};
    var fwd = p.facing > 0 ? !!inp.r : !!inp.l;
    var back = p.facing > 0 ? !!inp.l : !!inp.r;
    if (fwd && back) { fwd = false; back = false; }
    var down = !!inp.d, up = !!inp.u;
    if (down && up) { down = false; up = false; }
    if (down && back) return 1;
    if (down && fwd) return 3;
    if (down) return 2;
    if (up && back) return 7;
    if (up && fwd) return 9;
    if (up) return 8;
    if (back) return 4;
    if (fwd) return 6;
    return 5;
  }

  function noteDir(st, p) {
    var d = dirCode(p);
    if (d === p._dir) return;
    p._dir = d;
    if (d === 5) return;
    if (!p.mot) p.mot = [];
    p.mot.push({ d: d, t: st.tick });
    if (p.mot.length > 14) p.mot.shift();
  }

  /**
   * Sequenz muss in der Historie liegen, die jüngste Richtung ist der letzte Schritt
   * (Taste während ↓↘→ bzw. →↓↘). Fremde Richtungen dazwischen brechen die Kette.
   */
  function motionOk(hist, seq, now, windowTicks) {
    if (!hist || !hist.length || !seq || !seq.length) return false;
    var i = hist.length - 1;
    var end = hist[i];
    if (!end || now - end.t > windowTicks) return false;
    if (end.d !== seq[seq.length - 1]) return false;
    var si = seq.length - 2;
    var firstT = end.t;
    for (i = i - 1; i >= 0 && si >= 0; i--) {
      var h = hist[i];
      if (now - h.t > windowTicks) return false;
      if (h.d === seq[si]) {
        firstT = h.t;
        si--;
      } else if (h.d === seq[si + 1]) {
        /* gleiche Richtung nochmal, zählt nicht neu */
      } else {
        return false;
      }
    }
    return si < 0 && (now - firstT) <= windowTicks;
  }

  function tryMotion(st, p) {
    if (p.stun > 0 || !p.grounded) return null;
    var c = Plaza.Chars.finde(p.charId);
    var list = c.motions || [];
    if (!list.length || !p.mot || !p.mot.length) return null;
    if (!(p.bufA > 0 || p.bufB > 0 || p.bufC > 0)) return null;
    var best = null, i, mv, buf, win, strict, loose, score;
    for (i = 0; i < list.length; i++) {
      mv = list[i];
      buf = mv.btn === 'a' ? p.bufA : mv.btn === 'b' ? p.bufB : p.bufC;
      if (!(buf > 0)) continue;
      win = mv.win || 20;
      strict = motionOk(p.mot, mv.seq, st.tick, win);
      loose = !strict && mv.alt && motionOk(p.mot, mv.alt, st.tick, mv.altWin || 14);
      if (!strict && !loose) continue;
      score = (strict ? 100 : 40) + mv.seq.length;
      if (!best || score > best.score) best = { art: mv.art, score: score };
    }
    if (!best) return null;
    p.bufA = 0; p.bufB = 0; p.bufC = 0;
    p.mot = [];
    p._dir = 5;
    return best.art;
  }

  function hitbox(p) {
    var c = Plaza.Chars.finde(p.charId);
    var h = p.crouch ? Math.floor(c.h * 0.62) : c.h;
    var w = c.w;
    return { x: p.x - w / 2, y: p.y - h, w: w, h: h };
  }

  function atkBox(p) {
    if (!p.atk) return null;
    var m = p.atk.m;
    var f = p.atkFrame;
    if (f < m.startup || f >= m.startup + m.active) return null;
    if (m.projectile || (m.proj && m.proj.typ)) return null;
    var reach = m.reach;
    var x = p.facing > 0 ? p.x : p.x - reach;
    var high = m.high;
    var yOff = p.crouch ? 16 : 32;
    return { x: x, y: p.y - high - yOff, w: reach, h: high + yOff, throw: !!m.throw, overhead: !!m.overhead, low: !!m.low };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function istBlock(ang, opf, m) {
    if (!opf.grounded || opf.atk || opf.stun > 0) return false;
    if (m.throw || m.unblockbar) return false;
    var weg = (opf.facing > 0) ? opf.input.l : opf.input.r;
    if (!weg) return false;
    // Overhead trifft Duck-Block nicht als Block (muss stehend geblockt werden)
    if (m.overhead && opf.crouch) return false;
    // Low trifft stehenden Block nicht (muss geduckt)
    if (m.low && !opf.crouch) return false;
    return true;
  }

  function hatArmor(p) {
    if (!p.atk || !p.atk.m.armor) return false;
    var a = p.atk.m.armor;
    var f = p.atkFrame;
    return f >= (a.von || 0) && f <= (a.bis || 999) && p.armorLeft > 0;
  }

  function schaden(st, ang, opf, m) {
    if (opf.invuln > 0 || opf.hp <= 0) return false;
    // Hyper-Armor beim Opfer
    if (hatArmor(opf)) {
      opf.armorLeft--;
      opf.hitSeq++;
      opf.hitKind = 'armor';
      return false;
    }
    if (istBlock(ang, opf, m)) {
      // Specials chippen stärker — Block allein reicht nicht
      var spezChip = ang.atk && (ang.atk.art === 'special' || ang.atk.art === 'special2');
      var chipMul = spezChip ? 0.22 : 0.12;
      var chip = Math.max(1, Math.ceil(m.dmg * chipMul));
      opf.hp = Math.max(0, opf.hp - chip);
      opf.stun = 4; // kürzer — Block fühlt sich reaktiv an
      opf.vx = ang.facing * m.knock * 0.55;
      opf.blocking = true;
      opf.hitSeq++;
      opf.hitKind = 'block';
      ang.combo = 0; // Block bricht Combo
      ang.comboDmg = 0;
      return true;
    }
    opf.hp = Math.max(0, opf.hp - m.dmg);
    // Light: kürzerer Hitstun (Kombo-Fenster), Heavy: länger
    opf.stun = m.dmg >= 14 ? (14 + Math.floor(m.dmg / 2)) : (8 + Math.floor(m.dmg / 3));
    opf.vx = ang.facing * m.knock;
    opf.vy = m.throw ? -16.8 : (m.dmg >= 14 ? -8.8 : -4.8);
    opf.grounded = false;
    opf.atk = null;
    opf.blocking = false;
    opf.crouch = false;
    opf.invuln = m.dmg >= 14 ? 10 : 6;
    opf.hitSeq++;
    var spezHit = ang.atk && (ang.atk.art === 'special' || ang.atk.art === 'special2');
    opf.hitKind = m.throw ? 'throw' : (spezHit ? 'special' : (m.dmg >= 14 ? 'heavy' : 'light'));
    opf.combo = 0; // Getroffen → eigene Combo weg
    ang.combo = (ang.combo || 0) + 1;
    ang.comboDmg = (ang.comboDmg || 0) + m.dmg;
    if (m.throw) {
      opf.x = ang.x + ang.facing * 112;
      opf.y = BODEN - 40;
    }
    // Cancel-Fenster für Angreifer
    if (ang.atk && ang.atk.m.cancel) ang._cancel = ang.atk.m.cancel;
    return true;
  }

  
  function pushProj(st, pr) {
    pr.i = st._pid || 1;
    st._pid = pr.i + 1;
    st.projektil.push(pr);
  }

  function ext(a, b) {
    var o = {}, k;
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k];
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k];
    return o;
  }

  function spawnProj(st, p, m) {
    var c = Plaza.Chars.finde(p.charId);
    var pr = m.proj || {};
    var typ = pr.typ || 'ball';
    var base = {
      owner: p.id, farbe: c.farbe, accent: c.accent,
      dmg: pr.dmg != null ? pr.dmg : m.dmg,
      knock: pr.knock != null ? pr.knock : m.knock,
      typ: typ, low: !!pr.low, overhead: !!pr.overhead
    };
    if (typ === 'fächer' || typ === 'faecher') {
      var angles = pr.angles || [-0.35, 0, 0.35];
      for (var i = 0; i < angles.length; i++) {
        var ang = angles[i];
        var spd = pr.spd || 9.6;
        pushProj(st, ext(base, {
          x: p.x + p.facing * 56, y: p.y - 72,
          vx: p.facing * Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          w: 32, h: 32, life: pr.life || 40
        }));
      }
      return;
    }
    if (typ === 'bodenwelle') {
      pushProj(st, ext(base, {
        x: p.x + p.facing * 48, y: BODEN - 16,
        vx: p.facing * (pr.vx || 8.8), vy: 0,
        w: 56, h: 32, life: pr.life || 28, low: true
      }));
      return;
    }
    // Standard-Ball / ladbarer Sonnenball
    var scale = pr.scale || 1;
    pushProj(st, ext(base, {
      x: p.x + p.facing * 64, y: p.y - 72,
      vx: p.facing * (pr.vx || 12.8) * scale,
      vy: pr.vy || 0,
      w: Math.round(40 * scale), h: Math.round(32 * scale),
      life: pr.life || 50,
      dmg: Math.round(base.dmg * scale)
    }));
  }

  function updateSpieler(st, p, dt) {
    var c = Plaza.Chars.finde(p.charId);
    var inp = p.input;
    noteDir(st, p);
    if (p.bt > 0) p.bt--;
    // v2.2: Buffer während Stun einfrieren (Wakeup-Buffer)
    if (p.stun <= 0) {
      if (p.bufA > 0) p.bufA--;
      if (p.bufB > 0) p.bufB--;
      if (p.bufC > 0) p.bufC--;
    }
    if (p.invuln > 0) p.invuln--;
    p.blocking = false;

    // Duck / Block-Haltung
    if (p.stun <= 0 && !p.atk && p.grounded) {
      p.crouch = !!inp.d;
      var weg = (p.facing > 0) ? inp.l : inp.r;
      if (weg) {
        // Block wenn weg vom Gegner (facing-basiert)
        p.blocking = weg;
      }
      // Während Duck langsamer / kein Sprint
      if (p.crouch) p.blocking = weg || p.blocking;
    } else if (!p.grounded) {
      p.crouch = false;
    }

    var mot = null;
    if (p.stun <= 0 && !p.atk && p.grounded) mot = tryMotion(st, p);
    if (mot) { p.blocking = false; p.crouch = false; }

    if (p.stun > 0) {
      p.stun--;
      p.vx *= 0.85;
    } else if (!p.atk) {
      var dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      // Motion-Start: nicht in den Block-Rückwärtslauf kippen und nicht das Facing drehen
      if (mot) {
        p.vx *= 0.6;
      } else if (p.blocking) {
        var away = p.facing > 0 ? -1 : 1;
        if (dir === away) {
          p.vx = dir * c.speed * (p.crouch ? 0.35 : 1);
        } else {
          p.vx *= 0.5;
          if (Math.abs(p.vx) < 0.2) p.vx = 0;
        }
      } else if (dir && !p.crouch) {
        p.vx = dir * c.speed;
        p.facing = dir;
      } else if (dir && p.crouch) {
        p.vx = dir * c.speed * 0.35;
      } else {
        p.vx *= 0.7;
        if (Math.abs(p.vx) < 0.2) p.vx = 0;
      }
      if (inp.u && !p.prev.u && p.grounded && !p.crouch) {
        p.vy = -c.jump;
        p.grounded = false;
      }
      // Cancel / Attacken mit Input-Buffer. Motion vor der normalen Taste — Host prüft die Sequenz.
      if (mot) {
        startAtk(p, mot, true);
      } else if (p._cancel && p.bufC > 0) {
        p._cancel = null; p.bufC = 0;
        startAtk(p, 'special');
      } else if (p.bufA > 0) { p.bufA = 0; startAtk(p, moveArt(p, 'a')); }
      else if (p.bufB > 0) { p.bufB = 0; startAtk(p, 'heavy'); }
      else if (p.bufC > 0) { p.bufC = 0; startAtk(p, 'special'); }
    } else {
      p.vx *= 0.85;
      // Dash während Active
      var m0 = p.atk.m;
      if (m0.dash && p.atkFrame >= m0.startup && p.atkFrame < m0.startup + m0.active) {
        p.vx = p.facing * (m0.dash / Math.max(1, m0.active));
      }
      // Cancel on hit — C oder eine passende Motion (Host validiert die Sequenz)
      var motC = null;
      if (p._cancel && p.stun <= 0 && p.grounded) motC = tryMotion(st, p);
      if (p._cancel && (motC || p.bufC > 0)) {
        var cancelTo = motC || p._cancel;
        p._cancel = null; p.bufC = 0;
        p.atk = null;
        startAtk(p, cancelTo, !!motC);
      }
    }

    if (p.atk) {
      p.atkFrame++;
      var m = p.atk.m;
      var total = m.startup + m.active + m.recovery;
      var isProj = !!(m.projectile || (m.proj && m.proj.typ));
      if (isProj && p.atkFrame === m.startup && !p.hitDone) {
        p.hitDone = true;
        spawnProj(st, p, m);
      }
      if (p.atkFrame >= total) {
        if (!p.hitDone && p.hitCount === 0) { p.combo = 0; p.comboDmg = 0; } // Whiff bricht Combo
        p.atk = null;
        p._cancel = null;
      }
    }

    p.vy += GRAV;
    p.x += p.vx;
    p.y += p.vy;
    if (p.y >= BODEN) {
      p.y = BODEN; p.vy = 0; p.grounded = true;
    } else p.grounded = false;
    var half = c.w / 2;
    if (p.x < half + 32) p.x = half + 32;
    if (p.x > ARENA_W - half - 32) p.x = ARENA_W - half - 32;
  }

  function updateTreffer(st) {
    var i, j, a, b, box, hb, m, maxHits;
    for (i = 0; i < 2; i++) {
      a = st.p[i];
      b = st.p[1 - i];
      box = atkBox(a);
      if (!box || !a.atk) continue;
      m = a.atk.m;
      maxHits = m.hits || 1;
      if (a.hitCount >= maxHits) continue;
      // Multi-Hit: hitDone erst nach allen Hits; zwischen Hits kurzes Fenster
      if (a.hitDone && maxHits <= 1) continue;
      if (a.hitCount > 0 && (a.atkFrame - (a._lastHitFrame || 0)) < 3) continue;
      hb = hitbox(b);
      // Overhead verfehlt Duck nicht — trifft; Low verfehlt Jump
      if (m.low && !b.grounded) continue;
      if (overlaps(box, hb)) {
        if (schaden(st, a, b, m)) {
          a.hitCount++;
          a._lastHitFrame = a.atkFrame;
          if (a.hitCount >= maxHits) a.hitDone = true;
        } else if (b.hitKind === 'armor') {
          // Armor absorbiert — zählt als Kontakt
          a.hitCount++;
          a._lastHitFrame = a.atkFrame;
          if (a.hitCount >= maxHits) a.hitDone = true;
        }
      }
    }
    for (i = st.projektil.length - 1; i >= 0; i--) {
      var pr = st.projektil[i];
      pr.x += pr.vx; pr.y += pr.vy || 0; pr.life--;
      if (pr.life <= 0 || pr.x < -80 || pr.x > ARENA_W + 80) {
        st.projektil.splice(i, 1);
        continue;
      }
      for (j = 0; j < 2; j++) {
        if (st.p[j].id === pr.owner) continue;
        // Bodenwelle trifft nur Grounded
        if (pr.low && !st.p[j].grounded) continue;
        // Projectile-Armor (Rocco Schulter)
        if (hatArmor(st.p[j]) && st.p[j].atk && st.p[j].atk.m.armor && st.p[j].atk.m.armor.proj) {
          st.p[j].armorLeft--;
          st.p[j].hitSeq++;
          st.p[j].hitKind = 'armor';
          st.projektil.splice(i, 1);
          break;
        }
        hb = hitbox(st.p[j]);
        if (overlaps({ x: pr.x - pr.w / 2, y: pr.y - pr.h / 2, w: pr.w, h: pr.h }, hb)) {
          schaden(st, st.p[pr.owner], st.p[j], {
            dmg: pr.dmg, knock: pr.knock, throw: false,
            low: pr.low, overhead: pr.overhead, unblockbar: false
          });
          st.projektil.splice(i, 1);
          break;
        }
      }
    }
  }

  function trenne(st) {
    var a = st.p[0], b = st.p[1];
    var ca = Plaza.Chars.finde(a.charId), cb = Plaza.Chars.finde(b.charId);
    var minDist = (ca.w + cb.w) / 2 + 8;
    var dx = b.x - a.x;
    if (Math.abs(dx) < minDist && Math.abs(a.y - b.y) < 80) {
      var push = (minDist - Math.abs(dx)) / 2;
      var s = dx >= 0 ? 1 : -1;
      a.x -= s * push; b.x += s * push;
    }
    if (!a.atk && a.stun <= 0 && !a.blocking) a.facing = a.x <= b.x ? 1 : -1;
    if (!b.atk && b.stun <= 0 && !b.blocking) b.facing = b.x <= a.x ? 1 : -1;
  }

  function tick(st) {
    if (st.phase === 'countdown') {
      st.tick++;
      if (st.tick % 60 === 0) st.countdown--;
      if (st.countdown <= 0) {
        st.phase = 'kampf';
        st.nachricht = 'Los!';
      }
      return st;
    }
    if (st.phase === 'ende') {
      st.endeTimer++;
      return st;
    }
    st.tick++;
    if (st.tick % 60 === 0 && st.zeit > 0) st.zeit--;
    updateSpieler(st, st.p[0], TICK);
    updateSpieler(st, st.p[1], TICK);
    updateTreffer(st);
    trenne(st);

    var tot = -1;
    if (st.p[0].hp <= 0) tot = 0;
    if (st.p[1].hp <= 0) tot = 1;
    if (tot >= 0 || st.zeit <= 0) {
      st.phase = 'ende';
      st.endeTimer = 0;
      if (tot === 0) st.sieger = 1;
      else if (tot === 1) st.sieger = 0;
      else st.sieger = st.p[0].hp >= st.p[1].hp ? 0 : 1;
      st.nachricht = st.p[st.sieger].name + ' gewinnt!';
    }
    return st;
  }

  function snapshot(st) {
    return {
      tick: st.tick, phase: st.phase, countdown: st.countdown, zeit: st.zeit,
      sieger: st.sieger, endeTimer: st.endeTimer, nachricht: st.nachricht,
      projektil: st.projektil.map(function (p) {
        return {
          i: p.i | 0, x: p.x, y: p.y,
          vx: Math.round((p.vx || 0) * 10) / 10, vy: Math.round((p.vy || 0) * 10) / 10,
          w: p.w, h: p.h, farbe: p.farbe, owner: p.owner, typ: p.typ || 'ball'
        };
      }),
      p: st.p.map(function (p) {
        return {
          id: p.id, charId: p.charId, name: p.name,
          x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10,
          facing: p.facing, grounded: p.grounded,
          hp: p.hp, maxHp: p.maxHp, stun: p.stun,
          atk: p.atk ? { art: p.atk.art, frame: p.atkFrame } : null,
          invuln: p.invuln,
          crouch: !!p.crouch, blk: !!p.blocking,
          hitSeq: p.hitSeq | 0, hitKind: p.hitKind || '',
          combo: p.combo | 0, comboDmg: p.comboDmg | 0,
          vx: Math.round((p.vx || 0) * 10) / 10,
          vy: Math.round((p.vy || 0) * 10) / 10,
          af: p.atk ? (p.atkFrame | 0) : 0,
          bn: p.bt > 0 ? (p.bn || '') : '',
          bt: p.bt | 0
        };
      })
    };
  }

  function rematch(st) {
    return neu(st.p[0].charId, st.p[1].charId, st.p[0].name, st.p[1].name);
  }

  Plaza.Kampf = {
    ARENA_W: ARENA_W, ARENA_H: ARENA_H, BODEN: BODEN,
    neu: neu, setInput: setInput, tick: tick, snapshot: snapshot, rematch: rematch,
    hitbox: hitbox, atkBox: atkBox, motionOk: motionOk, dirCode: dirCode
  };
})(typeof window !== 'undefined' ? window : globalThis);
