import { NextRequest, NextResponse } from "next/server";
import { bucketStore } from "@/lib/store/bucket-store";
import { Message, EventEnvelope } from "@/lib/types";
import { extractPayload } from "@/lib/event-envelope";

export async function GET(request: NextRequest) {
  try {
    // Check if client wants envelope format
    const acceptHeader = request.headers.get("accept") || "";
    const wantsEnvelope = acceptHeader.includes("application/vnd.envelope+json");

    const buckets = bucketStore.getBuckets();
    
    if (wantsEnvelope) {
      // Return envelopes
      const allEnvelopes: EventEnvelope<Message>[] = [];
      
      for (const bucket of buckets) {
        const envelopes = bucketStore.getEventEnvelopes(bucket.id);
        // Add bucketName to each envelope's payload
        const envelopesWithBucketName = envelopes.map((envelope) => ({
          ...envelope,
          payload: {
            ...envelope.payload,
            bucketName: bucket.name,
          },
        }));
        allEnvelopes.push(...envelopesWithBucketName);
      }

      // Sort envelopes chronologically by timestamp
      allEnvelopes.sort((a, b) => {
        const timeA = a.metadata.timestamp.getTime();
        const timeB = b.metadata.timestamp.getTime();
        return timeA - timeB;
      });

      return NextResponse.json({ envelopes: allEnvelopes });
    } else {
      // Extract payloads for backward compatibility
      const allMessages: Message[] = [];

      // Collect all messages from all buckets
      for (const bucket of buckets) {
        const messages = bucketStore.getMessages(bucket.id);
        // Add bucketName to each message
        const messagesWithBucketName = messages.map((msg) => ({
          ...msg,
          bucketName: bucket.name,
        }));
        allMessages.push(...messagesWithBucketName);
      }

      // Sort messages chronologically by createdAt
      allMessages.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeA - timeB;
      });

      return NextResponse.json({ messages: allMessages });
    }
  } catch (error) {
    console.error("Get all messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

