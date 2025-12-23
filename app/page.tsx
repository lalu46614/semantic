"use client";

import { useState } from "react";
import { BucketSidebar } from "@/components/BucketSidebar";
import { ChatArea } from "@/components/ChatArea";

export default function Home() {
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);

  return (
    <div className="h-screen flex overflow-hidden">
      <BucketSidebar
        selectedBucketId={selectedBucketId}
        onBucketSelect={setSelectedBucketId}
      />
      <div className="flex-1 flex flex-col">
        <header className="border-b p-4">
          <h1 className="text-2xl font-bold">Semantic Bucket Chat</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered conversation routing with semantic bucket isolation
          </p>
        </header>
        <ChatArea 
          bucketId={selectedBucketId} 
          onBucketUpdate={setSelectedBucketId}
        />
      </div>
    </div>
  );
}

