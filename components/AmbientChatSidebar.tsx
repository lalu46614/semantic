"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useDragControls } from "framer-motion";
import { ChatArea } from "@/components/ChatArea";
import { MessageListRef } from "@/components/MessageList";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AmbientChatSidebarProps {
  messageListRef: React.RefObject<MessageListRef>;
  onBucketNameChange?: (bucketName: string | null) => void;
}

export function AmbientChatSidebar({ messageListRef, onBucketNameChange }: AmbientChatSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const dragControls = useDragControls();

  // Calculate default position (bottom-right with margins)
  useEffect(() => {
    if (isOpen) {
      const panelWidth = 400;
      const panelHeight = 600;
      const margin = 24;
      const defaultX = window.innerWidth - panelWidth - margin;
      const defaultY = window.innerHeight - panelHeight - margin;
      
      x.set(defaultX);
      y.set(defaultY);
    }
  }, [isOpen, x, y]);

  // Update position on window resize
  useEffect(() => {
    if (!isOpen) return;
    
    const handleResize = () => {
      const panelWidth = 400;
      const panelHeight = 600;
      const margin = 24;
      const maxX = window.innerWidth - panelWidth;
      const maxY = window.innerHeight - panelHeight;
      
      // Constrain current position to new viewport
      const currentX = x.get();
      const currentY = y.get();
      const newX = Math.max(0, Math.min(maxX, currentX));
      const newY = Math.max(0, Math.min(maxY, currentY));
      
      x.set(newX);
      y.set(newY);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, x, y]);

  const handleDrag = () => {
    // Constrain to viewport bounds during drag
    const panelWidth = 400;
    const panelHeight = 600;
    const currentX = x.get();
    const currentY = y.get();
    
    const constrainedX = Math.max(0, Math.min(window.innerWidth - panelWidth, currentX));
    const constrainedY = Math.max(0, Math.min(window.innerHeight - panelHeight, currentY));
    
    if (currentX !== constrainedX) x.set(constrainedX);
    if (currentY !== constrainedY) y.set(constrainedY);
  };

  const handleDragEnd = () => {
    handleDrag();
  };

  return (
    <>
      {/* Floating Chat Button - Always visible when closed */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-40"
          >
            <Button
              onClick={() => setIsOpen(true)}
              size="icon"
              className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 transition-all"
              aria-label="Open chat"
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Chat Panel - Visible when open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            drag
            dragControls={dragControls}
            dragMomentum={false}
            dragElastic={0}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            style={{
              x,
              y,
            }}
            className="fixed z-50 w-[400px] h-[600px] bg-background/95 backdrop-blur-md rounded-lg border shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header with close button - draggable handle */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="flex items-center justify-between p-4 border-b bg-background/50 cursor-move select-none"
            >
              <h2 className="text-lg font-semibold">Chat</h2>
              <Button
                onClick={() => setIsOpen(false)}
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                aria-label="Close chat"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatArea messageListRef={messageListRef} onBucketNameChange={onBucketNameChange} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

