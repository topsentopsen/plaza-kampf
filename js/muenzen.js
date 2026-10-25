/* Münzen v4.2 — pro Sieg, lokal, ohne Shop. */
(function (g) {
  'use strict';
  var Plaza = g.Plaza || (g.Plaza = {});
  var KEY = 'plaza-kampf-muenzen';
  var PRO_SIEG = 10;

  function storeOf(storage) {
    if (storage) return storage;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) {}
    return null;
  }

  function lesen(storage) {
    var s = storeOf(storage);
    if (!s) return 0;
    var raw = '0';
    try { raw = s.getItem(KEY) || '0'; } catch (e) { return 0; }
    var n = parseInt(raw, 10);
    return (n > 0 && n < 10000000) ? n : 0;
  }

  function gutschreiben(betrag, storage) {
    var add = (typeof betrag === 'number' && betrag > 0) ? (betrag | 0) : PRO_SIEG;
    var n = lesen(storage) + add;
    var s = storeOf(storage);
    if (s) {
      try { s.setItem(KEY, String(n)); } catch (e) {}
    }
    return n;
  }

  Plaza.Muenzen = {
    KEY: KEY,
    PRO_SIEG: PRO_SIEG,
    lesen: lesen,
    gutschreiben: gutschreiben
  };
})(typeof window !== 'undefined' ? window : globalThis);
