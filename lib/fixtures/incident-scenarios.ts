import type { AuthorityEntity } from "@/lib/domain/entities";
import type {
  AuthorityEventPayload,
  AuthorityEventType,
} from "@/lib/domain/events";
import { edge } from "@/lib/fixtures/cloud-cleanup";

export type ScenarioKey =
  "cloud-cleanup" | "nine-second-deletion" | "offboarded-token";

export const SCENARIO_KEYS: readonly ScenarioKey[] = [
  "cloud-cleanup",
  "nine-second-deletion",
  "offboarded-token",
];

export const RECONSTRUCTION_DISCLOSURE =
  "Reconstruction of a documented incident class — simulated.";

export interface ScenarioDescriptor {
  readonly key: ScenarioKey;
  readonly label: string;
  /** Present only for reconstructed scenarios; absent for the original demo. */
  readonly disclosure?: {
    readonly line: typeof RECONSTRUCTION_DISCLOSURE;
    readonly source: string;
  };
}

export interface ScriptedEventSpec {
  readonly type: AuthorityEventType;
  readonly actorId: string;
  readonly subjectId: string | null;
  readonly parentSubjectId: string | null;
  readonly payload: AuthorityEventPayload;
  /** Skip this event when the named entity was never built (sweep boundaries). */
  readonly requiresEntityId?: string;
  /** Mirror of the cloud driver's explicit issued-epoch assignments. */
  readonly issuedAtBaseEpoch?: boolean;
  readonly offsetMs?: number;
}

export interface ScriptedScenarioDefinition extends ScenarioDescriptor {
  readonly runId: string;
  readonly scenarioSeed: string;
  readonly authorityEpoch: number;
  readonly credentialId: string;
  /** The queued action that becomes due when the clock advances. */
  readonly dueQueueId: string;
  readonly build: readonly ScriptedEventSpec[];
  readonly vulnerableStop: readonly ScriptedEventSpec[];
  readonly protectedStop: readonly ScriptedEventSpec[];
  readonly vulnerableAdvance: readonly ScriptedEventSpec[];
  readonly protectedAdvance: readonly ScriptedEventSpec[];
}

const NS_EPOCH = 5;

const nsIds = {
  human: "human-operator-ns-01",
  root: "agent-migration-root-ns-01",
  credential: "credential-admin-ns-01",
  queue: "queue-corrective-drop-ns-01",
  effect: "effect-production-database-drop-ns-01",
} as const;

const nsEntities = {
  human: {
    id: nsIds.human,
    kind: "human",
    label: "Human operator",
    status: "active",
    parentId: null,
    authorityEpoch: NS_EPOCH,
    simulated: true,
  },
  root: {
    id: nsIds.root,
    kind: "agent",
    label: "Migration assistant agent",
    status: "active",
    parentId: nsIds.human,
    authorityEpoch: NS_EPOCH,
    simulated: true,
  },
  credential: {
    id: nsIds.credential,
    kind: "credential",
    label: "Over-permissioned admin credential",
    status: "valid",
    parentId: nsIds.root,
    authorityEpoch: NS_EPOCH,
    simulated: true,
  },
  queue: {
    id: nsIds.queue,
    kind: "queue_item",
    label: "Drop and recreate production database",
    status: "queued",
    parentId: nsIds.root,
    authorityEpoch: NS_EPOCH,
    committable: true,
    simulated: true,
  },
  effect: {
    id: nsIds.effect,
    kind: "effect",
    label: "Production database deletion",
    status: "committed",
    parentId: nsIds.queue,
    authorityEpoch: NS_EPOCH,
    simulated: true,
  },
} as const satisfies Record<string, AuthorityEntity>;

