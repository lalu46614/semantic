import { NextRequest } from "next/server";
import { routeMessage } from "@/lib/gemini/router";
import { executeMessageStream } from "@/lib/gemini/executor";
import { bucketStore } from "@/lib/store/bucket-store";
import { FileRef, EventSource, EventType } from "@/lib/types";
import { createEnvelope, extractPayload } from "@/lib/event-envelope";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const message = formData.get("message") as string;
    const bucketId = formData.get("bucketId") as string | null;
    const isVoice = formData.get("isVoice") === "true";
    const files = formData.getAll("files") as File[];

    // Extract envelope metadata from request
    const correlationId = (formData.get("correlationId") as string) || 
      `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = (formData.get("sessionId") as string) || null;
    const parentEventId = (formData.get("parentEventId") as string) || null;

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Wrap incoming message in envelope
    const userMessageEnvelope = createEnvelope(
      { message, bucketId: bucketId || undefined },
      {
        source: EventSource.API_ROUTE,
        type: isVoice ? EventType.VOICE_INPUT : EventType.MESSAGE_USER,
        correlationId,
        sessionId,
        parentEventId,
      }
    );

    // CRITICAL: Always call the router for every message, regardless of bucketId
    const existingBuckets = bucketStore.getBuckets();
    const routingDecisionEnvelope = await routeMessage(userMessageEnvelope, existingBuckets, bucketId || undefined);
    const routingDecision = extractPayload(routingDecisionEnvelope);

    let targetBucketId: string | null = null;

    if (routingDecision.action === "ROUTE_TO_EXISTING") {
      targetBucketId = routingDecision.bucketId!;
    } else if (routingDecision.action === "CREATE_NEW") {
      const newBucket = bucketStore.createBucket(
        routingDecision.newBucketName || "New Conversation"
      );
      targetBucketId = newBucket.id;
    } else if (routingDecision.action === "CLARIFY") {
      // Determine target bucket for clarification
      // Use provided bucketId, or most recent bucket, or create a temporary one
      if (bucketId) {
        const existingBucket = bucketStore.getBucket(bucketId);
        if (existingBucket) {
          targetBucketId = bucketId;
        }
      }
      
      if (!targetBucketId) {
        const allBuckets = bucketStore.getBuckets();
        if (allBuckets.length > 0) {
          // Use most recent bucket
          targetBucketId = allBuckets[0].id;
        } else {
          // Create a temporary bucket for clarification
          const tempBucket = bucketStore.createBucket("Clarification");
          targetBucketId = tempBucket.id;
        }
      }

      // Handle file uploads if any
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

      // Save user message to bucket
      const userMessageForStore = createEnvelope(
        {
          bucketId: targetBucketId,
          content: message,
          role: "user" as const,
          fileRefs,
          isVoice: isVoice || false,
        },
        {
          ...userMessageEnvelope.metadata,
          eventId: userMessageEnvelope.metadata.eventId,
        }
      );
      bucketStore.addMessage(userMessageForStore);

      // Save clarification as assistant message
      const clarificationMessageForStore = createEnvelope(
        {
          bucketId: targetBucketId,
          content: routingDecision.clarificationQuestion || "Could you clarify what you'd like to discuss?",
          role: "assistant" as const,
          fileRefs: [],
        },
        {
          source: EventSource.ROUTER,
          type: EventType.CLARIFICATION_REQUEST,
          correlationId: userMessageEnvelope.metadata.correlationId,
          sessionId: userMessageEnvelope.metadata.sessionId,
          parentEventId: routingDecisionEnvelope.metadata.eventId,
        }
      );
      bucketStore.addMessage(clarificationMessageForStore);

      return new Response(
        JSON.stringify({ 
          clarification: routingDecision.clarificationQuestion,
          bucketId: targetBucketId,
        }),
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

    // Create envelope for user message with fileRefs
    const userMessageForStore = createEnvelope(
      {
        bucketId: targetBucketId,
        content: message,
        role: "user" as const,
        fileRefs,
        isVoice: isVoice || false,
      },
      {
        ...userMessageEnvelope.metadata,
        eventId: userMessageEnvelope.metadata.eventId,
      }
    );

    // Add user message to bucket
    bucketStore.addMessage(userMessageForStore);

    // Create envelope for execution
    const executionEnvelope = createEnvelope(
      { message, bucketId: targetBucketId, fileRefs },
      {
        ...userMessageEnvelope.metadata,
        parentEventId: userMessageEnvelope.metadata.eventId,
      }
    );

    // Create a ReadableStream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          // Execute with streaming
          const { envelope: responseEnvelope, stream: chunkStream } = await executeMessageStream(
            executionEnvelope,
            targetBucketId,
            fileRefs
          );

          // Send initial metadata with envelope
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: "start", 
              bucketId: targetBucketId,
              envelope: responseEnvelope.metadata 
            })}\n\n`)
          );

          let fullResponse = "";

          // Stream chunks (payload only)
          for await (const chunk of chunkStream) {
            fullResponse += chunk;
            
            // Send chunk to client (payload only)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`)
            );
          }

          // Update envelope with final response
          responseEnvelope.payload.response = fullResponse;
          responseEnvelope.metadata.processingTime = Date.now() - new Date(responseEnvelope.metadata.timestamp).getTime();

          // Create envelope for assistant message
          const assistantMessageForStore = createEnvelope(
            {
              bucketId: targetBucketId,
              content: fullResponse,
              role: "assistant" as const,
              fileRefs: [],
            },
            {
              ...responseEnvelope.metadata,
              eventId: responseEnvelope.metadata.eventId,
            }
          );

          // Add complete assistant response to bucket
          bucketStore.addMessage(assistantMessageForStore);

          // Send completion signal with envelope
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: "done", 
              bucketId: targetBucketId,
              envelope: responseEnvelope.metadata 
            })}\n\n`)
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



