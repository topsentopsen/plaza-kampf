/* PeerJS Raum: Host autoritativ, Clients senden Inputs.
   Session-Schicht so gebaut, dass später >2 Spieler oder ein Relay eingehängt werden kann. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};

  function raumIdNeu() {
    var s = 'abcdefghjkmnpqrstuvwxyz23456789';
    var out = '';
    for (var i = 0; i < 6; i++) out += s.charAt(Math.floor(Math.random() * s.length));
    return out;
  }

  function erstelle(opts) {
    opts = opts || {};
    var handlers = {
      onStatus: opts.onStatus || function () {},
      onPeer: opts.onPeer || function () {},
      onMsg: opts.onMsg || function () {},
      onClose: opts.onClose || function () {}
    };
    var peer = null, conn = null, host = false, raum = null, bereit = false;

    function status(t, extra) { handlers.onStatus(t, extra || {}); }

    function sende(msg) {
      if (conn && conn.open) {
        try { conn.send(msg); } catch (e) { /* ignore */ }
      }
    }

    function bindConn(c) {
      conn = c;
      c.on('data', function (data) {
        if (!data || typeof data !== 'object') return;
        handlers.onMsg(data);
      });
      c.on('close', function () {
        conn = null;
        status('getrennt');
        handlers.onClose();
      });
      c.on('error', function (err) {
        status('fehler', { err: String(err && err.message || err) });
      });
      if (c.open) {
        bereit = true;
        status('verbunden');
        handlers.onPeer(c);
      } else {
        c.on('open', function () {
          bereit = true;
          status('verbunden');
          handlers.onPeer(c);
        });
      }
    }

    function hostStarten(wunschId) {
      if (typeof Peer === 'undefined') {
        status('kein-peerjs');
        return;
      }
      host = true;
      raum = wunschId || raumIdNeu();
      status('verbinde', { raum: raum, host: true });
      try {
        peer = new Peer('plaza-' + raum, { debug: 0 });
      } catch (e) {
        status('fehler', { err: String(e) });
        return;
      }
      peer.on('open', function (id) {
        status('warte', { raum: raum, peerId: id, host: true });
      });
      peer.on('connection', function (c) {
        if (conn && conn.open) {
          try { c.close(); } catch (e2) {}
          return;
        }
        bindConn(c);
      });
      peer.on('error', function (err) {
        var m = err && err.type ? err.type : String(err);
        if (m === 'unavailable-id') {
          // ID belegt → neue nehmen
          try { peer.destroy(); } catch (e3) {}
          hostStarten(raumIdNeu());
          return;
        }
        status('fehler', { err: m });
      });
      peer.on('disconnected', function () {
        status('getrennt');
      });
    }

    function beitreten(raumId) {
      if (typeof Peer === 'undefined') {
        status('kein-peerjs');
        return;
      }
      host = false;
      raum = String(raumId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!raum) { status('fehler', { err: 'kein-raum' }); return; }
      status('verbinde', { raum: raum, host: false });
      try {
        peer = new Peer({ debug: 0 });
      } catch (e) {
        status('fehler', { err: String(e) });
        return;
      }
      peer.on('open', function () {
        status('suche', { raum: raum });
        var c = peer.connect('plaza-' + raum, { reliable: true });
        bindConn(c);
      });
      peer.on('error', function (err) {
        var m = err && err.type ? err.type : String(err);
        status('fehler', { err: m });
      });
    }

    function trennen() {
      try { if (conn) conn.close(); } catch (e) {}
      try { if (peer) peer.destroy(); } catch (e2) {}
      conn = null; peer = null; bereit = false;
    }

    function istHost() { return host; }
    function istBereit() { return !!(conn && conn.open); }
    function getRaum() { return raum; }

    function linkFuer(base) {
      var b = base || (typeof location !== 'undefined' ? location.origin + location.pathname : '');
      return b + '?raum=' + encodeURIComponent(raum || '') + '&v=0.1';
    }

    return {
      hostStarten: hostStarten,
      beitreten: beitreten,
      sende: sende,
      trennen: trennen,
      istHost: istHost,
      istBereit: istBereit,
      getRaum: getRaum,
      linkFuer: linkFuer,
      raumIdNeu: raumIdNeu
    };
  }

  Plaza.Netz = { erstelle: erstelle, raumIdNeu: raumIdNeu };
})(typeof window !== 'undefined' ? window : globalThis);
