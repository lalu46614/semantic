import { Bucket, Message, FileRef, EventEnvelope, EventSource, EventType } from "@/lib/types";
import { createEnvelope, extractPayload } from "@/lib/event-envelope";

class BucketStore {
  private buckets: Map<string, Bucket> = new Map();
  private messages: Map<string, Message[]> = new Map(); // bucketId -> messages (for backward compatibility)
  private eventEnvelopes: Map<string, EventEnvelope<Message>[]> = new Map(); // bucketId -> envelopes
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
    this.eventEnvelopes.set(id, []);
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
    this.eventEnvelopes.delete(id);
    this.files.delete(id);
    return true;
  }

  // Message operations
  getMessages(bucketId: string, returnEnvelopes: boolean = false): Message[] | EventEnvelope<Message>[] {
    if (returnEnvelopes) {
      return this.eventEnvelopes.get(bucketId) || [];
    }
    // Extract payloads for backward compatibility
    const envelopes = this.eventEnvelopes.get(bucketId) || [];
    return envelopes.map(extractPayload);
  }

  /**
   * Adds a message, accepting either an envelope or a plain message (for backward compatibility)
   */
  addMessage(
    messageOrEnvelope: Omit<Message, "id" | "createdAt"> | EventEnvelope<Omit<Message, "id" | "createdAt">>
  ): Message {
    let envelope: EventEnvelope<Message>;
    let message: Message;

    // Check if it's already an envelope
    if ("metadata" in messageOrEnvelope && "payload" in messageOrEnvelope) {
      // It's an envelope
      const payload = messageOrEnvelope.payload as Omit<Message, "id" | "createdAt">;
      const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      message = {
        ...payload,
        id,
        createdAt: new Date(),
      };
      // Create new envelope with the full message as payload
      envelope = createEnvelope(message, {
        ...messageOrEnvelope.metadata,
        eventId: messageOrEnvelope.metadata.eventId,
      });
    } else {
      // It's a plain message - auto-wrap in envelope
      const plainMessage = messageOrEnvelope as Omit<Message, "id" | "createdAt">;
      const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      message = {
        ...plainMessage,
        id,
        createdAt: new Date(),
      };
      
      // Generate correlationId if not provided in envelopeMetadata
      const correlationId = plainMessage.envelopeMetadata?.correlationId || 
        `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      envelope = createEnvelope(message, {
        source: EventSource.API_ROUTE,
        type: message.role === "user" ? EventType.MESSAGE_USER : EventType.MESSAGE_ASSISTANT,
        correlationId,
        sessionId: plainMessage.envelopeMetadata?.sessionId || null,
        parentEventId: plainMessage.envelopeMetadata?.parentEventId || null,
        ...plainMessage.envelopeMetadata,
      });
    }

    // Store envelope
    const bucketEnvelopes = this.eventEnvelopes.get(message.bucketId) || [];
    bucketEnvelopes.push(envelope);
    this.eventEnvelopes.set(message.bucketId, bucketEnvelopes);

    // Also store in messages map for backward compatibility
    const bucketMessages = this.messages.get(message.bucketId) || [];
    bucketMessages.push(message);
    this.messages.set(message.bucketId, bucketMessages);

    // Update bucket timestamp
    const bucket = this.buckets.get(message.bucketId);
    if (bucket) {
      bucket.updatedAt = new Date();
    }

    return message;
  }

  /**
   * Gets event envelopes for a bucket
   */
  getEventEnvelopes(bucketId: string): EventEnvelope<Message>[] {
    return this.eventEnvelopes.get(bucketId) || [];
  }

  /**
   * Gets events by correlation ID across all buckets
   */
  getEventsByCorrelationId(correlationId: string): EventEnvelope<Message>[] {
    const allEnvelopes: EventEnvelope<Message>[] = [];
    for (const envelopes of this.eventEnvelopes.values()) {
      allEnvelopes.push(...envelopes);
    }
    return allEnvelopes.filter((e) => e.metadata.correlationId === correlationId);
  }

  /**
   * Gets events by session ID across all buckets
   */
  getEventsBySessionId(sessionId: string): EventEnvelope<Message>[] {
    const allEnvelopes: EventEnvelope<Message>[] = [];
    for (const envelopes of this.eventEnvelopes.values()) {
      allEnvelopes.push(...envelopes);
    }
    return allEnvelopes.filter((e) => e.metadata.sessionId === sessionId);
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

