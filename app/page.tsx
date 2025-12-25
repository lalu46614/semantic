"use client";

import { useRef, useState, useEffect } from "react";
import { BucketSidebar } from "@/components/BucketSidebar";
import { ChatArea } from "@/components/ChatArea";
import { MessageListRef } from "@/components/MessageList";
import { VoiceProvider, useVoice } from "@/contexts/VoiceContext";
import { TTSProvider } from "@/contexts/TTSContext";
import { VoiceConnect } from "@/components/VoiceConnect";
import { AmbientMode } from "@/components/AmbientMode";
import { AmbientChatSidebar } from "@/components/AmbientChatSidebar";

function MainContent() {
  const messageListRef = useRef<MessageListRef>(null);
  const [currentBucketName, setCurrentBucketName] = useState<string | null>(null);
  const { isAmbientMode } = useVoice();
  const [showAmbient, setShowAmbient] = useState(false);

  // Handle View Transition when ambient mode changes
  useEffect(() => {
    const transition = () => {
      if (typeof document !== "undefined" && "startViewTransition" in document) {
        (document as any).startViewTransition(() => {
          setShowAmbient(isAmbientMode);
        });
      } else {
        setShowAmbient(isAmbientMode);
      }
    };

    transition();
  }, [isAmbientMode]);

  if (showAmbient) {
    return (
      <>
        <AmbientMode />
        <AmbientChatSidebar 
          messageListRef={messageListRef} 
          onBucketNameChange={setCurrentBucketName} 
        />
      </>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <BucketSidebar messageListRef={messageListRef} />
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
  );
}

export default function Home() {
  return (
    <TTSProvider>
      <VoiceProvider>
        <MainContent />
      </VoiceProvider>
    </TTSProvider>
  );
}

