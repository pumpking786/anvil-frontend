import { useId } from 'react';

/** Lightweight architectural linework for the portal, outside document previews. */
export function PortalArtwork() {
  const id = useId();
  return (
    <div className="portal-artwork" aria-hidden="true">
      <svg viewBox="0 0 720 230" fill="none" focusable="false">
        <defs>
          <pattern id={`${id}-grid`} width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" className="portal-grid-line" />
          </pattern>
          <linearGradient id={`${id}-fade`} x1="0" x2="720" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" stopOpacity="0" />
            <stop offset=".45" stopColor="white" stopOpacity=".8" />
            <stop offset="1" stopColor="white" stopOpacity=".15" />
          </linearGradient>
          <mask id={`${id}-mask`}>
            <rect width="720" height="230" fill={`url(#${id}-fade)`} />
          </mask>
        </defs>
        <g mask={`url(#${id}-mask)`}>
          <rect width="720" height="230" fill={`url(#${id}-grid)`} />
          <g className="portal-circuit-lines" strokeLinejoin="round">
            <path d="M40 46H250L282 78H410L442 46H710" />
            <path d="M160 174H292L340 126H458L490 94H720" />
            <path d="M305 14H404L436 46V94L468 126H590L622 158H710" />
            <path d="M335 206H438L470 174H550L582 142V110" />
            <path d="M495 14L527 46V78" />
          </g>
          <g className="portal-circuit-nodes">
            <circle cx="250" cy="46" r="3" />
            <circle cx="340" cy="126" r="3" />
            <circle cx="458" cy="126" r="3" />
            <circle cx="590" cy="126" r="3" />
            <circle cx="527" cy="78" r="3" />
            <circle cx="582" cy="110" r="3" />
          </g>
          <g className="portal-circuit-chips">
            <rect x="477" y="35" width="22" height="22" rx="5" />
            <rect x="358" y="114" width="24" height="24" rx="6" />
            <path d="M484 42H492V50H484Z M366 122H374V130H366Z" />
          </g>
        </g>
      </svg>
    </div>
  );
}
