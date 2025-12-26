import { EventEnvelope, EventType, EventSource } from "@/lib/types";
import { createMultimodalEvent } from "@/lib/event-envelope";

/**
 * Default time window for multimodal event detection (2 seconds)
 */
const DEFAULT_TIME_WINDOW_MS = 2000;

/**
 * Detects multimodal windows by grouping events within a time window by correlationId
 * Returns arrays of events that should be fused together
 */
export function detectMultimodalWindow(
  events: EventEnvelope<any>[],
  timeWindowMs: number = DEFAULT_TIME_WINDOW_MS
): EventEnvelope<any>[][] {
  if (events.length === 0) {
    return [];
  }

  // Group events by correlationId first
  const eventsByCorrelation = new Map<string, EventEnvelope<any>[]>();
  for (const event of events) {
    const corrId = event.metadata.correlationId;
    if (!eventsByCorrelation.has(corrId)) {
      eventsByCorrelation.set(corrId, []);
    }
    eventsByCorrelation.get(corrId)!.push(event);
  }

  const fusedGroups: EventEnvelope<any>[][] = [];

  // For each correlation group, check if events are within time window
  for (const [correlationId, correlationEvents] of eventsByCorrelation.entries()) {
    if (correlationEvents.length === 1) {
      // Single event, no fusion needed
      continue;
    }

    // Sort by timestamp
    const sortedEvents = [...correlationEvents].sort(
      (a, b) => a.metadata.timestamp.getTime() - b.metadata.timestamp.getTime()
    );

    // Group events that are within timeWindowMs of each other
    const groups: EventEnvelope<any>[][] = [];
    let currentGroup: EventEnvelope<any>[] = [sortedEvents[0]];

    for (let i = 1; i < sortedEvents.length; i++) {
      const prevTime = sortedEvents[i - 1].metadata.timestamp.getTime();
      const currTime = sortedEvents[i].metadata.timestamp.getTime();
      const timeDiff = currTime - prevTime;

      if (timeDiff <= timeWindowMs) {
        // Within time window, add to current group
        currentGroup.push(sortedEvents[i]);
      } else {
        // Outside time window, start new group
        if (currentGroup.length > 1) {
          groups.push(currentGroup);
        }
        currentGroup = [sortedEvents[i]];
      }
    }

    // Add the last group if it has multiple events
    if (currentGroup.length > 1) {
      groups.push(currentGroup);
    }

    fusedGroups.push(...groups);
  }

  return fusedGroups;
}

/**
 * Fuses multiple events into a single multimodal event
 * Combines text, voice, and file inputs into unified event
 */
export function fuseEvents(
  events: EventEnvelope<any>[],
  timeWindow: number = DEFAULT_TIME_WINDOW_MS
): ReturnType<typeof createMultimodalEvent> {
  return createMultimodalEvent(events, timeWindow);
}

/**
 * Aligns temporal inputs by timestamp and creates unified event
 */
export function alignTemporalInputs(
  textEvent: EventEnvelope<any> | null,
  voiceEvent: EventEnvelope<any> | null,
  fileEvents: EventEnvelope<any>[]
): ReturnType<typeof createMultimodalEvent> {
  const events: EventEnvelope<any>[] = [];
  
  if (textEvent) events.push(textEvent);
  if (voiceEvent) events.push(voiceEvent);
  events.push(...fileEvents);

  if (events.length === 0) {
    throw new Error("At least one event is required for temporal alignment");
  }

  // Calculate time window based on event timestamps
  const timestamps = events.map((e) => e.metadata.timestamp.getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeWindow = maxTime - minTime;

  return createMultimodalEvent(events, timeWindow);
}

/**
 * Detects if events should be fused based on correlation and time window
 */
export function shouldFuseEvents(
  events: EventEnvelope<any>[],
  timeWindowMs: number = DEFAULT_TIME_WINDOW_MS
): boolean {
  if (events.length < 2) {
    return false;
  }

  // Check if all events have the same correlationId
  const firstCorrelationId = events[0].metadata.correlationId;
  if (!events.every((e) => e.metadata.correlationId === firstCorrelationId)) {
    return false;
  }

  // Check if events are within time window
  const timestamps = events.map((e) => e.metadata.timestamp.getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeDiff = maxTime - minTime;

  return timeDiff <= timeWindowMs;
}

