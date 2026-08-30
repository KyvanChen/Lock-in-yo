/**
 * Ambient scenes — something calm and non-narrative to rest your eyes on
 * between lines. Video scenes are public 24/7 live streams; sound scenes are
 * synthesised in the browser, so they need no network and never go offline.
 */
export interface VideoScene {
  id: string;
  name: string;
  note: string;
  /** YouTube video id of a public live stream. */
  youtube: string;
  source: string;
}

export const VIDEO_SCENES: VideoScene[] = [
  {
    id: "jelly",
    name: "Jelly cam",
    note: "Sea nettles drifting in the Open Sea exhibit. Live 7am-7pm Pacific.",
    youtube: "eQ_foBERmzA",
    source: "Monterey Bay Aquarium",
  },
  {
    id: "moon-jelly",
    name: "Moon jellies",
    note: "Translucent bells pulsing on a loop. The calmest thing on the internet.",
    youtube: "zL68biE6wAs",
    source: "Monterey Bay Aquarium",
  },
  {
    id: "iss-4k",
    name: "Earth from orbit",
    note: "4K views from the ISS, 24/7. One orbit is about 90 minutes.",
    youtube: "t8B3ACpcNfc",
    source: "Sen",
  },
  {
    id: "iss-nasa",
    name: "ISS official",
    note: "NASA's own external camera feed, with station-to-ground audio.",
    youtube: "jKHvbJe9c_Y",
    source: "NASA",
  },
];

export type NoiseId = "brown" | "rain" | "cabin";

export interface NoiseScene {
  id: NoiseId;
  name: string;
  note: string;
}

export const NOISE_SCENES: NoiseScene[] = [
  {
    id: "brown",
    name: "Brown noise",
    note: "Low, flat, and even. Masks conversation without the hiss of white noise.",
  },
  {
    id: "rain",
    name: "Rain",
    note: "Steady rainfall, no thunder. Nothing in it asks for your attention.",
  },
  {
    id: "cabin",
    name: "Cabin",
    note: "The low roar of a cruising aircraft. Pairs with a flight.",
  },
];

/**
 * A small synthesised noise engine. All three scenes are shaped from the same
 * brown-noise source, which keeps the graph cheap and the sound seamless.
 */
export class NoiseEngine {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  current: NoiseId | null = null;

  private buildBuffer(ctx: AudioContext): AudioBuffer {
    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      // Leaky integrator: turns flat white noise into 1/f-ish brown noise.
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    // Cross-fade the seam so the four-second loop is inaudible.
    const fade = Math.floor(ctx.sampleRate * 0.25);
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      data[i] = data[i] * t + data[data.length - fade + i] * (1 - t);
    }
    return buffer;
  }

  async play(id: NoiseId, volume: number) {
    this.stop();
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    await ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = this.buildBuffer(ctx);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    gain.gain.value = 0;

    if (id === "brown") {
      filter.type = "lowpass";
      filter.frequency.value = 1000;
    } else if (id === "rain") {
      filter.type = "highpass";
      filter.frequency.value = 900;
      filter.Q.value = 0.6;
    } else {
      // Cabin: almost everything above a few hundred hertz rolled off, plus a
      // slow sway so it breathes like a real engine.
      filter.type = "lowpass";
      filter.frequency.value = 320;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.08;
      lfoGain.gain.value = 60;
      lfo.connect(lfoGain).connect(filter.frequency);
      lfo.start();
      this.lfo = lfo;
    }

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.8);

    this.ctx = ctx;
    this.source = source;
    this.filter = filter;
    this.gain = gain;
    this.current = id;
  }

  setVolume(v: number) {
    if (this.gain && this.ctx) {
      this.gain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.15);
    }
  }

  stop() {
    try {
      this.lfo?.stop();
      this.source?.stop();
      void this.ctx?.close();
    } catch {
      /* already torn down */
    }
    this.ctx = null;
    this.source = null;
    this.filter = null;
    this.gain = null;
    this.lfo = null;
    this.current = null;
  }
}
