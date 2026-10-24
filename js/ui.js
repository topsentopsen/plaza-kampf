/* Menü, Charakterwahl, Touch-Steuerung. */
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
      overlay.hidden = name === 'kampf';
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
        b.innerHTML = '<span class="swatch" style="background:' + c.farbe + '"></span>' +
          '<strong>' + c.name + '</strong>' +
          '<small>' + c.moves.light.name + ' · ' + c.moves.heavy.name + ' · ' + c.moves.special.name + '</small>';
        if (selId === c.id) b.classList.add('aktiv');
        b.addEventListener('click', function () {
          var alle = box.querySelectorAll('.char-card');
          for (var i = 0; i < alle.length; i++) alle[i].classList.remove('aktiv');
          b.classList.add('aktiv');
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
      bind(controls.querySelector('[data-k="a"]'), 'a');
      bind(controls.querySelector('[data-k="b"]'), 'b');
      bind(controls.querySelector('[data-k="c"]'), 'c');
    }

    function bindKeys() {
      var map = {
        ArrowLeft: 'l', ArrowRight: 'r', ArrowUp: 'u', ArrowDown: 'd',
        a: 'l', d: 'r', w: 'u', s: 'd',
        j: 'a', k: 'b', l: 'c',
        KeyJ: 'a', KeyK: 'b', KeyL: 'c'
      };
      window.addEventListener('keydown', function (e) {
        var k = map[e.key] || map[e.code];
        if (!k) return;
        e.preventDefault();
        if (!input[k]) {
          input[k] = true;
          onInput(input);
        }
      });
      window.addEventListener('keyup', function (e) {
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
      if (hostBtn) hostBtn.addEventListener('click', function () { onHost(); });
      if (joinBtn) joinBtn.addEventListener('click', function () {
        onJoin((joinInput && joinInput.value || '').trim());
      });
      if (copyBtn) copyBtn.addEventListener('click', function () {
        var link = getLink();
        if (navigator.clipboard && link) {
          navigator.clipboard.writeText(link).then(function () {
            setStatus('Link kopiert!');
          }).catch(function () { setStatus(link); });
        } else setStatus(link);
      });
      if (rematchBtn) rematchBtn.addEventListener('click', function () { onRematch(); });
      var retryBtn = overlay.querySelector('[data-act="retry"]');
      if (retryBtn) retryBtn.addEventListener('click', function () { onRetry(); });
      var joinNow = overlay.querySelector('[data-act="join-now"]');
      if (joinNow) joinNow.addEventListener('click', function () {
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
