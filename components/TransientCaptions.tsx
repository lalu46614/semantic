"use client";

import { useEffect, useState, useRef } from "react";

interface TransientCaptionsProps {
  userText: string;
  aiText: string;
  aiWords?: string[];
  aiWordTimings?: number[];
  aiStartTime?: number;
  audioElapsedTime?: number;
}

export function TransientCaptions({ 
  userText, 
  aiText,
  aiWords,
  aiWordTimings,
  aiStartTime,
  audioElapsedTime = 0,
}: TransientCaptionsProps) {
  const [userOpacity, setUserOpacity] = useState(0);
  const [aiOpacity, setAiOpacity] = useState(0);
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  const [useFullText, setUseFullText] = useState(false);
  const userTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wordProgressionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Handle incremental AI text display synchronized with audio
  useEffect(() => {
    if (!aiWords || !aiWordTimings || aiWordTimings.length === 0) {
      // Fallback to full text display if timing data is not available
      if (aiText.trim()) {
        setAiOpacity(1);
        // Show all words if available, otherwise show full text
        setVisibleWordCount(aiWords?.length || 999); // Large number to show all
        if (aiTimeoutRef.current) {
          clearTimeout(aiTimeoutRef.current);
        }
        aiTimeoutRef.current = setTimeout(() => {
          setAiOpacity(0);
        }, 5000);
      } else {
        setAiOpacity(0);
        setVisibleWordCount(0);
      }
      return;
    }

    // Start showing caption when timing data is available
    setAiOpacity(1);

    // Use audio elapsed time (in seconds) passed from parent
    const elapsedSeconds = audioElapsedTime || 0;
    
    // Find how many words should be visible based on timing
    let newVisibleCount = 0;
    for (let i = 0; i < aiWordTimings.length; i++) {
      if (elapsedSeconds >= aiWordTimings[i]) {
        newVisibleCount = i + 1;
      } else {
        break;
      }
    }

    // If elapsed time is 0 or very small, show at least the first word
    if (elapsedSeconds < 0.1 && newVisibleCount === 0 && aiWords.length > 0) {
      newVisibleCount = 1;
    }

    // If elapsed time hasn't progressed much but we have words, gradually show more
    // This handles cases where audio timing isn't syncing properly
    if (elapsedSeconds > 0 && newVisibleCount === 1 && aiWords.length > 1) {
      // Gradually reveal words based on elapsed time, even if timings don't match
      const estimatedWordsPerSecond = 2.5; // Average speaking rate
      const estimatedCount = Math.min(
        Math.floor(elapsedSeconds * estimatedWordsPerSecond) + 1,
        aiWords.length
      );
      newVisibleCount = Math.max(newVisibleCount, estimatedCount);
    }

    // If word count is stuck at 1 for more than 2 seconds, show full text
    if (wordProgressionTimeoutRef.current) {
      clearTimeout(wordProgressionTimeoutRef.current);
    }
    if (newVisibleCount === 1 && aiWords.length > 1 && elapsedSeconds > 2) {
      wordProgressionTimeoutRef.current = setTimeout(() => {
        if (visibleWordCount === 1) {
          setUseFullText(true);
        }
      }, 2000);
    } else if (newVisibleCount > 1) {
      setUseFullText(false);
    }

    // Ensure we don't exceed total word count
    newVisibleCount = Math.min(newVisibleCount, aiWords.length);
    setVisibleWordCount(newVisibleCount);

    return () => {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
      }
      if (wordProgressionTimeoutRef.current) {
        clearTimeout(wordProgressionTimeoutRef.current);
      }
    };
  }, [aiText, aiWords, aiWordTimings, aiStartTime, audioElapsedTime, visibleWordCount]);

  // Handle AI text fade after all words are shown
  useEffect(() => {
    if (aiWords && aiWordTimings && visibleWordCount >= aiWords.length) {
      // All words are visible, start fade timer
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
      }
      aiTimeoutRef.current = setTimeout(() => {
        setAiOpacity(0);
      }, 3000); // Keep visible for 3 seconds after completion
    }

    return () => {
      if (aiTimeoutRef.current) {
        clearTimeout(aiTimeoutRef.current);
      }
    };
  }, [visibleWordCount, aiWords, aiWordTimings]);

  // Build visible AI text from words
  const visibleAiText = (() => {
    // If forced to use full text (word progression stuck), show full text
    if (useFullText && aiText) {
      return aiText;
    }
    
    // If we have word timing data, use word-based display
    if (aiWords && aiWordTimings && aiWords.length > 0) {
      // Always show at least one word, and show more based on visibleWordCount
      const countToShow = Math.max(visibleWordCount, 1);
      const wordsToShow = aiWords.slice(0, countToShow);
      
      // If we're showing all words or most words, just show full text for better UX
      if (countToShow >= aiWords.length * 0.8) {
        return aiText || wordsToShow.join(" ");
      }
      
      return wordsToShow.join(" ");
    }
    // Otherwise, fall back to full text
    return aiText;
  })();

  const hasContent = userText.trim();

  if (!hasContent) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none z-10">
      <div className="max-w-4xl w-full">
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
      </div>
    </div>
  );
}

