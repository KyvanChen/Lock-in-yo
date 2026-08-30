"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { NoiseEngine, type NoiseId } from "./scenes";
import { useData } from "./store";

interface AmbientContextValue {
  playing: NoiseId | null;
  /** Null stops playback. Selecting the current scene also stops it. */
  setNoise: (id: NoiseId | null) => void;
  volume: number;
  setVolume: (v: number) => void;
}

const AmbientContext = createContext<AmbientContextValue | null>(null);

/**
 * Owns the audio graph at the root so a chosen soundscape keeps playing while
 * you move between the planner and the timer.
 */
export function AmbientProvider({ children }: { children: React.ReactNode }) {
  const { settings, setSettings } = useData();
  const engine = useRef<NoiseEngine | null>(null);
  const [playing, setPlaying] = useState<NoiseId | null>(null);

  useEffect(() => {
    engine.current = new NoiseEngine();
    return () => engine.current?.stop();
  }, []);

  const setNoise = (id: NoiseId | null) => {
    const next = id === playing ? null : id;
    setSettings({ noise: next });
    setPlaying(next);
    if (!engine.current) return;
    if (next) void engine.current.play(next, settings.noise_volume);
    else engine.current.stop();
  };

  const setVolume = (v: number) => {
    setSettings({ noise_volume: v });
    engine.current?.setVolume(v);
  };

  return (
    <AmbientContext.Provider
      value={{ playing, setNoise, volume: settings.noise_volume, setVolume }}
    >
      {children}
    </AmbientContext.Provider>
  );
}

export function useAmbient(): AmbientContextValue {
  const ctx = useContext(AmbientContext);
  if (!ctx) throw new Error("useAmbient must be used inside <AmbientProvider>");
  return ctx;
}
