/**
 * AltaiLabs Logomark — italic-A glyph.
 *
 * The brand's identity rule is "first letter italic, rest roman". The
 * standalone mark distils that to a single italic A built from two
 * slanted strokes and a crossbar; the slant carries the same -7° angle
 * as the wordmark italic.
 */
export default function Logomark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer "A" — left and right strokes meeting at the apex.
          Slight skew (~7°) so the mark reads italic at any size. */}
      <path
        d="M5.5 21 L11 3.6 L13 3.6 L18.5 21"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      {/* Crossbar */}
      <path
        d="M8.5 14 L15.5 14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="square"
      />
    </svg>
  );
}
