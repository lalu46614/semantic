"use client";

import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from "react";
import { Message } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Bot } from "lucide-react";
import { BucketBadge } from "@/components/BucketBadge";
import { SystemDivider } from "@/components/SystemDivider";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

interface MessageListProps {
  onCurrentContextChange?: (bucketName: string | null) => void;
  filterMode?: 'ambient' | 'all';
}

export interface MessageListRef {
  scrollToBucket: (bucketId: string) => void;
}

export const MessageList = forwardRef<MessageListRef, MessageListProps>(
  ({ onCurrentContextChange, filterMode = 'all' }, ref) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

    // Integrate speech synthesis for voice responses
    useSpeechSynthesis({ messages, enabled: true });

    // Filter messages for ambient mode
    const filteredMessages = filterMode === 'ambient' 
      ? messages.filter((msg, index) => {
          if (msg.role === 'user') {
            // Only show typed user messages (not voice)
            return msg.isVoice !== true;
          } else if (msg.role === 'assistant') {
            // Only show AI responses if previous user message was typed
            const prevUserMsg = messages.slice(0, index).reverse().find(m => m.role === 'user');
            return prevUserMsg && prevUserMsg.isVoice !== true;
          }
          return false;
        })
      : messages;

    const fetchMessages = async () => {
      try {
        const response = await fetch("/api/messages");
        const data = await response.json();
        setMessages(data.messages || []);
        
        // Update current context based on most recent message
        if (data.messages && data.messages.length > 0 && onCurrentContextChange) {
          const lastMessage = data.messages[data.messages.length - 1];
          onCurrentContextChange(lastMessage.bucketName || null);
        }
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    useEffect(() => {
      fetchMessages();
      // Poll for updates
      const interval = setInterval(fetchMessages, 1000);
      return () => clearInterval(interval);
    }, [onCurrentContextChange]);

    useEffect(() => {
      // Auto-scroll to bottom when messages change (only if not manually scrolling)
      if (scrollRef.current) {
        // Find the viewport element inside ScrollArea
        const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (viewport) {
          const isNearBottom =
            viewport.scrollHeight - viewport.scrollTop <=
            viewport.clientHeight + 100;
          if (isNearBottom) {
            viewport.scrollTop = viewport.scrollHeight;
          }
        }
      }
    }, [filteredMessages]);

    // Expose scrollToBucket function via ref
    useImperativeHandle(ref, () => ({
      scrollToBucket: (bucketId: string) => {
        // Find first message with matching bucketId in filtered messages
        const firstMessage = filteredMessages.find((msg) => msg.bucketId === bucketId);
        if (firstMessage && scrollRef.current) {
          const messageElement = messageRefs.current.get(firstMessage.id);
          if (messageElement) {
            messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
            // Highlight the message
            setHighlightedMessageId(firstMessage.id);
            setTimeout(() => {
              setHighlightedMessageId(null);
            }, 2000);
          }
        }
      },
    }), [filteredMessages]);

    // Detect bucket switches and prepare dividers
    const renderMessagesWithDividers = () => {
      if (filteredMessages.length === 0) {
        return (
          <div className="text-center text-muted-foreground py-8">
            No messages yet. Start a conversation!
          </div>
        );
      }

      const elements: React.ReactNode[] = [];
      let previousBucketId: string | null = null;

      filteredMessages.forEach((message, index) => {
        // Check if bucket switched (only show divider for assistant messages)
        // We detect the switch when an assistant message has a different bucketId than the previous message
        if (
          message.role === "assistant" &&
          previousBucketId !== null &&
          previousBucketId !== message.bucketId &&
          message.bucketName
        ) {
          elements.push(
            <SystemDivider key={`divider-${message.id}`} bucketName={message.bucketName} />
          );
        }

        // Render the message
        const isHighlighted = highlightedMessageId === message.id;
        elements.push(
          <div
            key={message.id}
            ref={(el) => {
              if (el) {
                messageRefs.current.set(message.id, el);
              } else {
                messageRefs.current.delete(message.id);
              }
            }}
            className={`flex gap-3 transition-colors ${
              message.role === "user" ? "justify-end" : "justify-start"
            } ${isHighlighted ? "bg-yellow-500/10 rounded-lg p-2 -m-2" : ""}`}
          >
            {message.role === "assistant" && (
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {message.role === "assistant" && message.bucketName && (
                <div className="mb-2">
                  <BucketBadge bucketName={message.bucketName} />
                </div>
              )}
              <div className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </div>
              {message.fileRefs && message.fileRefs.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="text-xs opacity-75">Attachments:</div>
                  {message.fileRefs.map((file) => (
                    <div key={file.id} className="text-xs mt-1">
                      📎 {file.filename}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {message.role === "user" && (
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
                  <User className="h-4 w-4 text-secondary-foreground" />
                </div>
              </div>
            )}
          </div>
        );

        // Update previousBucketId for next iteration (track all messages to detect switches)
        previousBucketId = message.bucketId;
      });

      return elements;
    };

    return (
      <div className="absolute inset-0">
        <ScrollArea className="h-full w-full p-4" ref={scrollRef}>
          <div className="space-y-4">{renderMessagesWithDividers()}</div>
        </ScrollArea>
      </div>
    );
  }
);

MessageList.displayName = "MessageList";

