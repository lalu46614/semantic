"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export type TTSProvider = "native" | "elevenlabs";

const TTS_PROVIDER_KEY = "tts_provider";

interface TTSContextType {
  ttsProvider: TTSProvider;
  setTTSProvider: (provider: TTSProvider) => void;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

export function TTSProvider({ children }: { children: ReactNode }) {
  const [ttsProvider, setTTSProviderState] = useState<TTSProvider>("native");

  // Load preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(TTS_PROVIDER_KEY);
      if (stored === "native" || stored === "elevenlabs") {
        setTTSProviderState(stored);
      }
    }
  }, []);

  // Save preference to localStorage when it changes
  const setTTSProvider = (provider: TTSProvider) => {
    setTTSProviderState(provider);
    if (typeof window !== "undefined") {
      localStorage.setItem(TTS_PROVIDER_KEY, provider);
    }
  };

  return (
    <TTSContext.Provider
      value={{
        ttsProvider,
        setTTSProvider,
      }}
    >
      {children}
    </TTSContext.Provider>
  );
}

export function useTTS() {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error("useTTS must be used within a TTSProvider");
  }
  return context;
}

