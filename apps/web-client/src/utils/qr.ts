import { renderSVG } from 'uqr'

/**
 * Renders `text` as an SVG QR code, or an empty string for blank input.
 *
 * Black on white is fixed on purpose: a code has to stay scannable on a
 * projector in a bright classroom, and the design rules for theme tokens do not
 * apply to machine-readable codes.
 */
export function qrSvg(text: string): string {
  if (!text.trim()) return ''
  return renderSVG(text, {
    ecc: 'M',
    border: 2,
    boostEcc: true,
    blackColor: '#000000',
    whiteColor: '#ffffff',
  })
}
