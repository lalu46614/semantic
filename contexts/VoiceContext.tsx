"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { FileRef } from "@/lib/types";

interface TransientCaptions {
  user: string;
  ai: string;
}

interface VoiceContextType {
  isConnected: boolean;
  isListening: boolean;
  activeBucketId: string | null;
  lastVoiceMessageTimestamp: number | null;
  isAmbientMode: boolean;
  transientCaptions: TransientCaptions;
  sideCards: FileRef[];
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  setListening: (listening: boolean) => void;
  setActiveBucketId: (bucketId: string | null) => void;
  markVoiceMessageSent: () => void;
  markTextMessageSent: () => void;
  setAmbientMode: (mode: boolean) => void;
  updateTransientCaptions: (captions: Partial<TransientCaptions>) => void;
  addSideCard: (fileRef: FileRef) => void;
  removeSideCard: (fileId: string) => void;
  setError: (error: string | null) => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeBucketId, setActiveBucketId] = useState<string | null>(null);
  const [lastVoiceMessageTimestamp, setLastVoiceMessageTimestamp] = useState<number | null>(null);
  const [isAmbientMode, setIsAmbientMode] = useState(false);
  const [transientCaptions, setTransientCaptions] = useState<TransientCaptions>({ user: "", ai: "" });
  const [sideCards, setSideCards] = useState<FileRef[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Auto-set ambient mode when connected
  useEffect(() => {
    if (isConnected) {
      setIsAmbientMode(true);
    } else {
      setIsAmbientMode(false);
      setTransientCaptions({ user: "", ai: "" });
      setSideCards([]);
    }
  }, [isConnected]);

  const connect = () => {
    setIsConnected(true);
  };

  const disconnect = () => {
    setIsConnected(false);
    setIsListening(false);
    setLastVoiceMessageTimestamp(null);
    setIsAmbientMode(false);
    setTransientCaptions({ user: "", ai: "" });
    setSideCards([]);
    setError(null);
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

  const setAmbientMode = (mode: boolean) => {
    setIsAmbientMode(mode);
  };

  const updateTransientCaptions = (captions: Partial<TransientCaptions>) => {
    setTransientCaptions((prev) => ({ ...prev, ...captions }));
  };

  const addSideCard = (fileRef: FileRef) => {
    setSideCards((prev) => [...prev, fileRef]);
  };

  const removeSideCard = (fileId: string) => {
    setSideCards((prev) => prev.filter((card) => card.id !== fileId));
  };

  return (
    <VoiceContext.Provider
      value={{
        isConnected,
        isListening,
        activeBucketId,
        lastVoiceMessageTimestamp,
        isAmbientMode,
        transientCaptions,
        sideCards,
        error,
        connect,
        disconnect,
        setListening,
        setActiveBucketId,
        markVoiceMessageSent,
        markTextMessageSent,
        setAmbientMode,
        updateTransientCaptions,
        addSideCard,
        removeSideCard,
        setError,
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

