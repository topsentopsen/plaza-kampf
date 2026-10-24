# Plaza-Kampf v0.1

Retro-Versus-Kampfspiel für zwei Handys. Statisches HTML/JS (wie [Finca](https://topsentopsen.github.io/finca-spiel/)), Pixel-Look, On-Screen-Tasten.

**Live:** https://topsentopsen.github.io/plaza-kampf/

## Spielen

1. Handy A: **Raum erstellen** → Link teilen oder Code nennen.
2. Handy B: Link öffnen (`?raum=xxxxxx`) oder Code unter **Beitreten**.
3. Beide wählen einen Charakter → Countdown → Kampf.
4. Steuerung: ◀ ▶ ▲ laufen/springen, **A** leicht, **B** schwer, **S** Spezial. Am Desktop: Pfeile/WASD + J/K/L.

## Multiplayer

GitHub Pages ist nur statisch — kein eigener WebSocket-Server. **PeerJS** (WebRTC P2P + öffentlicher Broker) verbindet die Handys ohne API-Keys. Der Host simuliert den Kampf autoritativ und schickt den State; Clients senden Inputs. Die Session-Schicht (`js/netz.js`) ist so gebaut, dass später mehr Spieler oder ein Relay (z. B. Cloudflare) eingehängt werden können. Bei strengem NAT: Hinweis im UI, gleiches WLAN versuchen.

## Charaktere

| Name | Stil |
|------|------|
| **Biel** | Ausgewogen — Knuff, Sonnenhieb, Pa amb oli |
| **Lola** | Schnell — Tipp, Wirbeltritt, Rosenregen |
| **Toni** | Tank — Schlag, Amboss, Erdstoß |
| **Rocco** | Greifer — Greif, Schulter, Plaza-Wurf |
| **Nina** | Reichweite — Stich, Blitzkick, Sonnenball |

## Technik

- `js/chars.js` — Movesets
- `js/kampf.js` — Simulation (Host)
- `js/netz.js` — PeerJS Raum create/join
- `js/render.js` — Canvas
- `js/ui.js` — Menü + Touch
- `js/main.js` — Loop

Keine Secrets im Repo. PeerJS per CDN.

## Lokal

Einfach `index.html` über einen lokalen Static-Server öffnen (oder GitHub Pages). Tests: `node tests/kampf.test.js`.

## Version

v0.1 — erster Versus-Prototype, 2 Spieler, 5 Charaktere, Rematch.
