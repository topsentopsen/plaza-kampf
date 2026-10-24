/* Einstieg, Spielschleife, Host/Client-Logik. v0.5 */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};
  var VERSION = 'v0.5';
  Plaza.VERSION = VERSION;

  function params() {
    var q = {};
    try {
      var s = location.search.replace(/^\?/, '').split('&');
      for (var i = 0; i < s.length; i++) {
        var p = s[i].split('=');
        if (p[0]) q[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
      }
    } catch (e) {}
    return q;
  }

  function start() {
    var canvas = document.getElementById('spiel');
    var rahmen = document.getElementById('rahmen');
    var render = Plaza.Render.erstelle(canvas);
    var meinChar = 'biel';
    var peerChar = null;
    var seite = 0;
    var kampf = null;
    var letzterSnap = null;
    var netz = null;
    var lokalInput = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
    var peerInput = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
    var mode = 'menue';
    var hostWahl = null, gastWahl = null;
    var pendingRaum = null;

    var _skKey = '';
    function skalieren() {
      var ww = window.innerWidth - 12, wh = window.innerHeight;
      var W = Plaza.Render.W, H = Plaza.Render.H;
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
      var maxH = wh * 0.58;
      var sfInt = Math.max(1, Math.floor(Math.min(ww / W, maxH / H)));
      var cssW = W * sfInt, cssH = H * sfInt;
      if (sfInt <= 1) {
        var soft = Math.min(ww / W, maxH / H, 2.5);
        cssW = Math.floor(W * soft);
        cssH = Math.floor(H * soft);
      } else if (ww > cssW + W * 0.45 && sfInt < 3) {
        cssW = Math.floor(W * (sfInt + 0.5));
        cssH = Math.floor(H * (sfInt + 0.5));
      }
      var buf = dpr >= 2.5 ? 3 : 2;
      var key = cssW + 'x' + cssH + '@' + buf;
      if (key === _skKey) return;
      _skKey = key;
      rahmen.style.width = cssW + 'px';
      rahmen.style.height = cssH + 'px';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      if (Plaza.Render.setzePuffer) Plaza.Render.setzePuffer(render, buf);
      document.documentElement.style.setProperty('--s', String(cssW / W));
      var pad = Math.max(56, Math.min(76, Math.round(48 + (cssW / W) * 10)));
      document.documentElement.style.setProperty('--pad', pad + 'px');
      var hudFs = Math.max(13, Math.min(16, Math.round(12 + (cssW / W) * 1.5)));
      document.documentElement.style.setProperty('--ui', hudFs + 'px');
    }

    function setUrl(raum, isHost) {
      try {
        var q = '?raum=' + encodeURIComponent(raum || '') + '&v=0.5';
        if (isHost) q += '&host=1';
        history.replaceState(null, '', q);
      } catch (e) {}
    }

    var ui = Plaza.UI.erstelle({
      root: document.body,
      getLink: function () { return netz ? netz.linkFuer(null, false) : ''; },
      onHost: function () {
        seite = 0;
        netz.hostStarten();
        ui.showScreen('warte');
        ui.setStatus('Broker wird verbunden…');
        ui.showRetry(false);
      },
      onJoin: function (raum) {
        var code = (raum || pendingRaum || '').trim();
        if (!code) {
          ui.setStatus('Bitte Raum-Code eingeben');
          return;
        }
        seite = 1;
        pendingRaum = code;
        netz.beitreten(code);
        ui.showScreen('warte');
        ui.setStatus('Trete Raum ' + code + ' bei…');
        ui.showRetry(false);
      },
      onRetry: function () {
        ui.setStatus('Nochmal…');
        ui.showRetry(false);
        if (Plaza.Sound) Plaza.Sound.init();
        if (netz) netz.retry();
        ui.showScreen('warte');
      },
      onMute: function () {
        if (!Plaza.Sound) return true;
        Plaza.Sound.init();
        return Plaza.Sound.toggleMute();
      },
      onWahl: function (id) {
        meinChar = id;
        if (netz && netz.istHost()) hostWahl = id;
        else gastWahl = id;
        if (netz && netz.istBereit()) {
          netz.sende({ typ: 'wahl', charId: id, seite: seite, ver: VERSION });
        }
        ui.setStatus('Gewählt: ' + Plaza.Chars.finde(id).name + ' — warte auf den anderen…');
        if (netz && netz.istHost()) versucheStart();
      },
      onRematch: function () {
        if (netz && netz.istHost() && kampf) {
          kampf = Plaza.Kampf.rematch(kampf);
          kampf.phase = 'countdown';
          kampf.countdown = 3;
          kampf.tick = 0;
          broadcast();
        } else if (netz) {
          netz.sende({ typ: 'rematch' });
        }
      },
      onInput: function (inp) {
        lokalInput = {
          l: !!inp.l, r: !!inp.r, u: !!inp.u, d: !!inp.d,
          a: !!inp.a, b: !!inp.b, c: !!inp.c
        };
        if (mode === 'kampf' && netz && !netz.istHost() && netz.istBereit()) {
          netz.sende({ typ: 'input', seite: seite, input: lokalInput });
        }
      }
    });

    function versucheStart() {
      if (!(netz && netz.istHost())) return;
      if (!hostWahl || !gastWahl) return;
      kampf = Plaza.Kampf.neu(hostWahl, gastWahl);
      kampf.phase = 'countdown';
      kampf.countdown = 3;
      mode = 'kampf';
      ui.showScreen('kampf');
      if (Plaza.Sound) Plaza.Sound.resetDiff();
      if (Plaza.Render.resetFx) Plaza.Render.resetFx();
      broadcast();
    }

    function broadcast() {
      if (!(netz && netz.istHost() && kampf)) return;
      var snap = Plaza.Kampf.snapshot(kampf);
      letzterSnap = snap;
      netz.sende({ typ: 'state', state: snap });
    }

    netz = Plaza.Netz.erstelle({
      onStatus: function (t, extra) {
        extra = extra || {};
        var via = extra.via || extra.transport || '';
        if (t === 'warte') {
          var link = netz.linkFuer(null, false);
          ui.showLink(link, netz.getRaum());
          setUrl(netz.getRaum(), true);
          ui.setStatus('Raum ' + netz.getRaum() + ' offen' + (via ? ' (' + via + ')' : '') + ' — Link teilen. Handy nicht sperren!');
          ui.showRetry(false);
        } else if (t === 'verbunden') {
          ui.setStatus('Verbunden' + (via || netz.getTransport() ? ' über ' + (via || netz.getTransport()) : '') + '! Tippe deinen Charakter');
          hostWahl = null;
          gastWahl = null;
          ui.fillChars(null);
          ui.showScreen('wahl');
          mode = 'wahl';
          ui.showRetry(false);
          netz.sende({ typ: 'join', seite: seite });
        } else if (t === 'fehler') {
          var err = extra.err || '';
          var hinweis = extra.hinweis || '';
          ui.setStatus('Problem: ' + err + (hinweis ? ' — ' + hinweis : '') + ' Statuszeile beobachten, dann „Nochmal“.');
          ui.showRetry(true);
          if (mode !== 'kampf') ui.showScreen('warte');
        } else if (t === 'kein-peerjs' || t === 'mqtt-fehlt') {
          ui.setStatus('Netz-Bibliothek fehlt. Bitte hart neu laden.');
          ui.showRetry(true);
        } else if (t === 'getrennt') {
          ui.setStatus('Gegenüber weg. Tab offen lassen und „Nochmal“.');
          ui.showRetry(true);
        } else if (t === 'verbinde') {
          ui.setStatus('Verbinde' + (via ? ' über ' + via : '') + '…');
        } else if (t === 'suche') {
          ui.setStatus('Suche Host…' + (extra.try ? ' Versuch ' + extra.try : ''));
        } else if (t === 'broker-wechsel') {
          ui.setStatus('Anderer Broker…');
        } else if (t === 'mqtt-aus') {
          ui.setStatus('MQTT nicht erreichbar — PeerJS-Fallback…');
        } else if (t === 'neuer-code') {
          ui.showLink(netz.linkFuer(null, false), netz.getRaum());
          setUrl(netz.getRaum(), true);
          ui.setStatus('Neuer Code: ' + netz.getRaum());
        } else if (t === 'warte-peer') {
          ui.setStatus(extra.hinweis || 'Warte auf Mitspieler…');
        } else if (t === 'broker-weg') {
          ui.setStatus('Broker kurz weg — reconnect…');
        }
      },
      onMsg: function (msg) {
        if (!msg || !msg.typ) return;
        if (msg.typ === 'hello' || msg.typ === 'join') {
          if (netz.istHost()) ui.setStatus('Mitspieler da — Charakter wählen');
        }
        if (msg.typ === 'wahl') {
          if (msg.ver && msg.ver !== VERSION) {
            ui.setStatus('Andere Version (' + msg.ver + ') — bitte beide hart neu laden (?v=0.5)');
          }
          if (netz.istHost()) {
            if (msg.seite === 1) gastWahl = msg.charId;
            if (msg.seite === 0) hostWahl = msg.charId;
            versucheStart();
          } else if (msg.seite === 0) {
            peerChar = msg.charId;
          }
        }
        if (msg.typ === 'input' && netz.istHost()) {
          if (msg.seite === 1) peerInput = msg.input || peerInput;
        }
        if (msg.typ === 'state' && !netz.istHost()) {
          letzterSnap = msg.state;
          if (mode !== 'kampf') {
            mode = 'kampf';
            ui.showScreen('kampf');
          }
        }
        if (msg.typ === 'rematch' && netz.istHost() && kampf) {
          kampf = Plaza.Kampf.rematch(kampf);
          kampf.phase = 'countdown';
          kampf.countdown = 3;
          kampf.tick = 0;
          broadcast();
        }
      },
      onClose: function () {
        ui.setStatus('Verbindung zu.');
        ui.showRetry(true);
      }
    });

    var q = params();
    if (q.raum && (q.host === '1' || q.host === 'true')) {
      seite = 0;
      ui.showScreen('warte');
      ui.setStatus('Host-Raum ' + q.raum + ' wird geöffnet…');
      setTimeout(function () { netz.hostStarten(q.raum); }, 60);
    } else if (q.raum) {
      seite = 1;
      pendingRaum = q.raum;
      ui.showScreen('warte');
      ui.showLink('', q.raum);
      ui.setStatus('Raum ' + q.raum + ' — tippe „Jetzt beitreten“ (wichtig auf dem iPhone).');
      ui.showJoinConfirm(true, q.raum);
    } else {
      ui.showScreen('menue');
      Plaza.Render.menueHint(render, 'Raum erstellen oder beitreten');
    }

    document.addEventListener('pointerdown', function () {
      if (Plaza.Sound) Plaza.Sound.resume();
    }, { passive: true });

    canvas.addEventListener('pointerdown', function () {
      if (Plaza.Sound) Plaza.Sound.resume();
      if (letzterSnap && letzterSnap.phase === 'ende') {
        if (netz && netz.istHost() && kampf) {
          kampf = Plaza.Kampf.rematch(kampf);
          kampf.phase = 'countdown';
          kampf.countdown = 3;
          kampf.tick = 0;
          broadcast();
        } else if (netz) netz.sende({ typ: 'rematch' });
      }
    });

    // Warnung wenn Tab in Hintergrund
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && (mode === 'warte' || mode === 'wahl' || mode === 'kampf')) {
        ui.setStatus('Tab im Hintergrund — Verbindung kann reißen. Bitte offen lassen!');
      }
    });

    var acc = 0, last = performance.now();
    var STEP = 1000 / 60;

    function loop(now) {
      requestAnimationFrame(loop);
      var dt = Math.min(50, now - last);
      last = now;
      acc += dt;
      skalieren();

      if (mode === 'kampf' && netz && netz.istHost() && kampf) {
        while (acc >= STEP) {
          acc -= STEP;
          Plaza.Kampf.setInput(kampf, 0, lokalInput);
          Plaza.Kampf.setInput(kampf, 1, peerInput);
          Plaza.Kampf.tick(kampf);
          if (kampf.tick % 2 === 0) broadcast();
        }
        letzterSnap = Plaza.Kampf.snapshot(kampf);
        Plaza.Render.zeichne(render, letzterSnap, 0);
      } else if (mode === 'kampf' && letzterSnap) {
        Plaza.Render.zeichne(render, letzterSnap, seite);
        acc = 0;
      } else if (mode === 'menue') {
        Plaza.Render.menueHint(render, 'Versus · 2 Handys · v0.5');
        acc = 0;
      } else {
        Plaza.Render.menueHint(render, statusElText());
        acc = 0;
      }
    }

    function statusElText() {
      var el = document.getElementById('status');
      return el ? el.textContent : '';
    }

    window.addEventListener('resize', skalieren);
    skalieren();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else start();
})(typeof window !== 'undefined' ? window : globalThis);
