import { NextRequest, NextResponse } from "next/server";
import { bucketStore } from "@/lib/store/bucket-store";

export async function GET() {
  try {
    const buckets = bucketStore.getBuckets();
    return NextResponse.json({ buckets });
  } catch (error) {
    console.error("Get buckets error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Bucket name is required" },
        { status: 400 }
      );
    }

    const bucket = bucketStore.createBucket(name);
    return NextResponse.json({ bucket });
  } catch (error) {
    console.error("Create bucket error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bucketId = searchParams.get("id");

    if (!bucketId) {
      return NextResponse.json(
        { error: "Bucket ID is required" },
        { status: 400 }
      );
    }

    const deleted = bucketStore.deleteBucket(bucketId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Bucket not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete bucket error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

