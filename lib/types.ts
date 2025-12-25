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
}

export interface FileRef {
  id: string;
  bucketId: string;
  filename: string;
  path: string;
  uploadedAt: Date;
}

