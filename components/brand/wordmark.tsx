import { Mark } from "./mark";

export function Wordmark() {
  return (
    <span className="wordmark" aria-label="Quiesce">
      <Mark size={18} />
      QUIESCE<span aria-hidden="true">/</span>
    </span>
  );
}
