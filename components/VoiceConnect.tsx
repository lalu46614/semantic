"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useVoice } from "@/contexts/VoiceContext";
import { Mic, MicOff, X, Phone } from "lucide-react";
import { Bucket } from "@/lib/types";

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
  const { isConnected, isListening, connect, disconnect, setListening, activeBucketId, setActiveBucketId, markVoiceMessageSent } = useVoice();
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);

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

      if (finalTranscript) {
        // Send message when sentence is complete
        sendMessage(finalTranscript.trim());
        setTranscript(""); // Clear transcript after sending
      } else {
        setTranscript(interimTranscript);
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech") {
        // Ignore no-speech errors as they're common
        return;
      } else if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow microphone access.");
        disconnect();
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognitionRef.current.onend = () => {
      setListening(false);
      // Restart recognition if still connected
      if (isConnected && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (error) {
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
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Failed to start recognition:", error);
        setError("Failed to start speech recognition.");
      }
    } else if (!isConnected && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        // Ignore errors on stop
      }
      setTranscript("");
      setError(null);
    }
  }, [isConnected]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim()) return;
    
    try {
      const formData = new FormData();
      formData.append("message", messageText);
      formData.append("isVoice", "true");
      if (activeBucketId) {
        formData.append("bucketId", activeBucketId);
      }

      // Mark that a voice message was sent (before API call)
      markVoiceMessageSent();

      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        setError(`Error: ${data.error}`);
      } else if (data.clarification) {
        // Handle clarification request (don't speak this)
        console.log("Clarification needed:", data.clarification);
      }
    } catch (error) {
      console.error("Error sending voice message:", error);
      setError("Failed to send message. Please try again.");
    }
  };

  const handleConnect = () => {
    connect();
  };

  const handleDisconnect = () => {
    disconnect();
  };

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

  return (
    <>
      {/* Fixed overlay */}
      <div className="fixed top-4 right-4 z-50 w-80 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div
                className={`w-3 h-3 rounded-full ${
                  isListening ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              {/* Pulsing ring animation when listening */}
              {isListening && (
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping opacity-75" />
              )}
            </div>
            <span className="text-sm font-medium">Voice Connected</span>
          </div>
          <Button
            onClick={handleDisconnect}
            variant="ghost"
            size="icon"
            className="h-6 w-6"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Waveform visualization */}
        {isListening && (
          <div className="flex items-center justify-center gap-1 h-8 mb-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-green-500 rounded-full animate-pulse"
                style={{
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: "0.6s",
                  height: `${8 + Math.random() * 16}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Transcript display */}
        <div className="min-h-[60px] max-h-[120px] overflow-y-auto p-3 bg-muted rounded text-sm mb-3">
          {transcript ? (
            <p className="text-foreground">{transcript}</p>
          ) : (
            <p className="text-muted-foreground italic">
              {isListening
                ? "Listening... Speak now"
                : "Starting speech recognition..."}
            </p>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="text-xs text-destructive mb-2 p-2 bg-destructive/10 rounded">
            {error}
          </div>
        )}

        {/* Bucket indicator */}
        {activeBucketId && (
          <div className="text-xs text-muted-foreground">
            Bucket: {currentBucketName || "Auto-selected"}
          </div>
        )}
      </div>
    </>
  );
}

