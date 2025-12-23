import { Bucket, Message, FileRef } from "@/lib/types";

class BucketStore {
  private buckets: Map<string, Bucket> = new Map();
  private messages: Map<string, Message[]> = new Map(); // bucketId -> messages
  private files: Map<string, FileRef[]> = new Map(); // bucketId -> files

  // Bucket operations
  getBuckets(): Bucket[] {
    return Array.from(this.buckets.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  getBucket(id: string): Bucket | undefined {
    return this.buckets.get(id);
  }

  createBucket(name: string): Bucket {
    const id = `bucket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const bucket: Bucket = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
    };
    this.buckets.set(id, bucket);
    this.messages.set(id, []);
    this.files.set(id, []);
    return bucket;
  }

  updateBucket(id: string, name: string): Bucket | null {
    const bucket = this.buckets.get(id);
    if (!bucket) return null;
    bucket.name = name;
    bucket.updatedAt = new Date();
    return bucket;
  }

  deleteBucket(id: string): boolean {
    if (!this.buckets.has(id)) return false;
    this.buckets.delete(id);
    this.messages.delete(id);
    this.files.delete(id);
    return true;
  }

  // Message operations
  getMessages(bucketId: string): Message[] {
    return this.messages.get(bucketId) || [];
  }

  addMessage(message: Omit<Message, "id" | "createdAt">): Message {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullMessage: Message = {
      ...message,
      id,
      createdAt: new Date(),
    };

    const bucketMessages = this.messages.get(message.bucketId) || [];
    bucketMessages.push(fullMessage);
    this.messages.set(message.bucketId, bucketMessages);

    // Update bucket timestamp
    const bucket = this.buckets.get(message.bucketId);
    if (bucket) {
      bucket.updatedAt = new Date();
    }

    return fullMessage;
  }

  // File operations
  getFiles(bucketId: string): FileRef[] {
    return this.files.get(bucketId) || [];
  }

  addFile(file: Omit<FileRef, "id" | "uploadedAt">): FileRef {
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullFile: FileRef = {
      ...file,
      id,
      uploadedAt: new Date(),
    };

    const bucketFiles = this.files.get(file.bucketId) || [];
    bucketFiles.push(fullFile);
    this.files.set(file.bucketId, bucketFiles);

    return fullFile;
  }

  deleteFile(bucketId: string, fileId: string): boolean {
    const bucketFiles = this.files.get(bucketId);
    if (!bucketFiles) return false;
    const index = bucketFiles.findIndex((f) => f.id === fileId);
    if (index === -1) return false;
    bucketFiles.splice(index, 1);
    return true;
  }
}

// Singleton instance
export const bucketStore = new BucketStore();

