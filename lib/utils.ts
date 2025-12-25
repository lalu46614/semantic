import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Prepares text for text-to-speech by removing Markdown formatting,
 * converting symbols to words, and normalizing whitespace.
 * 
 * @param text - The text to prepare for speech
 * @returns Clean text ready for TTS
 */
export function prepareForSpeech(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // Remove code blocks (```code``` or `code`)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
  cleaned = cleaned.replace(/`[^`]*`/g, "");

  // Remove Markdown links [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");

  // Remove Markdown images ![alt](url)
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^\)]+\)/g, "");

  // Remove headers (# Header -> Header)
  cleaned = cleaned.replace(/^#{1,6}\s+(.+)$/gm, "$1");

  // Remove bold (**text** or __text__) -> text
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  cleaned = cleaned.replace(/__([^_]+)__/g, "$1");

  // Remove italic (*text* or _text_) -> text
  cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");
  cleaned = cleaned.replace(/_([^_]+)_/g, "$1");

  // Remove strikethrough (~~text~~)
  cleaned = cleaned.replace(/~~([^~]+)~~/g, "$1");

  // Remove list markers (-, *, +, 1., 2., etc.)
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, "");
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, "");

  // Remove blockquotes (> text)
  cleaned = cleaned.replace(/^>\s+/gm, "");

  // Remove horizontal rules (---, ***)
  cleaned = cleaned.replace(/^[-*]{3,}$/gm, "");

  // Convert symbols to words (with context awareness)
  // % -> percent (but preserve if part of number like 50%)
  cleaned = cleaned.replace(/(\d+)%/g, "$1 percent");
  cleaned = cleaned.replace(/%/g, "percent");

  // & -> and (but preserve HTML entities if any remain)
  cleaned = cleaned.replace(/&/g, " and ");

  // @ -> at
  cleaned = cleaned.replace(/@/g, " at ");

  // # -> number or hashtag (if standalone)
  cleaned = cleaned.replace(/#(\d+)/g, "number $1");
  cleaned = cleaned.replace(/#([a-zA-Z]+)/g, "hashtag $1");
  cleaned = cleaned.replace(/#/g, "number");

  // $ -> dollars (if followed by number, otherwise just remove)
  cleaned = cleaned.replace(/\$(\d+(?:\.\d+)?)/g, "$1 dollars");
  cleaned = cleaned.replace(/\$/g, "dollars");

  // + -> plus
  cleaned = cleaned.replace(/\+/g, " plus ");

  // = -> equals
  cleaned = cleaned.replace(/=/g, " equals ");

  // < -> less than
  cleaned = cleaned.replace(/</g, " less than ");

  // > -> greater than
  cleaned = cleaned.replace(/>/g, " greater than ");

  // Remove any remaining asterisks (from incomplete Markdown)
  cleaned = cleaned.replace(/\*/g, "");

  // Normalize whitespace: collapse multiple spaces/newlines to single space
  cleaned = cleaned.replace(/\s+/g, " ");

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

