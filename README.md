# Plaza-Kampf v0.3

Retro-Versus auf der *Plaza del Sol*. Statisches HTML/JS (Finca-Feeling).

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
