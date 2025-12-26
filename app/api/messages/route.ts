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
      // Extract payloads for backward compatibility, but include envelopeMetadata
      const allMessages: Message[] = [];

      // Collect all messages from all buckets
      for (const bucket of buckets) {
        // Get envelopes to access metadata
        const envelopes = bucketStore.getEventEnvelopes(bucket.id);
        // Extract payloads and include envelopeMetadata
        const messagesWithMetadata = envelopes.map((envelope) => {
          const message = extractPayload(envelope);
          return {
            ...message,
            bucketName: bucket.name,
            envelopeMetadata: {
              type: envelope.metadata.type,
              source: envelope.metadata.source,
              eventId: envelope.metadata.eventId,
              correlationId: envelope.metadata.correlationId,
              sessionId: envelope.metadata.sessionId,
              parentEventId: envelope.metadata.parentEventId,
              timestamp: envelope.metadata.timestamp,
            },
          };
        });
        allMessages.push(...messagesWithMetadata);
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

