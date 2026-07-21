/**
 * The Quiesce mark: a teal STOP glyph inside an instrument frame with
 * corner-reticle ticks, echoing the authority-topology and empty-state
 * visual language used throughout the app. Colors are the literal design
 * tokens (ink/line-strong/line/still) rather than CSS variables so the mark
 * renders identically in contexts without app/globals.css, such as
 * app/icon.svg and app/apple-icon.tsx.
 */
export function Mark({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="30"
        height="30"
        rx="7"
        fill="#101418"
        stroke="#3b4754"
        strokeWidth="1"
      />
      <path
        d="M7 4V7H4"
        stroke="#2c3540"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M25 28V25H28"
        stroke="#2c3540"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="12" y="12" width="8" height="8" rx="1.5" fill="#7fd1c8" />
    </svg>
  );
}
