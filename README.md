## v4.2 Gast flüssig, Münzen pro Sieg

- Ursache des hakeligen Gasts: der Kampf lief fast immer über öffentliche MQTT-Broker. Die liefern 60-Hz-Snapshots in Klumpen, und v4.1 hat bei leerem 50-ms-Puffer die Figur eingefroren.
- State und Input gehen über einen ungeordneten PeerJS-DataChannel, sobald er steht. MQTT bleibt Lobby und Fallback (dort nur jeder zweite Tick).
- Die Wiedergabe folgt der gemessenen Burst-Lücke (etwa 60–150 ms), Geschwindigkeit nahe 1×, kein vx-Vorlauf. Der lokale Gast wird zum neuesten Stand hin geglättet, der Gegner über den Puffer.
- `?debug=1` zeigt Empfangsrate, Puffertiefe und Hitch-Zähler. Ohne Flag bleibt das unsichtbar.
- Jeder Sieg gibt 10 Münzen, gespeichert in localStorage. Anzeige im Menü, HUD und Endscreen. Kein Shop.

Live: https://topsentopsen.github.io/plaza-kampf/?v=4.2

## v4.1 Einzelframe-Glitches

- Gast: einzelne Frames sprangen, obwohl der Lauf dazwischen glatt war. Ursache war ein harter Playhead-Sprung, sobald ein Snapshot-Burst den Puffer tiefer als 18 Ticks machte, plus vx-Extrapolation über das letzte Snapshot hinaus und Pose/Facing/Angriff schon bei der Intervallmitte. Veraltete Ticks konnten eine Frame lang die alte Position zeigen.
- Wiedergabe bleibt im Sim-Takt (~50 ms hinter dem neuesten Tick). Unterlauf hält die letzte Position. Pose wechselt am Tick-Rand. Out-of-order-Pakete im Kampf werden verworfen; nur der Countdown setzt den Puffer zurück.

Live (v4.1): https://topsentopsen.github.io/plaza-kampf/?v=4.1

## v4.0 Tick-Glättung, Praxis-KI, feste Kombis

- Gast ruckelte, weil v3.9 zwischen Paket-Ankunftszeiten interpolierte. Gebündelte Snapshots (ein Frame, mehrere Ticks) sprangen in 1 ms. Die Wiedergabe läuft jetzt mit Sim-Tick (~60 Hz), 50 ms hinter dem neuesten Stand.
- Solo-CPU (`PRAXIS` 0.84) geht härter rein, kontert Sprünge, kombiert im Hitstun und nutzt Specials öfter. Kein Ein-Treffer-Kill.
- Feste Street-Fighter-Kombis, kein Zufalls-Unlock: ↓↘→ + A (Hadoken) und eine zweite Kombi pro Kämpfer. Der Host erkennt sie nur am Input-Strom. Name blinkt auf, plus Schockwelle.

Live (v4.0): https://topsentopsen.github.io/plaza-kampf/?v=4.0
