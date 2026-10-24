/* Autoritative Kampfsimulation (läuft auf dem Host). */
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
      stun: 0, crouch: false,
      atk: null, atkFrame: 0, hitDone: false,
      invuln: 0, combo: 0,
      input: { l: false, r: false, u: false, d: false, a: false, b: false, c: false },
      prev: { a: false, b: false, c: false, u: false }
    };
  }

  function neu(charA, charB) {
    return {
      tick: 0, phase: 'kampf', // kampf | ende | countdown
      countdown: 3, zeit: ROUND_ZEIT,
      p: [spielerNeu(0, charA || 'biel'), spielerNeu(1, charB || 'toni')],
      projektil: [],
      sieger: null, endeTimer: 0,
      nachricht: 'Kampf!'
    };
  }

  function setInput(st, seite, inp) {
    var p = st.p[seite];
    if (!p) return;
    p.prev = { a: p.input.a, b: p.input.b, c: p.input.c, u: p.input.u };
    p.input = {
      l: !!inp.l, r: !!inp.r, u: !!inp.u, d: !!inp.d,
      a: !!inp.a, b: !!inp.b, c: !!inp.c
    };
  }

  function startAtk(p, art) {
    if (p.atk || p.stun > 0) return;
    var c = Plaza.Chars.finde(p.charId);
    var m = c.moves[art];
    if (!m) return;
    p.atk = { art: art, m: m };
    p.atkFrame = 0;
    p.hitDone = false;
  }

  function hitbox(p) {
    var c = Plaza.Chars.finde(p.charId);
    return { x: p.x - c.w / 2, y: p.y - c.h, w: c.w, h: c.h };
  }

  function atkBox(p) {
    if (!p.atk) return null;
    var m = p.atk.m;
    var f = p.atkFrame;
    if (f < m.startup || f >= m.startup + m.active) return null;
    if (m.projectile) return null;
    var reach = m.reach;
    var x = p.facing > 0 ? p.x : p.x - reach;
    return { x: x, y: p.y - m.high - 8, w: reach, h: m.high + 8, throw: !!m.throw };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function schaden(st, ang, opf, m) {
    if (opf.invuln > 0 || opf.hp <= 0) return;
    opf.hp = Math.max(0, opf.hp - m.dmg);
    opf.stun = 12 + Math.floor(m.dmg / 2);
    opf.vx = ang.facing * m.knock;
    opf.vy = m.throw ? -4 : -1.5;
    opf.grounded = false;
    opf.atk = null;
    opf.invuln = 8;
    ang.combo = (ang.combo || 0) + 1;
    if (m.throw) {
      opf.x = ang.x + ang.facing * 28;
      opf.y = BODEN - 10;
    }
  }

  function updateSpieler(st, p, dt) {
    var c = Plaza.Chars.finde(p.charId);
    var inp = p.input;
    if (p.invuln > 0) p.invuln--;
    if (p.stun > 0) {
      p.stun--;
      p.vx *= 0.85;
    } else if (!p.atk) {
      var dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      if (dir) {
        p.vx = dir * c.speed;
        p.facing = dir;
      } else {
        p.vx *= 0.7;
        if (Math.abs(p.vx) < 0.05) p.vx = 0;
      }
      if (inp.u && !p.prev.u && p.grounded) {
        p.vy = -c.jump;
        p.grounded = false;
      }
      if (inp.a && !p.prev.a) startAtk(p, 'light');
      else if (inp.b && !p.prev.b) startAtk(p, 'heavy');
      else if (inp.c && !p.prev.c) startAtk(p, 'special');
    } else {
      p.vx *= 0.85;
    }

    if (p.atk) {
      p.atkFrame++;
      var m = p.atk.m;
      var total = m.startup + m.active + m.recovery;
      // Projektil spawnen bei Active-Start
      if (m.projectile && p.atkFrame === m.startup && !p.hitDone) {
        p.hitDone = true;
        st.projektil.push({
          x: p.x + p.facing * 16, y: p.y - 18,
          vx: p.facing * 3.2, vy: 0,
          w: 10, h: 8, dmg: m.dmg, knock: m.knock,
          owner: p.id, life: 50, farbe: c.farbe
        });
      }
      if (p.atkFrame >= total) p.atk = null;
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
    var i, j, a, b, box, hb;
    for (i = 0; i < 2; i++) {
      a = st.p[i];
      b = st.p[1 - i];
      box = atkBox(a);
      if (!box || a.hitDone) continue;
      hb = hitbox(b);
      if (overlaps(box, hb)) {
        a.hitDone = true;
        schaden(st, a, b, a.atk.m);
      }
    }
    for (i = st.projektil.length - 1; i >= 0; i--) {
      var pr = st.projektil[i];
      pr.x += pr.vx; pr.life--;
      if (pr.life <= 0 || pr.x < -20 || pr.x > ARENA_W + 20) {
        st.projektil.splice(i, 1);
        continue;
      }
      for (j = 0; j < 2; j++) {
        if (st.p[j].id === pr.owner) continue;
        hb = hitbox(st.p[j]);
        if (overlaps({ x: pr.x - pr.w / 2, y: pr.y - pr.h / 2, w: pr.w, h: pr.h }, hb)) {
          schaden(st, st.p[pr.owner], st.p[j], { dmg: pr.dmg, knock: pr.knock, throw: false });
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
    // Facing zueinander wenn idle
    if (!a.atk && a.stun <= 0) a.facing = a.x <= b.x ? 1 : -1;
    if (!b.atk && b.stun <= 0) b.facing = b.x <= a.x ? 1 : -1;
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
        return { x: p.x, y: p.y, w: p.w, h: p.h, farbe: p.farbe, owner: p.owner };
      }),
      p: st.p.map(function (p) {
        return {
          id: p.id, charId: p.charId, name: p.name,
          x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10,
          facing: p.facing, grounded: p.grounded,
          hp: p.hp, maxHp: p.maxHp, stun: p.stun,
          atk: p.atk ? { art: p.atk.art, frame: p.atkFrame } : null,
          invuln: p.invuln
        };
      })
    };
  }

  function rematch(st) {
    return neu(st.p[0].charId, st.p[1].charId);
  }

  Plaza.Kampf = {
    ARENA_W: ARENA_W, ARENA_H: ARENA_H, BODEN: BODEN,
    neu: neu, setInput: setInput, tick: tick, snapshot: snapshot, rematch: rematch,
    hitbox: hitbox, atkBox: atkBox
  };
})(typeof window !== 'undefined' ? window : globalThis);