export const nineSecondDeletion: ScriptedScenarioDefinition = {
  key: "nine-second-deletion",
  label: "The nine-second deletion",
  disclosure: {
    line: RECONSTRUCTION_DISCLOSURE,
    source:
      "Incident library: a coding agent hit a credential mismatch, found an over-permissioned credential, and destroyed a production database seconds after the operator pressed stop (public post-mortems, 2024–2025). Quiesce did not observe the original incident.",
  },
  runId: "run-nine-second-deletion-001",
  scenarioSeed: "nine-second-deletion-v1",
  authorityEpoch: NS_EPOCH,
  credentialId: nsIds.credential,
  dueQueueId: nsIds.queue,
  build: [
    {
      type: "RUN_STARTED",
      actorId: nsIds.human,
      subjectId: nsIds.root,
      parentSubjectId: null,
      payload: {
        actorEntity: nsEntities.human,
        entity: nsEntities.root,
        edge: edge("owns", nsIds.human, nsIds.root),
        canonicalFixture: "nine-second-deletion-v1",
      },
    },
    {
      type: "RESOURCE_INSPECTED",
      actorId: nsIds.root,
      subjectId: null,
      parentSubjectId: null,
      payload: {
        action: "apply_schema_migration",
        resourceIds: ["production-database-01"],
        failure: "credential_mismatch",
        environment: "production",
        simulated: true,
      },
    },
    {
      type: "CREDENTIAL_ISSUED",
      actorId: nsIds.root,
      subjectId: nsIds.credential,
      parentSubjectId: nsIds.root,
      payload: {
        entity: nsEntities.credential,
        edge: edge("granted", nsIds.root, nsIds.credential),
        discovered: "over_permissioned_environment_credential",
        scope: "simulated:database-admin",
        simulated: true,
      },
    },
    {
      type: "ACTION_QUEUED",
      actorId: nsIds.root,
      subjectId: nsIds.queue,
      parentSubjectId: nsIds.root,
      payload: {
        entity: nsEntities.queue,
        edges: [
          edge("enqueues", nsIds.root, nsIds.queue),
          edge("authorizes", nsIds.credential, nsIds.queue),
        ],
        action: "drop_and_recreate_production_database",
        classification: "destructive_corrective_action",
        material: true,
        simulated: true,
      },
    },
    {
      type: "SCENARIO_READY",
      actorId: nsIds.root,
      subjectId: nsIds.root,
      parentSubjectId: nsIds.human,
      payload: { queuedActionIds: [nsIds.queue], simulated: true },
    },
  ],
  vulnerableStop: [
    {
      type: "STOP_INJECTED",
      actorId: nsIds.human,
      subjectId: nsIds.root,
      parentSubjectId: nsIds.human,
      issuedAtBaseEpoch: true,
      payload: { policy: "vulnerable", scope: "root_only", simulated: true },
    },
    {
      type: "AGENT_STOPPED",
      actorId: nsIds.human,
      subjectId: nsIds.root,
      parentSubjectId: nsIds.human,
      issuedAtBaseEpoch: true,
      payload: {
        entity: { ...nsEntities.root, status: "stopped" },
        propagation: "none",
        simulated: true,
      },
    },
  ],
  protectedStop: [
    {
      type: "STOP_INJECTED",
      actorId: nsIds.human,
      subjectId: nsIds.root,
      parentSubjectId: nsIds.human,
      payload: {
        policy: "protected",
        protocol: "SEAL_REVOKE_DRAIN_PROVE",
        simulated: true,
      },
    },
    {
      type: "AUTHORITY_EPOCH_ADVANCED",
      actorId: nsIds.human,
      subjectId: nsIds.root,
      parentSubjectId: nsIds.human,
      payload: {
        previousEpoch: NS_EPOCH,
        currentEpoch: NS_EPOCH + 1,
        simulated: true,
      },
    },
    {
      type: "COMMIT_GATE_SEALED",
      actorId: nsIds.human,
      subjectId: nsIds.root,
      parentSubjectId: nsIds.human,
      payload: {
        minimumValidAuthorityEpoch: NS_EPOCH + 1,
        gateStatus: "sealed",
        simulated: true,
      },
    },
    {
      type: "QUEUE_ITEM_CANCELLED",
      actorId: nsIds.root,
      subjectId: nsIds.queue,
      parentSubjectId: nsIds.root,
      requiresEntityId: nsIds.queue,
      issuedAtBaseEpoch: true,
      payload: {
        entity: {
          ...nsEntities.queue,
          status: "cancelled",
          committable: false,
        },
        issuedAuthorityEpoch: NS_EPOCH,
        simulated: true,
      },
    },
    {
      type: "CREDENTIAL_REVOKED",
      actorId: nsIds.root,
      subjectId: nsIds.credential,
      parentSubjectId: nsIds.root,
      requiresEntityId: nsIds.credential,
      payload: {
        entity: { ...nsEntities.credential, status: "revoked" },
        simulated: true,
      },
    },
    {
      type: "AGENT_TERMINATED",
      actorId: nsIds.human,
      subjectId: nsIds.root,
      parentSubjectId: nsIds.human,
      payload: {
        entity: { ...nsEntities.root, status: "terminated" },
        simulated: true,
      },
    },
    {
      type: "QUIESCENCE_REACHED",
      actorId: nsIds.human,
      subjectId: nsIds.root,
      parentSubjectId: nsIds.human,
      offsetMs: 60,
      payload: {
        authorityEpoch: NS_EPOCH + 1,
        residualAuthorityIds: [],
        pendingWorkIds: [],
        simulated: true,
      },
    },
  ],
  vulnerableAdvance: [
    {
      type: "EFFECT_ATTEMPTED",
      actorId: nsIds.queue,
      subjectId: nsIds.queue,
      parentSubjectId: nsIds.root,
      payload: {
        entity: { ...nsEntities.queue, status: "attempting" },
        credentialId: nsIds.credential,
        targetType: "production_database",
        targetId: "production-database-01",
        material: true,
        simulated: true,
      },
    },
    {
      type: "EFFECT_COMMITTED",
      actorId: nsIds.queue,
      subjectId: nsIds.effect,
      parentSubjectId: nsIds.queue,
      payload: {
        entity: nsEntities.effect,
        edge: edge("commits", nsIds.queue, nsIds.effect),
        credentialId: nsIds.credential,
        targetType: "production_database",
        targetId: "production-database-01",
        material: true,
        simulated: true,
      },
    },
  ],
  protectedAdvance: [
    {
      type: "EFFECT_ATTEMPTED",
      actorId: nsIds.queue,
      subjectId: nsIds.queue,
      parentSubjectId: nsIds.root,
      payload: {
        credentialId: nsIds.credential,
        issuedAuthorityEpoch: NS_EPOCH,
        targetType: "production_database",
        targetId: "production-database-01",
        material: true,
        simulated: true,
      },
    },
    {
      type: "STALE_AUTHORITY_REJECTED",
      actorId: nsIds.root,
      subjectId: nsIds.queue,
      parentSubjectId: nsIds.root,
      payload: {
        targetType: "production_database",
        targetId: "production-database-01",
        material: true,
        simulated: true,
      },
    },
    {
      type: "EFFECT_REJECTED",
      actorId: nsIds.root,
      subjectId: nsIds.effect,
      parentSubjectId: nsIds.queue,
      payload: {
        entity: { ...nsEntities.effect, status: "rejected" },
        edge: edge("cancels", nsIds.queue, nsIds.effect),
        reason: "stale_authority",
        issuedAuthorityEpoch: NS_EPOCH,
        currentAuthorityEpoch: NS_EPOCH + 1,
        targetType: "production_database",
        targetId: "production-database-01",
        material: true,
        simulated: true,
      },
    },
  ],
};

