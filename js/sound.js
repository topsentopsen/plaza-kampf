/* Prozeduraler Plaza/Kampf-Sound (WebAudio, 0 Assets). */
(function (g) {
  'use strict';
  var Plaza = g.Plaza = g.Plaza || {};

  var ctx = null, master = null, sfxBus = null, ambBus = null, mute = false, vol = 0.55;
  var noiseBuf = null, ambNodes = null, musicNodes = null, musicInt = 0;
  var lastHp = [100, 100], lastAtk = [null, null], lastHitSeq = [0, 0];
  var lastPhase = '', lastCd = -1, lastGround = [true, true];

  function ensure() {
    if (ctx) return true;
    try {
      var AC = g.AudioContext || g.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = vol;
      master.connect(ctx.destination);
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4;
      comp.attack.value = 0.003; comp.release.value = 0.12;
      sfxBus = ctx.createGain(); sfxBus.gain.value = 1;
      sfxBus.connect(comp); comp.connect(master);
      ambBus = ctx.createGain(); ambBus.gain.value = 0.18;
      ambBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      try {
        var m = g.localStorage && g.localStorage.getItem('plaza.mute');
        var v = g.localStorage && g.localStorage.getItem('plaza.vol');
        if (m === '1') mute = true;
        if (v != null) { vol = Math.max(0, Math.min(1, parseFloat(v) || 0.55)); master.gain.value = mute ? 0 : vol; }
      } catch (e0) {}
      return true;
    } catch (e) { ctx = null; return false; }
  }

  function resume() {
    if (!ensure()) return;
    try { if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
  }

  function ton(typ, f0, f1, dauer, v, bus) {
    if (!ctx || mute) return;
    try {
      var t = ctx.currentTime, o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = typ || 'square';
      o.frequency.setValueAtTime(Math.max(1, f0), t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dauer);
      gn.gain.setValueAtTime(Math.max(0.0001, v), t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
      o.connect(gn); gn.connect(bus || sfxBus);
      o.start(t); o.stop(t + dauer + 0.03);
    } catch (e) {}
  }

  function rausch(dauer, v, hpHz) {
    if (!ctx || mute || !noiseBuf) return;
    try {
      var t = ctx.currentTime;
      var src = ctx.createBufferSource(); src.buffer = noiseBuf;
      var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hpHz || 2000;
      var gn = ctx.createGain();
      gn.gain.setValueAtTime(Math.max(0.0001, v), t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
      src.connect(f); f.connect(gn); gn.connect(sfxBus);
      src.start(t); src.stop(t + dauer + 0.02);
    } catch (e) {}
  }

  function sfx(name, opts) {
    opts = opts || {};
    if (!ensure() || mute) return;
    resume();
    var pitch = opts.pitch || 1;
    try {
      switch (name) {
        case 'ui': ton('square', 880 * pitch, 1320 * pitch, 0.05, 0.12); break;
        case 'cd': ton('triangle', 440 * pitch, 440 * pitch, 0.12, 0.18); break;
        case 'los':
          ton('square', 220, 220, 0.28, 0.14);
          ton('square', 261.6, 261.6, 0.28, 0.12);
          ton('square', 329.6, 329.6, 0.28, 0.1);
          rausch(0.08, 0.2, 1500);
          break;
        case 'swingL': rausch(0.06, 0.12, 3000); ton('sine', 700 * pitch, 300 * pitch, 0.06, 0.1); break;
        case 'swingH': rausch(0.14, 0.18, 1200); ton('sawtooth', 300 * pitch, 90 * pitch, 0.14, 0.14); break;
        case 'hitL':
          ton('square', 240 * pitch, 80 * pitch, 0.07, 0.2);
          ton('sine', 110 * pitch, 55 * pitch, 0.09, 0.14);
          rausch(0.035, 0.18, 3500);
          break;
        case 'hitH':
          ton('square', 150 * pitch, 35 * pitch, 0.22, 0.24);
          ton('sine', 65, 28, 0.28, 0.28);
          ton('sawtooth', 90, 40, 0.12, 0.1);
          rausch(0.14, 0.28, 600);
          break;
        case 'jump': ton('triangle', 300 * pitch, 600 * pitch, 0.08, 0.1); break;
        case 'land': ton('sine', 120, 60, 0.1, 0.14); rausch(0.05, 0.08, 600); break;
        case 'ko':
          ton('sawtooth', 600, 60, 0.45, 0.18);
          setTimeout(function () { ton('sine', 523, 523, 0.5, 0.16); ton('sine', 1046, 1046, 0.55, 0.1); }, 280);
          break;
        case 'win':
          [330, 370, 415, 494, 587].forEach(function (f, i) {
            setTimeout(function () { ton('triangle', f, f * 1.02, 0.18, 0.14); }, i * 90);
          });
          break;
        case 'special-biel': ton('triangle', 330, 330, 0.25, 0.14); ton('triangle', 495, 495, 0.28, 0.12); break;
        case 'special-lola':
          ton('sine', 659, 659, 0.08, 0.12);
          setTimeout(function () { ton('sine', 784, 784, 0.08, 0.12); }, 50);
          setTimeout(function () { ton('sine', 988, 988, 0.1, 0.12); }, 100);
          rausch(0.12, 0.08, 5000);
          break;
        case 'special-toni': ton('sine', 90, 30, 0.35, 0.24); rausch(0.25, 0.2, 200); break;
        case 'special-rocco': ton('sawtooth', 110, 70, 0.22, 0.18); ton('sine', 80, 40, 0.2, 0.16); break;
        case 'special-nina': ton('sawtooth', 200, 1200, 0.22, 0.12); ton('sine', 1320, 1320, 0.1, 0.1); break;
        case 'block': ton('triangle', 900 * pitch, 400 * pitch, 0.06, 0.12); rausch(0.03, 0.1, 5000); break;
        case 'armor': ton('sine', 520, 260, 0.12, 0.14); ton('triangle', 780, 780, 0.08, 0.1); break;
        default: break;
      }
    } catch (e) {}
  }

  function startAmbient() {
    if (!ensure() || mute || ambNodes) return;
    try {
      // Höllen-Knistern: tiefes Rumble + High-Crackle
      var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280; lp.Q.value = 0.7;
      var g = ctx.createGain(); g.gain.value = 0.05;
      src.connect(lp); lp.connect(g); g.connect(ambBus);
      src.start();
      var src2 = ctx.createBufferSource(); src2.buffer = noiseBuf; src2.loop = true;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 4;
      var g2 = ctx.createGain(); g2.gain.value = 0.025;
      src2.connect(bp); bp.connect(g2); g2.connect(ambBus);
      src2.start();
      ambNodes = { src: src, src2: src2, g: g };
      // ferner Vulkan-Groll
      ambNodes.bell = setInterval(function () {
        if (mute || !ctx) return;
        ton('sine', 55, 40, 0.8, 0.05, ambBus);
        ton('triangle', 90, 60, 0.5, 0.03, ambBus);
      }, 16000);
    } catch (e) {}
  }


  function startMusic(intensity) {
    if (!ensure() || mute) return;
    intensity = intensity == null ? 0.5 : intensity;
    musicInt = intensity;
    if (musicNodes) { setMusicIntensity(intensity); return; }
    try {
      var t0 = ctx.currentTime;
      var g = ctx.createGain(); g.gain.value = 0.045 * intensity;
      g.connect(master);
      var notes = [165, 196, 220, 247, 294, 330]; // düsterer Moll/Phrygisch
      var oscs = [];
      function pulse() {
        if (!musicNodes || mute) return;
        var n = notes[(musicNodes.step | 0) % notes.length];
        musicNodes.step++;
        var o = ctx.createOscillator(), gn = ctx.createGain();
        o.type = musicNodes.step % 4 === 0 ? 'triangle' : 'square';
        o.frequency.value = n * (musicInt > 0.7 ? 1.01 : 1);
        var now = ctx.currentTime;
        gn.gain.setValueAtTime(0.0001, now);
        gn.gain.exponentialRampToValueAtTime(0.08 * musicInt, now + 0.02);
        gn.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        o.connect(gn); gn.connect(g);
        o.start(now); o.stop(now + 0.22);
      }
      musicNodes = { g: g, step: 0, iv: setInterval(pulse, 220) };
      pulse();
    } catch (e) {}
  }

  function setMusicIntensity(v) {
    musicInt = Math.max(0.15, Math.min(1, v));
    if (musicNodes && musicNodes.g) {
      try { musicNodes.g.gain.value = 0.045 * musicInt; } catch (e) {}
    }
  }

  function stopMusic() {
    if (!musicNodes) return;
    try { clearInterval(musicNodes.iv); } catch (e) {}
    try { musicNodes.g.disconnect(); } catch (e) {}
    musicNodes = null;
  }

  function duckMusic(ms) {
    if (!musicNodes || !musicNodes.g) return;
    try {
      var g = musicNodes.g.gain, now = ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0.01, now + 0.03);
      g.linearRampToValueAtTime(0.045 * musicInt, now + (ms || 180) / 1000);
    } catch (e) {}
  }

  function stopAmbient() {
    if (!ambNodes) return;
    try { ambNodes.src.stop(); } catch (e) {}
    try { if (ambNodes.src2) ambNodes.src2.stop(); } catch (e2) {}
    if (ambNodes.bell) clearInterval(ambNodes.bell);
    ambNodes = null;
  }

  function setMute(b) {
    mute = !!b;
    if (master) master.gain.value = mute ? 0 : vol;
    try { if (g.localStorage) g.localStorage.setItem('plaza.mute', mute ? '1' : '0'); } catch (e) {}
    if (mute) { stopAmbient(); stopMusic(); } else { startAmbient(); }
  }

  function toggleMute() { setMute(!mute); return mute; }
  function isMute() { return mute; }

  function resetDiff() {
    lastHp = [999, 999]; lastAtk = [null, null]; lastHitSeq = [0, 0]; lastPhase = ''; lastCd = -1; lastGround = [true, true];
    stopMusic();
  }

  function fromSnap(snap) {
    if (!snap || !snap.p) return;
    if (!ensure()) return;
    try {
      // Countdown
      if (snap.phase === 'countdown' && snap.countdown !== lastCd) {
        if (snap.countdown > 0) sfx('cd');
        else sfx('los');
        lastCd = snap.countdown;
      }
      // Phase ende
      if (snap.phase === 'ende' && lastPhase !== 'ende') {
        sfx('ko');
        setTimeout(function () { sfx('win'); }, 400);
      }
      if (snap.phase === 'kampf' && lastPhase !== 'kampf') startMusic(0.55);
      if (snap.phase === 'ende') stopMusic();
      if (snap.phase === 'kampf' && snap.p) {
        var minHp = Math.min(snap.p[0].hp / (snap.p[0].maxHp || 100), snap.p[1].hp / (snap.p[1].maxHp || 100));
        setMusicIntensity(0.45 + (1 - minHp) * 0.5);
      }
      lastPhase = snap.phase;

      for (var i = 0; i < 2; i++) {
        var p = snap.p[i];
        if (!p) continue;
        var c = Plaza.Chars && Plaza.Chars.finde ? Plaza.Chars.finde(p.charId) : null;
        var pitch = (c && c.sound && c.sound.hitPitch) || 1;

        // Hit via hitSeq (bevorzugt) oder HP-Diff
        var seq = p.hitSeq | 0;
        if (seq > (lastHitSeq[i] | 0)) {
          var kind = p.hitKind || '';
          if (kind === 'block') sfx('block', { pitch: pitch });
          else if (kind === 'armor') sfx('armor', { pitch: pitch });
          else if (kind === 'heavy' || kind === 'throw') { sfx('hitH', { pitch: pitch }); duckMusic(220); }
          else sfx('hitL', { pitch: pitch });
          lastHitSeq[i] = seq;
        } else if (typeof lastHp[i] === 'number' && p.hp < lastHp[i]) {
          var d = lastHp[i] - p.hp;
          sfx(d >= 10 ? 'hitH' : 'hitL', { pitch: pitch });
        }
        lastHp[i] = p.hp;

        // Swing / special
        var art = p.atk && p.atk.art;
        if (art && art !== lastAtk[i]) {
          if (art === 'special') sfx('special-' + p.charId, { pitch: pitch });
          else sfx(art === 'heavy' ? 'swingH' : 'swingL', { pitch: pitch });
        }
        lastAtk[i] = art || null;

        // Land
        if (lastGround[i] === false && p.grounded) sfx('land', { pitch: pitch });
        // Jump approx: left ground
        if (lastGround[i] === true && p.grounded === false && !p.atk) sfx('jump', { pitch: pitch });
        lastGround[i] = !!p.grounded;
      }
    } catch (e) {}
  }

  Plaza.Sound = {
    init: function () { ensure(); resume(); startAmbient(); },
    resume: resume,
    sfx: sfx,
    setMute: setMute,
    toggleMute: toggleMute,
    isMute: isMute,
    fromSnap: fromSnap,
    resetDiff: resetDiff,
    startAmbient: startAmbient,
    stopAmbient: stopAmbient,
    startMusic: startMusic,
    stopMusic: stopMusic,
    setMusicIntensity: setMusicIntensity,
    duckMusic: duckMusic
  };
})(typeof window !== 'undefined' ? window : globalThis);
