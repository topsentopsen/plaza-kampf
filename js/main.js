/* Einstieg, Spielschleife, Host/Client-Logik. v2.5 — Solo/Testmodus. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};
  var VERSION = 'v2.5';
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
    var meinName = '';
    var hostName = '';
    var gastName = '';
    var soloMode = false;
    var netDown = false;
    try {
      meinName = (localStorage.getItem('plazaName') || '').trim().slice(0, 14);
    } catch (e0) {}


    var _skKey = '';
    function istLandscape() {
      return window.innerWidth > window.innerHeight;
    }
    function istFullscreen() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }
    function updateFsButton(ok) {
      var b = document.querySelector('[data-act="fs"]');
      if (!b) return;
      if (ok === true || (ok !== false && istFullscreen())) {
        b.textContent = '⛶';
        b.setAttribute('aria-label', 'Vollbild beenden');
        b.classList.add('aktiv');
      } else {
        b.textContent = '⛶';
        b.setAttribute('aria-label', 'Vollbild');
        b.classList.remove('aktiv');
      }
      // Immer sichtbar; im Landscape/Kampf hervorheben
      b.classList.toggle('hint-pulse', istLandscape() && !istFullscreen());
    }
    function istIOS() {
      var ua = navigator.userAgent || '';
      return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }
    function kannFullscreen() {
      var doc = document.documentElement;
      return !!(doc.requestFullscreen || doc.webkitRequestFullscreen || doc.webkitRequestFullScreen);
    }
    function scrollLock(on) {
      try {
        if (on) document.documentElement.classList.add('scroll-lock');
        else document.documentElement.classList.remove('scroll-lock');
      } catch (e0) {}
      try { window.scrollTo(0, 0); } catch (e1) {}
    }
    function hideSafariChrome() {
      // Klassiker + visualViewport: Leiste nach Drehen klein halten soweit möglich
      try { window.scrollTo(0, 0); } catch (e0) {}
      try { window.scrollTo(0, 1); } catch (e1) {}
      setTimeout(function () { try { window.scrollTo(0, 0); } catch (e2) {} }, 50);
      setTimeout(function () { try { window.scrollTo(0, 0); } catch (e3) {} }, 300);
    }
    function showIosHintIfNeeded() {
      if (!istIOS() || kannFullscreen()) return;
      try { if (localStorage.getItem('plaza.iosHint') === '1') return; } catch (e0) {}
      var h = document.getElementById('ios-hint');
      if (h) h.classList.add('show');
    }
    function requestFs() {
      var doc = document.documentElement;
      scrollLock(true);
      hideSafariChrome();
      if (istFullscreen()) {
        var exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) try { exit.call(document); } catch (e0) {}
        updateFsButton(false);
        return;
      }
      var req = doc.requestFullscreen || doc.webkitRequestFullscreen || doc.webkitRequestFullScreen;
      if (req) {
        try {
          var p = req.call(doc);
          if (p && p.catch) p.catch(function () {
            ui.setStatus('Vollbild blockiert — quer drehen, dann ⛶ erneut tippen. iPhone: Home-Bildschirm hilft.');
            showIosHintIfNeeded();
          });
        } catch (e1) {
          ui.setStatus('Vollbild nicht verfügbar — ⛶ nach Drehen tippen / Home-Bildschirm.');
          showIosHintIfNeeded();
        }
      } else {
        ui.setStatus('iPhone Safari: nach Drehen ⛶ tippen + Adressleiste wegwischen. Oder: Zum Home-Bildschirm.');
        showIosHintIfNeeded();
        hideSafariChrome();
      }
      setTimeout(function () { updateFsButton(); _skKey = ''; skalieren(); }, 200);
    }
    function tryFullscreen() {
      var land = istLandscape();
      document.body.classList.toggle('landscape', land);
      document.body.classList.toggle('landscape-kampf', land && mode === 'kampf');
      scrollLock(land || mode === 'kampf');
      if (land) hideSafariChrome();
      updateFsButton();
      // Nach Orientierungswechsel FS-Button pulsen; API nur nach Geste
      if (land && mode === 'kampf' && !istFullscreen()) {
        updateFsButton(false);
      }
    }
    function skalieren() {
      var vv = window.visualViewport;
      var ww = (vv && vv.width) || window.innerWidth;
      var wh = (vv && vv.height) || window.innerHeight;
      var W = Plaza.Render.W, H = Plaza.Render.H;
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
      var land = istLandscape();
      var safeB = 0;
      try {
        var cs = getComputedStyle(document.documentElement);
        // approx controls height in landscape vs portrait
      } catch (e1) {}
      var ctrlH = land ? Math.max(64, Math.min(90, wh * 0.18)) : Math.max(70, Math.min(110, wh * 0.22));
      var statusH = (mode === 'kampf' && land) ? 0 : 28;
      var maxW = ww - (land ? 4 : 12);
      var maxH = wh - ctrlH - statusH - (land ? 4 : 16);
      if (maxH < 80) maxH = wh * 0.55;
      var sfInt = Math.max(1, Math.floor(Math.min(maxW / W, maxH / H)));
      var cssW = W * sfInt, cssH = H * sfInt;
      var soft = Math.min(maxW / W, maxH / H);
      if (land || soft > sfInt) {
        // Landscape: fill as much as possible (soft scale OK; buffer stays crisp)
        cssW = Math.floor(W * soft);
        cssH = Math.floor(H * soft);
      } else if (sfInt <= 1) {
        soft = Math.min(maxW / W, maxH / H, 2.5);
        cssW = Math.floor(W * soft);
        cssH = Math.floor(H * soft);
      } else if (maxW > cssW + W * 0.45 && sfInt < 3) {
        cssW = Math.floor(W * (sfInt + 0.5));
        cssH = Math.floor(H * (sfInt + 0.5));
      }
      var buf = dpr >= 2.5 ? 3 : 2;
      var key = cssW + 'x' + cssH + '@' + buf + (land ? 'L' : 'P') + mode;
      if (key === _skKey) return;
      _skKey = key;
      rahmen.style.width = cssW + 'px';
      rahmen.style.height = cssH + 'px';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      if (Plaza.Render.setzePuffer) Plaza.Render.setzePuffer(render, buf);
      document.documentElement.style.setProperty('--s', String(cssW / W));
      var pad = Math.max(land ? 48 : 56, Math.min(land ? 68 : 76, Math.round(44 + (cssW / W) * 9)));
      document.documentElement.style.setProperty('--pad', pad + 'px');
      var hudFs = Math.max(12, Math.min(16, Math.round(11 + (cssW / W) * 1.4)));
      document.documentElement.style.setProperty('--ui', hudFs + 'px');
      document.documentElement.style.setProperty('--ctrl-h', ctrlH + 'px');
    }


    function nameFields() {
      return [
        document.getElementById('name-input-warte'),
        document.getElementById('name-input-wahl'),
        document.getElementById('name-input')
      ].filter(Boolean);
    }
    function liesName() {
      var fields = nameFields();
      var n = '';
      var active = document.activeElement;
      if (active && fields.indexOf(active) >= 0 && (active.value || '').trim()) {
        n = (active.value || '').trim();
      } else {
        for (var i = 0; i < fields.length; i++) {
          if ((fields[i].value || '').trim()) { n = fields[i].value.trim(); break; }
        }
      }
      if (!n) n = meinName || '';
      n = n.replace(/[<>]/g, '').slice(0, 14);
      meinName = n;
      try { if (n) localStorage.setItem('plazaName', n); } catch (e2) {}
      fields.forEach(function (f) { if (n && !(f.value || '').trim()) f.value = n; });
      return n;
    }
    function syncNameFields(n) {
      n = (n || meinName || '').slice(0, 14);
      nameFields().forEach(function (f) { if (f) f.value = n; });
    }

    function setUrl(raum, isHost) {
      try {
        var q = '?raum=' + encodeURIComponent(raum || '') + '&v=1.0';
        if (isHost) q += '&host=1';
        history.replaceState(null, '', q);
      } catch (e) {}
    }

    var ui = Plaza.UI.erstelle({
      root: document.body,
      getLink: function () { return netz ? netz.linkFuer(null, false) : ''; },
      onSolo: function () {
        soloMode = true;
        netDown = false;
        seite = 0;
        hostName = liesName();
        meinName = hostName;
        gastName = 'CPU';
        hostWahl = null;
        gastWahl = null;
        kampf = null;
        letzterSnap = null;
        meinChar = null;
        ui.fillChars(null);
        ui.showScreen('wahl');
        if (ui.setSeiteHint) ui.setSeiteHint(0);
        mode = 'wahl';
        ui.setStatus('Testmodus: Charakter wählen — du kämpfst gegen die CPU.');
        try { if (Plaza.Sound) Plaza.Sound.init(); } catch (eS) {}
      },
      onMenue: function () {
        soloMode = false;
        kampf = null;
        letzterSnap = null;
        hostWahl = null;
        gastWahl = null;
        meinChar = null;
        mode = 'menue';
        ui.showScreen('menue');
        ui.setStatus('');
        Plaza.Render.menueHint(render, 'Versus · Solo · v2.5');
      },
      onHost: function () {
        soloMode = false;
        seite = 0;
        hostName = liesName();
        meinName = hostName;
        netz.hostStarten();
        ui.showScreen('warte');
        ui.setStatus('Broker wird verbunden…');
        ui.showRetry(false);
      },
      onJoin: function (raum) {
        soloMode = false;
        var code = (raum || pendingRaum || '').trim();
        if (!code) {
          ui.setStatus('Bitte Raum-Code eingeben');
          return;
        }
        seite = 1;
        gastName = liesName();
        meinName = gastName;
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
      onFullscreen: function () {
        requestFs();
      },
      onSwap: function () {
        if (soloMode) {
          ui.setStatus('Im Testmodus bist du immer P1 (links).');
          return;
        }
        // Nur vor Kampf: eigene Seite umkehren (Host bleibt sim-autoritativ auf Index 0/1 via seite)
        if (mode === 'kampf' || mode === 'ende') {
          ui.setStatus('Seiten nur vor dem Kampf tauschen.');
          return;
        }
        seite = seite === 0 ? 1 : 0;
        if (ui.setSeiteHint) ui.setSeiteHint(seite);
        ui.setStatus(seite === 0 ? 'Du startest links (P1).' : 'Du startest rechts (P2).');
        if (netz && netz.istBereit()) {
          netz.sende({ typ: 'swap', seite: seite, ver: VERSION });
        }
      },
      onWahl: function (id) {
        meinChar = id;
        var nm = liesName();
        if (soloMode) {
          hostWahl = id;
          hostName = nm || hostName || 'Spieler';
          gastWahl = Plaza.KI ? Plaza.KI.zufallsGegner(id) : 'toni';
          gastName = 'CPU';
          ui.setStatus('Gewählt: ' + Plaza.Chars.finde(id).name + ' vs CPU (' + Plaza.Chars.finde(gastWahl).name + ')');
          startSolo();
          return;
        }
        if (netz && netz.istHost()) { hostWahl = id; hostName = nm || hostName; }
        else { gastWahl = id; gastName = nm || gastName; }
        if (netz && netz.istBereit()) {
          netz.sende({ typ: 'wahl', charId: id, seite: seite, ver: VERSION, name: nm });
        }
        ui.setStatus('Gewählt: ' + Plaza.Chars.finde(id).name + ' — warte auf den anderen…');
        if (netz && netz.istHost()) versucheStart();
      },
      onRematch: function () {
        if (soloMode && kampf) {
          kampf = Plaza.Kampf.rematch(kampf);
          kampf.phase = 'countdown';
          kampf.countdown = 3;
          kampf.tick = 0;
          mode = 'kampf';
          ui.showScreen('kampf');
          if (Plaza.Sound) Plaza.Sound.resetDiff();
          if (Plaza.Render.resetFx) Plaza.Render.resetFx();
          return;
        }
        if (netz && netz.istHost() && kampf) {
          kampf = Plaza.Kampf.rematch(kampf);
          kampf.phase = 'countdown';
          kampf.countdown = 3;
          kampf.tick = 0;
          mode = 'kampf';
          ui.showScreen('kampf');
          broadcast();
        } else if (netz) {
          netz.sende({ typ: 'rematch', ver: VERSION });
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
      var n0 = hostName || Plaza.Chars.finde(hostWahl).name;
      var n1 = gastName || Plaza.Chars.finde(gastWahl).name;
      var c0 = hostWahl, c1 = gastWahl, nm0 = n0, nm1 = n1;
      // Host seite===1 → Host rechts: Chars tauschen, Host spielt Index 1
      if (netz.istHost() && seite === 1) {
        c0 = gastWahl; c1 = hostWahl; nm0 = n1; nm1 = n0;
      }
      kampf = Plaza.Kampf.neu(c0, c1, nm0, nm1);
      kampf.phase = 'countdown';
      kampf.countdown = 3;
      mode = 'kampf';
      ui.showScreen('kampf');
      _skKey = '';
      tryFullscreen();
      skalieren();
      if (Plaza.Sound) Plaza.Sound.resetDiff();
      if (Plaza.Render.resetFx) Plaza.Render.resetFx();
      broadcast();
    }

    function startSolo() {
      if (!soloMode || !hostWahl || !gastWahl) return;
      var n0 = hostName || Plaza.Chars.finde(hostWahl).name;
      var n1 = gastName || 'CPU';
      kampf = Plaza.Kampf.neu(hostWahl, gastWahl, n0, n1);
      kampf.phase = 'countdown';
      kampf.countdown = 3;
      seite = 0;
      mode = 'kampf';
      ui.showScreen('kampf');
      _skKey = '';
      tryFullscreen();
      skalieren();
      if (Plaza.Sound) Plaza.Sound.resetDiff();
      if (Plaza.Render.resetFx) Plaza.Render.resetFx();
      letzterSnap = Plaza.Kampf.snapshot(kampf);
      ui.setStatus('Testmodus vs CPU — Moves ausprobieren!');
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
          netDown = false; ui.setStatus('Verbunden' + (via || netz.getTransport() ? ' über ' + (via || netz.getTransport()) : '') + '! Name prüfen, dann Charakter tippen');
          hostWahl = null;
          gastWahl = null;
          var nm = liesName();
          if (netz.istHost()) hostName = nm || hostName;
          else gastName = nm || gastName;
          syncNameFields(nm);
          ui.fillChars(null);
          ui.showScreen('wahl');
          if (ui.setSeiteHint) ui.setSeiteHint(seite);
          mode = 'wahl';
          ui.showRetry(false);
          netz.sende({ typ: 'join', seite: seite, name: nm });
          netz.sende({ typ: 'name', seite: seite, name: nm });
          setTimeout(function () {
            var nw = document.getElementById('name-input-wahl');
            if (nw && !nw.value) nw.value = nm || '';
            if (nw && !(nm || '').trim()) try { nw.focus(); } catch (ef2) {}
          }, 60);
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
        if (msg.typ === 'hello' || msg.typ === 'join' || msg.typ === 'name') {
          if (msg.name) {
            if (msg.seite === 0) hostName = String(msg.name).slice(0, 14);
            if (msg.seite === 1) gastName = String(msg.name).slice(0, 14);
          }
          if (netz.istHost() && (msg.typ === 'hello' || msg.typ === 'join')) {
            netDown = false; ui.setStatus('Mitspieler da — Charakter wählen');
            if (netz.istHost()) netz.sende({ typ: 'seat', seite: seite, ver: VERSION });
            // eigenen Namen nochmal schicken
            netz.sende({ typ: 'name', seite: 0, name: hostName || liesName() });
          }
        }
        if (msg.typ === 'wahl') {
          if (msg.ver && msg.ver !== VERSION) {
            ui.setStatus('Andere Version (' + msg.ver + ') — bitte beide hart neu laden (?v=' + (Plaza.Netz && Plaza.Netz.VERSION_Q ? Plaza.Netz.VERSION_Q : '2.0') + ')');
          }
          if (msg.name) {
            if (msg.seite === 0) hostName = String(msg.name).slice(0, 14);
            if (msg.seite === 1) gastName = String(msg.name).slice(0, 14);
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
            _skKey = '';
            tryFullscreen();
            skalieren();
          }
          // Ende immer zeichnen (auch wenn vorher kein Frame kam)
          if (letzterSnap && letzterSnap.phase === 'ende') {
            mode = 'kampf';
            ui.showScreen('kampf');
          }
        }
        if ((msg.typ === 'swap' || msg.typ === 'seat') && mode !== 'kampf' && mode !== 'ende') {
          if (typeof msg.seite === 'number') {
            seite = msg.seite === 0 ? 1 : 0;
            if (ui.setSeiteHint) ui.setSeiteHint(seite);
            if (msg.typ === 'swap') {
              ui.setStatus('Gegner hat Seite getauscht — du bist jetzt P' + (seite + 1) + '.');
            } else if (ui.setSeiteHint) {
              /* quiet seat sync from host */
            }
          }
        }
        if (msg.typ === 'rematch' && netz.istHost() && kampf) {
          // v2.5: nur aus Endphase, Version prüfen, Doppel-Rematch ignorieren
          if (kampf.phase !== 'ende' && mode !== 'ende') {
            /* ignore mid-fight rematch spam */
          } else if (msg.ver && msg.ver !== VERSION) {
            ui.setStatus('Rematch abgelehnt — andere Version (' + msg.ver + ')');
          } else {
            mode = 'kampf';
            ui.showScreen('kampf');
            kampf = Plaza.Kampf.rematch(kampf);
            kampf.phase = 'countdown';
            kampf.countdown = 3;
            kampf.tick = 0;
            broadcast();
          }
        }
      },
      onClose: function () {
        netDown = true;
        ui.setStatus('Verbindung weg — Tab offen lassen, „Nochmal“ tippen.');
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
      ui.setStatus('Raum ' + q.raum + ' — zuerst Namen tippen, dann „Jetzt beitreten“.');
      ui.showJoinConfirm(true, q.raum);
      syncNameFields(meinName);
      setTimeout(function () {
        var nw = document.getElementById('name-input-warte');
        if (nw) try { nw.focus(); } catch (ef) {}
      }, 80);
    } else {
      ui.showScreen('menue');
      Plaza.Render.menueHint(render, 'Raum erstellen oder beitreten');
    }

    document.addEventListener('pointerdown', function () {
      if (Plaza.Sound) { Plaza.Sound.resume(); Plaza.Sound.init(); }
      hideSafariChrome();
    }, { passive: true });

    canvas.addEventListener('pointerdown', function () {
      if (Plaza.Sound) Plaza.Sound.resume();
      if (letzterSnap && letzterSnap.phase === 'ende') {
        if (soloMode && kampf) {
          kampf = Plaza.Kampf.rematch(kampf);
          kampf.phase = 'countdown';
          kampf.countdown = 3;
          kampf.tick = 0;
          mode = 'kampf';
          ui.showScreen('kampf');
        } else if (netz && netz.istHost() && kampf) {
          kampf = Plaza.Kampf.rematch(kampf);
          kampf.phase = 'countdown';
          kampf.countdown = 3;
          kampf.tick = 0;
          broadcast();
        } else if (netz) netz.sende({ typ: 'rematch', ver: VERSION });
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

      if (soloMode && (mode === 'kampf' || mode === 'ende') && kampf) {
        while (acc >= STEP) {
          acc -= STEP;
          var cpu = kampf.p[1];
          var stunBefore = cpu ? cpu.stun : 0;
          var cpuInp = Plaza.KI
            ? Plaza.KI.denk(kampf, 1, { aggressiv: 0.5, dummy: false })
            : { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
          Plaza.Kampf.setInput(kampf, 0, lokalInput);
          Plaza.Kampf.setInput(kampf, 1, cpuInp);
          Plaza.Kampf.tick(kampf);
          if (Plaza.KI && Plaza.KI.markWake && cpu && stunBefore > 0 && cpu.stun <= 0) {
            Plaza.KI.markWake(cpu);
          }
        }
        letzterSnap = Plaza.Kampf.snapshot(kampf);
        Plaza.Render.zeichne(render, letzterSnap, 0);
        if (letzterSnap.phase === 'ende') {
          if (mode !== 'ende') {
            mode = 'ende';
            var wonS = letzterSnap.sieger === 0;
            if (ui.setEnde) ui.setEnde(wonS ? 'GEWONNEN!' : (letzterSnap.sieger != null ? 'VERLOREN!' : 'Ende'),
              (letzterSnap.nachricht || '') + ' (Testmodus)');
            ui.showScreen('ende');
          }
        } else if (mode === 'ende') {
          mode = 'kampf';
          ui.showScreen('kampf');
        }
      } else if (mode === 'kampf' && netz && netz.istHost() && kampf) {
        var phaseVorher = kampf.phase;
        while (acc >= STEP) {
          acc -= STEP;
          if (seite === 1) {
            Plaza.Kampf.setInput(kampf, 1, lokalInput);
            Plaza.Kampf.setInput(kampf, 0, peerInput);
          } else {
            Plaza.Kampf.setInput(kampf, 0, lokalInput);
            Plaza.Kampf.setInput(kampf, 1, peerInput);
          }
          Plaza.Kampf.tick(kampf);
          // Ende: tick friert ein → sofort + regelmäßig broadcasten (Bugfix: Client sah kein Ende)
          if (kampf.phase === 'ende') {
            if (phaseVorher !== 'ende' || (kampf.endeTimer % 12) === 0) broadcast();
            phaseVorher = 'ende';
          } else if (kampf.tick % 2 === 0) {
            broadcast();
          }
        }
        letzterSnap = Plaza.Kampf.snapshot(kampf);
        Plaza.Render.zeichne(render, letzterSnap, 0);
        if (netDown && Plaza.Render.banner) Plaza.Render.banner(render, 'VERBINDUNG WEG — Nochmal');
        if (letzterSnap.phase === 'ende') {
          if (mode !== 'ende') {
            mode = 'ende';
            var wonH = letzterSnap.sieger === 0;
            if (ui.setEnde) ui.setEnde(wonH ? 'GEWONNEN!' : 'VERLOREN!', letzterSnap.nachricht || '');
            ui.showScreen('ende');
          }
        } else if (mode === 'ende') {
          mode = 'kampf';
          ui.showScreen('kampf');
        }
      } else if ((mode === 'kampf' || mode === 'ende') && letzterSnap) {
        Plaza.Render.zeichne(render, letzterSnap, seite);
        if (netDown && Plaza.Render.banner) Plaza.Render.banner(render, 'VERBINDUNG WEG — Nochmal');
        if (letzterSnap.phase === 'ende') {
          if (mode !== 'ende') {
            mode = 'ende';
            var wonC = letzterSnap.sieger === seite;
            if (ui.setEnde) ui.setEnde(wonC ? 'GEWONNEN!' : (letzterSnap.sieger != null ? 'VERLOREN!' : 'Ende'), letzterSnap.nachricht || '');
            ui.showScreen('ende');
          }
        } else if (mode === 'ende' && letzterSnap.phase !== 'ende') {
          mode = 'kampf';
          ui.showScreen('kampf');
        }
        acc = 0;
      } else if (mode === 'menue') {
        Plaza.Render.menueHint(render, 'Versus · Solo · v2.5');
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

    window.addEventListener('resize', function () { _skKey = ''; tryFullscreen(); skalieren(); });
    window.addEventListener('orientationchange', function () {
      hideSafariChrome();
      setTimeout(function () {
        _skKey = ''; tryFullscreen(); skalieren(); hideSafariChrome();
        if (istIOS() && istLandscape()) {
          ui.setStatus('Nach Drehen: ⛶ tippen (Browserleiste weg).');
          updateFsButton(false);
        }
      }, 120);
      setTimeout(function () { hideSafariChrome(); _skKey = ''; skalieren(); }, 450);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () {
        _skKey = ''; skalieren();
        if (istLandscape()) hideSafariChrome();
      });
    }
    // Fullscreen oft nur nach Geste — bei erstem Tap im Kampf nachholen
    document.addEventListener('pointerdown', function () {
      if (mode === 'kampf' && istLandscape()) tryFullscreen();
    }, { passive: true });
    // Prefill name input
    syncNameFields(meinName);
    document.addEventListener('fullscreenchange', function () { updateFsButton(); _skKey = ''; skalieren(); });
    document.addEventListener('webkitfullscreenchange', function () { updateFsButton(); _skKey = ''; skalieren(); });
    skalieren();
    if ('serviceWorker' in navigator) {
      try { navigator.serviceWorker.register('sw.js?v=2.5'); } catch (eSw) {}
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else start();
})(typeof window !== 'undefined' ? window : globalThis);
