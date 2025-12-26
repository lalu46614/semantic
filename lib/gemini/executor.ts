import { GoogleGenerativeAI } from "@google/generative-ai";
import { FileRef, EventEnvelope, EventSource, EventType } from "@/lib/types";
import { bucketStore } from "@/lib/store/bucket-store";
import { createEnvelope, extractPayload, correlateEvents } from "@/lib/event-envelope";
import fs from "fs";
import path from "path";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function executeMessage(
  userInputOrEnvelope: string | EventEnvelope<{ message: string; bucketId: string; fileRefs?: FileRef[] }>,
  bucketId: string,
  fileRefs?: FileRef[]
): Promise<EventEnvelope<{ response: string }>> {
  // Extract message and envelope metadata
  let userInput: string;
  let parentEnvelope: EventEnvelope<any> | null = null;
  let correlationId: string;
  let parentEventId: string | null = null;
  let sessionId: string | null = null;

  if (typeof userInputOrEnvelope === "string") {
    // Plain string input (backward compatibility)
    userInput = userInputOrEnvelope;
    correlationId = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  } else {
    // Envelope input
    parentEnvelope = userInputOrEnvelope;
    const payload = extractPayload(userInputOrEnvelope);
    userInput = payload.message || payload;
    correlationId = userInputOrEnvelope.metadata.correlationId;
    parentEventId = userInputOrEnvelope.metadata.eventId;
    sessionId = userInputOrEnvelope.metadata.sessionId;
    // Use fileRefs from envelope payload if available
    if (payload.fileRefs) {
      fileRefs = payload.fileRefs;
    }
    if (payload.bucketId) {
      bucketId = payload.bucketId;
    }
  }

  const startTime = Date.now();
  // Use gemini-2.5-flash (or gemini-1.5-flash as fallback via env var)
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: "You are a conversational assistant. Always respond in natural, spoken prose. Never use Markdown formatting such as asterisks, hashtags, bullet points, code blocks, or headers. Write as if you are speaking directly to the user in a natural conversation. Use plain text only - no special formatting characters.",
  });

  // Fetch only messages and files for this bucket (strict isolation)
  const messages = bucketStore.getMessages(bucketId);
  const bucketFiles = bucketStore.getFiles(bucketId);
  
  // Include any fileRefs passed in the current request
  const allFileRefs = fileRefs 
    ? [...bucketFiles, ...fileRefs]
    : bucketFiles;

  // Build conversation history (only from this bucket)
  const conversationHistory = messages.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  // Prepare file parts if any files are attached
  const fileParts: any[] = [];
  
  for (const fileRef of allFileRefs) {
    try {
      const filePath = path.join(process.cwd(), "public", fileRef.path);
      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath);
        const mimeType = getMimeType(fileRef.filename);
        
        fileParts.push({
          inlineData: {
            data: fileData.toString("base64"),
            mimeType: mimeType,
          },
        });
      }
    } catch (error) {
      console.error(`Error reading file ${fileRef.filename}:`, error);
    }
  }

  // Construct the prompt with context
  const contextPrompt = conversationHistory.length > 0
    ? `Previous conversation context:\n${messages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n")}\n\n`
    : "";

  const fullPrompt = `${contextPrompt}User: ${userInput}`;

  try {
    // Prepare content parts
    const contentParts: any[] = [{ text: fullPrompt }];
    contentParts.push(...fileParts);

    const result = await model.generateContent(contentParts);
    const response = result.response;
    const responseText = response.text();
    
    const processingTime = Date.now() - startTime;
    
    // Wrap response in envelope
    const envelopeMetadata = correlateEvents(
      parentEnvelope || createEnvelope({ message: userInput }, {
        source: EventSource.API_ROUTE,
        type: EventType.MESSAGE_USER,
        correlationId,
      }),
      {
        source: EventSource.EXECUTOR,
        type: EventType.MESSAGE_ASSISTANT,
        correlationId,
        parentEventId,
        sessionId,
        processingTime,
      }
    );

    return createEnvelope({ response: responseText }, envelopeMetadata);
  } catch (error) {
    console.error("Executor error:", error);
    throw new Error("Failed to generate response. Please try again.");
  }
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    csv: "text/csv",
  };
  return mimeTypes[ext || ""] || "application/octet-stream";
}

