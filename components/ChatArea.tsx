"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageList, MessageListRef } from "@/components/MessageList";
import { FileUpload } from "@/components/FileUpload";
import { ContextHeader } from "@/components/ContextHeader";
import { useVoice } from "@/contexts/VoiceContext";
import { Send, Loader2 } from "lucide-react";

/**
 * Gets or creates a session ID stored in sessionStorage
 */
function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  const existingSessionId = sessionStorage.getItem("sessionId");
  if (existingSessionId) {
    return existingSessionId;
  }
  
  const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem("sessionId", newSessionId);
  return newSessionId;
}

/**
 * Generates a correlation ID for an interaction
 */
function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

interface ChatAreaProps {
  messageListRef?: React.RefObject<MessageListRef>;
  onBucketNameChange?: (bucketName: string | null) => void;
}

export function ChatArea({ messageListRef, onBucketNameChange }: ChatAreaProps) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [currentContext, setCurrentContext] = useState<string | null>(null);
  const internalMessageListRef = useRef<MessageListRef>(null);
  const refToUse = messageListRef || internalMessageListRef;
  const { setActiveBucketId, isConnected, markTextMessageSent, activeBucketId, isAmbientMode } = useVoice();
  const [buckets, setBuckets] = useState<any[]>([]);

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

  const handleContextChange = useCallback((bucketName: string | null) => {
    setCurrentContext(bucketName);
    onBucketNameChange?.(bucketName);
    // Update activeBucketId in VoiceContext when context changes
    if (bucketName && buckets.length > 0) {
      const bucket = buckets.find((b) => b.name === bucketName);
      if (bucket) {
        setActiveBucketId(bucket.id);
      }
    } else if (!bucketName && buckets.length > 0) {
      // If no current bucket, use the most recent bucket
      const sortedBuckets = [...buckets].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      if (sortedBuckets[0]) {
        setActiveBucketId(sortedBuckets[0].id);
      }
    } else {
      setActiveBucketId(null);
    }
  }, [buckets, setActiveBucketId, onBucketNameChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const messageToSend = message;
    const filesToSend = selectedFiles;
    
    // Generate correlationId and get sessionId for this interaction
    const correlationId = generateCorrelationId();
    const sessionId = getOrCreateSessionId();
    
    // Only mark text message sent if NOT in Connect mode (to allow TTS in Connect mode)
    if (!isConnected) {
      markTextMessageSent();
    }
    
    setMessage("");
    setSelectedFiles([]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("message", messageToSend);
      formData.append("correlationId", correlationId);
      formData.append("sessionId", sessionId);
      filesToSend.forEach((file) => {
        formData.append("files", file);
      });

      // In Connect mode, use activeBucketId and streaming endpoint
      // Note: Text messages typed in chat are NOT voice, even in ambient mode
      if (isConnected && activeBucketId) {
        formData.append("bucketId", activeBucketId);
        formData.append("isVoice", "false"); // Text input is never voice

        // Use streaming endpoint for Connect mode
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Check if response is JSON (clarification) or SSE stream
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          // Handle JSON response (clarification)
          const data = await response.json();
          if (data.error) {
            alert(`Error: ${data.error}`);
          }
          // Clarification messages are now saved to the store and will appear in chat automatically
        } else {
          // Read SSE stream
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let fullResponse = "";

          if (!reader) {
            throw new Error("No response body");
          }

          let envelopeMetadata: any = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.type === "start") {
                    // Extract envelope metadata from initial event
                    envelopeMetadata = data.envelope;
                    if (envelopeMetadata) {
                      console.log("[ChatArea] Received envelope metadata:", envelopeMetadata);
                    }
                  } else if (data.type === "chunk" && data.text) {
                    fullResponse += data.text;
                    // Text inputs in ambient mode don't trigger speech responses
                    // Only voice-initiated messages should be spoken
                  } else if (data.type === "done") {
                    // Extract envelope metadata from final event if available
                    if (data.envelope) {
                      envelopeMetadata = data.envelope;
                      console.log("[ChatArea] Response complete with envelope:", envelopeMetadata);
                    }
                    // Message is already saved to bucket history by backend
                  } else if (data.type === "error") {
                    alert(`Error: ${data.error || "Streaming failed"}`);
                  }
                  // Clarification messages are now saved to the store and will appear in chat automatically
                } catch (e) {
                  console.error("Error parsing SSE data:", e);
                }
              }
            }
          }
        }
      } else {
        // Normal mode - use regular endpoint
        // Explicitly mark as non-voice for text messages
        formData.append("isVoice", "false");
        const response = await fetch("/api/chat", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        // Handle envelope response if present
        if (data.envelope) {
          console.log("[ChatArea] Received envelope:", data.envelope);
          // Use envelope metadata for UI updates if needed
          // The response payload is already extracted for backward compatibility
        }

        if (data.error) {
          alert(`Error: ${data.error}`);
        }
        // Clarification messages are now saved to the store and will appear in chat automatically
        // Message is already added to the store, MessageList will update via polling
      }
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ContextHeader bucketName={currentContext} />
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <MessageList 
          ref={refToUse} 
          onCurrentContextChange={handleContextChange}
          filterMode={isAmbientMode ? 'ambient' : 'all'}
        />
      </div>
      <form onSubmit={handleSubmit} className="border-t flex-shrink-0 bg-background">
        <FileUpload bucketId={null} onFilesChange={setSelectedFiles} />
        <div className="p-4 flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message (will auto-create bucket if needed)..."
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button type="submit" disabled={isLoading || !message.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

