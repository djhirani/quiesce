import type { AuthorityEdge, AuthorityEntity } from "./entities";

export type AuthorityEventType =
  | "RUN_STARTED"
  | "RESOURCE_INSPECTED"
  | "SAFE_EFFECT_COMMITTED"
  | "AGENT_SPAWNED"
  | "CREDENTIAL_ISSUED"
  | "JOB_SCHEDULED"
  | "RETRY_ENABLED"
  | "ACTION_QUEUED"
  | "SCENARIO_READY"
  | "STOP_INJECTED"
  | "AUTHORITY_EPOCH_ADVANCED"
  | "COMMIT_GATE_SEALED"
  | "AGENT_STOPPED"
  | "AGENT_TERMINATED"
  | "CREDENTIAL_REVOKED"
  | "JOB_CANCELLED"
  | "QUEUE_ITEM_CANCELLED"
  | "RETRY_DISABLED"
  | "CLOCK_ADVANCED"
  | "JOB_TRIGGERED"
  | "EFFECT_ATTEMPTED"
  | "STALE_AUTHORITY_REJECTED"
  | "EFFECT_COMMITTED"
  | "EFFECT_REJECTED"
  | "QUIESCENCE_REACHED";

export interface AuthorityEventPayload extends Record<string, unknown> {
  readonly simulated?: true;
  readonly entity?: AuthorityEntity;
  readonly actorEntity?: AuthorityEntity;
  readonly edge?: AuthorityEdge;
  readonly edges?: readonly AuthorityEdge[];
}

export interface AuthorityEvent<
  TPayload extends AuthorityEventPayload = AuthorityEventPayload,
> {
  readonly eventIndex: number;
  readonly eventId: string;
  readonly runId: string;
  readonly scenarioSeed: string;
  readonly logicalTimeMs: number;
  readonly wallTimeIso: string;
  readonly type: AuthorityEventType;
  readonly actorId: string;
  readonly subjectId: string | null;
  readonly parentSubjectId: string | null;
  readonly causedByEventId: string | null;
  readonly authorityEpoch: number | null;
  readonly issuedAuthorityEpoch: number | null;
  readonly payload: TPayload;
  readonly previousEventHash: null;
  readonly eventHash: null;
}

export type NewAuthorityEvent = Omit<
  AuthorityEvent,
  | "eventIndex"
  | "eventId"
  | "runId"
  | "scenarioSeed"
  | "wallTimeIso"
  | "previousEventHash"
  | "eventHash"
>;
