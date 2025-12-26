import { EventType, EventEnvelope, EventMetadata } from "@/lib/types";

/**
 * Schema versions for each event type
 */
const SCHEMA_VERSIONS: Record<EventType, string> = {
  [EventType.MESSAGE_USER]: "1.0.0",
  [EventType.MESSAGE_ASSISTANT]: "1.0.0",
  [EventType.ROUTING_DECISION]: "1.0.0",
  [EventType.FILE_UPLOAD]: "1.0.0",
  [EventType.VOICE_INPUT]: "1.0.0",
  [EventType.CLARIFICATION_REQUEST]: "1.0.0",
};

/**
 * Gets the current schema version for an event type
 */
export function getEventSchemaVersion(eventType: EventType): string {
  return SCHEMA_VERSIONS[eventType] || "1.0.0";
}

/**
 * Migrates an envelope to a target version
 * Currently all versions are 1.0.0, so this is a placeholder for future schema evolution
 */
export function migrateEnvelope(
  envelope: EventEnvelope<any>,
  targetVersion: string
): EventEnvelope<any> {
  const currentVersion = envelope.metadata.version;
  
  // If already at target version, return as-is
  if (currentVersion === targetVersion) {
    return envelope;
  }

  // For now, all schemas are 1.0.0, so migration is a no-op
  // In the future, this would handle schema evolution:
  // - v1.0.0 -> v1.1.0: Add new optional fields
  // - v1.1.0 -> v2.0.0: Breaking changes, transform payload structure
  // etc.

  const migratedMetadata: EventMetadata = {
    ...envelope.metadata,
    version: targetVersion,
  };

  return {
    metadata: migratedMetadata,
    payload: envelope.payload,
  };
}

/**
 * Checks if an envelope needs migration
 */
export function needsMigration(
  envelope: EventEnvelope<any>,
  targetVersion?: string
): boolean {
  const currentVersion = envelope.metadata.version;
  const target = targetVersion || getEventSchemaVersion(envelope.metadata.type);
  return currentVersion !== target;
}

