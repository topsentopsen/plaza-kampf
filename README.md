# Plaza-Kampf v0.6

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

`js/{palette,chars,kampf,netz,sound,render,ui,main}.js` · Tests: `node tests/kampf.test.js`

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