const OT_EPOCH = 3;

const otIds = {
  human: "human-operator-ot-01",
  root: "agent-offboarding-root-ot-01",
  credential: "credential-delegated-token-ot-01",
  job: "job-nightly-export-ot-01",
  queue: "queue-archive-export-ot-01",
  effect: "effect-archive-export-ot-01",
} as const;

const otEntities = {
  human: {
    id: otIds.human,
    kind: "human",
    label: "Human operator",
    status: "active",
    parentId: null,
    authorityEpoch: OT_EPOCH,
    simulated: true,
  },
  root: {
    id: otIds.root,
    kind: "agent",
    label: "Offboarding workflow agent",
    status: "active",
    parentId: otIds.human,
    authorityEpoch: OT_EPOCH,
    simulated: true,
  },
  credential: {
    id: otIds.credential,
    kind: "credential",
    label: "Delegated service token",
    status: "valid",
    parentId: otIds.root,
    authorityEpoch: OT_EPOCH,
    simulated: true,
  },
  job: {
    id: otIds.job,
    kind: "scheduled_job",
    label: "Nightly archive export job",
    status: "armed",
    parentId: otIds.root,
    authorityEpoch: OT_EPOCH,
    simulated: true,
  },
  queue: {
    id: otIds.queue,
    kind: "queue_item",
    label: "Export customer archive to external store",
    status: "queued",
    parentId: otIds.job,
    authorityEpoch: OT_EPOCH,
    committable: true,
    simulated: true,
  },
  effect: {
    id: otIds.effect,
    kind: "effect",
    label: "External customer-archive export",
    status: "committed",
    parentId: otIds.queue,
    authorityEpoch: OT_EPOCH,
    simulated: true,
  },
} as const satisfies Record<string, AuthorityEntity>;

