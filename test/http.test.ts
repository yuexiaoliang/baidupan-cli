import { describe, expect, it } from 'vitest'
import { resolveRequestTimeout } from '../src/api/http'

describe('resolveRequestTimeout', () => {
  it('uses five minutes when the value is missing or invalid', () => {
    expect(resolveRequestTimeout()).toBe(300_000)
    expect(resolveRequestTimeout('invalid')).toBe(300_000)
    expect(resolveRequestTimeout('0')).toBe(300_000)
    expect(resolveRequestTimeout('-1')).toBe(300_000)
  })

  it('uses a positive timeout supplied by the environment', () => {
    expect(resolveRequestTimeout('120000')).toBe(120_000)
  })
})
