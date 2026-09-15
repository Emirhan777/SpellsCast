// Sound for SpellsCast.
//
// Effects are synthesised with Web Audio. Classical recordings are bundled
// locally; their credits and commercial-use licenses are listed in credits.html.
//
// A browser keeps a page silent until someone clicks or presses a key ON THAT
// PAGE. All of this plays on the big screen, but the game is played from the
// phone, so without a click on the big screen itself nothing is ever heard.
// `unlocked` says whether that click has happened, and onChange() lets the page
// show a "click to turn on sound" prompt until it has.

// Where the mute choice is remembered. This used to be "spellscast.muted", but the
// speaker button that wrote it muted the game when it was clicked to turn the
// sound ON, so a stored "muted" from that version is almost always an accident.
// A new key starts everyone unmuted, once.
import { MUSIC_TRACKS, DEFAULT_MUSIC } from "./music.js";

const MUTE_KEY = "spellscast.sound.muted";
const MUSIC_KEY = "spellscast.music.track";
const VOLUME_KEY = "spellscast.music.volume";

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.bgm = null;
    this.musicVolume = 0.35;
    this.musicId = DEFAULT_MUSIC;
    this.musicStatus = "idle";
    this.playRequest = 0;
    this.listeners = [];

    try {
      if (typeof localStorage !== "undefined") {
        this.muted = localStorage.getItem(MUTE_KEY) === "1";
        const track = localStorage.getItem(MUSIC_KEY);
        if (track === "none" || MUSIC_TRACKS.some((t) => t.id === track)) this.musicId = track;
        const volume = localStorage.getItem(VOLUME_KEY);
        if (volume !== null && Number.isFinite(Number(volume))) {
          this.musicVolume = Math.min(1, Math.max(0, Number(volume)));
        }
      }
    } catch {}
    if (!this.musicTrack) this.musicStatus = "off";
  }

  // True once a click or key press on this page has let audio start.
  get unlocked() {
    return !!this.ctx && this.ctx.state === "running";
  }

  // Call `fn` whenever `unlocked` or the mute setting changes.
  onChange(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((f) => f !== fn); };
  }

  notify() {
    for (const fn of this.listeners) { try { fn(); } catch {} }
  }

  get musicTrack() {
    return MUSIC_TRACKS.find((t) => t.id === this.musicId) || null;
  }

  initMusic() {
    if (typeof window === "undefined" || typeof document === "undefined" || this.bgm) return;
    try {
      const el = document.createElement("audio");
      el.id = "bgmPlayer";
      if (this.musicTrack) el.src = this.musicTrack.src;
      el.preload = "none";
      el.loop = true;
      el.playsInline = true;
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.style.position = "fixed";
      el.style.width = "1px";
      el.style.height = "1px";
      el.style.opacity = "0.001";
      el.style.pointerEvents = "none";
      el.style.bottom = "0";
      el.style.left = "0";
      el.volume = this.muted ? 0 : this.musicVolume;
      el.muted = this.muted;
      document.body.appendChild(el);
      this.bgm = el;
      for (const [event, status] of [["playing", "playing"], ["waiting", "loading"], ["error", "error"]]) {
        el.addEventListener(event, () => {
          this.musicStatus = this.musicTrack ? status : "off";
          this.notify();
        });
      }
    } catch {}
  }

  playMusic() {
    if (!this.musicTrack || this.muted) return;
    if (!this.bgm) this.initMusic();
    if (this.bgm?.error) this.bgm.load();
    if (this.bgm && this.bgm.paused) {
      const request = ++this.playRequest;
      this.musicStatus = "loading";
      this.bgm.volume = this.musicVolume;
      this.bgm.muted = false;
      this.bgm.play().catch((error) => {
        if (request !== this.playRequest || error.name === "AbortError") return;
        this.musicStatus = error.name === "NotAllowedError" ? "blocked" : "error";
        this.notify();
      });
      this.notify();
    }
  }

  pauseMusic() {
    this.playRequest++;
    if (this.bgm && !this.bgm.paused) {
      this.bgm.pause();
    }
    this.musicStatus = this.musicTrack ? "paused" : "off";
  }

  setMusicTrack(id) {
    if (id !== "none" && !MUSIC_TRACKS.some((t) => t.id === id)) return false;
    this.pauseMusic();
    this.musicId = id;
    try { localStorage.setItem(MUSIC_KEY, id); } catch {}
    this.initMusic();
    if (this.bgm) {
      if (this.musicTrack) this.bgm.src = this.musicTrack.src;
      else this.bgm.removeAttribute("src");
      this.bgm.load();
    }
    this.musicStatus = this.musicTrack ? "idle" : "off";
    this.playMusic();
    this.notify();
    return true;
  }

  setMusicVolume(value) {
    if (!Number.isFinite(Number(value))) return;
    this.musicVolume = Math.min(1, Math.max(0, Number(value)));
    try { localStorage.setItem(VOLUME_KEY, String(this.musicVolume)); } catch {}
    if (this.bgm) this.bgm.volume = this.musicVolume;
    this.notify();
  }

  init() {
    this.initMusic();
    this.playMusic();
    if (this.ctx) {
      // resume() only succeeds inside a click or key press, and settles later.
      if (this.ctx.state === "suspended") this.ctx.resume().then(() => this.notify(), () => {});
      return;
    }
    const AudioContext = (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) ||
      (typeof globalThis !== "undefined" && globalThis.AudioContext);
    if (!AudioContext) return;

    this.ctx = new AudioContext();
    this.ctx.onstatechange = () => this.notify();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.35;
    this.masterGain.connect(this.ctx.destination);
    this.notify();
  }

  isMuted() {
    return this.muted;
  }

  setMuted(mute) {
    this.muted = !!mute;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {}
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.35, this.ctx.currentTime, 0.05);
    }
    if (this.bgm) {
      this.bgm.muted = this.muted;
    }
    if (this.muted) this.pauseMusic(); else this.playMusic();
    this.notify();
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  ensureContext() {
    if (!this.ctx) this.init();
    else if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx && !this.muted;
  }

  // --- Sound primitives ---

  // White noise buffer for fire, sparks, and whooshes
  noiseBuffer(duration = 0.5) {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Distinct bolt sound per spell
  castBolt(spellId) {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;

    switch (spellId) {
      case "expel": {
        // Crisp, whip-like disarming snap
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }
      case "levitate": {
        // Ethereal rising bell chime
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + i * 0.035);
          gain.gain.setValueAtTime(0.001, now + i * 0.035);
          gain.gain.linearRampToValueAtTime(0.2, now + i * 0.035 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.035 + 0.35);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now + i * 0.035);
          osc.stop(now + i * 0.035 + 0.36);
        });
        break;
      }
      case "banish": {
        // Resonant silver chord and shimmer
        [440, 554.37, 659.25, 880, 1108.7].forEach((freq) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.18, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
          osc.connect(gain);
          gain.connect(this.masterGain);
          osc.start(now);
          osc.stop(now + 0.56);
        });
        break;
      }
      case "shatter": {
        // Electric thunder snap and ominous low boom
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer(0.4);
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(3200, now);
        filter.frequency.exponentialRampToValueAtTime(140, now + 0.35);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start(now);
        noise.stop(now + 0.4);

        // Sub bass drop
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();
        sub.type = "sine";
        sub.frequency.setValueAtTime(110, now);
        sub.frequency.exponentialRampToValueAtTime(35, now + 0.35);
        subGain.gain.setValueAtTime(0.4, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        sub.connect(subGain);
        subGain.connect(this.masterGain);
        sub.start(now);
        sub.stop(now + 0.36);
        break;
      }
      default: {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.16);
      }
    }
  }

  // Defeat audio tailored to the defeat animation mode
  defeat(mode) {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;

    if (mode === "fling") {
      // Wand spinning away clatter
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.25);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.26);
    } else if (mode === "banish") {
      // Wisp retreating shriek / icy whoosh
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.45);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.46);
    } else if (mode === "dissolve") {
      // Poisonous / dark disintegration fizz
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer(0.3);
      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(2200, now);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.3);
    } else if (mode === "incinerate") {
      // Crackling embers burst
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer(0.35);
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.value = 3;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.35);
    } else {
      // Gentle float chime
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  }

  combo(mult) {
    if (!this.ensureContext() || mult <= 1) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    const base = notes[Math.min(mult - 1, notes.length - 1)];

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.14);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  lifeLost() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.35);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.36);
  }

  countdown(step) {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    const freq = step === 0 ? 880 : 587.33;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(step === 0 ? 0.35 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (step === 0 ? 0.35 : 0.15));
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + (step === 0 ? 0.36 : 0.16));
  }

  gameOver() {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    [196, 174.61, 146.83, 110].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.2);
      gain.gain.setValueAtTime(0.3, now + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.6);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.62);
    });
  }
}

export const sound = new SoundEngine();
