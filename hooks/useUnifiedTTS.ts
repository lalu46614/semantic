"use client";

import { useElevenLabsTTS } from "./useElevenLabsTTS";
import { useNativeTTS } from "./useNativeTTS";
import { useTTS } from "@/contexts/TTSContext";

interface UseUnifiedTTSOptions {
  enabled?: boolean;
  onVolumeUpdate?: (volume: number) => void;
  onAudioStart?: () => void;
  onAudioEnd?: () => void;
  onChunkStart?: (duration: number) => void;
  onChunkEnd?: () => void;
}

export function useUnifiedTTS(options: UseUnifiedTTSOptions = {}) {
  const { ttsProvider } = useTTS();

  const elevenLabsTTS = useElevenLabsTTS({
    ...options,
    enabled: options.enabled && ttsProvider === "elevenlabs",
  });

  const nativeTTS = useNativeTTS({
    ...options,
    enabled: options.enabled && ttsProvider === "native",
  });

  // Return the appropriate TTS implementation based on provider
  return ttsProvider === "elevenlabs" ? elevenLabsTTS : nativeTTS;
}

