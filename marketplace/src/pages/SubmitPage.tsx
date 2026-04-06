import {
  Alert,
  Button,
  Checkbox,
  Divider,
  FileInput,
  Group,
  NumberInput,
  Radio,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { submitPlugin } from '../api/endpoints'
import { CATEGORIES } from '../components/CategoryPills'
import { PluginSubmissionSchema } from '../types/plugin'

const MAX_BUNDLE_BYTES = 5 * 1024 * 1024
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024

interface FormState {
  pluginName: string
  description: string
  version: string
  author: string
  authorEmail: string
  category: string
  contentRating: 'safe' | 'educational' | 'general'
  contextPrompt: string
  supportsScreenshot: boolean
  supportsVerboseState: boolean
  supportsEventLog: boolean
  authType: 'none' | 'api-key' | 'oauth2-pkce'
  apiKeyHeader: string
  apiKeyInstructions: string
  oauthAuthUrl: string
  oauthTokenUrl: string
  oauthScopes: string
  oauthClientId: string
  toolsJson: string
  defaultWidth: number
  defaultHeight: number
  isPersistent: boolean
  bundle: File | null
  screenshot: File | null
}

const INITIAL: FormState = {
  pluginName: '',
  description: '',
  version: '1.0.0',
  author: '',
  authorEmail: '',
  category: 'Math',
  contentRating: 'educational',
  contextPrompt: '',
  supportsScreenshot: false,
  supportsVerboseState: false,
  supportsEventLog: false,
  authType: 'none',
  apiKeyHeader: 'X-API-Key',
  apiKeyInstructions: '',
  oauthAuthUrl: '',
  oauthTokenUrl: '',
  oauthScopes: '',
  oauthClientId: '',
  toolsJson: '[]',
  defaultWidth: 400,
  defaultHeight: 600,
  isPersistent: false,
  bundle: null,
  screenshot: null,
}

export function SubmitPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function buildManifest(): unknown {
    let tools: unknown
    try {
      tools = JSON.parse(form.toolsJson)
    } catch {
      throw new Error('Tools JSON is invalid')
    }

    const authentication =
      form.authType === 'none'
        ? { authType: 'none' as const }
        : form.authType === 'api-key'
        ? {
            authType: 'api-key' as const,
            keyHeaderName: form.apiKeyHeader,
            instructions: form.apiKeyInstructions || undefined,
          }
        : {
            authType: 'oauth2-pkce' as const,
            authorizationUrl: form.oauthAuthUrl,
            tokenUrl: form.oauthTokenUrl,
            scopes: form.oauthScopes.split(',').map((s) => s.trim()).filter(Boolean),
            clientId: form.oauthClientId,
          }

    return {
      pluginName: form.pluginName,
      description: form.description,
      version: form.version,
      author: form.author,
      authorEmail: form.authorEmail || undefined,
      category: form.category,
      contentRating: form.contentRating,
      tools,
      userInterface: {
        defaultWidth: form.defaultWidth,
        defaultHeight: form.defaultHeight,
        sandboxPermissions: ['allow-scripts'],
        isPersistent: form.isPersistent,
      },
      authentication,
      contextPrompt: form.contextPrompt || undefined,
      capabilities: {
        supportsScreenshot: form.supportsScreenshot,
        supportsVerboseState: form.supportsVerboseState,
        supportsEventLog: form.supportsEventLog,
      },
    }
  }

  function validateLocal(): Record<string, string> {
    const errs: Record<string, string> = {}
    if (!form.bundle) errs.bundle = 'Bundle file is required'
    else if (form.bundle.size > MAX_BUNDLE_BYTES) errs.bundle = 'Bundle exceeds 5MB'
    else if (!form.bundle.name.toLowerCase().endsWith('.zip')) errs.bundle = 'Bundle must be a .zip file'
    if (form.screenshot && form.screenshot.size > MAX_SCREENSHOT_BYTES) {
      errs.screenshot = 'Screenshot exceeds 2MB'
    }

    let manifest: unknown
    try {
      manifest = buildManifest()
    } catch (err) {
      errs.tools = err instanceof Error ? err.message : 'Invalid tools JSON'
      return errs
    }

    const result = PluginSubmissionSchema.safeParse(manifest)
    if (!result.success) {
      const flat = result.error.flatten()
      for (const [key, messages] of Object.entries(flat.fieldErrors)) {
        if (messages && messages.length > 0) errs[key] = messages[0]
      }
    }
    return errs
  }

  async function handleSubmit() {
    const errs = validateLocal()
    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      notifications.show({
        title: 'Please fix the highlighted errors',
        message: 'Some fields are missing or invalid.',
        color: 'red',
      })
      return
    }

    if (!form.bundle) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('manifest', JSON.stringify(buildManifest()))
      fd.set('bundle', form.bundle)
      if (form.screenshot) fd.set('screenshot', form.screenshot)

      const res = await submitPlugin(fd)
      notifications.show({
        title: 'Plugin submitted',
        message: 'Your plugin is now pending review.',
        color: 'green',
      })
      navigate(`/submit/success?id=${encodeURIComponent(res.pluginId)}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed'
      notifications.show({ title: 'Error', message, color: 'red' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Submit a plugin</Title>
      <Alert color="blue">
        Submissions are reviewed by the ChatBridge team before they appear in the marketplace.
      </Alert>

      <Stack gap="sm">
        <Title order={4}>Plugin info</Title>
        <TextInput
          label="Plugin name"
          required
          value={form.pluginName}
          onChange={(e) => update('pluginName', e.currentTarget.value)}
          error={errors.pluginName}
        />
        <Textarea
          label="Description"
          required
          rows={3}
          value={form.description}
          onChange={(e) => update('description', e.currentTarget.value)}
          error={errors.description}
          maxLength={2000}
          description={`${form.description.length} / 2000`}
        />
        <Group grow>
          <TextInput
            label="Version"
            required
            value={form.version}
            onChange={(e) => update('version', e.currentTarget.value)}
            error={errors.version}
          />
          <Select
            label="Category"
            required
            data={CATEGORIES.filter((c) => c !== 'All').map((c) => ({ value: c, label: c }))}
            value={form.category}
            onChange={(v) => v && update('category', v)}
            error={errors.category}
          />
        </Group>
        <Radio.Group
          label="Content rating"
          value={form.contentRating}
          onChange={(v) => update('contentRating', v as FormState['contentRating'])}
        >
          <Group mt="xs">
            <Radio value="safe" label="Safe" />
            <Radio value="educational" label="Educational" />
            <Radio value="general" label="General" />
          </Group>
        </Radio.Group>
      </Stack>

      <Divider />

      <Stack gap="sm">
        <Title order={4}>Technical</Title>
        <Textarea
          label="Context prompt (optional)"
          description="System prompt shown to the AI when your plugin is active"
          rows={3}
          value={form.contextPrompt}
          onChange={(e) => update('contextPrompt', e.currentTarget.value)}
          maxLength={1000}
        />
        <Textarea
          label="Tools (JSON)"
          description="Array of tool definitions"
          rows={6}
          value={form.toolsJson}
          onChange={(e) => update('toolsJson', e.currentTarget.value)}
          error={errors.tools}
          ff="monospace"
        />
        <Group grow>
          <NumberInput
            label="Default width"
            value={form.defaultWidth}
            onChange={(v) => update('defaultWidth', Number(v) || 400)}
          />
          <NumberInput
            label="Default height"
            value={form.defaultHeight}
            onChange={(v) => update('defaultHeight', Number(v) || 600)}
          />
        </Group>
        <Checkbox
          label="Keep plugin iframe persistent across messages"
          checked={form.isPersistent}
          onChange={(e) => update('isPersistent', e.currentTarget.checked)}
        />
        <Group>
          <Checkbox
            label="Supports screenshot"
            checked={form.supportsScreenshot}
            onChange={(e) => update('supportsScreenshot', e.currentTarget.checked)}
          />
          <Checkbox
            label="Supports verbose state"
            checked={form.supportsVerboseState}
            onChange={(e) => update('supportsVerboseState', e.currentTarget.checked)}
          />
          <Checkbox
            label="Supports event log"
            checked={form.supportsEventLog}
            onChange={(e) => update('supportsEventLog', e.currentTarget.checked)}
          />
        </Group>
      </Stack>

      <Divider />

      <Stack gap="sm">
        <Title order={4}>Authentication</Title>
        <Radio.Group
          value={form.authType}
          onChange={(v) => update('authType', v as FormState['authType'])}
        >
          <Group>
            <Radio value="none" label="None" />
            <Radio value="api-key" label="API Key" />
            <Radio value="oauth2-pkce" label="OAuth2 PKCE" />
          </Group>
        </Radio.Group>
        {form.authType === 'api-key' && (
          <>
            <TextInput
              label="API key header name"
              value={form.apiKeyHeader}
              onChange={(e) => update('apiKeyHeader', e.currentTarget.value)}
            />
            <Textarea
              label="Instructions for users"
              value={form.apiKeyInstructions}
              onChange={(e) => update('apiKeyInstructions', e.currentTarget.value)}
            />
          </>
        )}
        {form.authType === 'oauth2-pkce' && (
          <>
            <TextInput
              label="Authorization URL"
              value={form.oauthAuthUrl}
              onChange={(e) => update('oauthAuthUrl', e.currentTarget.value)}
            />
            <TextInput
              label="Token URL"
              value={form.oauthTokenUrl}
              onChange={(e) => update('oauthTokenUrl', e.currentTarget.value)}
            />
            <TextInput
              label="Scopes (comma-separated)"
              value={form.oauthScopes}
              onChange={(e) => update('oauthScopes', e.currentTarget.value)}
            />
            <TextInput
              label="Client ID"
              value={form.oauthClientId}
              onChange={(e) => update('oauthClientId', e.currentTarget.value)}
            />
          </>
        )}
      </Stack>

      <Divider />

      <Stack gap="sm">
        <Title order={4}>Files</Title>
        <FileInput
          label="Bundle (.zip, max 5MB)"
          required
          accept=".zip,application/zip"
          value={form.bundle}
          onChange={(f) => update('bundle', f)}
          error={errors.bundle}
        />
        <FileInput
          label="Screenshot (.png/.jpg, max 2MB)"
          accept="image/png,image/jpeg"
          value={form.screenshot}
          onChange={(f) => update('screenshot', f)}
          error={errors.screenshot}
        />
      </Stack>

      <Divider />

      <Stack gap="sm">
        <Title order={4}>Author</Title>
        <TextInput
          label="Author name"
          required
          value={form.author}
          onChange={(e) => update('author', e.currentTarget.value)}
          error={errors.author}
        />
        <TextInput
          label="Author email (optional, not public)"
          value={form.authorEmail}
          onChange={(e) => update('authorEmail', e.currentTarget.value)}
          error={errors.authorEmail}
        />
      </Stack>

      <Group justify="flex-end">
        <Button size="lg" onClick={handleSubmit} loading={submitting}>
          Submit plugin
        </Button>
      </Group>
      {Object.keys(errors).length > 0 && (
        <Text size="xs" c="red">
          Fix the highlighted fields to continue.
        </Text>
      )}
    </Stack>
  )
}
