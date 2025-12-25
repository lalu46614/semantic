import { NextRequest } from "next/server";
import { routeMessage } from "@/lib/gemini/router";
import { executeMessageStream } from "@/lib/gemini/executor";
import { bucketStore } from "@/lib/store/bucket-store";
import { FileRef } from "@/lib/types";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const message = formData.get("message") as string;
    const bucketId = formData.get("bucketId") as string | null;
    const isVoice = formData.get("isVoice") === "true";
    const files = formData.getAll("files") as File[];

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // CRITICAL: Always call the router for every message, regardless of bucketId
    const existingBuckets = bucketStore.getBuckets();
    const routingDecision = await routeMessage(message, existingBuckets, bucketId || undefined);

    let targetBucketId: string | null = null;

    if (routingDecision.action === "ROUTE_TO_EXISTING") {
      targetBucketId = routingDecision.bucketId!;
    } else if (routingDecision.action === "CREATE_NEW") {
      const newBucket = bucketStore.createBucket(
        routingDecision.newBucketName || "New Conversation"
      );
      targetBucketId = newBucket.id;
    } else if (routingDecision.action === "CLARIFY") {
      return new Response(
        JSON.stringify({ clarification: routingDecision.clarificationQuestion }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle file uploads if any (now that we know the target bucket)
    const fileRefs: FileRef[] = [];
    if (files && files.length > 0 && targetBucketId) {
      for (const file of files) {
        if (file.size > 0) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const filename = file.name;
          const uploadPath = `uploads/${Date.now()}_${filename}`;
          const filePath = `public/${uploadPath}`;
          
          // Save file
          const fullPath = path.join(process.cwd(), filePath);
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(fullPath, buffer);

          const fileRef = bucketStore.addFile({
            bucketId: targetBucketId,
            filename,
            path: uploadPath,
          });
          fileRefs.push(fileRef);
        }
      }
    }

    if (!targetBucketId) {
      return new Response(
        JSON.stringify({ error: "Could not determine bucket" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Add user message to bucket
    bucketStore.addMessage({
      bucketId: targetBucketId,
      content: message,
      role: "user",
      fileRefs,
      isVoice: isVoice || false,
    });

    // Create a ReadableStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          // Send initial metadata
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "start", bucketId: targetBucketId })}\n\n`)
          );

          let fullResponse = "";

          // Stream from Gemini
          for await (const chunk of executeMessageStream(message, targetBucketId, fileRefs)) {
            fullResponse += chunk;
            
            // Send chunk to client
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`)
            );
          }

          // Add complete assistant response to bucket
          bucketStore.addMessage({
            bucketId: targetBucketId,
            content: fullResponse,
            role: "assistant",
            fileRefs: [],
          });

          // Send completion signal
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done", bucketId: targetBucketId })}\n\n`)
          );
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: "Streaming failed" })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat stream API error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}



