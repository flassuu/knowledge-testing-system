import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { qrSvg } from '../src/utils/qr.ts'

describe('qr code generator', () => {
  it('renders a QR for a join link', () => {
    const svg = qrSvg('http://192.168.1.65:3300/?join=JV8Z9B')
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    assert.match(svg, /viewBox="0 0 \d+ \d+"/)
    assert.match(svg, /<path/)
  })

  it('draws on an opaque white background so a projector cannot break scanning', () => {
    const svg = qrSvg('http://192.168.1.65:3300/?join=JV8Z9B')
    assert.match(svg, /<rect fill="#ffffff"/)
    assert.match(svg, /<path fill="#000000"/)
  })

  it('returns nothing for blank input, so the caller can hide the frame', () => {
    assert.equal(qrSvg(''), '')
    assert.equal(qrSvg('   '), '')
  })

  it('grows with the payload but stays within the size a phone camera reads', () => {
    const short = qrSvg('http://10.0.0.5:3300/?join=ABC123')
    const long = qrSvg('http://a-very-long-hostname.example.internal:3300/?join=ABC123')
    const sizeOf = (svg: string) => Number(/viewBox="0 0 (\d+)/.exec(svg)?.[1] ?? 0)
    assert.ok(sizeOf(short) > 0)
    assert.ok(sizeOf(long) >= sizeOf(short))
    // Under 600 modules means a version below 15: scannable from a distance.
    assert.ok(sizeOf(long) / 10 <= 60, `unexpectedly large: ${sizeOf(long)}`)
  })
})
