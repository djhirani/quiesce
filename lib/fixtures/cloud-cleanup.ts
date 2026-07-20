import type { AuthorityEdge, AuthorityEntity } from "@/lib/domain/entities";

export const CLOUD_CLEANUP_SEED = "cloud-cleanup-v1";
export const CLOUD_CLEANUP_RUN_ID = "run-cloud-cleanup-v1-001";
export const CLOUD_CLEANUP_AUTHORITY_EPOCH = 7;

export const entityIds = {
  human: "human-operator-01",
  root: "agent-cleanup-root-01",
  child: "agent-optimisation-child-01",
  credential: "credential-cleanup-01",
  job: "job-recurring-cleanup-01",
  retry: "retry-cleanup-01",
  developmentQueue: "queue-development-cache-01",
  backupQueue: "queue-production-backup-01",
  safeEffectOne: "effect-development-instance-01",
  safeEffectTwo: "effect-development-instance-02",
  backupEffect: "effect-production-backup-deletion-01",
} as const;

export const cloudCleanupEntities = {
  human: {
    id: entityIds.human,
    kind: "human",
    label: "Human operator",
    status: "active",
    parentId: null,
    authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    simulated: true,
  },
  root: {
    id: entityIds.root,
    kind: "agent",
    label: "Root cleanup agent",
    status: "active",
    parentId: entityIds.human,
    authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    simulated: true,
  },
  child: {
    id: entityIds.child,
    kind: "agent",
    label: "Optimisation child",
    status: "active",
    parentId: entityIds.root,
    authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    simulated: true,
  },
  credential: {
    id: entityIds.credential,
    kind: "credential",
    label: "Temporary cleanup credential",
    status: "valid",
    parentId: entityIds.root,
    authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    simulated: true,
  },
  job: {
    id: entityIds.job,
    kind: "scheduled_job",
    label: "Recurring cleanup job",
    status: "armed",
    parentId: entityIds.child,
    authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    simulated: true,
  },
  retry: {
    id: entityIds.retry,
    kind: "retry_worker",
    label: "Cleanup retry worker",
    status: "active",
    parentId: entityIds.job,
    authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    simulated: true,
  },
  developmentQueue: {
    id: entityIds.developmentQueue,
    kind: "queue_item",
    label: "Delete development cache",
    status: "queued",
    parentId: entityIds.job,
    authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    committable: true,
    simulated: true,
  },
  backupQueue: {
    id: entityIds.backupQueue,
    kind: "queue_item",
    label: "Delete production backup",
    status: "queued",
    parentId: entityIds.retry,
    authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    committable: true,
    simulated: true,
  },
  safeEffectOne: {
    id: entityIds.safeEffectOne,
    kind: "effect",
    label: "Stopped development instance 01",
    status: "committed",
    parentId: entityIds.root,
    authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    simulated: true,
  },
  safeEffectTwo: {
    id: entityIds.safeEffectTwo,
    kind: "effect",
    label: "Stopped development instance 02",
    status: "committed",
    parentId: entityIds.root,
    authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    simulated: true,
  },
  backupEffect: {
    id: entityIds.backupEffect,
    kind: "effect",
    label: "Production backup deletion",
    status: "committed",
    parentId: entityIds.backupQueue,
    authorityEpoch: CLOUD_CLEANUP_AUTHORITY_EPOCH,
    simulated: true,
  },
} as const satisfies Record<string, AuthorityEntity>;

export function edge(
  relationship: AuthorityEdge["relationship"],
  sourceId: string,
  targetId: string,
): AuthorityEdge {
  return {
    id: `${sourceId}:${relationship}:${targetId}`,
    sourceId,
    targetId,
    relationship,
  };
}
