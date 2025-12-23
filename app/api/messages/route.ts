import { NextRequest, NextResponse } from "next/server";
import { bucketStore } from "@/lib/store/bucket-store";
import { Message } from "@/lib/types";

export async function GET() {
  try {
    const buckets = bucketStore.getBuckets();
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
  } catch (error) {
    console.error("Get all messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

