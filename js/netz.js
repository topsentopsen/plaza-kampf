/* Netz v0.2: MQTT-Relay (öffentlich) als Hauptweg, PeerJS+TURN als Fallback.
   Keine Secrets — nur öffentliche Broker / OpenRelay-Demo-TURN. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};
  var VERSION_Q = '3.1';

  var MQTT_URLS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081/mqtt',
    'wss://mqtt.eclipseprojects.io:443/mqtt'
  ];

  var PEER_OPTS = {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    debug: 1,
    pingInterval: 4000,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
        { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
      ]
    }
  };

  function raumIdNeu() {
    var s = 'abcdefghjkmnpqrstuvwxyz23456789';
    var out = '';
    for (var i = 0; i < 6; i++) out += s.charAt(Math.floor(Math.random() * s.length));
    return out;
  }

  function normalizeRaum(id) {
    return String(id || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
  }

  function erstelle(opts) {
    opts = opts || {};
    var handlers = {
      onStatus: opts.onStatus || function () {},
      onPeer: opts.onPeer || function () {},
      onMsg: opts.onMsg || function () {},
      onClose: opts.onClose || function () {}
    };

    var host = false;
    var raum = null;
    var me = 'p' + Math.random().toString(36).slice(2, 10);
    var transport = null; // 'mqtt' | 'peer'
    var verbunden = false;
    var destroyed = false;
    var mqttClient = null;
    var peer = null;
    var conn = null;
    var peerRetryTimer = null;
    var peerTries = 0;
    var mqttIndex = 0;
    var heartbeatTimer = null;
    var lastPeerSeen = 0;

    function status(t, extra) {
      var e = extra || {};
      e.transport = transport;
      e.raum = raum;
      e.host = host;
      handlers.onStatus(t, e);
    }

    function topicBase() { return 'plaza/v02/' + raum; }

    function emitMsg(data) {
      if (!data || typeof data !== 'object') return;
      if (data.from && data.from === me) return;
      handlers.onMsg(data);
    }

    function markConnected() {
      if (verbunden) return;
      verbunden = true;
      status('verbunden', { me: me });
      handlers.onPeer({ transport: transport });
      startHeartbeat();
    }

    function startHeartbeat() {
      stopHeartbeat();
      heartbeatTimer = setInterval(function () {
        sende({ typ: 'hb', t: Date.now() });
        if (host && lastPeerSeen && Date.now() - lastPeerSeen > 20000) {
          status('warte-peer', { hinweis: 'Mitspieler still — Tab offen lassen?' });
        }
      }, 4000);
    }

    function stopHeartbeat() {
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    }

    /* ---------- MQTT ---------- */
    function mqttStart() {
      if (typeof mqtt === 'undefined' || !mqtt.connect) {
        status('mqtt-fehlt');
        peerStart();
        return;
      }
      transport = 'mqtt';
      var url = MQTT_URLS[mqttIndex % MQTT_URLS.length];
      status('verbinde', { via: 'mqtt', broker: url });
      try {
        if (mqttClient) { try { mqttClient.end(true); } catch (e0) {} }
        mqttClient = mqtt.connect(url, {
          clientId: 'plaza_' + me,
          clean: true,
          connectTimeout: 10000,
          reconnectPeriod: 3000,
          keepalive: 20
        });
      } catch (e) {
        status('fehler', { err: String(e) });
        mqttFailover();
        return;
      }

      var brokerUp = false;
      var openTimer = setTimeout(function () {
        if (!brokerUp && transport === 'mqtt') mqttFailover();
      }, 12000);

      mqttClient.on('connect', function () {
        brokerUp = true;
        clearTimeout(openTimer);
        var base = topicBase();
        mqttClient.subscribe([base + '/msg', base + '/host'], function (err) {
          if (err) {
            status('fehler', { err: 'subscribe' });
            mqttFailover();
            return;
          }
          status(host ? 'warte' : 'suche', { via: 'mqtt' });
          if (host) {
            mqttClient.publish(base + '/host', JSON.stringify({ from: me, t: Date.now(), raum: raum }), { retain: true, qos: 0 });
            // Host ist „bereit“, wartet auf Gast-Join
          } else {
            sende({ typ: 'join', seite: 1, t: Date.now() });
          }
        });
      });

      mqttClient.on('message', function (topic, buf) {
        var raw = buf ? buf.toString() : '';
        var data;
        try { data = JSON.parse(raw); } catch (e1) { return; }
        if (!data) return;
        if (topic.indexOf('/host') !== -1) {
          if (!host && data.from && data.from !== me) {
            // Host da: erneut join (falls Host unsere erste Join-Msg verpasst hat)
            sende({ typ: 'join', seite: 1, t: Date.now() });
            markConnected();
          }
          return;
        }
        if (data.from === me) return;
        if (data.typ === 'hb') {
          lastPeerSeen = Date.now();
          if (!verbunden) markConnected();
          return;
        }
        if (data.typ === 'join') {
          lastPeerSeen = Date.now();
          if (host) markConnected();
        }
        if (!verbunden && (data.typ === 'join' || data.typ === 'wahl' || data.typ === 'state' || data.typ === 'hello')) {
          markConnected();
        }
        lastPeerSeen = Date.now();
        emitMsg(data);
      });

      mqttClient.on('error', function (err) {
        status('fehler', { err: (err && err.message) || 'mqtt' });
      });

      mqttClient.on('close', function () {
        if (destroyed) return;
        if (verbunden) {
          verbunden = false;
          status('getrennt');
          handlers.onClose();
        }
      });
    }

    function mqttFailover() {
      if (destroyed) return;
      mqttIndex++;
      if (mqttIndex < MQTT_URLS.length) {
        status('broker-wechsel', { n: mqttIndex });
        try { if (mqttClient) mqttClient.end(true); } catch (e) {}
        setTimeout(mqttStart, 400);
      } else {
        status('mqtt-aus', { hinweis: 'Wechsle zu PeerJS…' });
        try { if (mqttClient) mqttClient.end(true); } catch (e2) {}
        mqttClient = null;
        peerStart();
      }
    }

    /* ---------- PeerJS Fallback ---------- */
    function peerStart() {
      if (typeof Peer === 'undefined') {
        status('kein-peerjs');
        return;
      }
      transport = 'peer';
      peerTries = 0;
      status('verbinde', { via: 'peer' });
      if (host) peerHost();
      else peerJoin();
    }

    function peerHost() {
      try { if (peer) peer.destroy(); } catch (e) {}
      try {
        peer = new Peer('plaza2-' + raum, Object.assign({}, PEER_OPTS));
      } catch (e2) {
        status('fehler', { err: String(e2) });
        return;
      }
      peer.on('open', function (id) {
        status('warte', { via: 'peer', peerId: id });
      });
      peer.on('connection', function (c) {
        if (conn && conn.open) { try { c.close(); } catch (e3) {} return; }
        bindPeerConn(c);
      });
      peer.on('error', function (err) {
        var m = err && err.type ? err.type : String(err);
        if (m === 'unavailable-id') {
          try { peer.destroy(); } catch (e4) {}
          raum = raumIdNeu();
          status('neuer-code', { raum: raum });
          peerHost();
          return;
        }
        if (m === 'network' || m === 'server-error' || m === 'socket-error') {
          status('fehler', { err: m, retry: true });
          setTimeout(function () { if (!destroyed && !verbunden) peerHost(); }, 2500);
          return;
        }
        status('fehler', { err: m, retry: true });
      });
      peer.on('disconnected', function () {
        if (destroyed) return;
        status('broker-weg');
        try { peer.reconnect(); } catch (e5) {}
      });
    }

    function peerJoin() {
      try { if (peer) peer.destroy(); } catch (e) {}
      try {
        peer = new Peer(Object.assign({}, PEER_OPTS));
      } catch (e2) {
        status('fehler', { err: String(e2) });
        return;
      }
      peer.on('open', function () {
        status('suche', { via: 'peer' });
        peerConnectAttempt();
      });
      peer.on('error', function (err) {
        var m = err && err.type ? err.type : String(err);
        status('fehler', { err: m, retry: true });
      });
      peer.on('disconnected', function () {
        if (destroyed) return;
        try { peer.reconnect(); } catch (e3) {}
      });
    }

    function peerConnectAttempt() {
      if (destroyed || verbunden || !peer || peer.destroyed) return;
      peerTries++;
      status('suche', { via: 'peer', try: peerTries });
      var c;
      try {
        c = peer.connect('plaza2-' + raum, { reliable: true, serialization: 'json' });
      } catch (e) {
        schedulePeerRetry();
        return;
      }
      bindPeerConn(c);
      // Timeout: wenn nicht open → erneut
      schedulePeerRetry();
    }

    function schedulePeerRetry() {
      if (peerRetryTimer) clearTimeout(peerRetryTimer);
      peerRetryTimer = setTimeout(function () {
        if (destroyed || verbunden) return;
        if (peerTries >= 10) {
          status('fehler', { err: 'peer-timeout', retry: true, hinweis: 'P2P hängt (NAT?). Erneut versuchen oder anderes Netz.' });
          return;
        }
        peerConnectAttempt();
      }, 3500);
    }

    function bindPeerConn(c) {
      conn = c;
      c.on('data', function (data) {
        if (!data || typeof data !== 'object') return;
        if (data.typ === 'hb') { lastPeerSeen = Date.now(); return; }
        lastPeerSeen = Date.now();
        emitMsg(data);
      });
      c.on('open', function () {
        if (peerRetryTimer) clearTimeout(peerRetryTimer);
        sende({ typ: 'hello', seite: host ? 0 : 1, t: Date.now() });
        markConnected();
      });
      c.on('close', function () {
        conn = null;
        if (verbunden) {
          verbunden = false;
          status('getrennt');
          handlers.onClose();
        }
        if (!host && !destroyed) schedulePeerRetry();
      });
      c.on('error', function (err) {
        status('fehler', { err: String(err && err.message || err), retry: true });
      });
      if (c.open) {
        sende({ typ: 'hello', seite: host ? 0 : 1, t: Date.now() });
        markConnected();
      }
    }

    /* ---------- Public API ---------- */
    function hostStarten(wunschId) {
      destroyed = false;
      host = true;
      raum = normalizeRaum(wunschId) || raumIdNeu();
      verbunden = false;
      mqttIndex = 0;
      status('verbinde', { host: true });
      mqttStart();
    }

    function beitreten(raumId) {
      destroyed = false;
      host = false;
      raum = normalizeRaum(raumId);
      if (!raum) { status('fehler', { err: 'kein-raum' }); return; }
      verbunden = false;
      mqttIndex = 0;
      status('verbinde', { host: false });
      mqttStart();
    }

    function sende(msg) {
      if (!msg || typeof msg !== 'object') return;
      var payload = Object.assign({ from: me, v: 2 }, msg);
      if (transport === 'mqtt' && mqttClient && mqttClient.connected) {
        try {
          mqttClient.publish(topicBase() + '/msg', JSON.stringify(payload), { qos: 0, retain: false });
        } catch (e) {}
        return;
      }
      if (transport === 'peer' && conn && conn.open) {
        try { conn.send(payload); } catch (e2) {}
      }
    }

    function trennen() {
      destroyed = true;
      stopHeartbeat();
      if (peerRetryTimer) clearTimeout(peerRetryTimer);
      try { if (conn) conn.close(); } catch (e) {}
      try { if (peer) peer.destroy(); } catch (e2) {}
      try { if (mqttClient) mqttClient.end(true); } catch (e3) {}
      conn = null; peer = null; mqttClient = null; verbunden = false;
    }

    function retry() {
      trennen();
      destroyed = false;
      verbunden = false;
      mqttIndex = 0;
      if (host) hostStarten(raum);
      else beitreten(raum);
    }

    function linkFuer(base, asHost) {
      var b = base || (typeof location !== 'undefined' ? (location.origin + location.pathname) : '');
      var q = '?raum=' + encodeURIComponent(raum || '') + '&v=' + VERSION_Q;
      if (asHost) q += '&host=1';
      return b + q;
    }

    return {
      hostStarten: hostStarten,
      beitreten: beitreten,
      sende: sende,
      trennen: trennen,
      retry: retry,
      istHost: function () { return host; },
      istBereit: function () { return verbunden; },
      getRaum: function () { return raum; },
      getTransport: function () { return transport; },
      linkFuer: linkFuer,
      raumIdNeu: raumIdNeu
    };
  }

  Plaza.Netz = { erstelle: erstelle, raumIdNeu: raumIdNeu, VERSION_Q: VERSION_Q };
})(typeof window !== 'undefined' ? window : globalThis);
