import { NextRequest, NextResponse } from "next/server";
import { bucketStore } from "@/lib/store/bucket-store";
import { EventEnvelope, Message } from "@/lib/types";
import { extractPayload } from "@/lib/event-envelope";

export async function GET(
  request: NextRequest,
  { params }: { params: { bucketId: string } }
) {
  try {
    const { bucketId } = params;
    const bucket = bucketStore.getBucket(bucketId);
    
    // Check if client wants envelope format
    const acceptHeader = request.headers.get("accept") || "";
    const wantsEnvelope = acceptHeader.includes("application/vnd.envelope+json");

    if (wantsEnvelope) {
      // Return envelopes
      const envelopes = bucketStore.getEventEnvelopes(bucketId);
      // Add bucketName to each envelope's payload
      const envelopesWithBucketName = envelopes.map((envelope) => ({
        ...envelope,
        payload: {
          ...envelope.payload,
          bucketName: bucket?.name || "Unknown",
        },
      }));
      
      return NextResponse.json({ envelopes: envelopesWithBucketName });
    } else {
      // Extract payloads for backward compatibility
      const messages = bucketStore.getMessages(bucketId);
      
      // Add bucketName to each message
      const messagesWithBucketName = messages.map((msg) => ({
        ...msg,
        bucketName: bucket?.name || "Unknown",
      }));
      
      return NextResponse.json({ messages: messagesWithBucketName });
    }
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

