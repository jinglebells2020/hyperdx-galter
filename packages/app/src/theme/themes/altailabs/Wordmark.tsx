import React from 'react';

import Logomark from './Logomark';

/**
 * AltaiLabs Wordmark — italic-A + uppercase "ALTAILABS".
 *
 * Typography per the AltaiLabs brand book:
 *   - Family: Barlow Condensed (free open-source stand-in until Trade
 *     Gothic Condensed No. 18 is licensed).
 *   - Weight: 500, uppercase, tracking 0.02em.
 *   - First letter italic, rest roman — the single mark of the brand.
 *
 * The font is expected to be present on the page (HyperDX loads its
 * own fonts via _document.tsx; this falls back to system-condensed
 * sans-serifs if Barlow Condensed is unavailable).
 */
const WORDMARK_STACK =
  "'Barlow Condensed', 'Trade Gothic Next LT Pro Cn', 'Helvetica Neue Condensed', Arial, sans-serif";

export default function Wordmark() {
  return (
    <div className="align-items-center d-flex">
      <div
        className="me-2"
        style={{ display: 'inline-flex', alignItems: 'center' }}
      >
        <Logomark size={20} />
      </div>
      <span
        style={{
          fontFamily: WORDMARK_STACK,
          fontWeight: 500,
          fontSize: 18,
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
          lineHeight: 1,
        }}
      >
        <span style={{ fontStyle: 'italic', marginRight: '0.02em' }}>A</span>
        <span style={{ fontStyle: 'normal' }}>LTAILABS</span>
      </span>
    </div>
  );
}
