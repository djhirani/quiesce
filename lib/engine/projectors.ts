import type { NextLegalCommand, SimulationPhase } from "@/lib/domain/commands";
import type { AuthorityEdge, AuthorityEntity } from "@/lib/domain/entities";
import type { AuthorityEvent } from "@/lib/domain/events";

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
  if (events.at(-1)?.type === "SCENARIO_READY") return "ready_to_stop";
  return "building_authority";
}

export function projectNextLegalCommand(
  events: readonly AuthorityEvent[],
): NextLegalCommand {
  const phase = projectPhase(events);
  if (phase === "idle") return "START_RUN";
  if (phase === "building_authority") return "ADVANCE_TO_READY";
  return null;
}
