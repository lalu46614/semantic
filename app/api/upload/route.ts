import { NextRequest, NextResponse } from "next/server";
import { bucketStore } from "@/lib/store/bucket-store";
import fs from "fs";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const bucketId = formData.get("bucketId") as string;

    if (!file) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      );
    }

    if (!bucketId) {
      return NextResponse.json(
        { error: "Bucket ID is required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;
    const uploadPath = `uploads/${Date.now()}_${filename}`;
    const filePath = path.join(process.cwd(), "public", uploadPath);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save file
    fs.writeFileSync(filePath, buffer);

    // Create file reference
    const fileRef = bucketStore.addFile({
      bucketId,
      filename,
      path: uploadPath,
    });

    return NextResponse.json({ file: fileRef });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

