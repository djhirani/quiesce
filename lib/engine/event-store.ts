import type {
  AuthorityEvent,
  AuthorityEventPayload,
  NewAuthorityEvent,
} from "@/lib/domain/events";

const FIXED_TEST_EPOCH_MS = Date.parse("2026-01-01T00:00:00.000Z");

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export class AppendOnlyEventStore {
  readonly #runId: string;
  readonly #scenarioSeed: string;
  readonly #events: AuthorityEvent[] = [];

  constructor(runId: string, scenarioSeed: string) {
    this.#runId = runId;
    this.#scenarioSeed = scenarioSeed;
  }

  append<TPayload extends AuthorityEventPayload>(
    input: NewAuthorityEvent & { readonly payload: TPayload },
  ): AuthorityEvent<TPayload> {
    if (
      input.causedByEventId !== null &&
      !this.#events.some((event) => event.eventId === input.causedByEventId)
    ) {
      throw new Error(`Unknown caused-by event: ${input.causedByEventId}`);
    }

    const eventIndex = this.#events.length + 1;
    const event = deepFreeze({
      ...input,
      eventIndex,
      eventId: `E-${String(eventIndex).padStart(3, "0")}`,
      runId: this.#runId,
      scenarioSeed: this.#scenarioSeed,
      wallTimeIso: new Date(
        FIXED_TEST_EPOCH_MS + input.logicalTimeMs,
      ).toISOString(),
      previousEventHash: null,
      eventHash: null,
    }) as AuthorityEvent<TPayload>;

    this.#events.push(event);
    return event;
  }

  history(): readonly AuthorityEvent[] {
    return Object.freeze([...this.#events]);
  }
}
