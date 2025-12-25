"use client";

import { useEffect, useRef } from "react";
import { useVoice } from "@/contexts/VoiceContext";
import { Message } from "@/lib/types";
import { prepareForSpeech } from "@/lib/utils";

interface UseSpeechSynthesisOptions {
  messages: Message[];
  enabled?: boolean;
}

export function useSpeechSynthesis({ messages, enabled = true }: UseSpeechSynthesisOptions) {
  const { isConnected, lastVoiceMessageTimestamp } = useVoice();
  const lastSpokenMessageId = useRef<string | null>(null);
  const speechSynthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      speechSynthRef.current = window.speechSynthesis;
    }
  }, []);

  useEffect(() => {
    // Disable TTS during voice mode - VoiceConnect handles it via ElevenLabs
    if (!enabled || isConnected) {
      // Cancel any ongoing speech when disabled or during voice mode
      if (speechSynthRef.current && speechSynthRef.current.speaking) {
        speechSynthRef.current.cancel();
      }
      return;
    }

    // Find the most recent assistant message that hasn't been spoken
    const recentAssistantMessages = messages
      .filter((msg) => msg.role === "assistant")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (recentAssistantMessages.length === 0) {
      return;
    }

    const latestMessage = recentAssistantMessages[0];

    // Skip if we've already spoken this message
    if (lastSpokenMessageId.current === latestMessage.id) {
      return;
    }

    // Only speak if this is a response to a voice-initiated message
    // Check if there was a voice message sent recently (within last 30 seconds)
    // and the assistant message came after it
    if (lastVoiceMessageTimestamp === null) {
      return; // No voice message was sent, don't speak
    }

    const messageTime = new Date(latestMessage.createdAt).getTime();
    const timeSinceVoiceMessage = messageTime - lastVoiceMessageTimestamp;
    
    // Only speak if message came after voice message and within 30 seconds
    if (timeSinceVoiceMessage < 0 || timeSinceVoiceMessage > 30000) {
      return; // Message is too old or came before voice message
    }

    // Use browser TTS (ElevenLabs is handled by VoiceConnect during voice mode)
    if (speechSynthRef.current) {
      // Skip if there's already speech in progress
      if (speechSynthRef.current.speaking) {
        return;
      }

      // Speak the latest assistant message (with cleanup for speech)
      const utterance = new SpeechSynthesisUtterance(prepareForSpeech(latestMessage.content));
      
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

      utterance.onend = () => {
        lastSpokenMessageId.current = latestMessage.id;
      };

      utterance.onerror = (error) => {
        console.error("Speech synthesis error:", error);
        lastSpokenMessageId.current = latestMessage.id; // Mark as processed to avoid retries
      };

      speechSynthRef.current.speak(utterance);
      lastSpokenMessageId.current = latestMessage.id;
    }
  }, [messages, isConnected, enabled, lastVoiceMessageTimestamp]);

  // Cleanup: cancel speech on unmount or when disconnected
  useEffect(() => {
    return () => {
      if (speechSynthRef.current && speechSynthRef.current.speaking) {
        speechSynthRef.current.cancel();
      }
    };
  }, []);

  useEffect(() => {
    // Cancel speech when voice mode connects (VoiceConnect handles TTS during voice mode)
    if (isConnected && speechSynthRef.current && speechSynthRef.current.speaking) {
      speechSynthRef.current.cancel();
      lastSpokenMessageId.current = null; // Reset so we can speak again when voice mode disconnects
    }
  }, [isConnected]);
}

