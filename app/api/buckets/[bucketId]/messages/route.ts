import { NextRequest, NextResponse } from "next/server";
import { bucketStore } from "@/lib/store/bucket-store";

export async function GET(
  request: NextRequest,
  { params }: { params: { bucketId: string } }
) {
  try {
    const { bucketId } = params;
    const messages = bucketStore.getMessages(bucketId);
    const bucket = bucketStore.getBucket(bucketId);
    
    // Add bucketName to each message
    const messagesWithBucketName = messages.map((msg) => ({
      ...msg,
      bucketName: bucket?.name || "Unknown",
    }));
    
    return NextResponse.json({ messages: messagesWithBucketName });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