export interface StreamExecutionResult {
  envelope: EventEnvelope<{ response: string }>;
  stream: AsyncGenerator<string, void, unknown>;
}

export async function executeMessageStream(
  userInputOrEnvelope: string | EventEnvelope<{ message: string; bucketId: string; fileRefs?: FileRef[] }>,
  bucketId: string,
  fileRefs?: FileRef[]
): Promise<StreamExecutionResult> {
  // Extract message and envelope metadata
  let userInput: string;
  let parentEnvelope: EventEnvelope<any> | null = null;
  let correlationId: string;
  let parentEventId: string | null = null;
  let sessionId: string | null = null;

  if (typeof userInputOrEnvelope === "string") {
    // Plain string input (backward compatibility)
    userInput = userInputOrEnvelope;
    correlationId = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  } else {
    // Envelope input
    parentEnvelope = userInputOrEnvelope;
    const payload = extractPayload(userInputOrEnvelope);
    userInput = payload.message || payload;
    correlationId = userInputOrEnvelope.metadata.correlationId;
    parentEventId = userInputOrEnvelope.metadata.eventId;
    sessionId = userInputOrEnvelope.metadata.sessionId;
    // Use fileRefs from envelope payload if available
    if (payload.fileRefs) {
      fileRefs = payload.fileRefs;
    }
    if (payload.bucketId) {
      bucketId = payload.bucketId;
    }
  }

  const startTime = Date.now();
  // Use gemini-2.5-flash (or gemini-1.5-flash as fallback via env var)
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: "You are a conversational assistant. Always respond in natural, spoken prose. Never use Markdown formatting such as asterisks, hashtags, bullet points, code blocks, or headers. Write as if you are speaking directly to the user in a natural conversation. Use plain text only - no special formatting characters.",
  });

  // Fetch only messages and files for this bucket (strict isolation)
  const messages = bucketStore.getMessages(bucketId);
  const bucketFiles = bucketStore.getFiles(bucketId);
  
  // Include any fileRefs passed in the current request
  const allFileRefs = fileRefs 
    ? [...bucketFiles, ...fileRefs]
    : bucketFiles;

  // Build conversation history (only from this bucket)
  const conversationHistory = messages.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  // Prepare file parts if any files are attached
  const fileParts: any[] = [];
  
  for (const fileRef of allFileRefs) {
    try {
      const filePath = path.join(process.cwd(), "public", fileRef.path);
      if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath);
        const mimeType = getMimeType(fileRef.filename);
        
        fileParts.push({
          inlineData: {
            data: fileData.toString("base64"),
            mimeType: mimeType,
          },
        });
      }
    } catch (error) {
      console.error(`Error reading file ${fileRef.filename}:`, error);
    }
  }

  // Construct the prompt with context
  const contextPrompt = conversationHistory.length > 0
    ? `Previous conversation context:\n${messages
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n")}\n\n`
    : "";

  const fullPrompt = `${contextPrompt}User: ${userInput}`;

  try {
    // Prepare content parts
    const contentParts: any[] = [{ text: fullPrompt }];
    contentParts.push(...fileParts);

    const stream = await model.generateContentStream(contentParts);
    
    // Create envelope metadata (processingTime will be updated when stream completes)
    const envelopeMetadata = correlateEvents(
      parentEnvelope || createEnvelope({ message: userInput }, {
        source: EventSource.API_ROUTE,
        type: EventType.MESSAGE_USER,
        correlationId,
      }),
      {
        source: EventSource.EXECUTOR,
        type: EventType.MESSAGE_ASSISTANT,
        correlationId,
        parentEventId,
        sessionId,
        processingTime: null, // Will be calculated when stream completes
      }
    );

    // Create envelope with placeholder response (will be updated)
    const envelope = createEnvelope({ response: "" }, envelopeMetadata);

    // Create async generator for chunks
    async function* chunkGenerator(): AsyncGenerator<string, void, unknown> {
      for await (const chunk of stream.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield chunkText;
        }
      }
      // Update processing time when stream completes
      envelope.metadata.processingTime = Date.now() - startTime;
    }

    return {
      envelope,
      stream: chunkGenerator(),
    };
  } catch (error) {
    console.error("Executor streaming error:", error);
    throw new Error("Failed to generate streaming response. Please try again.");
  }
}

