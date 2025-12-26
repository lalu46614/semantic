import { NextRequest, NextResponse } from "next/server";
import { routeMessage } from "@/lib/gemini/router";
import { executeMessage } from "@/lib/gemini/executor";
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
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
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
    // The router will analyze intent and can override the selected bucket if it detects a hard pivot
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
      return NextResponse.json({
        clarification: routingDecision.clarificationQuestion,
      });
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
      return NextResponse.json(
        { error: "Could not determine bucket" },
        { status: 400 }
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

    // Add user message to bucket (store accepts envelopes)
    bucketStore.addMessage(userMessageForStore);

    // Execute with bucket-isolated context (pass envelope)
    const executionEnvelope = createEnvelope(
      { message, bucketId: targetBucketId, fileRefs },
      {
        ...userMessageEnvelope.metadata,
        parentEventId: userMessageEnvelope.metadata.eventId,
      }
    );
    const responseEnvelope = await executeMessage(executionEnvelope, targetBucketId, fileRefs);
    const response = extractPayload(responseEnvelope).response;

    // Create envelope for assistant message
    const assistantMessageForStore = createEnvelope(
      {
        bucketId: targetBucketId,
        content: response,
        role: "assistant" as const,
        fileRefs: [],
      },
      {
        ...responseEnvelope.metadata,
        eventId: responseEnvelope.metadata.eventId,
      }
    );

    // Add assistant response to bucket
    bucketStore.addMessage(assistantMessageForStore);

    // Check if client wants envelope format
    const acceptHeader = request.headers.get("accept") || "";
    const wantsEnvelope = acceptHeader.includes("application/vnd.envelope+json");

    if (wantsEnvelope) {
      return NextResponse.json({
        envelope: responseEnvelope,
        bucketId: targetBucketId,
        isVoice,
      });
    }

    // Extract payload for backward compatibility
    return NextResponse.json({
      response,
      bucketId: targetBucketId,
      isVoice, // Pass through isVoice flag for client-side speech synthesis
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

