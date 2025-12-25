"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useVoice } from "@/contexts/VoiceContext";
import { Phone } from "lucide-react";
import { Bucket } from "@/lib/types";
import { useElevenLabsTTS } from "@/hooks/useElevenLabsTTS";
import { prepareForSpeech } from "@/lib/utils";

interface VoiceConnectProps {
  currentBucketName: string | null;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function VoiceConnect({ currentBucketName }: VoiceConnectProps) {
  const {
    isConnected,
    isListening,
    connect,
    disconnect,
    setListening,
    activeBucketId,
    setActiveBucketId,
    markVoiceMessageSent,
    updateTransientCaptions,
    error,
    setError,
  } = useVoice();
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const fullResponseRef = useRef<string>("");
  const audioStartTimeRef = useRef<number | null>(null);
  
  const { 
    sendChunk: sendElevenLabsChunk, 
    resumeAudioContext,
    getTotalDuration,
  } = useElevenLabsTTS({ 
    enabled: isConnected,
    onAudioStart: () => {
      // When audio starts, mark the start time for caption synchronization
      audioStartTimeRef.current = Date.now();
      console.log("[VoiceConnect] Audio playback started");
    },
    onAudioEnd: () => {
      // When audio ends, keep caption visible briefly then clear
      console.log("[VoiceConnect] Audio playback ended");
      setTimeout(() => {
        updateTransientCaptions({ 
          ai: "", 
          user: "",
          aiWords: undefined,
          aiWordTimings: undefined,
          aiStartTime: undefined,
        });
      }, 3000); // Keep visible for 3 seconds after audio ends
    },
  });

  // Fetch buckets to derive bucketId from bucketName
  useEffect(() => {
    const fetchBuckets = async () => {
      try {
        const response = await fetch("/api/buckets");
        const data = await response.json();
        setBuckets(data.buckets || []);
      } catch (error) {
        console.error("Error fetching buckets:", error);
      }
    };
    fetchBuckets();
    const interval = setInterval(fetchBuckets, 2000);
    return () => clearInterval(interval);
  }, []);

  // Update activeBucketId when currentBucketName changes
  useEffect(() => {
    if (currentBucketName && buckets.length > 0) {
      const bucket = buckets.find((b) => b.name === currentBucketName);
      if (bucket) {
        setActiveBucketId(bucket.id);
      }
    } else {
      // If no current bucket, use the most recent bucket or null
      if (buckets.length > 0 && !currentBucketName) {
        // Keep the current activeBucketId or set to most recent
        const sortedBuckets = [...buckets].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        if (sortedBuckets[0] && !activeBucketId) {
          setActiveBucketId(sortedBuckets[0].id);
        }
      } else if (!currentBucketName) {
        setActiveBucketId(null);
      }
    }
  }, [currentBucketName, buckets, setActiveBucketId]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in your browser.");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = "en-US";

    recognitionRef.current.onstart = () => {
      console.log("[SpeechRecognition] Started - listening for speech");
      setListening(true);
      setError(null);
    };

    recognitionRef.current.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      // Log speech recognition results
      if (interimTranscript) {
        console.log("[SpeechRecognition] Interim transcript:", interimTranscript);
      }
      if (finalTranscript) {
        console.log("[SpeechRecognition] Final transcript:", finalTranscript.trim());
      }

      // Update transient captions with user speech
      if (interimTranscript || finalTranscript) {
        updateTransientCaptions({ user: interimTranscript || finalTranscript });
      }

      if (finalTranscript) {
        // Send message when sentence is complete
        const messageToSend = finalTranscript.trim();
        console.log("[VoiceConnect] Sending message:", messageToSend);
        // Keep user caption visible - it will be cleared when response starts
        sendMessage(messageToSend);
        setTranscript(""); // Clear transcript after sending
      } else {
        setTranscript(interimTranscript);
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("[SpeechRecognition] Error:", event.error);
      if (event.error === "no-speech") {
        // Ignore no-speech errors as they're common
        console.log("[SpeechRecognition] No speech detected (this is normal)");
        return;
      } else if (event.error === "not-allowed") {
        const errorMsg = "Microphone access denied. Please allow microphone access.";
        console.error("[SpeechRecognition] Microphone access denied");
        setError(errorMsg);
        disconnect();
      } else if (event.error === "aborted") {
        console.log("[SpeechRecognition] Recognition aborted (may be restarting)");
        // Don't set error for aborted - it's usually intentional
      } else {
        const errorMsg = `Speech recognition error: ${event.error}`;
        console.error("[SpeechRecognition] Error:", errorMsg);
        setError(errorMsg);
      }
    };

    recognitionRef.current.onend = () => {
      console.log("[SpeechRecognition] Ended");
      setListening(false);
      // Restart recognition if still connected
      if (isConnected && recognitionRef.current) {
        try {
          console.log("[SpeechRecognition] Restarting recognition...");
          recognitionRef.current.start();
        } catch (error) {
          console.warn("[SpeechRecognition] Could not restart (may already be starting):", error);
          // Ignore errors if recognition is already starting
        }
      }
    };

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          // Ignore errors on cleanup
        }
      }
    };
  }, [isConnected, setListening, disconnect]);

  // Handle connect/disconnect
  useEffect(() => {
    if (isConnected && recognitionRef.current) {
      // Add a small delay to ensure AudioContext is ready
      const startRecognition = async () => {
        try {
          // Wait a bit for AudioContext to be ready
          await new Promise(resolve => setTimeout(resolve, 300));
          console.log("[VoiceConnect] Starting speech recognition...");
          recognitionRef.current.start();
          console.log("[VoiceConnect] Speech recognition start() called");
        } catch (error: any) {
          console.error("[VoiceConnect] Failed to start recognition:", error);
          if (error.name === "InvalidStateError") {
            // Recognition might already be running, try to restart
            console.log("[VoiceConnect] Recognition may already be running, attempting restart...");
            try {
              recognitionRef.current.stop();
              await new Promise(resolve => setTimeout(resolve, 100));
              recognitionRef.current.start();
            } catch (retryError) {
              console.error("[VoiceConnect] Retry failed:", retryError);
              setError("Failed to start speech recognition. Please try disconnecting and reconnecting.");
            }
          } else {
            setError("Failed to start speech recognition.");
          }
        }
      };
      startRecognition();
    } else if (!isConnected && recognitionRef.current) {
      console.log("[VoiceConnect] Stopping speech recognition...");
      try {
        recognitionRef.current.stop();
        console.log("[VoiceConnect] Speech recognition stopped");
      } catch (error) {
        console.warn("[VoiceConnect] Error stopping recognition (may already be stopped):", error);
        // Ignore errors on stop
      }
      setTranscript("");
      setError(null);
    }
  }, [isConnected]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim()) {
      console.warn("[VoiceConnect] Attempted to send empty message");
      return;
    }
    
    console.log("[VoiceConnect] ===== Starting message send =====");
    console.log("[VoiceConnect] Message:", messageText);
    console.log("[VoiceConnect] Active bucket ID:", activeBucketId);
    
    try {
      const formData = new FormData();
      formData.append("message", messageText);
      formData.append("isVoice", "true");
      if (activeBucketId) {
        formData.append("bucketId", activeBucketId);
      }

      // Mark that a voice message was sent (before API call)
      markVoiceMessageSent();
      console.log("[VoiceConnect] Marked voice message as sent");

      // Use streaming endpoint for voice messages
      console.log("[VoiceConnect] Sending request to /api/chat/stream...");
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        body: formData,
      });

      console.log("[VoiceConnect] Response received, status:", response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Clear AI caption at start, but keep user caption visible
      fullResponseRef.current = "";
      updateTransientCaptions({ 
        ai: "",
        aiWords: undefined,
        aiWordTimings: undefined,
        aiStartTime: undefined,
      });

      // Check Content-Type to determine if it's JSON (clarification) or SSE stream
      const contentType = response.headers.get("Content-Type") || "";
      console.log("[VoiceConnect] Response Content-Type:", contentType);
      
      if (contentType.includes("application/json")) {
        // Handle JSON response (clarification)
        const data = await response.json();
        
        if (data.clarification) {
          // Display clarification to user
          console.log("[VoiceConnect] Received clarification:", data.clarification);
          // Clear user caption when clarification arrives
          updateTransientCaptions({ user: "", ai: data.clarification });
          // Don't send clarification to ElevenLabs TTS
          return;
        } else if (data.error) {
          console.error("[VoiceConnect] Error in response:", data.error);
          setError(`Error: ${data.error}`);
          return;
        }
      }

      // Read SSE stream (Content-Type is text/event-stream)
      console.log("[VoiceConnect] Reading SSE stream...");
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      if (!reader) {
        throw new Error("No response body");
      }

      console.log("[VoiceConnect] Starting to read stream chunks...");
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("[VoiceConnect] Stream reading complete");
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === "chunk" && data.text) {
                fullResponse += data.text;
                fullResponseRef.current = fullResponse;
                console.log("[VoiceConnect] Received chunk:", data.text.substring(0, 50) + "...");
                // Clear user caption when first response chunk arrives
                if (fullResponse === data.text) {
                  updateTransientCaptions({ user: "" });
                }
                // Don't update caption with full text yet - wait for audio timing
                // Just store the text for now
                
                // Forward chunk to ElevenLabs immediately (with cleanup for speech)
                sendElevenLabsChunk(prepareForSpeech(data.text), false);
              } else if (data.type === "done") {
                console.log("[VoiceConnect] Response complete, full length:", fullResponse.length);
                // Send final chunk to ElevenLabs
                if (fullResponse.trim()) {
                  sendElevenLabsChunk("", true); // Trigger generation
                }
                
                // Calculate word timing when response is complete
                // Wait a bit for audio duration to be calculated and audio to start
                const calculateAndSetTimings = () => {
                  const totalDuration = getTotalDuration();
                  const words = splitIntoWords(fullResponse);
                  
                  if (words.length > 0 && totalDuration > 0) {
                    // Calculate timing for each word
                    const wordTimings = calculateWordTimings(words, totalDuration);
                    // Use audio start time if available, otherwise use current time
                    const startTime = audioStartTimeRef.current || Date.now();
                    
                    console.log(`[VoiceConnect] Calculated word timings: ${words.length} words, ${totalDuration.toFixed(2)}s total`);
                    
                    updateTransientCaptions({
                      ai: fullResponse,
                      aiWords: words,
                      aiWordTimings: wordTimings,
                      aiStartTime: startTime,
                    });
                  } else if (words.length > 0) {
                    // If duration not available yet, estimate based on speaking rate
                    // Average speaking rate: ~150 words per minute = 0.4 seconds per word
                    const estimatedDuration = words.length * 0.4;
                    const wordTimings = calculateWordTimings(words, estimatedDuration);
                    const startTime = audioStartTimeRef.current || Date.now();
                    
                    console.log(`[VoiceConnect] Using estimated word timings: ${words.length} words, ${estimatedDuration.toFixed(2)}s estimated`);
                    
                    updateTransientCaptions({
                      ai: fullResponse,
                      aiWords: words,
                      aiWordTimings: wordTimings,
                      aiStartTime: startTime,
                    });
                  } else {
                    // Fallback: show full text if no words
                    updateTransientCaptions({ ai: fullResponse });
                  }
                };
                
                // Try immediately, then retry after a delay if duration not ready
                calculateAndSetTimings();
                setTimeout(calculateAndSetTimings, 1000); // Retry after 1 second
                
                // Clear transient captions after audio finishes (handled by audio end callback)
              } else if (data.type === "error") {
                setError(`Error: ${data.error || "Streaming failed"}`);
              } else if (data.clarification) {
                // Handle clarification request in SSE format (don't speak this)
                updateTransientCaptions({ ai: data.clarification });
                console.log("Clarification needed:", data.clarification);
                // Don't send clarification to ElevenLabs TTS
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("[VoiceConnect] ===== Error sending voice message =====", error);
      setError("Failed to send message. Please try again.");
      // Clear captions on error
      fullResponseRef.current = "";
      updateTransientCaptions({ 
        ai: "", 
        user: "",
        aiWords: undefined,
        aiWordTimings: undefined,
        aiStartTime: undefined,
      });
    }
  };

  const handleConnect = async () => {
    // Resume audio context on user interaction (required for autoplay)
    // This must be called during the user's Connect gesture
    if (typeof window !== "undefined") {
      try {
        await resumeAudioContext();
      } catch (error) {
        console.error("Error resuming audio context:", error);
      }
    }
    connect();
  };

  const handleDisconnect = () => {
    disconnect();
  };

  // When connected, UI is handled by AmbientMode component
  // Only show connect button when not connected
  if (!isConnected) {
    return (
      <Button
        onClick={handleConnect}
        variant="outline"
        className="flex items-center gap-2"
      >
        <Phone className="h-4 w-4" />
        Connect
      </Button>
    );
  }

  // Helper function to split text into words while preserving spaces and punctuation
  const splitIntoWords = (text: string): string[] => {
    // Split by word boundaries but keep spaces and punctuation attached to words
    const words: string[] = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      words.push(match[0]);
    }
    return words;
  };

  // Calculate timing for each word based on total duration
  const calculateWordTimings = (words: string[], totalDuration: number): number[] => {
    if (words.length === 0) return [];
    
    // Calculate average time per word
    const avgTimePerWord = totalDuration / words.length;
    
    // Create timings array - each word gets its share of time
    const timings: number[] = [];
    let cumulativeTime = 0;
    
    for (let i = 0; i < words.length; i++) {
      // Each word gets avgTimePerWord, but we can adjust for word length
      // Longer words might take slightly more time
      const wordLength = words[i].length;
      const baseTime = avgTimePerWord;
      const lengthAdjustment = (wordLength / 5) * 0.1; // Small adjustment based on length
      const wordTime = baseTime + lengthAdjustment;
      
      timings.push(cumulativeTime);
      cumulativeTime += wordTime;
    }
    
    return timings;
  };

  // When connected, the AmbientMode component handles the UI
  return null;
}

