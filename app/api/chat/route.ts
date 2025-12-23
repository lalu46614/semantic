import { NextRequest, NextResponse } from "next/server";
import { routeMessage } from "@/lib/gemini/router";
import { executeMessage } from "@/lib/gemini/executor";
import { bucketStore } from "@/lib/store/bucket-store";
import { FileRef } from "@/lib/types";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const message = formData.get("message") as string;
    const bucketId = formData.get("bucketId") as string | null;
    const files = formData.getAll("files") as File[];

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // CRITICAL: Always call the router for every message, regardless of bucketId
    // The router will analyze intent and can override the selected bucket if it detects a hard pivot
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

    // Add user message to bucket
    bucketStore.addMessage({
      bucketId: targetBucketId,
      content: message,
      role: "user",
      fileRefs,
    });

    // Execute with bucket-isolated context
    const response = await executeMessage(message, targetBucketId, fileRefs);

    // Add assistant response to bucket
    bucketStore.addMessage({
      bucketId: targetBucketId,
      content: response,
      role: "assistant",
      fileRefs: [],
    });

    return NextResponse.json({
      response,
      bucketId: targetBucketId,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

