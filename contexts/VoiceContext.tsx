"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface VoiceContextType {
  isConnected: boolean;
  isListening: boolean;
  activeBucketId: string | null;
  lastVoiceMessageTimestamp: number | null;
  connect: () => void;
  disconnect: () => void;
  setListening: (listening: boolean) => void;
  setActiveBucketId: (bucketId: string | null) => void;
  markVoiceMessageSent: () => void;
  markTextMessageSent: () => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeBucketId, setActiveBucketId] = useState<string | null>(null);
  const [lastVoiceMessageTimestamp, setLastVoiceMessageTimestamp] = useState<number | null>(null);

  const connect = () => {
    setIsConnected(true);
  };

  const disconnect = () => {
    setIsConnected(false);
    setIsListening(false);
    setLastVoiceMessageTimestamp(null);
  };

  const markVoiceMessageSent = () => {
    setLastVoiceMessageTimestamp(Date.now());
  };

  const markTextMessageSent = () => {
    // Clear voice message timestamp when text message is sent
    // This ensures text replies won't be spoken
    setLastVoiceMessageTimestamp(null);
  };

  const setListening = (listening: boolean) => {
    setIsListening(listening);
  };

  return (
    <VoiceContext.Provider
      value={{
        isConnected,
        isListening,
        activeBucketId,
        lastVoiceMessageTimestamp,
        connect,
        disconnect,
        setListening,
        setActiveBucketId,
        markVoiceMessageSent,
        markTextMessageSent,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error("useVoice must be used within a VoiceProvider");
  }
  return context;
}

