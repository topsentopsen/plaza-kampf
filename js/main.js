/* Einstieg, Spielschleife, Host/Client-Logik. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};
  var VERSION = 'v0.1';
  Plaza.VERSION = VERSION;

  function params() {
    var q = {};
    try {
      var s = location.search.replace(/^\?/, '').split('&');
      for (var i = 0; i < s.length; i++) {
        var p = s[i].split('=');
        if (p[0]) q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
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
    var seite = 0; // 0 = host
    var kampf = null;
    var letzterSnap = null;
    var netz = null;
    var lokalInput = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
    var peerInput = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
    var mode = 'menue'; // menue | warte | wahl | kampf
    var hostWahl = null, gastWahl = null;

    function skalieren() {
      var ww = window.innerWidth, wh = window.innerHeight;
      var s = Math.max(1, Math.floor(Math.min(ww / Plaza.Render.W, wh / Plaza.Render.H)));
      // feiner skalieren für Handys
      var sf = Math.min(ww / Plaza.Render.W, (wh * 0.62) / Plaza.Render.H);
      rahmen.style.width = Math.floor(Plaza.Render.W * sf) + 'px';
      rahmen.style.height = Math.floor(Plaza.Render.H * sf) + 'px';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      document.documentElement.style.setProperty('--s', String(sf));
    }

    var ui = Plaza.UI.erstelle({
      root: document.body,
      getLink: function () { return netz ? netz.linkFuer() : ''; },
      onHost: function () {
        seite = 0;
        netz.hostStarten();
        ui.showScreen('warte');
        ui.setStatus('Raum wird erstellt…');
      },
      onJoin: function (raum) {
        if (!raum) {
          ui.setStatus('Bitte Raum-Code eingeben');
          return;
        }
        seite = 1;
        netz.beitreten(raum);
        ui.showScreen('warte');
        ui.setStatus('Verbinde mit ' + raum + '…');
      },
      onWahl: function (id) {
        meinChar = id;
        if (netz && netz.istBereit()) {
          netz.sende({ typ: 'wahl', charId: id, seite: seite });
        }
        if (netz && netz.istHost()) {
          hostWahl = id;
          versucheStart();
        } else {
          gastWahl = id;
          ui.setStatus('Warte auf den Host…');
        }
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
        if (t === 'warte') {
          var link = netz.linkFuer();
          ui.showLink(link, netz.getRaum());
          ui.setStatus('Raum ' + netz.getRaum() + ' — Link teilen!');
          // URL aktualisieren
          try {
            history.replaceState(null, '', '?raum=' + encodeURIComponent(netz.getRaum()) + '&v=0.1');
          } catch (e) {}
        } else if (t === 'verbunden') {
          ui.setStatus('Verbunden! Charakter wählen');
          ui.fillChars(meinChar);
          ui.showScreen('wahl');
          mode = 'wahl';
          if (netz.istHost()) {
            hostWahl = meinChar;
            netz.sende({ typ: 'join', seite: 1 });
          } else {
            gastWahl = meinChar;
            netz.sende({ typ: 'join', seite: 1, charId: meinChar });
            netz.sende({ typ: 'wahl', charId: meinChar, seite: 1 });
          }
        } else if (t === 'fehler') {
          var err = (extra && extra.err) || '';
          var hinweis = 'Verbindung fehlgeschlagen (' + err + '). ';
          if (err === 'peer-unavailable' || err === 'network' || err === 'server-error') {
            hinweis += 'Strenges NAT oder Broker blockiert? Beide im gleichen WLAN versuchen oder später erneut.';
          }
          ui.setStatus(hinweis);
          ui.showScreen('menue');
        } else if (t === 'kein-peerjs') {
          ui.setStatus('PeerJS konnte nicht geladen werden. Bitte neu laden.');
        } else if (t === 'getrennt') {
          ui.setStatus('Gegenüber getrennt.');
          if (mode === 'kampf') {
            mode = 'menue';
            ui.showScreen('menue');
          }
        } else if (t === 'verbinde' || t === 'suche') {
          ui.setStatus(t === 'suche' ? 'Suche Host…' : 'Verbinde…');
        }
      },
      onMsg: function (msg) {
        if (!msg || !msg.typ) return;
        if (msg.typ === 'join' && netz.istHost()) {
          ui.setStatus('Gast da — Charakter wählen');
        }
        if (msg.typ === 'wahl') {
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
        if (msg.typ === 'wahl' && netz.istHost() && msg.seite === 0) {
          /* ignore self */
        }
      },
      onClose: function () {
        ui.setStatus('Verbindung zu.');
      }
    });

    // Auto-Join aus URL
    var q = params();
    if (q.raum) {
      seite = 1;
      ui.showScreen('warte');
      // PeerJS braucht ggf. einen Tick
      setTimeout(function () { netz.beitreten(q.raum); }, 80);
    } else {
      ui.showScreen('menue');
      Plaza.Render.menueHint(render, 'Raum erstellen oder beitreten');
    }

    // Rematch-Tap auf Canvas
    canvas.addEventListener('pointerdown', function () {
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
        Plaza.Render.menueHint(render, 'Versus · 2 Handys · PeerJS');
        acc = 0;
      } else {
        Plaza.Render.menueHint(render, ui && statusElText());
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

    // Host sendet eigene Wahl beim Öffnen der Wahl-Seite
    var _fill = ui.fillChars;
    ui.fillChars = function (id) {
      _fill(id);
      if (netz && netz.istHost()) {
        hostWahl = id || meinChar;
        netz.sende({ typ: 'wahl', charId: hostWahl, seite: 0 });
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else start();
})(typeof window !== 'undefined' ? window : globalThis);
