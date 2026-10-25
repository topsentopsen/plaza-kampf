## v3.1 Level-System

Vier Arenen wählbar: **Hölle**, **Dschungel**, **Brücke**, **zerstörte Stadt**. Wetter + Parallax bleiben. Host/Solo wählt die Arena im Menü.

Live: https://topsentopsen.github.io/plaza-kampf/?v=3.1

## v3.0 Parallax

Mehrschichtiges dynamisches Parallax: stärkere Kamera beim Laufen, Ebenen-Drift, Heat-Shimmer und Asche-Schleier. Theme bleibt Hölle.


# Plaza-Kampf v3.1 — Level · Wetter · Parallax

Dunkles Versus — *la Pelea del Infierno*. Feuer, Vulkane, ernste Street-Fighter-Chars. Statisches HTML/JS auf GitHub Pages.

**Live:** https://topsentopsen.github.io/plaza-kampf/

## Spielen

1. Handy A: **Raum erstellen** → Link teilen.
2. Handy B: Link → **Jetzt beitreten**.
3. Charakter wählen → Countdown → Kampf.
4. Tab offen lassen. Ton: 🔊 oben links (iPhone: Klingelschalter).

Steuerung: ◀ ▶ ▲ · **A** leicht · **B** schwer · **S** Spezial.

## Charaktere

| Figur | Spitzname | Stil |
|---|---|---|
| Biel | El Pescador | Allrounder, Pa amb oli |
| Lola | La Rosa | Schnell, Rosenregen |
| Toni | El Herrero | Tank, Erdstoß |
| Rocco | El Portero | Grappler, Plaza-Wurf |
| Nina | La Chispa | Rushdown, Sonnenball |

## v0.3 „Plaza lebt“

- Arena mit Tiefe: Himmel-Bänder, Meer/Hügel, Dorf, Café, Brunnen, Palmen, Pflaster, Vordergrund + Parallax
- WebAudio-Sound (prozedural): Hits, Swings, Spezial-Signaturen, Countdown, KO/Sieg, Ambient
- Figuren mit Silhouette/Lore/Stat-Pips, Hit-Sparks, Delay-HP-Balken
- Multiplayer unverändert: MQTT primary + PeerJS/TURN fallback (`netz.js` / `kampf.js` unangetastet)

## Technik

`js/{palette,chars,kampf,netz,sound,levels,render,ki,ui,main}.js` · Tests: `node tests/kampf.test.js`

Design-Plan: siehe Repo-Extern `/workspace/plaza-kampf-claude/design-v0.3-2026-10-24.md`

## v0.4 „Hölle“
- Extreme dunkle Arena: Blutmond, Vulkane, Lava-Meer, Ruinen, Fackeln
- Charakter-Redesign: kantige dunkle Outfits/Silhouetten (Street-Fighter-Feeling)
- UI/HUD/Buttons schwarz-rot mit Feuer-Akzenten
- Combat-WIP: Block, Duck, Air, Armor, Multi-Hit, Dash/Cancel, Projektile (Host-autoritativ)
- Multiplayer unverändert: MQTT primary + PeerJS/TURN
- Cache: hart neu laden mit `?v=0.4`

Live: https://topsentopsen.github.io/plaza-kampf/


## v0.5 „Politur“
- Schärfere Auflösung: 2×/3× interner Canvas-Puffer + Integer-CSS-Scale (Retina)
- Idle-Mikroanims, Win-Pose + Spruch, Combo-Anzeige
- Mehr Hit-FX (Slash/Block/Armor/Ember), punchiger Sound, Höllen-Ambient
- Arena: Asche-Partikel + Lava-Glow; Lobby-Schritte klarer
- Feel: Block/Hitstun/Dash-Tuning
- Cache: hart neu laden mit `?v=0.5`


## v0.6 „Namen & Ende“
- Spielernamen eingeben (Lobby/Wahl), schweben über dem Kopf, Netz-Sync
- Endscreen für **beide**: GEWONNEN / VERLOREN + Siegerzeile (Ende-Broadcast-Fix)
- Querformat: Fullscreen wo möglich, Canvas nutzt fast die ganze Fläche
- Cache: hart neu laden mit `?v=0.6`


## v0.7 „Eingabe & Fullscreen“
- Sichtbarer Fullscreen-Button ⛶ (nach Drehen tippen)
- Gast: Namensfeld auf Warte-Screen vor „Jetzt beitreten“
- Fix: WASD/JKL stehlen keine Buchstaben mehr aus Namensfeldern (Thompson ✓)
- Cache: `?v=0.7`


## v0.8 „Sprites, Duck, Rematch, Musik, VFX“
- Touch Duck-Button ▼ · Rematch-Knopf am Ende-Screen
- iOS: visualViewport, scroll-lock, Safari-Chrome-Tricks, Home-Bildschirm-Hinweis
- Detailliertere Charakter-Sprites (Idle/Walk/Atk/Hurt)
- Höllen-Kampf-Musik (WebAudio Loop) · reichere Special-VFX (Feuer/Eis/Messer)
- Cache: `?v=0.8`


## v0.9 „Seiten, Balance, Disconnect“
- Seite tauschen (P1↔P2) vor dem Kampf
- Disconnect-Banner im Kampf + klarer Retry-Hinweis
- Balance: Special-Chip höher, Toni-Special etwas entschärft, Lola/Nina Tempo
- HUD: SPECIAL!-Callout, bessere Mini-Porträts
- Cache: `?v=0.9`


## v1.0 „Feel“
- 5-Frame Input-Buffer für A/B/C (Touch/Lag-freundlich)
- Light→Special Cancel (Biel/Lola/Nina/Toni)
- Combo-HUD mit DMG + SUPER ab 5 Hits
- Charakterkarten: A/B/C Move-Tips mit Schaden
- Pad-Tippleiste im Kampf
- Cache: `?v=1.0`


## v1.1 „Showtime“
- Win-Posen pro Charakter (sichtbar unter Ende-Vignette)
- Porträt-Canvas auf Charakterkarten
- Neon-Schild „PLAZA“ in der Arena
- Cache: `?v=1.1`


## v1.2 „Release“
- PWA: Manifest, Icons, Service Worker (Home-Bildschirm)
- Tutorial-Screen mit Moves & Block-Regeln
- Feinschliff auf v1.1-Basis
- Cache: `?v=1.2`


## v3.0 „Allein üben“
- Testmodus ohne zweites Handy: Menü → **Allein üben**
- Lokaler Kampf gegen einfache CPU (Dummy-Anteile: Block/Abstand)
- Charakterwahl + Name wie online; Rematch & Menü am Ende
- Online-Versus unverändert
- Cache: `?v=3.0`
