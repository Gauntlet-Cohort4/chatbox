import type { PluginEventMap } from '@shared/types/plugin-events'
import type Emittery from 'emittery'
import platform from '@/platform'

export type PluginLogEventType =
  | 'tool_invoke'
  | 'tool_result'
  | 'tool_error'
  | 'tool_timeout'
  | 'app_ready'
  | 'app_complete'
  | 'app_crash'
  | 'app_event_log'
  | 'catalog_poll_success'
  | 'catalog_poll_failure'
  | 'catalog_update'
  | 'auth_flow_start'
  | 'auth_flow_success'
  | 'auth_flow_failure'
  | 'bundle_download_start'
  | 'bundle_download_success'
  | 'bundle_hash_mismatch'
  | 'message_validation_failure'
  | 'message_rate_limited'
  | 'marketplace_poll_applied'
  | 'marketplace_poll_unchanged'
  | 'marketplace_poll_not_found'
  | 'marketplace_poll_failure'
  | 'marketplace_register'
  | 'marketplace_exchange_code'

const WARN_SUFFIXES = ['error', 'failure', 'mismatch', 'timeout'] as const

function determineLevel(eventType: PluginLogEventType): 'info' | 'warn' {
  return WARN_SUFFIXES.some((suffix) => eventType.endsWith(suffix)) ? 'warn' : 'info'
}

export function logPluginEvent(
  eventType: PluginLogEventType,
  pluginId: string,
  details?: Record<string, unknown>
): void {
  const level = determineLevel(eventType)
  const message = `[Plugin:${pluginId}] ${eventType}${details ? ` ${JSON.stringify(details)}` : ''}`
  platform.appLog(level, message)
}

export function initPluginLogger(eventBus: Emittery<PluginEventMap>): () => void {
  const unsubscribers: Array<() => void> = []

  unsubscribers.push(
    eventBus.on('tool:invoke-request', (data) => {
      logPluginEvent('tool_invoke', data.pluginId, {
        toolName: data.toolName,
        callId: data.callId,
      })
    })
  )

  unsubscribers.push(
    eventBus.on('tool:result-received', (data) => {
      logPluginEvent('tool_result', data.pluginId, {
        callId: data.callId,
      })
    })
  )

  unsubscribers.push(
    eventBus.on('tool:error-received', (data) => {
      logPluginEvent('tool_error', data.pluginId, {
        callId: data.callId,
        error: data.error,
      })
    })
  )

  unsubscribers.push(
    eventBus.on('plugin:ready', (data) => {
      logPluginEvent('app_ready', data.pluginId)
    })
  )

  unsubscribers.push(
    eventBus.on('plugin:complete', (data) => {
      const truncatedSummary = data.summary.length > 100 ? `${data.summary.slice(0, 100)}...` : data.summary
      logPluginEvent('app_complete', data.pluginId, {
        summary: truncatedSummary,
      })
    })
  )

  unsubscribers.push(
    eventBus.on('plugin:event-log', (data) => {
      logPluginEvent('app_event_log', data.pluginId, {
        eventDescription: data.eventDescription,
      })
    })
  )

  unsubscribers.push(
    eventBus.on('screenshot:request', (data) => {
      logPluginEvent('tool_invoke', data.pluginId, {
        count: data.count,
      })
    })
  )

  unsubscribers.push(
    eventBus.on('screenshot:result', (data) => {
      logPluginEvent('tool_result', data.pluginId, {
        storageKeys: data.storageKeys.length,
      })
    })
  )

  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe()
    }
  }
}
