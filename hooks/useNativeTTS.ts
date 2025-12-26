"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseNativeTTSOptions {
  enabled?: boolean;
  onVolumeUpdate?: (volume: number) => void;
  onAudioStart?: () => void;
  onAudioEnd?: () => void;
  onChunkStart?: (duration: number) => void;
  onChunkEnd?: () => void;
}

export function useNativeTTS({
  enabled = true,
  onVolumeUpdate,
  onAudioStart,
  onAudioEnd,
  onChunkStart,
  onChunkEnd,
}: UseNativeTTSOptions = {}) {
  const speechSynthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceQueueRef = useRef<SpeechSynthesisUtterance[]>([]);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentElapsedTime, setCurrentElapsedTime] = useState(0);
  const isProcessingQueueRef = useRef(false);
  const audioStartTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const elapsedTimeFrameRef = useRef<number | null>(null);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      speechSynthRef.current = window.speechSynthesis;
    }
  }, []);

  // Volume tracking simulation (native API doesn't provide real-time volume)
  useEffect(() => {
    if (!onVolumeUpdate) return;

    const updateVolume = () => {
      if (isPlaying) {
        // Simulate volume during playback (you could enhance this with audio analysis if needed)
        onVolumeUpdate(0.5);
      } else {
        onVolumeUpdate(0);
      }
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };

    animationFrameRef.current = requestAnimationFrame(updateVolume);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, onVolumeUpdate]);

  // Elapsed time tracking
  useEffect(() => {
    const updateElapsedTime = () => {
      if (audioStartTimeRef.current) {
        const elapsed = (Date.now() - audioStartTimeRef.current) / 1000;
        setCurrentElapsedTime(Math.max(0, elapsed));
        
        if (isPlaying || utteranceQueueRef.current.length > 0) {
          elapsedTimeFrameRef.current = requestAnimationFrame(updateElapsedTime);
        } else {
          elapsedTimeFrameRef.current = null;
        }
      } else {
        setCurrentElapsedTime(0);
        elapsedTimeFrameRef.current = null;
      }
    };

    if (isPlaying || utteranceQueueRef.current.length > 0) {
      if (elapsedTimeFrameRef.current === null) {
        elapsedTimeFrameRef.current = requestAnimationFrame(updateElapsedTime);
      }
    }

    return () => {
      if (elapsedTimeFrameRef.current) {
        cancelAnimationFrame(elapsedTimeFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Process utterance queue
  const processQueue = useCallback(() => {
    if (isProcessingQueueRef.current || !speechSynthRef.current) return;

    if (utteranceQueueRef.current.length === 0) {
      setIsPlaying(false);
      if (audioStartTimeRef.current) {
        audioStartTimeRef.current = null;
        onAudioEnd?.();
      }
      return;
    }

    isProcessingQueueRef.current = true;
    const utterance = utteranceQueueRef.current.shift()!;
    currentUtteranceRef.current = utterance;

    // Track audio start time
    if (audioStartTimeRef.current === null) {
      audioStartTimeRef.current = Date.now();
      setCurrentElapsedTime(0);
      onAudioStart?.();
    }

    // Estimate duration (approximate: ~150 words per minute = ~4 characters per second)
    const estimatedDuration = utterance.text.length / 4;
    onChunkStart?.(estimatedDuration);

    utterance.onend = () => {
      currentUtteranceRef.current = null;
      onChunkEnd?.();
      isProcessingQueueRef.current = false;
      setIsPlaying(false);
      
      // Process next item in queue
      if (utteranceQueueRef.current.length > 0) {
        setIsPlaying(true);
        processQueue();
      } else {
        // Queue is empty
        if (audioStartTimeRef.current) {
          audioStartTimeRef.current = null;
          setCurrentElapsedTime(0);
          onAudioEnd?.();
        }
      }
    };

    utterance.onerror = (error) => {
      console.error("Native TTS error:", error);
      currentUtteranceRef.current = null;
      isProcessingQueueRef.current = false;
      setIsPlaying(false);
      
      // Continue with next item
      if (utteranceQueueRef.current.length > 0) {
        processQueue();
      } else {
        if (audioStartTimeRef.current) {
          audioStartTimeRef.current = null;
          setCurrentElapsedTime(0);
          onAudioEnd?.();
        }
      }
    };

    setIsPlaying(true);
    speechSynthRef.current.speak(utterance);
  }, [onAudioStart, onAudioEnd, onChunkStart, onChunkEnd]);

  // Send chunk of text to speak
  const sendChunk = useCallback(
    (text: string, isFinal: boolean = false) => {
      if (!speechSynthRef.current || !enabled) {
        return;
      }

      const cleanedText = text.trim();
      if (!cleanedText && !isFinal) {
        return;
      }

      if (cleanedText) {
        const utterance = new SpeechSynthesisUtterance(cleanedText);

        // Use default browser voice or try to find a natural-sounding voice
        const voices = speechSynthRef.current.getVoices();
        const preferredVoice = voices.find(
          (voice) =>
            voice.lang.includes("en") &&
            (voice.name.includes("Natural") ||
              voice.name.includes("Neural") ||
              voice.name.includes("Premium"))
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        } else if (voices.length > 0) {
          utterance.voice = voices.find((v) => v.lang.includes("en")) || voices[0];
        }

        utterance.lang = "en-US";
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utteranceQueueRef.current.push(utterance);
      }

      // If final, process the queue
      if (isFinal || cleanedText) {
        if (!isProcessingQueueRef.current && !isPlaying) {
          processQueue();
        }
      }
    },
    [enabled, isPlaying, processQueue]
  );

  // Interrupt function - disabled (no-op) to prevent stopping TTS playback
  const interrupt = useCallback(() => {
    // No-op: Interruption functionality has been disabled
    // TTS will continue playing even when this function is called
  }, []);

  // Note: Removed interrupt calls from cleanup - TTS will continue playing

  // Get current elapsed time (approximate)
  const getElapsedTime = useCallback(() => {
    if (audioStartTimeRef.current) {
      return (Date.now() - audioStartTimeRef.current) / 1000;
    }
    return 0;
  }, []);

  return {
    isConnected: true, // Native API is always "connected"
    isPlaying,
    sendChunk,
    connect: () => {}, // No-op for native
    disconnect: () => {}, // No-op for native
    interrupt,
    resumeAudioContext: async () => {}, // No-op for native
    getTotalDuration: () => 0, // Not easily calculable for native
    getElapsedTime,
    currentElapsedTime,
  };
}

