// Shadow Bell: all sound is WebAudio oscillators, made on the spot — no
// audio files, no network. The first user gesture creates the context
// (browsers block sound before one), and M toggles the mute.
export function createAudio() {
  const audio = {
    context: null,
    muted: false,
    stepCount: 0,
  };

  function ensure() {
    if (!audio.context) {
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        audio.context = new Ctor();
      } catch {
        audio.context = null;
      }
    }
    if (audio.context && audio.context.state === 'suspended') audio.context.resume();
    return audio.context;
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = null) {
    const ctx = ensure();
    if (!ctx || audio.muted) return;
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      audio.muted = !audio.muted;
      return audio.muted;
    },
    get muted() { return audio.muted; },
    footstep(running) {
      // A soft tick, alternating pitch so walking has a rhythm.
      audio.stepCount += 1;
      tone(audio.stepCount % 2 ? 170 : 140, 0.05, 'sine', running ? 0.05 : 0.03);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.12);
      tone(1318, 0.18, 'sine', 0.1, 0.09);
    },
    spotted() {
      // Two clashing notes: the moment a guard is sure it saw you.
      tone(233, 0.22, 'sawtooth', 0.08);
      tone(247, 0.22, 'sawtooth', 0.08, 0.02);
    },
    caught() {
      tone(160, 0.35, 'triangle', 0.14, 0, 70);
    },
    levelClear() {
      [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.22, 'sine', 0.11, i * 0.11));
    },
    win() {
      [523, 659, 784, 1046, 1318, 1568].forEach((freq, i) => tone(freq, 0.3, 'sine', 0.1, i * 0.13));
    },
    gameOver() {
      [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.3, 'triangle', 0.1, i * 0.16));
    },
  };
}
