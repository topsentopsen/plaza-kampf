/* Menü, Charakterwahl, Touch-Steuerung. v1.0 */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};

  function erstelle(opts) {
    opts = opts || {};
    var root = opts.root;
    var onHost = opts.onHost || function () {};
    var onJoin = opts.onJoin || function () {};
    var onWahl = opts.onWahl || function () {};
    var onRematch = opts.onRematch || function () {};
    var onInput = opts.onInput || function () {};
    var onRetry = opts.onRetry || function () {};
    var onMute = opts.onMute || function () {};
    var onFullscreen = opts.onFullscreen || function () {};
    var onSwap = opts.onSwap || function () {};
    var getLink = opts.getLink || function () { return ''; };

    var overlay = root.querySelector('#overlay');
    var controls = root.querySelector('#controls');
    var statusEl = root.querySelector('#status');
    var input = {
      l: false, r: false, u: false, d: false,
      a: false, b: false, c: false
    };

    function setStatus(t) {
      if (statusEl) statusEl.textContent = t || '';
    }

    function showScreen(name) {
      var screens = overlay.querySelectorAll('.screen');
      for (var i = 0; i < screens.length; i++) {
        screens[i].hidden = screens[i].dataset.screen !== name;
      }
      controls.hidden = name !== 'kampf';
      // ende: Overlay mit Rematch-Knopf über dem Canvas
      overlay.hidden = (name === 'kampf');
      if (name === 'ende') overlay.classList.add('ende-mode');
      else overlay.classList.remove('ende-mode');
    }
    function setEnde(titel, text) {
      var tEl = overlay.querySelector('#ende-titel');
      var pEl = overlay.querySelector('#ende-text');
      if (tEl) tEl.textContent = titel || 'Ende';
      if (pEl) pEl.textContent = text || '';
    }

    function fillChars(selId) {
      var box = overlay.querySelector('[data-screen="wahl"] .chars');
      if (!box) return;
      box.innerHTML = '';
      Plaza.Chars.LISTE.forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'char-card';
        b.dataset.id = c.id;
        var st = c.stats || { tempo: 3, kraft: 3, reich: 3 };
        function pips(n) {
          var s = '';
          for (var i = 1; i <= 5; i++) s += '<i class="' + (i <= n ? 'an' : '') + '"></i>';
          return s;
        }
        var ml = c.moves.light, mh = c.moves.heavy, ms = c.moves.special;
        b.innerHTML = '<span class="swatch" style="background:' + c.farbe + '"></span>' +
          '<strong>' + c.name + '</strong>' +
          '<em class="spitz">' + (c.spitzname || '') + '</em>' +
          '<small class="lore">' + (c.lore || '') + '</small>' +
          '<span class="pips" title="Tempo">' + pips(st.tempo) + '</span>' +
          '<small class="moves">' +
            '<b>A</b> ' + ml.name + ' (' + ml.dmg + ') · ' +
            '<b>B</b> ' + mh.name + ' (' + mh.dmg + ') · ' +
            '<b>C</b> ' + ms.name + ' (' + ms.dmg + ')' +
          '</small>';
        if (selId === c.id) b.classList.add('aktiv');
        b.addEventListener('click', function () {
          var alle = box.querySelectorAll('.char-card');
          for (var i = 0; i < alle.length; i++) alle[i].classList.remove('aktiv');
          b.classList.add('aktiv');
          if (Plaza.Sound) Plaza.Sound.sfx('ui');
          onWahl(c.id);
        });
        box.appendChild(b);
      });
    }

    function bindTouch() {
      function bind(el, key) {
        if (!el) return;
        function down(e) {
          e.preventDefault();
          input[key] = true;
          onInput(input);
          el.classList.add('down');
        }
        function up(e) {
          e.preventDefault();
          input[key] = false;
          onInput(input);
          el.classList.remove('down');
        }
        el.addEventListener('pointerdown', down);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointerleave', up);
        el.addEventListener('pointercancel', up);
      }
      bind(controls.querySelector('[data-k="l"]'), 'l');
      bind(controls.querySelector('[data-k="r"]'), 'r');
      bind(controls.querySelector('[data-k="u"]'), 'u');
      bind(controls.querySelector('[data-k="d"]'), 'd');
      bind(controls.querySelector('[data-k="a"]'), 'a');
      bind(controls.querySelector('[data-k="b"]'), 'b');
      bind(controls.querySelector('[data-k="c"]'), 'c');
    }

    function typingInField(e) {
      var t = e.target;
      if (!t) return false;
      var tag = (t.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (t.isContentEditable) return true;
      return false;
    }

    function bindKeys() {
      var map = {
        ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd',
        a: 'l', d: 'r', w: 'u', s: 'd',
        j: 'a', k: 'b', l: 'c',
        KeyJ: 'a', KeyK: 'b', KeyL: 'c'
      };
      // Nur WASD/JKL als Kampf-Keys — NICHT während Namenseingabe (Bug: „S“ in Thompson)
      window.addEventListener('keydown', function (e) {
        if (typingInField(e)) return;
        var k = map[e.key] || map[e.code];
        if (!k) return;
        e.preventDefault();
        if (!input[k]) {
          input[k] = true;
          onInput(input);
        }
      });
      window.addEventListener('keyup', function (e) {
        if (typingInField(e)) return;
        var k = map[e.key] || map[e.code];
        if (!k) return;
        e.preventDefault();
        input[k] = false;
        onInput(input);
      });
    }

    function bindMenue() {
      var hostBtn = overlay.querySelector('[data-act="host"]');
      var joinBtn = overlay.querySelector('[data-act="join"]');
      var joinInput = overlay.querySelector('#raum-input');
      var copyBtn = overlay.querySelector('[data-act="copy"]');
      var rematchBtn = overlay.querySelector('[data-act="rematch"]');
      if (hostBtn) hostBtn.addEventListener('click', function () {
        if (Plaza.Sound) { Plaza.Sound.init(); Plaza.Sound.sfx('ui'); }
        onHost();
      });
      if (joinBtn) joinBtn.addEventListener('click', function () {
        if (Plaza.Sound) { Plaza.Sound.init(); Plaza.Sound.sfx('ui'); }
        onJoin((joinInput && joinInput.value || '').trim());
      });
      var muteBtn = root.querySelector('[data-act="mute"]');
      if (muteBtn) muteBtn.addEventListener('click', function () {
        var m = onMute();
        muteBtn.textContent = m ? '🔇' : '🔊';
        muteBtn.setAttribute('aria-label', m ? 'Ton an' : 'Ton aus');
      });
      var fsBtn = root.querySelector('[data-act="fs"]');
      if (fsBtn) fsBtn.addEventListener('click', function () {
        if (Plaza.Sound) Plaza.Sound.init();
        onFullscreen();
      });
      if (copyBtn) copyBtn.addEventListener('click', function () {
        var link = getLink();
        if (navigator.clipboard && link) {
          navigator.clipboard.writeText(link).then(function () {
            setStatus('Link kopiert!');
          }).catch(function () { setStatus(link); });
        } else setStatus(link);
      });
      if (rematchBtn) rematchBtn.addEventListener('click', function () {
        if (Plaza.Sound) Plaza.Sound.sfx('ui');
        onRematch();
      });
      var swapBtns = overlay.querySelectorAll('[data-act="swap"]');
      for (var si = 0; si < swapBtns.length; si++) {
        swapBtns[si].addEventListener('click', function () {
          if (Plaza.Sound) Plaza.Sound.sfx('ui');
          onSwap();
        });
      }
      var iosOk = root.querySelector('[data-act="ios-hint-ok"]');
      if (iosOk) iosOk.addEventListener('click', function () {
        var h = root.querySelector('#ios-hint');
        if (h) h.classList.remove('show');
        try { localStorage.setItem('plaza.iosHint', '1'); } catch (e0) {}
      });
      var retryBtn = overlay.querySelector('[data-act="retry"]');
      if (retryBtn) retryBtn.addEventListener('click', function () { onRetry(); });
      var joinNow = overlay.querySelector('[data-act="join-now"]');
      if (joinNow) joinNow.addEventListener('click', function () {
        if (Plaza.Sound) { Plaza.Sound.init(); Plaza.Sound.sfx('ui'); }
        var codeEl = overlay.querySelector('#raum-code');
        onJoin((codeEl && codeEl.textContent || '').trim());
      });
    }

    function showLink(link, raum) {
      var el = overlay.querySelector('#raum-link');
      var code = overlay.querySelector('#raum-code');
      if (el) el.textContent = link;
      if (code) code.textContent = raum || '';
    }

    bindTouch();
    bindKeys();
    bindMenue();

    function showRetry(on) {
      var b = overlay.querySelector('[data-act="retry"]');
      if (b) b.hidden = !on;
    }
    function showJoinConfirm(on, code) {
      var b = overlay.querySelector('[data-act="join-now"]');
      if (b) b.hidden = !on;
      if (code) {
        var c = overlay.querySelector('#raum-code');
        if (c) c.textContent = code;
      }
    }

    return {
      showScreen: showScreen,
      setEnde: setEnde,
      setSeiteHint: function (seite) {
        var el = overlay.querySelector('#seite-hint');
        if (!el) return;
        el.textContent = seite === 0
          ? 'Du bist P1 (links) — Startseite.'
          : 'Du bist P2 (rechts) — Gastseite.';
      },
      fillChars: fillChars,
      setStatus: setStatus,
      showLink: showLink,
      showRetry: showRetry,
      showJoinConfirm: showJoinConfirm,
      getInput: function () { return input; },
      resetInput: function () {
        input = { l: false, r: false, u: false, d: false, a: false, b: false, c: false };
      }
    };
  }

  Plaza.UI = { erstelle: erstelle };
})(typeof window !== 'undefined' ? window : globalThis);
