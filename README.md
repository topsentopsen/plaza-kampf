## v3.9 Gast-Glättung (Client-Interpolation)

- Ursache hakelig: Host zeichnet lokal 60 Hz, Gast nur Roh-Snapshots (~30 Hz) ohne Zwischenframes.
- Fix: `js/interp.js` lerpt Positionen zwischen Snapshots (+ kurzes vx-Extrapolieren); Host sendet State jeden Sim-Tick (~60 Hz).
- Solo, Pause-Menü und Rückwärtslauf unverändert.

Live: https://topsentopsen.github.io/plaza-kampf/?v=3.9
