import { GoogleGenerativeAI } from "@google/generative-ai";
import { FileRef } from "@/lib/types";
import { bucketStore } from "@/lib/store/bucket-store";
import fs from "fs";
import path from "path";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function executeMessage(
  userInput: string,
  bucketId: string,
  fileRefs?: FileRef[]
): Promise<string> {
  // Use gemini-2.5-flash (or gemini-1.5-flash as fallback via env var)
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({
    model: modelName,
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
    return response.text();
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

