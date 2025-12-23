"use client";

import { useRef, useState } from "react";
import { BucketSidebar } from "@/components/BucketSidebar";
import { ChatArea } from "@/components/ChatArea";
import { MessageListRef } from "@/components/MessageList";
import { VoiceProvider } from "@/contexts/VoiceContext";
import { VoiceConnect } from "@/components/VoiceConnect";

export default function Home() {
  const messageListRef = useRef<MessageListRef>(null);
  const [currentBucketName, setCurrentBucketName] = useState<string | null>(null);

  return (
    <VoiceProvider>
      <div className="h-screen flex overflow-hidden">
        <BucketSidebar
          messageListRef={messageListRef}
        />
        <div className="flex-1 flex flex-col">
          <header className="border-b p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Semantic Bucket Chat</h1>
                <p className="text-sm text-muted-foreground">
                  AI-powered conversation routing with semantic bucket isolation
                </p>
              </div>
              <VoiceConnect currentBucketName={currentBucketName} />
            </div>
          </header>
          <ChatArea messageListRef={messageListRef} onBucketNameChange={setCurrentBucketName} />
        </div>
      </div>
    </VoiceProvider>
  );
}

