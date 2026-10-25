/* Einstieg, Spielschleife, Host/Client-Logik. v4.2 — Tick-Playback, Praxis-KI, Motion-Specials. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};
  var VERSION = 'v4.2';
  Plaza.VERSION = VERSION;
  function sanitizeName(n) {
    n = String(n == null ? '' : n).replace(/[\u0000-\u001f<>]/g, '').trim();
    if (n.length > 16) n = n.slice(0, 16);
    return n || 'Spieler';
  }

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

  function applyLevel(id) {
    if (Plaza.Render && Plaza.Render.setLevel) {
      return Plaza.Render.setLevel(id || 'hoelle');
    }
    return id || 'hoelle';
  }
  function currentLevel() {
    return (Plaza.Render && Plaza.Render.getLevel) ? Plaza.Render.getLevel() : 'hoelle';
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
    var snapInterp = (Plaza.Interp && Plaza.Interp.erstelle)
      ? Plaza.Interp.erstelle({ delayMs: 90 })
      : null;
    var smoothX = null, smoothY = null;
    var kampfNr = 0;
    var siegMark = '';
    var inputSeq = 0;
    var lastPeerSeq = 0;
    var debugOn = false;
    try {
      var pq = params();
      debugOn = pq.debug === '1';
      if (!debugOn && typeof localStorage !== 'undefined' && localStorage.getItem('plazaDebug') === '1') debugOn = true;
    } catch (eDbg) {}
    function resetInterp() {
      if (snapInterp) snapInterp.reset();
      smoothX = null;
      smoothY = null;
    }
    function pushInterp(snap) {
      if (snapInterp && snap) snapInterp.push(snap);
    }
    function drawSnap(nowMs) {
      if (snapInterp && netz && !netz.istHost() && !soloMode) {
        var sInterp = snapInterp.sample(nowMs);
        if (sInterp) return sInterp;
      }
      return letzterSnap;
    }
    function cloneViewAt(view, idx) {
      var p = [], i, src, o, k;
      for (i = 0; i < view.p.length; i++) {
        if (i !== idx) { p.push(view.p[i]); continue; }
        src = view.p[i]; o = {};
        for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) o[k] = src[k];
        p.push(o);
      }
      return {
        phase: view.phase, countdown: view.countdown, zeit: view.zeit,
        sieger: view.sieger, endeTimer: view.endeTimer, nachricht: view.nachricht,
        tick: view.tick, projektil: view.projektil, p: p
      };
    }
    function applyLocalPredict(view) {
      if (!view || !view.p || !view.p[seite] || !snapInterp || !Plaza.Interp || !netz || netz.istHost() || soloMode) return view;
      var lead = snapInterp.latest();
      var leadMe = lead && lead.p && lead.p[seite];
      if (!leadMe || lead.phase === 'countdown' || lead.phase === 'ende') {
        smoothX = null; smoothY = null;
        return view;
      }
      var goalX = leadMe.x;
      var dir = (lokalInput.r ? 1 : 0) - (lokalInput.l ? 1 : 0);
      var canMove = !leadMe.stun && !leadMe.atk && !leadMe.blk && leadMe.grounded;
      if (canMove && dir && Plaza.Chars && Plaza.Chars.finde) {
        var ch = Plaza.Chars.finde(leadMe.charId);
        var speed = (ch && ch.speed) || 6;
        if (lokalInput.d || leadMe.crouch) speed *= 0.35;
        goalX = leadMe.x + dir * speed * 2;
      }
      if (smoothX == null) smoothX = view.p[seite].x;
      if (smoothY == null) smoothY = view.p[seite].y;
      smoothX = Plaza.Interp.schritt(smoothX, goalX, 40);
      smoothY = Plaza.Interp.schritt(smoothY, leadMe.y, 40);
      var copy = cloneViewAt(view, seite);
      copy.p[seite].x = smoothX;
      copy.p[seite].y = smoothY;
      if (canMove && dir) copy.p[seite].facing = dir > 0 ? 1 : -1;
      return copy;
    }
    function noteSieg(snap) {
      if (!snap || snap.phase !== 'ende' || snap.sieger == null || snap.sieger !== seite) return '';
      var mark = String(kampfNr) + ':' + snap.sieger;
      if (siegMark === mark) return Plaza.Muenzen ? (' · ' + Plaza.Muenzen.lesen() + ' Münzen') : '';
      siegMark = mark;
      if (!Plaza.Muenzen) return '';
      var total = Plaza.Muenzen.gutschreiben(Plaza.Muenzen.PRO_SIEG);
      if (ui && ui.zeigeMuenzen) ui.zeigeMuenzen();
      return ' · +' + Plaza.Muenzen.PRO_SIEG + ' Münzen (gesamt ' + total + ')';
    }
    function drawNetDebug() {
      if (!debugOn) return;
      var el = document.getElementById('net-debug');
      if (!el) {
        el = document.createElement('div');
        el.id = 'net-debug';
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:80;font:11px ui-monospace,monospace;color:#c0ffc0;background:rgba(0,0,0,.55);padding:2px 4px;pointer-events:none';
        document.body.appendChild(el);
      }
      var st = (snapInterp && snapInterp.stats) ? snapInterp.stats() : null;
      var via = (netz && netz.getTransport) ? netz.getTransport() : '-';
      el.textContent = st
        ? ('via ' + via + '  recv ' + st.recvHz + '/s  puffer ' + (Math.round(st.depth * 10) / 10) + '  delay ' + st.delayMs + 'ms  hitch ' + st.underruns)
        : ('via ' + via);
    }
    var netz = null;
    var lokalInput = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
    var peerInput = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
    function clearPeerInput() {
      peerInput = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
    }
    var mode = 'menue';
    var paused = false;
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
    function istPwaStandalone() {
      try {
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
        if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches) return true;
      } catch (e0) {}
      try { if (navigator.standalone === true) return true; } catch (e1) {}
      return false;
    }
    function markIosMode() {
      var pwa = istPwaStandalone();
      document.body.classList.toggle('pwa-standalone', pwa);
      document.body.classList.toggle('ios-safari-tab', istIOS() && !pwa);
      return pwa;
    }
    function hideSafariChrome() {
      // iOS Safari-Tab: Adressleiste lässt sich nicht dauerhaft entfernen — nur einklappen.
      // PWA/Home-Screen: nichts nötig.
      if (istPwaStandalone()) return;
      var wasLock = document.documentElement.classList.contains('scroll-lock');
      try {
        document.documentElement.classList.add('ios-chrome-dismiss');
        if (wasLock) document.documentElement.classList.remove('scroll-lock');
      } catch (eA) {}
      try { window.scrollTo(0, 0); } catch (e0) {}
      try { window.scrollTo(0, 1); } catch (e1) {}
      try {
        if (window.visualViewport && window.visualViewport.offsetTop > 0) {
          window.scrollTo(0, window.visualViewport.offsetTop + 1);
        }
      } catch (eVv) {}
      setTimeout(function () {
        try { window.scrollTo(0, 0); } catch (e2) {}
      }, 50);
      setTimeout(function () {
        try { window.scrollTo(0, 0); } catch (e3) {}
        try {
          document.documentElement.classList.remove('ios-chrome-dismiss');
          if (wasLock) document.documentElement.classList.add('scroll-lock');
        } catch (eB) {}
      }, 320);
    }
    function showIosHintIfNeeded() {
      if (!istIOS() || istPwaStandalone()) return;
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
      markIosMode();
      var land = istLandscape();
      document.body.classList.toggle('landscape', land);
      document.body.classList.toggle('landscape-kampf', land && (mode === 'kampf' || mode === 'ende'));
      // PWA: immer locken; Safari-Tab: lock nach Chrome-Dismiss
      scrollLock(land || mode === 'kampf' || istPwaStandalone());
      if (land && !istPwaStandalone()) hideSafariChrome();
      updateFsButton();
      // Nach Orientierungswechsel FS-Button pulsen; API nur nach Geste
      if (land && mode === 'kampf' && !istFullscreen()) {
        updateFsButton(false);
      }
    }
    function skalieren() {
      var vv = window.visualViewport;
      // iOS Safari: visualViewport = sichtbare Fläche unter der Adressleiste
      var ww = (vv && vv.width) || window.innerWidth;
      var wh = (vv && vv.height) || window.innerHeight;
      if (vv && vv.height > 0) {
        wh = vv.height;
        ww = vv.width || ww;
      }
      var W = Plaza.Render.W, H = Plaza.Render.H;
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
      var land = istLandscape();
      var fight = (mode === 'kampf' || mode === 'ende');
      // v3.8: Landscape-Kampf — Controls als Overlay, Canvas nutzt volle Viewport-Fläche
      var overlayCtrl = land && fight;
      document.body.classList.toggle('landscape', land);
      document.body.classList.toggle('landscape-kampf', land && fight);
      document.body.classList.toggle('ctrl-overlay', overlayCtrl);
      var ctrlH = land
        ? Math.max(52, Math.min(72, Math.round(wh * 0.14)))
        : Math.max(70, Math.min(110, wh * 0.22));
      var statusH = (fight && land) ? 0 : 28;
      var maxW = ww - (land ? 2 : 12);
      var maxH;
      if (overlayCtrl) {
        maxH = wh - 2; // kein Pad-Streifen abziehen
      } else {
        maxH = wh - ctrlH - statusH - (land ? 4 : 16);
      }
      if (maxH < 80) maxH = wh * 0.55;
      var soft = Math.min(maxW / W, maxH / H);
      var cssW, cssH;
      if (overlayCtrl || land) {
        // Aspect 1280×768 letterbox nur wenn nötig — maximal einpassen
        cssW = Math.floor(W * soft);
        cssH = Math.floor(H * soft);
      } else {
        var sfInt = Math.max(1, Math.floor(soft));
        cssW = W * sfInt;
        cssH = H * sfInt;
        if (soft > sfInt) {
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
      }
      var buf = dpr >= 2.5 ? 3 : 2;
      var key = cssW + 'x' + cssH + '@' + buf + (land ? 'L' : 'P') + mode + (overlayCtrl ? 'O' : '');
      if (key === _skKey) return;
      _skKey = key;
      rahmen.style.width = cssW + 'px';
      rahmen.style.height = cssH + 'px';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      if (Plaza.Render.setzePuffer) Plaza.Render.setzePuffer(render, buf);
      document.documentElement.style.setProperty('--s', String(cssW / W));
      // Compact pads on iPhone landscape overlay
      var pad;
      if (overlayCtrl) {
        pad = Math.max(40, Math.min(52, Math.round(36 + (cssW / W) * 6)));
      } else if (land) {
        pad = Math.max(44, Math.min(60, Math.round(42 + (cssW / W) * 7)));
      } else {
        pad = Math.max(56, Math.min(76, Math.round(44 + (cssW / W) * 9)));
      }
      document.documentElement.style.setProperty('--pad', pad + 'px');
      var hudFs = Math.max(12, Math.min(16, Math.round(11 + (cssW / W) * 1.4)));
      document.documentElement.style.setProperty('--ui', hudFs + 'px');
      document.documentElement.style.setProperty('--ctrl-h', ctrlH + 'px');
      if (overlayCtrl) {
        try { window.scrollTo(0, 0); } catch (eSc) {}
      }
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
      n = sanitizeName(n);
      meinName = n;
      try { if (n) localStorage.setItem('plazaName', n); } catch (e2) {}
      fields.forEach(function (f) { if (n && !(f.value || '').trim()) f.value = n; });
      return n;
    }
    function syncNameFields(n) {
      n = sanitizeName(n || meinName || '');
      nameFields().forEach(function (f) { if (f) f.value = n; });
    }

    function setUrl(raum, isHost) {
      try {
        var q = '?raum=' + encodeURIComponent(raum || '') + '&v=' + (Plaza.Netz && Plaza.Netz.VERSION_Q ? Plaza.Netz.VERSION_Q : VERSION.replace(/^v/, ''));
        if (isHost) q += '&host=1';
        history.replaceState(null, '', q);
      } catch (e) {}
    }

    var ui = Plaza.UI.erstelle({
      root: document.body,
      getLink: function () { return netz ? netz.linkFuer(null, false) : ''; },
      onLevel: function (id) {
        applyLevel(id);
        if (netz && netz.istHost() && netz.istBereit() && mode !== 'kampf' && mode !== 'ende') {
          netz.sende({
            typ: 'level', level: id, ver: VERSION,
            wetter: (Plaza.Render && Plaza.Render.wetterState) ? Plaza.Render.wetterState() : null
          });
        }
      },
      onSolo: function () {
        soloMode = true;
        applyLevel(ui.getLevel ? ui.getLevel() : currentLevel());
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
        paused = false;
        resetInterp();
        soloMode = false;
        kampf = null;
        letzterSnap = null;
        hostWahl = null;
        gastWahl = null;
        meinChar = null;
        peerChar = null;
        clearPeerInput();
        if (netz) {
          try { netz.trennen(); } catch (eT) {}
        }
        mode = 'menue';
        ui.showScreen('menue');
        ui.setStatus('');
        if (ui.setPauseBtn) ui.setPauseBtn(false);
        Plaza.Render.menueHint(render, 'Versus · Solo · v4.2');
      },
      onPause: function () {
        if (mode !== 'kampf' && mode !== 'ende') return;
        paused = true;
        if (ui.resetInput) ui.resetInput();
        lokalInput = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
        ui.showScreen('pause');
        ui.setStatus('Pause');
      },
      onResume: function () {
        if (!paused && mode !== 'pause') {
          /* allow resume from pause screen even if flag lag */
        }
        paused = false;
        if (letzterSnap && letzterSnap.phase === 'ende') {
          mode = 'ende';
          ui.showScreen('ende');
        } else {
          mode = 'kampf';
          ui.showScreen('kampf');
        }
        ui.setStatus(soloMode ? 'Testmodus vs CPU' : '');
      },
      onAbort: function () {
        paused = false;
        resetInterp();
        // reuse onMenue disconnect path
        soloMode = false;
        kampf = null;
        letzterSnap = null;
        hostWahl = null;
        gastWahl = null;
        meinChar = null;
        peerChar = null;
        clearPeerInput();
        if (netz) {
          try { netz.trennen(); } catch (eT2) {}
        }
        mode = 'menue';
        ui.showScreen('menue');
        ui.setStatus('Kampf abgebrochen.');
        if (ui.setPauseBtn) ui.setPauseBtn(false);
        Plaza.Render.menueHint(render, 'Versus · Solo · v4.2');
      },
      onHost: function () {
        soloMode = false;
        applyLevel(ui.getLevel ? ui.getLevel() : currentLevel());
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
        // Slots = Sim-Index/Seite (nicht „Host-Rolle“): seite 0 → hostWahl, 1 → gastWahl
        if (seite === 0) { hostWahl = id; hostName = nm || hostName; }
        else { gastWahl = id; gastName = nm || gastName; }
        if (netz && netz.istBereit()) {
          netz.sende({ typ: 'wahl', charId: id, seite: seite, ver: VERSION, name: nm });
        }
        ui.setStatus('Gewählt: ' + Plaza.Chars.finde(id).name + ' — warte auf den anderen…');
        if (netz && netz.istHost()) versucheStart();
      },
      onRematch: function () {
        if (soloMode && kampf) {
          kampfNr++;
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
          kampfNr++;
          kampf = Plaza.Kampf.rematch(kampf);
          kampf.phase = 'countdown';
          kampf.countdown = 3;
          kampf.tick = 0;
          mode = 'kampf';
          ui.showScreen('kampf');
          clearPeerInput();
          if (Plaza.Sound) Plaza.Sound.resetDiff();
          if (Plaza.Render.resetFx) Plaza.Render.resetFx();
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
          inputSeq++;
          netz.sende({ typ: 'input', seite: seite, input: lokalInput, seq: inputSeq });
        }
      }
    });

    function versucheStart() {
      if (!(netz && netz.istHost())) return;
      if (!hostWahl || !gastWahl) return;
      var n0 = hostName || Plaza.Chars.finde(hostWahl).name;
      var n1 = gastName || Plaza.Chars.finde(gastWahl).name;
      // hostWahl/gastWahl sind bereits Sim-Slots 0/1; Input-Mapping läuft über seite
      var c0 = hostWahl, c1 = gastWahl, nm0 = n0, nm1 = n1;
      applyLevel(currentLevel());
      clearPeerInput();
      kampfNr++;
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
      applyLevel(ui.getLevel ? ui.getLevel() : currentLevel());
      kampfNr++;
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
      resetInterp();
      ui.setStatus('Testmodus vs CPU — Moves ausprobieren!');
    }

    function broadcast(force) {
      if (!(netz && netz.istHost() && kampf)) return;
      var snap = Plaza.Kampf.snapshot(kampf);
      letzterSnap = snap;
      var direkt = netz.hatDirekt && netz.hatDirekt();
      // MQTT-Fallback: jeder zweite Tick. Der Broker klumpt 60 Hz sonst zu Bursts.
      // Peer-DataChannel trägt jeden Tick. Level/Wetter nicht in jedes Paket.
      if (!force && !direkt && kampf.phase === 'kampf' && (kampf.tick % 2) !== 0) return;
      var msg = { typ: 'state', state: snap };
      if (force || kampf.phase !== 'kampf' || (kampf.tick % 30) === 0) {
        msg.level = currentLevel();
        if (Plaza.Render && Plaza.Render.wetterState) msg.wetter = Plaza.Render.wetterState();
      }
      netz.sende(msg);
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
            if (netz.istHost()) {
              netz.sende({ typ: 'seat', seite: seite, ver: VERSION });
              netz.sende({
                typ: 'level', level: currentLevel(), ver: VERSION,
                wetter: (Plaza.Render && Plaza.Render.wetterState) ? Plaza.Render.wetterState() : null
              });
            }
            // eigenen Namen nochmal schicken
            netz.sende({ typ: 'name', seite: 0, name: hostName || liesName() });
          }
        }
        if (msg.typ === 'level' && !netz.istHost()) {
          if (msg.level) {
            applyLevel(msg.level);
            if (ui.setLevel) ui.setLevel(msg.level);
          }
          if (msg.wetter && Plaza.Render && Plaza.Render.applyWetter) Plaza.Render.applyWetter(msg.wetter);
        }
        if (msg.typ === 'wahl') {
          if (msg.ver && msg.ver !== VERSION) {
            ui.setStatus('Andere Version (' + msg.ver + ') — bitte beide hart neu laden (?v=' + (Plaza.Netz && Plaza.Netz.VERSION_Q ? Plaza.Netz.VERSION_Q : '2.8') + ')');
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
          // Peer = andere Seite (auch nach Swap: Gast kann seite 0 sein)
          if (typeof msg.seite === 'number' && msg.seite !== seite) {
            if (typeof msg.seq === 'number' && msg.seq < lastPeerSeq) { /* älteres Input */ }
            else {
              if (typeof msg.seq === 'number') lastPeerSeq = msg.seq;
              peerInput = msg.input || peerInput;
            }
          }
        }
        if (msg.typ === 'state' && !netz.istHost()) {
          var st = msg.state;
          // Veraltetes / out-of-order Paket: nicht eine Frame lang anzeigen und nicht den Endscreen aufreißen.
          // Countdown (Rematch) bleibt erlaubt — der Tick springt dort bewusst zurück.
          if (st && letzterSnap && typeof st.tick === 'number' && typeof letzterSnap.tick === 'number'
              && st.tick < letzterSnap.tick && st.phase !== 'countdown') {
            /* veraltetes Paket */
          } else {
            if (st && st.phase === 'countdown' && letzterSnap && letzterSnap.phase === 'ende') kampfNr++;
            if (msg.level) {
              applyLevel(msg.level);
              if (ui.setLevel) ui.setLevel(msg.level);
            }
            if (msg.wetter && Plaza.Render && Plaza.Render.applyWetter) Plaza.Render.applyWetter(msg.wetter);
            letzterSnap = msg.state;
            pushInterp(msg.state);
            if (mode !== 'kampf') {
              mode = 'kampf';
              ui.showScreen('kampf');
              _skKey = '';
              tryFullscreen();
              skalieren();
            }
            // Ende: sofort Endscreen (vorher kurz kampf erzwungen → Flackern)
            if (letzterSnap && letzterSnap.phase === 'ende') {
              mode = 'ende';
              var wonG = letzterSnap.sieger === seite;
              if (ui.setEnde) ui.setEnde(wonG ? 'GEWONNEN!' : (letzterSnap.sieger != null ? 'VERLOREN!' : 'Ende'), letzterSnap.nachricht || '');
              ui.showScreen('ende');
            }
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
          // v3.0: nur aus Endphase, Version prüfen, Doppel-Rematch ignorieren
          if (kampf.phase !== 'ende' && mode !== 'ende') {
            /* ignore mid-fight rematch spam */
          } else if (msg.ver && msg.ver !== VERSION) {
            ui.setStatus('Rematch abgelehnt — andere Version (' + msg.ver + ')');
          } else {
            mode = 'kampf';
            ui.showScreen('kampf');
            kampfNr++;
            kampf = Plaza.Kampf.rematch(kampf);
            kampf.phase = 'countdown';
            kampf.countdown = 3;
            kampf.tick = 0;
            clearPeerInput();
            resetInterp();
            if (Plaza.Sound) Plaza.Sound.resetDiff();
            if (Plaza.Render.resetFx) Plaza.Render.resetFx();
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

    markIosMode();
    if (istIOS() && !istPwaStandalone()) {
      // Einmalig Hinweis, dass nur Home-Bildschirm die Leiste wirklich entfernt
      setTimeout(showIosHintIfNeeded, 900);
    }
    document.addEventListener('pointerdown', function () {
      if (Plaza.Sound) { Plaza.Sound.resume(); Plaza.Sound.init(); }
      hideSafariChrome();
    }, { passive: true });

    canvas.addEventListener('pointerdown', function () {
      if (Plaza.Sound) Plaza.Sound.resume();
      if (letzterSnap && letzterSnap.phase === 'ende') {
        if (soloMode && kampf) {
          kampfNr++;
          kampf = Plaza.Kampf.rematch(kampf);
          kampf.phase = 'countdown';
          kampf.countdown = 3;
          kampf.tick = 0;
          mode = 'kampf';
          ui.showScreen('kampf');
        } else if (netz && netz.istHost() && kampf) {
          kampfNr++;
          kampf = Plaza.Kampf.rematch(kampf);
          kampf.phase = 'countdown';
          kampf.countdown = 3;
          kampf.tick = 0;
          clearPeerInput();
          resetInterp();
          if (Plaza.Sound) Plaza.Sound.resetDiff();
          if (Plaza.Render.resetFx) Plaza.Render.resetFx();
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

    var framesDrawn = 0, framesSkipped = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      var dt = Math.min(50, now - last);
      last = now;
      acc += dt;
      skalieren();
      var tabHidden = typeof document !== 'undefined' && document.hidden;

      if (soloMode && (mode === 'kampf' || mode === 'ende') && kampf && !paused) {
        while (acc >= STEP) {
          acc -= STEP;
          var cpu = kampf.p[1];
          var stunBefore = cpu ? cpu.stun : 0;
          var cpuInp = Plaza.KI
            ? Plaza.KI.denk(kampf, 1, { aggressiv: Plaza.KI.PRAXIS || 0.84, praxis: true, dummy: false })
            : { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
          Plaza.Kampf.setInput(kampf, 0, lokalInput);
          Plaza.Kampf.setInput(kampf, 1, cpuInp);
          Plaza.Kampf.tick(kampf);
          if (Plaza.KI && Plaza.KI.markWake && cpu && stunBefore > 0 && cpu.stun <= 0) {
            Plaza.KI.markWake(cpu);
          }
        }
        letzterSnap = Plaza.Kampf.snapshot(kampf);
        if (!tabHidden) { Plaza.Render.zeichne(render, letzterSnap, 0); framesDrawn++; } else { framesSkipped++; }
        if (letzterSnap.phase === 'ende') {
          if (mode !== 'ende') {
            mode = 'ende';
            var wonS = letzterSnap.sieger === seite;
            var coinS = noteSieg(letzterSnap);
            if (ui.setEnde) ui.setEnde(wonS ? 'GEWONNEN!' : (letzterSnap.sieger != null ? 'VERLOREN!' : 'Ende'),
              (letzterSnap.nachricht || '') + ' (Testmodus)' + coinS);
            ui.showScreen('ende');
          }
        } else if (mode === 'ende') {
          mode = 'kampf';
          ui.showScreen('kampf');
        }
      } else if (mode === 'kampf' && netz && netz.istHost() && kampf && !paused) {
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
          } else {
            // v4.2: jeden Sim-Tick (~60 Hz). Gast spielt die Ticks mit festem Takt ab,
            // auch wenn die Pakete im selben Frame gebündelt ankommen.
            broadcast();
          }
        }
        letzterSnap = Plaza.Kampf.snapshot(kampf);
        if (!tabHidden) { Plaza.Render.zeichne(render, letzterSnap, seite); framesDrawn++; } else { framesSkipped++; }
        if (netDown && Plaza.Render.banner) Plaza.Render.banner(render, 'VERBINDUNG WEG — Nochmal');
        if (letzterSnap.phase === 'ende') {
          if (mode !== 'ende') {
            mode = 'ende';
            var wonH = letzterSnap.sieger === seite;
            var coinH = noteSieg(letzterSnap);
            if (ui.setEnde) ui.setEnde(wonH ? 'GEWONNEN!' : (letzterSnap.sieger != null ? 'VERLOREN!' : 'Ende'), (letzterSnap.nachricht || '') + coinH);
            ui.showScreen('ende');
          }
        } else if (mode === 'ende') {
          mode = 'kampf';
          ui.showScreen('kampf');
        }
      } else if (paused && letzterSnap) {
        if (!tabHidden) { Plaza.Render.zeichne(render, letzterSnap, seite); framesDrawn++; } else { framesSkipped++; }
        acc = 0;
      } else if ((mode === 'kampf' || mode === 'ende') && letzterSnap) {
        // Gast: Input-HB dichter (Paketverlust → sonst sticky keys)
        if (mode === 'kampf' && netz && !netz.istHost() && netz.istBereit()) {
          // Jeden Frame — Motion-Inputs (↓↘→) dürfen nicht auf 20 Hz zusammenfallen.
          inputSeq++;
          netz.sende({ typ: 'input', seite: seite, input: lokalInput, seq: inputSeq });
        }
        var view = (!netz.istHost() && !soloMode && mode === 'kampf')
          ? applyLocalPredict(drawSnap(now) || letzterSnap)
          : letzterSnap;
        if (!tabHidden) { Plaza.Render.zeichne(render, view, seite); framesDrawn++; } else { framesSkipped++; }
        if (netDown && Plaza.Render.banner) Plaza.Render.banner(render, 'VERBINDUNG WEG — Nochmal');
        if (letzterSnap.phase === 'ende') {
          if (mode !== 'ende') {
            mode = 'ende';
            var wonC = letzterSnap.sieger === seite;
            var coinC = noteSieg(letzterSnap);
            if (ui.setEnde) ui.setEnde(wonC ? 'GEWONNEN!' : (letzterSnap.sieger != null ? 'VERLOREN!' : 'Ende'), (letzterSnap.nachricht || '') + coinC);
            ui.showScreen('ende');
          }
        } else if (mode === 'ende' && letzterSnap.phase !== 'ende') {
          mode = 'kampf';
          ui.showScreen('kampf');
        }
        acc = 0;
      } else if (mode === 'menue') {
        Plaza.Render.menueHint(render, 'Versus · Solo · v4.2');
        acc = 0;
      } else {
        Plaza.Render.menueHint(render, statusElText());
        acc = 0;
      }
      drawNetDebug();
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
      try { navigator.serviceWorker.register('sw.js?v=4.2'); } catch (eSw) {}
    }
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else start();
})(typeof window !== 'undefined' ? window : globalThis);
