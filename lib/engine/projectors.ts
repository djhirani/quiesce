import type { NextLegalCommand, SimulationPhase } from "@/lib/domain/commands";
import type { AuthorityEdge, AuthorityEntity } from "@/lib/domain/entities";
import type { AuthorityEvent } from "@/lib/domain/events";
import type { InvariantResult } from "@/lib/domain/results";

export function projectEntities(
  events: readonly AuthorityEvent[],
): readonly AuthorityEntity[] {
  const entities = new Map<string, AuthorityEntity>();
  for (const event of events) {
    if (event.payload.actorEntity) {
      entities.set(event.payload.actorEntity.id, event.payload.actorEntity);
    }
    if (event.payload.entity) {
      entities.set(event.payload.entity.id, event.payload.entity);
    }
  }
  return Object.freeze([...entities.values()]);
}

export function projectGraph(events: readonly AuthorityEvent[]): {
  readonly nodes: readonly AuthorityEntity[];
  readonly edges: readonly AuthorityEdge[];
} {
  const edges = new Map<string, AuthorityEdge>();
  for (const event of events) {
    if (event.payload.edge) {
      edges.set(event.payload.edge.id, event.payload.edge);
    }
    for (const edge of event.payload.edges ?? []) {
      edges.set(edge.id, edge);
    }
  }
  return Object.freeze({
    nodes: projectEntities(events),
    edges: Object.freeze([...edges.values()]),
  });
}

export function projectStatuses(
  events: readonly AuthorityEvent[],
): Readonly<Record<string, AuthorityEntity["status"]>> {
  return Object.freeze(
    Object.fromEntries(
      projectEntities(events).map((entity) => [entity.id, entity.status]),
    ),
  );
}

export function projectPhase(
  events: readonly AuthorityEvent[],
): SimulationPhase {
  if (events.length === 0) return "idle";
  if (
    ["EFFECT_COMMITTED", "EFFECT_REJECTED"].includes(events.at(-1)?.type ?? "")
  )
    return "test_complete";
  if (
    ["CLOCK_ADVANCED", "JOB_TRIGGERED", "EFFECT_ATTEMPTED"].includes(
      events.at(-1)?.type ?? "",
    )
  )
    return "clock_advanced";
  if (events.at(-1)?.type === "AGENT_STOPPED") return "survivors_evaluated";
  if (events.at(-1)?.type === "QUIESCENCE_REACHED")
    return "protected_quiescent";
  if (events.at(-1)?.type === "STOP_INJECTED") return "stop_injected";
  if (events.at(-1)?.type === "SCENARIO_READY") return "ready_to_stop";
  return "building_authority";
}

export function projectNextLegalCommand(
  events: readonly AuthorityEvent[],
): NextLegalCommand {
  const phase = projectPhase(events);
  if (phase === "idle") return "START_RUN";
  if (phase === "building_authority") return "ADVANCE_TO_READY";
  if (phase === "ready_to_stop") return "INJECT_STOP";
  if (phase === "survivors_evaluated") return "ADVANCE_CLOCK";
  if (phase === "protected_quiescent") return "ADVANCE_CLOCK";
  return null;
}

export function projectResidualAuthorities(
  events: readonly AuthorityEvent[],
): readonly AuthorityEntity[] {
  if (!events.some((event) => event.type === "STOP_INJECTED")) return [];
  const residualKinds = new Set<AuthorityEntity["kind"]>([
    "agent",
    "credential",
    "scheduled_job",
    "retry_worker",
  ]);
  const liveStatuses = new Set<AuthorityEntity["status"]>([
    "active",
    "valid",
    "armed",
  ]);
  return Object.freeze(
    projectEntities(events).filter(
      (entity) =>
        residualKinds.has(entity.kind) && liveStatuses.has(entity.status),
    ),
  );
}

export function projectPendingWork(
  events: readonly AuthorityEvent[],
): readonly AuthorityEntity[] {
  if (!events.some((event) => event.type === "STOP_INJECTED")) return [];
  return Object.freeze(
    projectEntities(events).filter(
      (entity) =>
        entity.kind === "queue_item" &&
        (entity.status === "queued" || entity.status === "attempting") &&
        entity.committable === true,
    ),
  );
}

export function projectEscapedEffects(
  events: readonly AuthorityEvent[],
): readonly AuthorityEntity[] {
  const stop = events.find((event) => event.type === "STOP_INJECTED");
  if (!stop) return [];
  const escapedIds = new Set(
    events
      .filter(
        (event) =>
          event.type === "EFFECT_COMMITTED" &&
          event.eventIndex > stop.eventIndex &&
          event.payload.material === true,
      )
      .map((event) => event.subjectId),
  );
  return Object.freeze(
    projectEntities(events).filter((entity) => escapedIds.has(entity.id)),
  );
}

export function projectShutdownInvariants(
  events: readonly AuthorityEvent[],
): readonly InvariantResult[] {
  const stop = events.find((event) => event.type === "STOP_INJECTED");
  if (!stop) return [];
  const residuals = projectResidualAuthorities(events);
  const pending = projectPendingWork(events);
  const evidenceFor = (entity: AuthorityEntity) =>
    events.findLast((event) => event.subjectId === entity.id)?.eventId ??
    stop.eventId;
  const groups = [
    {
      invariantId: "no-active-descendants",
      label: "No active descendants",
      entities: residuals.filter((entity) => entity.kind === "agent"),
    },
    {
      invariantId: "no-usable-delegated-credentials",
      label: "No usable delegated credentials",
      entities: residuals.filter((entity) => entity.kind === "credential"),
    },
    {
      invariantId: "no-executable-schedules",
      label: "No executable schedules",
      entities: residuals.filter((entity) => entity.kind === "scheduled_job"),
    },
    {
      invariantId: "no-active-retries",
      label: "No active retries",
      entities: residuals.filter((entity) => entity.kind === "retry_worker"),
    },
    {
      invariantId: "no-committable-queue-items",
      label: "No committable queue items",
      entities: pending,
    },
  ];
  return Object.freeze(
    groups.map(({ invariantId, label, entities }) =>
      Object.freeze({
        invariantId,
        label,
        passed: entities.length === 0,
        evidenceEventIds: Object.freeze([
          stop.eventId,
          ...entities.map(evidenceFor),
        ]),
      }),
    ),
  );
}
