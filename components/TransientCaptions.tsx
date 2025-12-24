"use client";

import { useEffect, useState, useRef } from "react";

interface TransientCaptionsProps {
  userText: string;
  aiText: string;
}

export function TransientCaptions({ userText, aiText }: TransientCaptionsProps) {
  const [userOpacity, setUserOpacity] = useState(0);
  const [aiOpacity, setAiOpacity] = useState(0);
  const userTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle user text fade
  useEffect(() => {
    if (userText.trim()) {
      setUserOpacity(1);
      if (userTimeoutRef.current) {
        clearTimeout(userTimeoutRef.current);
      }
      userTimeoutRef.current = setTimeout(() => {
        setUserOpacity(0);
      }, 3000);
    } else {
      setUserOpacity(0);
    }

    return () => {
      if (userTimeoutRef.current) {
        clearTimeout(userTimeoutRef.current);
      }
    };
  }, [userText]);

  // Handle AI text fade
  useEffect(() => {
    if (aiText.trim()) {
      setAiOpacity(1);
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
      }
      aiTimeoutRef.current = setTimeout(() => {
        setAiOpacity(0);
      }, 5000);
    } else {
      setAiOpacity(0);
    }

    return () => {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
      }
    };
  }, [aiText]);

  const hasContent = userText.trim() || aiText.trim();

  if (!hasContent) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 p-8 pointer-events-none z-10">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* User speech caption */}
        {userText.trim() && (
          <div
            className="bg-black/60 backdrop-blur-md rounded-lg px-6 py-4 text-white text-lg transition-opacity duration-500"
            style={{ opacity: userOpacity }}
          >
            <div className="text-xs text-gray-400 mb-1">You</div>
            <div>{userText}</div>
          </div>
        )}

        {/* AI response caption */}
        {aiText.trim() && (
          <div
            className="bg-blue-900/60 backdrop-blur-md rounded-lg px-6 py-4 text-white text-lg transition-opacity duration-500"
            style={{ opacity: aiOpacity }}
          >
            <div className="text-xs text-blue-300 mb-1">Assistant</div>
            <div>{aiText}</div>
          </div>
        )}
      </div>
    </div>
  );
}

