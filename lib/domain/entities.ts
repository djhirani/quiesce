export type EntityKind =
  | "human"
  | "agent"
  | "credential"
  | "scheduled_job"
  | "retry_worker"
  | "queue_item"
  | "effect";

export type RuntimeStatus =
  | "pending"
  | "active"
  | "stopped"
  | "valid"
  | "armed"
  | "queued"
  | "attempting"
  | "terminated"
  | "revoked"
  | "cancelled"
  | "rejected"
  | "committed"
  | "expired";

export interface AuthorityEntity {
  readonly id: string;
  readonly kind: EntityKind;
  readonly label: string;
  readonly status: RuntimeStatus;
  readonly parentId: string | null;
  readonly authorityEpoch: number | null;
  readonly committable?: boolean;
  readonly simulated: true;
}

export type AuthorityRelationship =
  | "spawned"
  | "granted"
  | "owns"
  | "schedules"
  | "retries"
  | "enqueues"
  | "authorizes"
  | "commits";

export interface AuthorityEdge {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly relationship: AuthorityRelationship;
}
