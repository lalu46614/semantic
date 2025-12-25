"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useVoice } from "@/contexts/VoiceContext";
import { AmbientSphere } from "@/components/AmbientSphere";
import { TransientCaptions } from "@/components/TransientCaptions";
import { SideCard } from "@/components/SideCard";
import { Button } from "@/components/ui/button";
import { X, AlertCircle } from "lucide-react";
import { FileRef } from "@/lib/types";
import { useElevenLabsTTS } from "@/hooks/useElevenLabsTTS";
import { prepareForSpeech } from "@/lib/utils";

export function AmbientMode() {
  const {
    disconnect,
    transientCaptions,
    sideCards,
    removeSideCard,
    activeBucketId,
    addSideCard,
    error,
  } = useVoice();
  const [volume, setVolume] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Initialize ElevenLabs TTS with volume callback
  const { sendChunk, isConnected: ttsConnected, currentElapsedTime } = useElevenLabsTTS({
    enabled: true,
    onVolumeUpdate: setVolume,
  });

  // Handle file drop
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0 || !activeBucketId) return;

      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("bucketId", activeBucketId);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            const fileRef: FileRef = data.file;
            addSideCard(fileRef);

            // Send verbal acknowledgment via ElevenLabs
            const ackText = "I've added that file to our session. Checking it now...";
            sendChunk(prepareForSpeech(ackText), true);

            // Auto-remove side card after 5 seconds
            setTimeout(() => {
              removeSideCard(fileRef.id);
            }, 5000);
          }
        } catch (error) {
          console.error("Error uploading file:", error);
        }
      }
    },
    [activeBucketId, addSideCard, removeSideCard, sendChunk]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div
      ref={dropZoneRef}
      className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay indicator */}
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500/20 border-4 border-dashed border-blue-400 flex items-center justify-center z-20">
          <div className="text-white text-2xl font-semibold">Drop file here</div>
        </div>
      )}

      {/* Ambient Sphere */}
      <AmbientSphere volume={volume} />

      {/* Side Cards */}
      {sideCards.length > 0 && (
        <div className="absolute top-8 right-8 space-y-4 z-10">
          {sideCards.map((card) => (
            <SideCard key={card.id} fileRef={card} onRemove={removeSideCard} />
          ))}
        </div>
      )}

      {/* Disconnect Button */}
      <div className="absolute top-8 left-8 z-10">
        <Button
          variant="outline"
          size="lg"
          onClick={disconnect}
          className="bg-background/80 backdrop-blur-sm"
        >
          <X className="h-5 w-5 mr-2" />
          Disconnect
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-red-900/90 backdrop-blur-md rounded-lg px-6 py-4 text-white text-sm flex items-center gap-3 shadow-lg border border-red-700">
            <AlertCircle className="h-5 w-5 text-red-300 flex-shrink-0" />
            <div>
              <div className="font-semibold mb-1">Error</div>
              <div>{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Transient Captions */}
      <TransientCaptions
        userText={transientCaptions.user}
        aiText={transientCaptions.ai}
        aiWords={transientCaptions.aiWords}
        aiWordTimings={transientCaptions.aiWordTimings}
        aiStartTime={transientCaptions.aiStartTime}
        audioElapsedTime={currentElapsedTime}
      />
    </div>
  );
}

