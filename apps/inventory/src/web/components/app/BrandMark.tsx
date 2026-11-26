/*
 * Geometry from @beep/brand (MIT, Copyright (c) 2026 beep-effect); the notice is in public/LICENSE-brand.txt.
 */

/**
 * Benjamin's mark: a lambda wearing pixel glasses, on a 24-unit grid. The lambda is drawn in `--brand`; the glasses
 * take the page's ink (`--foreground`) and paper (`--background`), so the mark reads in both themes. Decorative beside
 * the app's name, so it is hidden from screen readers. Size it with a class (`size-7`).
 */
export function BrandMark(props: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={props.className}>
      <g className="stroke-brand" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 20l6.5 -9" />
        <path d="M19 20c-6 0 -6 -16 -12 -16" />
      </g>
      <g transform="translate(5.4, 9.5) scale(0.52) rotate(8 12.5 2.5)">
        <path className="fill-foreground" d="m0,0v2h1v1h1v1h7v-1h1v-1h1v-2h2v2h1v1h1v1h6v-1h1v-1h1v-1h1v-2z" />
        <path className="fill-background" d="m2,1v1h4v2h1v-1h-2v-2h-1v3h1v-1h-2v-2z" />
        <path className="fill-background" d="m15,1v1h4v2h1v-1h-2v-2h-1v3h1v-1h-2v-2z" />
      </g>
    </svg>
  )
}
