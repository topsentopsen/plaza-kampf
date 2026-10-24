# Plaza-Kampf v0.2

Retro-Versus-Kampfspiel für zwei Handys. Statisches HTML/JS (wie [Finca](https://topsentopsen.github.io/finca-spiel/)).

**Live:** https://topsentopsen.github.io/plaza-kampf/

## Spielen

1. Handy A: **Raum erstellen** → Status „Raum … offen“ → **Link kopieren** und teilen.
2. Handy B: Link öffnen → **Jetzt beitreten** tippen (wichtig auf dem iPhone).
3. Beide wählen einen Charakter → Countdown → Kampf.
4. Handy **nicht sperren**, Tab im Vordergrund lassen. Statuszeile beobachten.
5. Bei Fehler: **Nochmal**. Hart neu laden bei Cache (`v=0.2`).

Steuerung: ◀ ▶ ▲ · **A** leicht · **B** schwer · **S** Spezial. Desktop: Pfeile/WASD + J/K/L.

## Was in v0.2 anders ist

v0.1 hing oft am **WebRTC/PeerJS-Datenkanal** (WLAN-Client-Isolation, ICE, iOS ohne User-Gesture).

v0.2 verbindet zuerst über einen **öffentlichen MQTT-Broker** (EMQX / HiveMQ / Mosquitto) — kein P2P nötig, gleicher Raum = gleiches Topic. Wenn MQTT scheitert: **PeerJS-Fallback** mit STUN + öffentlichem OpenRelay-TURN und Retries. Host-URL trägt `&host=1` (Refresh bleibt Host); der geteilte Link **ohne** `host=1`.

Keine Passwörter/API-Keys von Tobi im Repo. OpenRelay-Demo-Credentials sind öffentlich dokumentierte TURN-Zugänge.

## Charaktere

Biel · Lola · Toni · Rocco · Nina

## Technik

- `js/netz.js` — MQTT-primary, PeerJS-fallback, Heartbeat, Retry
- `js/kampf.js` — Host-Simulation
- `js/chars.js` / `render.js` / `ui.js` / `main.js`

Tests: `node tests/kampf.test.js`
