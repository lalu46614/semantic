import { GoogleGenerativeAI } from "@google/generative-ai";
import { RoutingDecision, Bucket } from "@/lib/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const ROUTING_SCHEMA = {
  type: "object",
  properties: {
    action: {
      type: "string",
      enum: ["ROUTE_TO_EXISTING", "CREATE_NEW", "CLARIFY"],
      description: "The routing action to take",
    },
    bucketId: {
      type: "string",
      nullable: true,
      description: "The ID of the bucket to route to (required if action is ROUTE_TO_EXISTING)",
    },
    newBucketName: {
      type: "string",
      nullable: true,
      description: "The name for the new bucket (required if action is CREATE_NEW)",
    },
    clarificationQuestion: {
      type: "string",
      nullable: true,
      description: "A polite, human-like question to clarify user intent (required if action is CLARIFY)",
    },
  },
  required: ["action"],
};

export async function routeMessage(
  userInput: string,
  existingBuckets: Bucket[],
  currentBucketId?: string
): Promise<RoutingDecision> {
  // Use gemini-2.5-flash (or gemini-1.5-flash as fallback via env var)
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: ROUTING_SCHEMA as any,
    },
  });

  const bucketsContext = existingBuckets.length > 0
    ? existingBuckets.map((b) => `- ${b.name} (ID: ${b.id})`).join("\n")
    : "No existing buckets.";

  const currentBucketContext = currentBucketId
    ? existingBuckets.find((b) => b.id === currentBucketId)
      ? `\nCURRENTLY SELECTED BUCKET: ${existingBuckets.find((b) => b.id === currentBucketId)!.name} (ID: ${currentBucketId})\nNote: The user may be continuing this conversation OR pivoting to a new topic. Analyze the intent carefully.`
      : ""
    : "\nCURRENTLY SELECTED BUCKET: None (no bucket is currently selected)";

  const prompt = `You are a semantic routing system. Analyze the user's input and decide how to route it.

EXISTING BUCKETS:
${bucketsContext}
${currentBucketContext}

USER INPUT: "${userInput}"

ROUTING RULES:
1. ROUTE_TO_EXISTING: If the input is semantically related to an existing bucket (e.g., continuing a conversation about exam prep, asking follow-up questions in the same domain). This can be the currently selected bucket OR a different existing bucket if the message relates better to another one.
2. CREATE_NEW: If the input is a hard pivot to a completely different topic (e.g., "Translate this Tamil file" while in an "English Exam" context, or starting a completely new unrelated topic). Even if a bucket is currently selected, create a new one if the intent is clearly different.
3. CLARIFY: If the intent is ambiguous and you cannot confidently determine whether it relates to an existing bucket or needs a new one. Provide a polite, human-like question to clarify.

Return a JSON object with:
- action: One of "ROUTE_TO_EXISTING", "CREATE_NEW", or "CLARIFY"
- bucketId: The bucket ID if routing to existing, null otherwise
- newBucketName: A descriptive name for the new bucket if creating new, null otherwise
- clarificationQuestion: A question if action is CLARIFY, null otherwise

Be strict: only route to existing if there's clear semantic similarity. When in doubt, use CLARIFY.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Parse JSON response
    const decision: RoutingDecision = JSON.parse(text);
    
    // Validate the decision
    if (decision.action === "ROUTE_TO_EXISTING" && !decision.bucketId) {
      return {
        action: "CLARIFY",
        bucketId: null,
        newBucketName: null,
        clarificationQuestion: "Which conversation would you like to continue?",
      };
    }
    
    if (decision.action === "CREATE_NEW" && !decision.newBucketName) {
      // Generate a default name from the input
      decision.newBucketName = userInput.substring(0, 50) || "New Conversation";
    }
    
    if (decision.action === "CLARIFY" && !decision.clarificationQuestion) {
      decision.clarificationQuestion = "Could you clarify what you'd like to discuss?";
    }
    
    return decision;
  } catch (error) {
    console.error("Router error:", error);
    // Fallback to CLARIFY on error
    return {
      action: "CLARIFY",
      bucketId: null,
      newBucketName: null,
      clarificationQuestion: "I'm having trouble understanding. Could you rephrase your request?",
    };
  }
}

