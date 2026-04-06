import { describe, expect, it } from 'vitest'
import { PluginManifestSchema, PluginSubmissionSchema } from '../../src/types/plugin'

describe('Phase 0 scaffold', () => {
  it('exports PluginManifestSchema', () => {
    expect(PluginManifestSchema).toBeDefined()
  })

  it('exports PluginSubmissionSchema', () => {
    expect(PluginSubmissionSchema).toBeDefined()
  })

  it('PluginSubmissionSchema validates a minimal valid submission', () => {
    const submission = {
      pluginName: 'Test Plugin',
      description: 'A test plugin',
      version: '1.0.0',
      author: 'Test Author',
      category: 'Math',
      contentRating: 'educational' as const,
      tools: [],
      userInterface: {
        defaultWidth: 400,
        defaultHeight: 600,
        sandboxPermissions: ['allow-scripts'],
        isPersistent: false,
      },
      authentication: { authType: 'none' as const },
      capabilities: {
        supportsScreenshot: false,
        supportsVerboseState: false,
        supportsEventLog: false,
      },
    }
    const result = PluginSubmissionSchema.safeParse(submission)
    expect(result.success).toBe(true)
  })

  it('PluginSubmissionSchema rejects empty plugin name', () => {
    const submission = {
      pluginName: '',
      description: 'A test plugin',
      version: '1.0.0',
      author: 'Test Author',
      category: 'Math',
      contentRating: 'educational' as const,
      tools: [],
      userInterface: {},
      authentication: { authType: 'none' as const },
      capabilities: {},
    }
    const result = PluginSubmissionSchema.safeParse(submission)
    expect(result.success).toBe(false)
  })
})
