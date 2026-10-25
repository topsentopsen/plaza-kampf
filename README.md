## v4.0 Tick-Glättung, Praxis-KI, feste Kombis

- Gast ruckelte, weil v3.9 zwischen Paket-Ankunftszeiten interpolierte. Gebündelte Snapshots (ein Frame, mehrere Ticks) sprangen in 1 ms. Die Wiedergabe läuft jetzt mit Sim-Tick (~60 Hz), 50 ms hinter dem neuesten Stand.
- Solo-CPU (`PRAXIS` 0.84) geht härter rein, kontert Sprünge, kombiert im Hitstun und nutzt Specials öfter. Kein Ein-Treffer-Kill.
- Feste Street-Fighter-Kombis, kein Zufalls-Unlock: ↓↘→ + A (Hadoken) und eine zweite Kombi pro Kämpfer. Der Host erkennt sie nur am Input-Strom. Name blinkt auf, plus Schockwelle.

Live: https://topsentopsen.github.io/plaza-kampf/?v=4.0
