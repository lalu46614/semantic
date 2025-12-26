import { EventEnvelope, EventMetadata, EventType, EventSource, MultimodalEvent } from "@/lib/types";
import { getEventSchemaVersion } from "@/lib/event-schemas";

/**
 * Generates a unique event ID
 */
function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates an event envelope with the given payload and optional metadata
 */
export function createEnvelope<T>(
  payload: T,
  metadata?: Partial<EventMetadata>
): EventEnvelope<T> {
  const eventId = metadata?.eventId || generateEventId();
  const timestamp = metadata?.timestamp || new Date();
  const eventType = metadata?.type || EventType.MESSAGE_USER;
  const version = metadata?.version || getEventSchemaVersion(eventType);

  // Validate required fields
  if (!metadata?.source) {
    throw new Error("EventMetadata.source is required");
  }
  if (!metadata?.type) {
    throw new Error("EventMetadata.type is required");
  }
  if (!metadata?.correlationId) {
    throw new Error("EventMetadata.correlationId is required");
  }

  const fullMetadata: EventMetadata = {
    eventId,
    version,
    timestamp,
    source: metadata.source,
    type: metadata.type,
    correlationId: metadata.correlationId,
    parentEventId: metadata.parentEventId ?? null,
    sessionId: metadata.sessionId ?? null,
    userId: metadata.userId ?? null,
    processingTime: metadata.processingTime ?? null,
    latency: metadata.latency ?? null,
  };

  return {
    metadata: fullMetadata,
    payload,
  };
}

/**
 * Extracts the payload from an event envelope
 */
export function extractPayload<T>(envelope: EventEnvelope<T>): T {
  return envelope.payload;
}

/**
 * Extracts the metadata from an event envelope
 */
export function extractMetadata(envelope: EventEnvelope<any>): EventMetadata {
  return envelope.metadata;
}

/**
 * Links events via parentEventId
 * Note: This is a utility function for setting parentEventId when creating child events
 */
export function correlateEvents(
  parentEnvelope: EventEnvelope<any>,
  childMetadata: Partial<EventMetadata>
): Partial<EventMetadata> {
  return {
    ...childMetadata,
    parentEventId: parentEnvelope.metadata.eventId,
    correlationId: parentEnvelope.metadata.correlationId,
  };
}

/**
 * Creates a multimodal event by fusing multiple input events within a time window
 */
export function createMultimodalEvent(
  events: EventEnvelope<any>[],
  timeWindow: number
): MultimodalEvent {
  if (events.length === 0) {
    throw new Error("Cannot create multimodal event from empty events array");
  }

  // Group events by correlationId (they should all have the same one)
  const correlationId = events[0].metadata.correlationId;
  if (!events.every((e) => e.metadata.correlationId === correlationId)) {
    throw new Error("All events must have the same correlationId to be fused");
  }

  // Find text, voice, and file events
  const textEvent = events.find(
    (e) => e.metadata.type === EventType.MESSAGE_USER && !e.metadata.source.includes("VOICE")
  );
  const voiceEvent = events.find(
    (e) => e.metadata.type === EventType.VOICE_INPUT || e.metadata.source === EventSource.VOICE_CONNECT
  );
  const fileEvents = events.filter((e) => e.metadata.type === EventType.FILE_UPLOAD);

  // Merge payloads (assuming messages have content, fileRefs, etc.)
  const mergedPayload: any = {
    content: textEvent?.payload?.content || voiceEvent?.payload?.content || "",
    fileRefs: [
      ...(textEvent?.payload?.fileRefs || []),
      ...(voiceEvent?.payload?.fileRefs || []),
      ...fileEvents.flatMap((e) => e.payload?.fileRefs || []),
    ],
    isVoice: !!voiceEvent,
  };

  // Create temporal alignment metadata
  const temporalAlignment = {
    textTimestamp: textEvent?.metadata.timestamp,
    voiceTimestamp: voiceEvent?.metadata.timestamp,
    fileTimestamps: fileEvents.map((e) => e.metadata.timestamp),
    timeWindow,
  };

  // Use the earliest timestamp as the base
  const baseEvent = events.reduce((earliest, current) =>
    current.metadata.timestamp < earliest.metadata.timestamp ? current : earliest
  );

  const multimodalMetadata: EventMetadata & {
    temporalAlignment?: {
      textTimestamp?: Date;
      voiceTimestamp?: Date;
      fileTimestamps?: Date[];
      timeWindow: number;
    };
  } = {
    ...baseEvent.metadata,
    type: EventType.MESSAGE_USER,
    temporalAlignment,
  };

  return {
    metadata: multimodalMetadata,
    payload: mergedPayload,
  };
}

/**
 * Validates an envelope structure against a schema
 * Basic validation - can be extended with JSON Schema validation
 */
export function validateEnvelope(
  envelope: EventEnvelope<any>,
  schema?: any
): boolean {
  // Basic structure validation
  if (!envelope.metadata || !envelope.payload) {
    return false;
  }

  const metadata = envelope.metadata;
  if (
    !metadata.eventId ||
    !metadata.version ||
    !metadata.timestamp ||
    !metadata.source ||
    !metadata.type ||
    !metadata.correlationId
  ) {
    return false;
  }

  // If schema provided, validate against it (future enhancement)
  if (schema) {
    // TODO: Implement JSON Schema validation
  }

  return true;
}

