"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChatArea } from "@/components/ChatArea";
import { MessageListRef } from "@/components/MessageList";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AmbientChatSidebarProps {
  messageListRef: React.RefObject<MessageListRef>;
  onBucketNameChange?: (bucketName: string | null) => void;
}

export function AmbientChatSidebar({ messageListRef, onBucketNameChange }: AmbientChatSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: isCollapsed ? "calc(100% - 60px)" : 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed top-0 right-0 h-full z-50 pointer-events-none"
    >
      <div className="pointer-events-auto h-full flex items-center">
        {/* Chat Panel */}
        <motion.div
          animate={{ width: isCollapsed ? 0 : 400 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="h-full bg-background/95 backdrop-blur-md border-l shadow-lg overflow-hidden"
        >
          {!isCollapsed && (
            <ChatArea messageListRef={messageListRef} onBucketNameChange={onBucketNameChange} />
          )}
        </motion.div>

        {/* Collapse/Expand Button */}
        <Button
          onClick={() => setIsCollapsed(!isCollapsed)}
          variant="outline"
          size="icon"
          className="rounded-l-lg rounded-r-none h-20 bg-background/95 backdrop-blur-md border-r-0 shadow-lg flex-shrink-0"
        >
          {isCollapsed ? (
            <ChevronLeft className="h-5 w-5" />
          ) : (
            <ChevronRight className="h-5 w-5" />
          )}
        </Button>
      </div>
    </motion.div>
  );
}

