import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Code,
  Group,
  Loader,
  PasswordInput,
  Stack,
  Tabs,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useCallback, useEffect, useState } from 'react'
import {
  adminApproveSubmission,
  adminListReports,
  adminListSubmissions,
  adminRejectSubmission,
  adminResolveReport,
} from '../api/endpoints'
import { ApiClientError } from '../api/client'
import { getStoredAdminToken, setStoredAdminToken } from '../components/AdminGuard'

interface SubmissionRow {
  pluginId: string
  pluginName: string
  description: string
  author: string
  category: string
  bundleSizeBytes: number | null
  submittedAt: number
}

interface ReportRow {
  reportId: string
  pluginId: string
  pluginName: string
  reporterId: string
  reportReason: string
  reportDetails: string | null
  reportStatus: string
  createdAt: number
  resolutionNotes: string | null
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString()
}

export function AdminPage() {
  const [token, setToken] = useState<string | null>(getStoredAdminToken())
  const [tokenInput, setTokenInput] = useState('')
  const [tokenError, setTokenError] = useState<string | null>(null)

  async function tryToken() {
    setTokenError(null)
    setStoredAdminToken(tokenInput)
    try {
      await adminListSubmissions()
      setToken(tokenInput)
      notifications.show({ title: 'Signed in', message: 'Admin access granted.', color: 'green' })
    } catch (err) {
      setStoredAdminToken(null)
      if (err instanceof ApiClientError && err.status === 401) {
        setTokenError('Invalid admin token')
      } else {
        setTokenError('Failed to verify token')
      }
    }
  }

  if (!token) {
    return (
      <Center h={400}>
        <Card withBorder padding="lg" w={400}>
          <Stack>
            <Title order={3}>Admin sign-in</Title>
            <Text size="sm" c="dimmed">
              Enter the admin token to access submissions and reports.
            </Text>
            <PasswordInput
              value={tokenInput}
              onChange={(e) => setTokenInput(e.currentTarget.value)}
              placeholder="Admin token"
              error={tokenError}
            />
            <Button onClick={tryToken}>Enter</Button>
          </Stack>
        </Card>
      </Center>
    )
  }

  return <AdminPanel onSignOut={() => { setStoredAdminToken(null); setToken(null); setTokenInput('') }} />
}

interface AdminPanelProps {
  onSignOut: () => void
}

function AdminPanel({ onSignOut }: AdminPanelProps) {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [subRes, repRes] = await Promise.all([adminListSubmissions(), adminListReports()])
      setSubmissions(subRes.submissions as unknown as SubmissionRow[])
      setReports(repRes.reports as unknown as ReportRow[])
    } catch {
      // show empty
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function approve(pluginId: string) {
    try {
      await adminApproveSubmission(pluginId)
      notifications.show({ title: 'Approved', message: pluginId, color: 'green' })
      void load()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Approve failed'
      notifications.show({ title: 'Error', message, color: 'red' })
    }
  }

  function reject(pluginId: string) {
    let reason = ''
    modals.openConfirmModal({
      title: 'Reject submission',
      children: (
        <Textarea
          label="Rejection reason"
          required
          onChange={(e) => {
            reason = e.currentTarget.value
          }}
          placeholder="Explain why this plugin is being rejected"
          rows={4}
        />
      ),
      labels: { confirm: 'Reject', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        if (!reason.trim()) {
          notifications.show({ title: 'Reason required', message: 'Please provide a reason.', color: 'red' })
          return
        }
        try {
          await adminRejectSubmission(pluginId, reason.trim())
          notifications.show({ title: 'Rejected', message: pluginId, color: 'orange' })
          void load()
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Reject failed'
          notifications.show({ title: 'Error', message, color: 'red' })
        }
      },
    })
  }

  async function resolve(reportId: string, resolution: 'resolved' | 'dismissed') {
    try {
      await adminResolveReport(reportId, resolution)
      notifications.show({ title: resolution, message: reportId, color: 'green' })
      void load()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Resolve failed'
      notifications.show({ title: 'Error', message, color: 'red' })
    }
  }

  if (loading) {
    return (
      <Center h={400}>
        <Loader />
      </Center>
    )
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Admin panel</Title>
        <Button variant="subtle" onClick={onSignOut}>
          Sign out
        </Button>
      </Group>

      <Group>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed">
            Pending submissions
          </Text>
          <Text size="xl" fw={700}>
            {submissions.length}
          </Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed">
            Open reports
          </Text>
          <Text size="xl" fw={700}>
            {reports.filter((r) => r.reportStatus === 'open').length}
          </Text>
        </Card>
      </Group>

      <Tabs defaultValue="submissions">
        <Tabs.List>
          <Tabs.Tab value="submissions">Submissions ({submissions.length})</Tabs.Tab>
          <Tabs.Tab value="reports">Reports ({reports.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="submissions" pt="md">
          {submissions.length === 0 ? (
            <Alert color="blue">No pending submissions.</Alert>
          ) : (
            <Stack gap="sm">
              {submissions.map((s) => (
                <Card key={s.pluginId} withBorder padding="md">
                  <Group justify="space-between" mb="xs">
                    <div>
                      <Text fw={600}>{s.pluginName}</Text>
                      <Text size="xs" c="dimmed">
                        by {s.author} · {s.category} · {formatBytes(s.bundleSizeBytes)} · submitted{' '}
                        {formatDate(s.submittedAt)}
                      </Text>
                    </div>
                    <Group>
                      <Button size="xs" color="green" onClick={() => void approve(s.pluginId)}>
                        Approve
                      </Button>
                      <Button size="xs" color="red" variant="light" onClick={() => reject(s.pluginId)}>
                        Reject
                      </Button>
                    </Group>
                  </Group>
                  <Text size="sm">{s.description}</Text>
                  <Code mt="xs" fz="xs">
                    {s.pluginId}
                  </Code>
                </Card>
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="reports" pt="md">
          {reports.length === 0 ? (
            <Alert color="blue">No reports.</Alert>
          ) : (
            <Stack gap="sm">
              {reports.map((r) => (
                <Card key={r.reportId} withBorder padding="md">
                  <Group justify="space-between" mb="xs">
                    <div>
                      <Text fw={600}>{r.pluginName}</Text>
                      <Text size="xs" c="dimmed">
                        {r.reportReason} · filed {formatDate(r.createdAt)}
                      </Text>
                    </div>
                    <Badge color={r.reportStatus === 'open' ? 'red' : 'gray'}>{r.reportStatus}</Badge>
                  </Group>
                  {r.reportDetails && <Text size="sm">{r.reportDetails}</Text>}
                  {r.reportStatus === 'open' && (
                    <Group mt="xs">
                      <Button size="xs" color="green" onClick={() => void resolve(r.reportId, 'resolved')}>
                        Resolve
                      </Button>
                      <Button size="xs" variant="light" onClick={() => void resolve(r.reportId, 'dismissed')}>
                        Dismiss
                      </Button>
                    </Group>
                  )}
                </Card>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
