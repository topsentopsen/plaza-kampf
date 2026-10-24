/* Autoritative Kampfsimulation (läuft auf dem Host). v1.2: Buffer + Feinschliff. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};

  var ARENA_W = 320, ARENA_H = 180, BODEN = 148, GRAV = 0.38;
  var TICK = 1 / 60, ROUND_ZEIT = 99;

  function spielerNeu(seite, charId) {
    var c = Plaza.Chars.finde(charId);
    return {
      id: seite, charId: c.id, name: c.name,
      x: seite === 0 ? 80 : 240, y: BODEN, vx: 0, vy: 0,
      facing: seite === 0 ? 1 : -1, grounded: true,
      hp: c.hp, maxHp: c.hp,
      stun: 0, crouch: false, blocking: false,
      atk: null, atkFrame: 0, hitDone: false, hitCount: 0,
      bufA: 0, bufB: 0, bufC: 0, comboDmg: 0,
      invuln: 0, combo: 0, armorLeft: 0,
      hitSeq: 0, hitKind: '',
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

  function startAtk(p, art) {
    if (p.atk || p.stun > 0) return;
    if (p.blocking) return;
    var c = Plaza.Chars.finde(p.charId);
    var m = c.moves[art];
    if (!m) {
      // Fallback: air → light wenn nicht definiert
      if (art === 'air') m = c.moves.light;
      if (!m) return;
      art = 'light';
    }
    p.atk = { art: art, m: m };
    p.atkFrame = 0;
    p.hitDone = false;
    p.hitCount = 0;
    p.armorLeft = (m.armor && m.armor.hits) || (m.armor ? 1 : 0);
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
    var yOff = p.crouch ? 4 : 8;
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
      var chipMul = (ang.atk && ang.atk.art === 'special') ? 0.22 : 0.12;
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
    opf.vy = m.throw ? -4.2 : (m.dmg >= 14 ? -2.2 : -1.2);
    opf.grounded = false;
    opf.atk = null;
    opf.blocking = false;
    opf.crouch = false;
    opf.invuln = m.dmg >= 14 ? 10 : 6;
    opf.hitSeq++;
    opf.hitKind = m.throw ? 'throw' : ((ang.atk && ang.atk.art === 'special') ? 'special' : (m.dmg >= 14 ? 'heavy' : 'light'));
    opf.combo = 0; // Getroffen → eigene Combo weg
    ang.combo = (ang.combo || 0) + 1;
    ang.comboDmg = (ang.comboDmg || 0) + m.dmg;
    if (m.throw) {
      opf.x = ang.x + ang.facing * 28;
      opf.y = BODEN - 10;
    }
    // Cancel-Fenster für Angreifer
    if (ang.atk && ang.atk.m.cancel) ang._cancel = ang.atk.m.cancel;
    return true;
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
        var spd = pr.spd || 2.4;
        st.projektil.push(ext(base, {
          x: p.x + p.facing * 14, y: p.y - 18,
          vx: p.facing * Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          w: 8, h: 8, life: pr.life || 40
        }));
      }
      return;
    }
    if (typ === 'bodenwelle') {
      st.projektil.push(ext(base, {
        x: p.x + p.facing * 12, y: BODEN - 4,
        vx: p.facing * (pr.vx || 2.2), vy: 0,
        w: 14, h: 8, life: pr.life || 28, low: true
      }));
      return;
    }
    // Standard-Ball / ladbarer Sonnenball
    var scale = pr.scale || 1;
    st.projektil.push(ext(base, {
      x: p.x + p.facing * 16, y: p.y - 18,
      vx: p.facing * (pr.vx || 3.2) * scale,
      vy: pr.vy || 0,
      w: Math.round(10 * scale), h: Math.round(8 * scale),
      life: pr.life || 50,
      dmg: Math.round(base.dmg * scale)
    }));
  }

  function updateSpieler(st, p, dt) {
    var c = Plaza.Chars.finde(p.charId);
    var inp = p.input;
    if (p.bufA > 0) p.bufA--;
    if (p.bufB > 0) p.bufB--;
    if (p.bufC > 0) p.bufC--;
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

    if (p.stun > 0) {
      p.stun--;
      p.vx *= 0.85;
    } else if (!p.atk) {
      var dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      // Beim Blocken nicht vorwärts laufen
      if (p.blocking) {
        p.vx *= 0.5;
      } else if (dir && !p.crouch) {
        p.vx = dir * c.speed;
        p.facing = dir;
      } else if (dir && p.crouch) {
        p.vx = dir * c.speed * 0.35;
      } else {
        p.vx *= 0.7;
        if (Math.abs(p.vx) < 0.05) p.vx = 0;
      }
      if (inp.u && !p.prev.u && p.grounded && !p.crouch) {
        p.vy = -c.jump;
        p.grounded = false;
      }
      // Cancel / Attacken mit Input-Buffer
      if (p._cancel && p.bufC > 0) {
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
      // Cancel on hit
      if (p._cancel && p.bufC > 0) {
        var cancelTo = p._cancel;
        p._cancel = null; p.bufC = 0;
        p.atk = null;
        startAtk(p, cancelTo);
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
    if (p.x < half + 8) p.x = half + 8;
    if (p.x > ARENA_W - half - 8) p.x = ARENA_W - half - 8;
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
      if (pr.life <= 0 || pr.x < -20 || pr.x > ARENA_W + 20) {
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
    var minDist = (ca.w + cb.w) / 2 + 2;
    var dx = b.x - a.x;
    if (Math.abs(dx) < minDist && Math.abs(a.y - b.y) < 20) {
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
        return { x: p.x, y: p.y, w: p.w, h: p.h, farbe: p.farbe, owner: p.owner, typ: p.typ || 'ball' };
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
          af: p.atk ? (p.atkFrame | 0) : 0
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
    hitbox: hitbox, atkBox: atkBox
  };
})(typeof window !== 'undefined' ? window : globalThis);
