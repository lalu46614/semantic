"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChatArea } from "@/components/ChatArea";
import { MessageListRef } from "@/components/MessageList";

interface FloatingChatOverlayProps {
  messageListRef: React.RefObject<MessageListRef>;
  onBucketNameChange?: (bucketName: string | null) => void;
}

export function FloatingChatOverlay({ messageListRef, onBucketNameChange }: FloatingChatOverlayProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none p-4"
      >
        <div className="pointer-events-auto max-w-4xl mx-auto bg-background/95 backdrop-blur-md rounded-lg border shadow-lg">
          <ChatArea messageListRef={messageListRef} onBucketNameChange={onBucketNameChange} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

