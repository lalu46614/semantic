export type RoutingAction = "ROUTE_TO_EXISTING" | "CREATE_NEW" | "CLARIFY";

export interface RoutingDecision {
  action: RoutingAction;
  bucketId: string | null;
  newBucketName: string | null;
  clarificationQuestion: string | null;
}

export interface Bucket {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  bucketId: string;
  bucketName?: string;
  content: string;
  role: "user" | "assistant";
  fileRefs: FileRef[];
  createdAt: Date;
  isVoice?: boolean;
  envelopeMetadata?: Partial<EventMetadata>;
}

export interface FileRef {
  id: string;
  bucketId: string;
  filename: string;
  path: string;
  uploadedAt: Date;
}

// Event Envelope Types
export enum EventType {
  MESSAGE_USER = "MESSAGE_USER",
  MESSAGE_ASSISTANT = "MESSAGE_ASSISTANT",
  ROUTING_DECISION = "ROUTING_DECISION",
  FILE_UPLOAD = "FILE_UPLOAD",
  VOICE_INPUT = "VOICE_INPUT",
  CLARIFICATION_REQUEST = "CLARIFICATION_REQUEST",
}

export enum EventSource {
  CHAT_AREA = "CHAT_AREA",
  VOICE_CONNECT = "VOICE_CONNECT",
  API_ROUTE = "API_ROUTE",
  ROUTER = "ROUTER",
  EXECUTOR = "EXECUTOR",
}

export interface EventMetadata {
  eventId: string;
  version: string;
  timestamp: Date;
  source: EventSource;
  type: EventType;
  correlationId: string;
  parentEventId: string | null;
  sessionId: string | null;
  userId: string | null;
  processingTime: number | null;
  latency: number | null;
}

export interface EventEnvelope<T> {
  metadata: EventMetadata;
  payload: T;
}

export interface MultimodalEvent extends EventEnvelope<any> {
  metadata: EventMetadata & {
    temporalAlignment?: {
      textTimestamp?: Date;
      voiceTimestamp?: Date;
      fileTimestamps?: Date[];
      timeWindow: number;
    };
  };
}

