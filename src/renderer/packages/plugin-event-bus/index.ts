import Emittery from 'emittery'
import type { PluginEventMap } from '@shared/types/plugin-events'

export const pluginEventBus = new Emittery<PluginEventMap>()
