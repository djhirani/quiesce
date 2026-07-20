import type { AuthorityEvent } from "@/lib/domain/events";
import { entityIds } from "@/lib/fixtures/cloud-cleanup";
import { projectStatuses } from "./projectors";

export interface CommitFenceEvaluation {
  readonly issuedAuthorityEpoch: number;
  readonly minimumValidAuthorityEpoch: number;
  readonly currentAuthorityEpoch: number;
  readonly credentialStatus: string | undefined;
  readonly commitGateStatus: "open" | "sealed";
  readonly mayCommit: boolean;
  readonly rejectionReason:
    "stale_authority" | "credential_invalid" | "gate_sealed" | null;
}

export function evaluateCommitFence(
  events: readonly AuthorityEvent[],
  issuedAuthorityEpoch: number,
): CommitFenceEvaluation {
  const advanced = events.findLast(
    (event) => event.type === "AUTHORITY_EPOCH_ADVANCED",
  );
  const currentAuthorityEpoch =
    typeof advanced?.payload.currentEpoch === "number"
      ? advanced.payload.currentEpoch
      : issuedAuthorityEpoch;
  const gate = events.findLast((event) => event.type === "COMMIT_GATE_SEALED");
  const minimumValidAuthorityEpoch =
    typeof gate?.payload.minimumValidAuthorityEpoch === "number"
      ? gate.payload.minimumValidAuthorityEpoch
      : issuedAuthorityEpoch;
  const credentialStatus = projectStatuses(events)[entityIds.credential];
  const commitGateStatus = gate ? "sealed" : "open";
  const stale = issuedAuthorityEpoch < minimumValidAuthorityEpoch;
  const rejectionReason = stale
    ? "stale_authority"
    : credentialStatus !== "valid"
      ? "credential_invalid"
      : commitGateStatus !== "open"
        ? "gate_sealed"
        : null;
  return Object.freeze({
    issuedAuthorityEpoch,
    minimumValidAuthorityEpoch,
    currentAuthorityEpoch,
    credentialStatus,
    commitGateStatus,
    mayCommit: rejectionReason === null,
    rejectionReason,
  });
}
