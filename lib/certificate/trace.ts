import { z } from "zod";
import type {
  AuthorityEvent,
  AuthorityEventPayload,
  AuthorityEventType,
} from "@/lib/domain/events";
import { canonicalize } from "@/lib/certificate/canonical";
import { sha256Prefixed } from "@/lib/certificate/hash";

/**
 * Exported snake_case trace-event representation used identically by the
 * canonical JSONL, the browser trace.jsonl download, and the CLI verifier.
 * Internal engine events remain camelCase; conversion is explicit field by
 * field — no generic key transformer. The payload is carried verbatim as
 * recorded evidence.
 */
export interface ExportedTraceEvent {
  readonly event_index: number;
  readonly event_id: string;
  readonly run_id: string;
  readonly scenario_seed: string;
  readonly logical_time_ms: number;
  readonly wall_time_iso: string;
  readonly type: string;
  readonly actor_id: string;
  readonly subject_id: string | null;
  readonly parent_subject_id: string | null;
  readonly caused_by_event_id: string | null;
  readonly authority_epoch: number | null;
  readonly issued_authority_epoch: number | null;
  readonly payload: Record<string, unknown>;
  readonly previous_event_hash: string | null;
  readonly event_hash: string | null;
}

const sha256String = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const exportedTraceEventSchema = z.strictObject({
  event_index: z.number().int().min(1),
  event_id: z.string().min(1),
  run_id: z.string().min(1),
  scenario_seed: z.string().min(1),
  logical_time_ms: z.number().int().min(0),
  wall_time_iso: z.string().min(1),
  type: z.string().min(1),
  actor_id: z.string().min(1),
  subject_id: z.string().min(1).nullable(),
  parent_subject_id: z.string().min(1).nullable(),
  caused_by_event_id: z.string().min(1).nullable(),
  authority_epoch: z.number().int().nullable(),
  issued_authority_epoch: z.number().int().nullable(),
  payload: z.record(z.string(), z.unknown()),
  previous_event_hash: sha256String.nullable(),
  event_hash: sha256String,
});

export function toExportedTraceEvent(
  event: AuthorityEvent,
): ExportedTraceEvent {
  return {
    event_index: event.eventIndex,
    event_id: event.eventId,
    run_id: event.runId,
    scenario_seed: event.scenarioSeed,
    logical_time_ms: event.logicalTimeMs,
    wall_time_iso: event.wallTimeIso,
    type: event.type,
    actor_id: event.actorId,
    subject_id: event.subjectId,
    parent_subject_id: event.parentSubjectId,
    caused_by_event_id: event.causedByEventId,
    authority_epoch: event.authorityEpoch,
    issued_authority_epoch: event.issuedAuthorityEpoch,
    payload: event.payload,
    previous_event_hash: event.previousEventHash,
    event_hash: event.eventHash,
  };
}

export function fromExportedTraceEvent(
  exported: ExportedTraceEvent,
): AuthorityEvent {
  return {
    eventIndex: exported.event_index,
    eventId: exported.event_id,
    runId: exported.run_id,
    scenarioSeed: exported.scenario_seed,
    logicalTimeMs: exported.logical_time_ms,
    wallTimeIso: exported.wall_time_iso,
    type: exported.type as AuthorityEventType,
    actorId: exported.actor_id,
    subjectId: exported.subject_id,
    parentSubjectId: exported.parent_subject_id,
    causedByEventId: exported.caused_by_event_id,
    authorityEpoch: exported.authority_epoch,
    issuedAuthorityEpoch: exported.issued_authority_epoch,
    payload: exported.payload as AuthorityEventPayload,
    previousEventHash: exported.previous_event_hash,
    eventHash: exported.event_hash,
  };
}

/**
 * Computes the export-time event hash chain over a completed trace without
 * touching event-store recording semantics:
 * - previous_event_hash is null for the first event;
 * - each later previous_event_hash equals the preceding event_hash;
 * - event_hash is SHA-256 over the canonical exported event including
 *   previous_event_hash but excluding event_hash itself.
 */
export async function enrichTraceWithHashes(
  events: readonly AuthorityEvent[],
): Promise<readonly ExportedTraceEvent[]> {
  const enriched: ExportedTraceEvent[] = [];
  let previousEventHash: string | null = null;
  for (const event of events) {
    const hashable: Record<string, unknown> = {
      ...toExportedTraceEvent(event),
      previous_event_hash: previousEventHash,
    };
    delete hashable.event_hash;
    const eventHash = await sha256Prefixed(canonicalize(hashable));
    enriched.push({
      ...toExportedTraceEvent(event),
      previous_event_hash: previousEventHash,
      event_hash: eventHash,
    });
    previousEventHash = eventHash;
  }
  return enriched;
}

/**
 * Canonical JSONL: one canonical exported event per line, a newline between
 * events, and exactly one trailing newline.
 */
export function traceToCanonicalJsonl(
  exportedEvents: readonly ExportedTraceEvent[],
): string {
  return exportedEvents.map((event) => canonicalize(event)).join("\n") + "\n";
}

export async function computeTraceHash(
  canonicalJsonl: string,
): Promise<string> {
  return sha256Prefixed(canonicalJsonl);
}