export const offboardedToken: ScriptedScenarioDefinition = {
  key: "offboarded-token",
  label: "The offboarded token",
  disclosure: {
    line: RECONSTRUCTION_DISCLOSURE,
    source:
      "Incident library: a delegated token outlived the offboarded identity that created it, and a scheduled job kept exporting data after the parent authority was stopped (public post-mortems, 2023–2025). Quiesce did not observe the original incident.",
  },
  runId: "run-offboarded-token-001",
  scenarioSeed: "offboarded-token-v1",
  authorityEpoch: OT_EPOCH,
  credentialId: otIds.credential,
  dueQueueId: otIds.queue,
  build: [
    {
      type: "RUN_STARTED",
      actorId: otIds.human,
      subjectId: otIds.root,
      parentSubjectId: null,
      payload: {
        actorEntity: otEntities.human,
        entity: otEntities.root,
        edge: edge("owns", otIds.human, otIds.root),
        canonicalFixture: "offboarded-token-v1",
      },
    },
    {
      type: "CREDENTIAL_ISSUED",
      actorId: otIds.root,
      subjectId: otIds.credential,
      parentSubjectId: otIds.root,
      payload: {
        entity: otEntities.credential,
        edge: edge("granted", otIds.root, otIds.credential),
        delegatedTo: "nightly-export-service",
        scope: "simulated:archive-export",
        simulated: true,
      },
    },
    {
      type: "JOB_SCHEDULED",
      actorId: otIds.root,
      subjectId: otIds.job,
      parentSubjectId: otIds.root,
      payload: {
        entity: otEntities.job,
        edge: edge("schedules", otIds.root, otIds.job),
        intervalMs: 300_000,
        action: "export_customer_archive",
        simulated: true,
      },
    },
    {
      type: "ACTION_QUEUED",
      actorId: otIds.job,
      subjectId: otIds.queue,
      parentSubjectId: otIds.job,
      payload: {
        entity: otEntities.queue,
        edges: [
          edge("enqueues", otIds.job, otIds.queue),
          edge("authorizes", otIds.credential, otIds.queue),
        ],
        action: "export_customer_archive",
        classification: "delegated_scheduled_export",
        material: true,
        simulated: true,
      },
    },
    {
      type: "SCENARIO_READY",
      actorId: otIds.root,
      subjectId: otIds.root,
      parentSubjectId: otIds.human,
      payload: { queuedActionIds: [otIds.queue], simulated: true },
    },
  ],
  vulnerableStop: [
    {
      type: "STOP_INJECTED",
      actorId: otIds.human,
      subjectId: otIds.root,
      parentSubjectId: otIds.human,
      issuedAtBaseEpoch: true,
      payload: { policy: "vulnerable", scope: "root_only", simulated: true },
    },
    {
      type: "AGENT_STOPPED",
      actorId: otIds.human,
      subjectId: otIds.root,
      parentSubjectId: otIds.human,
      issuedAtBaseEpoch: true,
      payload: {
        entity: { ...otEntities.root, status: "stopped" },
        propagation: "none",
        simulated: true,
      },
    },
  ],
  protectedStop: [
    {
      type: "STOP_INJECTED",
      actorId: otIds.human,
      subjectId: otIds.root,
      parentSubjectId: otIds.human,
      payload: {
        policy: "protected",
        protocol: "SEAL_REVOKE_DRAIN_PROVE",
        simulated: true,
      },
    },
    {
      type: "AUTHORITY_EPOCH_ADVANCED",
      actorId: otIds.human,
      subjectId: otIds.root,
      parentSubjectId: otIds.human,
      payload: {
        previousEpoch: OT_EPOCH,
        currentEpoch: OT_EPOCH + 1,
        simulated: true,
      },
    },
    {
      type: "COMMIT_GATE_SEALED",
      actorId: otIds.human,
      subjectId: otIds.root,
      parentSubjectId: otIds.human,
      payload: {
        minimumValidAuthorityEpoch: OT_EPOCH + 1,
        gateStatus: "sealed",
        simulated: true,
      },
    },
    {
      type: "QUEUE_ITEM_CANCELLED",
      actorId: otIds.root,
      subjectId: otIds.queue,
      parentSubjectId: otIds.job,
      requiresEntityId: otIds.queue,
      issuedAtBaseEpoch: true,
      payload: {
        entity: {
          ...otEntities.queue,
          status: "cancelled",
          committable: false,
        },
        issuedAuthorityEpoch: OT_EPOCH,
        simulated: true,
      },
    },
    {
      type: "JOB_CANCELLED",
      actorId: otIds.root,
      subjectId: otIds.job,
      parentSubjectId: otIds.root,
      requiresEntityId: otIds.job,
      payload: {
        entity: { ...otEntities.job, status: "cancelled" },
        simulated: true,
      },
    },
    {
      type: "CREDENTIAL_REVOKED",
      actorId: otIds.root,
      subjectId: otIds.credential,
      parentSubjectId: otIds.root,
      requiresEntityId: otIds.credential,
      payload: {
        entity: { ...otEntities.credential, status: "revoked" },
        simulated: true,
      },
    },
    {
      type: "AGENT_TERMINATED",
      actorId: otIds.human,
      subjectId: otIds.root,
      parentSubjectId: otIds.human,
      payload: {
        entity: { ...otEntities.root, status: "terminated" },
        simulated: true,
      },
    },
    {
      type: "QUIESCENCE_REACHED",
      actorId: otIds.human,
      subjectId: otIds.root,
      parentSubjectId: otIds.human,
      offsetMs: 60,
      payload: {
        authorityEpoch: OT_EPOCH + 1,
        residualAuthorityIds: [],
        pendingWorkIds: [],
        simulated: true,
      },
    },
  ],
  vulnerableAdvance: [
    {
      type: "JOB_TRIGGERED",
      actorId: otIds.job,
      subjectId: otIds.job,
      parentSubjectId: otIds.root,
      payload: {
        targetType: "customer_archive",
        targetId: "customer-archive-01",
        material: true,
        simulated: true,
      },
    },
    {
      type: "EFFECT_ATTEMPTED",
      actorId: otIds.job,
      subjectId: otIds.queue,
      parentSubjectId: otIds.job,
      payload: {
        entity: { ...otEntities.queue, status: "attempting" },
        credentialId: otIds.credential,
        targetType: "customer_archive",
        targetId: "customer-archive-01",
        material: true,
        simulated: true,
      },
    },
    {
      type: "EFFECT_COMMITTED",
      actorId: otIds.job,
      subjectId: otIds.effect,
      parentSubjectId: otIds.queue,
      payload: {
        entity: otEntities.effect,
        edge: edge("commits", otIds.queue, otIds.effect),
        credentialId: otIds.credential,
        targetType: "customer_archive",
        targetId: "customer-archive-01",
        material: true,
        simulated: true,
      },
    },
  ],
  protectedAdvance: [
    {
      type: "EFFECT_ATTEMPTED",
      actorId: otIds.job,
      subjectId: otIds.queue,
      parentSubjectId: otIds.job,
      payload: {
        credentialId: otIds.credential,
        issuedAuthorityEpoch: OT_EPOCH,
        targetType: "customer_archive",
        targetId: "customer-archive-01",
        material: true,
        simulated: true,
      },
    },
    {
      type: "STALE_AUTHORITY_REJECTED",
      actorId: otIds.root,
      subjectId: otIds.queue,
      parentSubjectId: otIds.job,
      payload: {
        targetType: "customer_archive",
        targetId: "customer-archive-01",
        material: true,
        simulated: true,
      },
    },
    {
      type: "EFFECT_REJECTED",
      actorId: otIds.root,
      subjectId: otIds.effect,
      parentSubjectId: otIds.queue,
      payload: {
        entity: { ...otEntities.effect, status: "rejected" },
        edge: edge("cancels", otIds.queue, otIds.effect),
        reason: "stale_authority",
        issuedAuthorityEpoch: OT_EPOCH,
        currentAuthorityEpoch: OT_EPOCH + 1,
        targetType: "customer_archive",
        targetId: "customer-archive-01",
        material: true,
        simulated: true,
      },
    },
  ],
};

export const scenarioDescriptors: readonly ScenarioDescriptor[] = [
  { key: "cloud-cleanup", label: "Cloud cleanup" },
  {
    key: "nine-second-deletion",
    label: nineSecondDeletion.label,
    disclosure: nineSecondDeletion.disclosure,
  },
  {
    key: "offboarded-token",
    label: offboardedToken.label,
    disclosure: offboardedToken.disclosure,
  },
];

export function getScenarioDescriptor(key: ScenarioKey): ScenarioDescriptor {
  const descriptor = scenarioDescriptors.find((entry) => entry.key === key);
  if (!descriptor) throw new Error(`Unknown scenario: ${key}`);
  return descriptor;
}

export function getScriptedDefinition(
  key: Exclude<ScenarioKey, "cloud-cleanup">,
): ScriptedScenarioDefinition {
  return key === "nine-second-deletion" ? nineSecondDeletion : offboardedToken;
}
