const CivAudio = {
  muted: false,
  ctx: null,

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },

  ensure() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  play(name) {
    if (this.muted) return;
    this.ensure();
    switch (name) {
      case 'move': this._tone(220, 0.08, 'square', 0.1); break;
      case 'attack': this._noise(0.15, 0.3); break;
      case 'found': this._melody([262, 330, 392], 0.12, 'sine', 0.15); break;
      case 'tech': this._melody([392, 523, 659], 0.1, 'sine', 0.12); break;
      case 'turn': this._tone(440, 0.12, 'sine', 0.08); break;
      case 'victory': this._melody([523, 587, 659, 784], 0.15, 'sine', 0.2); break;
      case 'city': this._tone(330, 0.1, 'triangle', 0.12); break;
      case 'click': this._tone(660, 0.04, 'square', 0.05); break;
      case 'build': this._melody([262, 349], 0.1, 'triangle', 0.1); break;
    }
  },

  _tone(freq, dur, type, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  },

  _noise(dur, vol) {
    const bufSize = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 2);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
  },

  _melody(notes, noteDur, type, vol) {
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const t = this.ctx.currentTime + i * noteDur * 1.3;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + noteDur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + noteDur);
    });
  },

  toggleMute() {
    this.muted = !this.muted;
    document.getElementById('mute-btn').textContent = this.muted ? 'Sound: OFF' : 'Sound: ON';
    return this.muted;
  }
};
