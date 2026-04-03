import type { PluginEventMap } from '@shared/types/plugin-events'
import Emittery from 'emittery'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initPluginLogger, logPluginEvent } from './logger'

vi.mock('@/platform', () => ({
  default: {
    appLog: vi.fn().mockResolvedValue(undefined),
  },
}))

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
const getPlatformMock = async () => {
  const mod = await import('@/platform')
  return mod.default as { appLog: ReturnType<typeof vi.fn> }
}

describe('logPluginEvent', () => {
  let platform: { appLog: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    platform = await getPlatformMock()
    platform.appLog.mockClear()
  })

  // Info level tests
  it('calls platform.appLog with "info" level for "tool_invoke" type', () => {
    logPluginEvent('tool_invoke', 'test-plugin')
    expect(platform.appLog).toHaveBeenCalledWith('info', expect.any(String))
  })

  it('calls platform.appLog with "info" level for "app_ready" type', () => {
    logPluginEvent('app_ready', 'test-plugin')
    expect(platform.appLog).toHaveBeenCalledWith('info', expect.any(String))
  })

  it('calls platform.appLog with "info" level for "catalog_poll_success" type', () => {
    logPluginEvent('catalog_poll_success', 'test-plugin')
    expect(platform.appLog).toHaveBeenCalledWith('info', expect.any(String))
  })

  // Warn level tests
  it('calls platform.appLog with "warn" level for "tool_error" type', () => {
    logPluginEvent('tool_error', 'test-plugin')
    expect(platform.appLog).toHaveBeenCalledWith('warn', expect.any(String))
  })

  it('calls platform.appLog with "warn" level for "tool_timeout" type', () => {
    logPluginEvent('tool_timeout', 'test-plugin')
    expect(platform.appLog).toHaveBeenCalledWith('warn', expect.any(String))
  })

  it('calls platform.appLog with "warn" level for "catalog_poll_failure" type', () => {
    logPluginEvent('catalog_poll_failure', 'test-plugin')
    expect(platform.appLog).toHaveBeenCalledWith('warn', expect.any(String))
  })

  it('calls platform.appLog with "warn" level for "bundle_hash_mismatch" type', () => {
    logPluginEvent('bundle_hash_mismatch', 'test-plugin')
    expect(platform.appLog).toHaveBeenCalledWith('warn', expect.any(String))
  })

  it('calls platform.appLog with "warn" level for "message_validation_failure" type', () => {
    logPluginEvent('message_validation_failure', 'test-plugin')
    expect(platform.appLog).toHaveBeenCalledWith('warn', expect.any(String))
  })

  // Format tests
  it('formats message with [Plugin:{pluginId}] prefix', () => {
    logPluginEvent('tool_invoke', 'my-plugin')
    expect(platform.appLog).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('[Plugin:my-plugin]'))
  })

  it('includes eventType in message', () => {
    logPluginEvent('app_ready', 'test-plugin')
    expect(platform.appLog).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('app_ready'))
  })

  it('includes JSON stringified details when provided', () => {
    const details = { key: 'value', count: 42 }
    logPluginEvent('tool_invoke', 'test-plugin', details)
    expect(platform.appLog).toHaveBeenCalledWith(expect.any(String), expect.stringContaining(JSON.stringify(details)))
  })

  it('omits details section when details is undefined', () => {
    logPluginEvent('tool_invoke', 'test-plugin')
    const calledMessage = platform.appLog.mock.calls[0][1] as string
    // Message should end with the eventType, no trailing JSON
    expect(calledMessage).toBe('[Plugin:test-plugin] tool_invoke')
  })
})

describe('initPluginLogger', () => {
  let eventBus: Emittery<PluginEventMap>
  let platform: { appLog: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    eventBus = new Emittery<PluginEventMap>()
    platform = await getPlatformMock()
    platform.appLog.mockClear()
  })

  it('subscribes to tool:invoke-request event', async () => {
    initPluginLogger(eventBus)
    await eventBus.emit('tool:invoke-request', {
      pluginId: 'p1',
      callId: 'c1',
      toolName: 'test_tool',
      args: {},
    })
    expect(platform.appLog).toHaveBeenCalledWith('info', expect.stringContaining('tool_invoke'))
  })

  it('subscribes to tool:result-received event', async () => {
    initPluginLogger(eventBus)
    await eventBus.emit('tool:result-received', {
      pluginId: 'p1',
      callId: 'c1',
      result: 'ok',
    })
    expect(platform.appLog).toHaveBeenCalledWith('info', expect.stringContaining('tool_result'))
  })

  it('subscribes to tool:error-received event', async () => {
    initPluginLogger(eventBus)
    await eventBus.emit('tool:error-received', {
      pluginId: 'p1',
      callId: 'c1',
      error: 'something failed',
    })
    expect(platform.appLog).toHaveBeenCalledWith('warn', expect.stringContaining('tool_error'))
  })

  it('subscribes to plugin:ready event', async () => {
    initPluginLogger(eventBus)
    await eventBus.emit('plugin:ready', { pluginId: 'p1' })
    expect(platform.appLog).toHaveBeenCalledWith('info', expect.stringContaining('app_ready'))
  })

  it('subscribes to plugin:complete event', async () => {
    initPluginLogger(eventBus)
    await eventBus.emit('plugin:complete', {
      pluginId: 'p1',
      summary: 'Done processing',
    })
    expect(platform.appLog).toHaveBeenCalledWith('info', expect.stringContaining('app_complete'))
  })

  it('subscribes to plugin:event-log event', async () => {
    initPluginLogger(eventBus)
    await eventBus.emit('plugin:event-log', {
      pluginId: 'p1',
      eventDescription: 'something happened',
      eventTimestamp: Date.now(),
    })
    expect(platform.appLog).toHaveBeenCalledWith('info', expect.stringContaining('app_event_log'))
  })

  it('cleanup function unsubscribes from all events', async () => {
    const cleanup = initPluginLogger(eventBus)
    cleanup()

    await eventBus.emit('tool:invoke-request', {
      pluginId: 'p1',
      callId: 'c1',
      toolName: 'test_tool',
      args: {},
    })
    await eventBus.emit('plugin:ready', { pluginId: 'p1' })

    expect(platform.appLog).not.toHaveBeenCalled()
  })
})
