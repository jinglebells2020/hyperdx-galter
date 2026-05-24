/**
 * Mooldir Logomark — italic-M glyph.
 *
 * The brand's identity rule is "first letter italic, rest roman". The
 * standalone mark distils that to a single italic M built from four
 * slanted strokes; the slant carries the same -7° angle as the wordmark
 * italic.
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
      {/* Italic "M" — four diagonal strokes from baseline to apex and
          back, slanted ~7° so the mark reads italic at any size. */}
      <path
        d="M4 21 L7 3.6 L12 17 L17 3.6 L20 21"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
    </svg>
  );
}
