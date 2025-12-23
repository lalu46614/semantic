"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageList } from "@/components/MessageList";
import { FileUpload } from "@/components/FileUpload";
import { Send, Loader2 } from "lucide-react";

interface ChatAreaProps {
  bucketId: string | null;
  onBucketUpdate?: (bucketId: string) => void;
}

export function ChatArea({ bucketId, onBucketUpdate }: ChatAreaProps) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const messageToSend = message;
    const filesToSend = selectedFiles;
    
    setMessage("");
    setSelectedFiles([]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("message", messageToSend);
      // bucketId is optional - router will determine the target bucket
      if (bucketId) {
        formData.append("bucketId", bucketId);
      }
      filesToSend.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.clarification) {
        // Handle clarification request
        alert(data.clarification);
      } else if (data.error) {
        alert(`Error: ${data.error}`);
      } else if (data.bucketId && data.bucketId !== bucketId) {
        // Router created a new bucket or switched to a different one
        // Update the selected bucket in the parent component
        if (onBucketUpdate) {
          onBucketUpdate(data.bucketId);
        }
      }
      // Message is already added to the store, MessageList will update via polling
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <MessageList bucketId={bucketId} />
      <form onSubmit={handleSubmit} className="border-t">
        <FileUpload bucketId={bucketId} onFilesChange={setSelectedFiles} />
        <div className="p-4 flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={bucketId ? "Type your message..." : "Type your message (will auto-create bucket if needed)..."}
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

