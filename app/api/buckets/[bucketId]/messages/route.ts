import { NextRequest, NextResponse } from "next/server";
import { bucketStore } from "@/lib/store/bucket-store";

export async function GET(
  request: NextRequest,
  { params }: { params: { bucketId: string } }
) {
  try {
    const { bucketId } = params;
    const messages = bucketStore.getMessages(bucketId);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

