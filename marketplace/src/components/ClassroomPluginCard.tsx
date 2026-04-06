import { Badge, Box, Button, Card, Group, Image, Stack, Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import {
  approveTeacherPlugin,
  deployTeacherPlugin,
  getPluginImageUrl,
  removeTeacherPlugin,
  revokeTeacherPlugin,
} from '../api/endpoints'
import type { TeacherPlugin } from '../types/api'

interface ClassroomPluginCardProps {
  plugin: TeacherPlugin
  teacherId: string
  onChanged: () => void
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending_review: { color: 'yellow', label: 'Pending review' },
  approved: { color: 'blue', label: 'Approved' },
  deployed: { color: 'green', label: 'Deployed' },
  revoked: { color: 'red', label: 'Revoked' },
}

export function ClassroomPluginCard({ plugin, teacherId, onChanged }: ClassroomPluginCardProps) {
  const [busy, setBusy] = useState(false)

  async function runAction(name: string, action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      notifications.show({ title: name, message: 'Done.', color: 'green' })
      onChanged()
    } catch (err) {
      const message = err instanceof Error ? err.message : `${name} failed`
      notifications.show({ title: 'Error', message, color: 'red' })
    } finally {
      setBusy(false)
    }
  }

  function confirmAndRun(name: string, body: string, action: () => Promise<unknown>) {
    modals.openConfirmModal({
      title: name,
      children: <Text size="sm">{body}</Text>,
      labels: { confirm: name, cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => void runAction(name, action),
    })
  }

  const status = STATUS_META[plugin.status] ?? { color: 'gray', label: plugin.status }

  const actions: Array<{ label: string; onClick: () => void; variant?: string; color?: string }> = []

  if (plugin.status === 'pending_review') {
    actions.push({
      label: 'Approve',
      onClick: () => void runAction('Approve', () => approveTeacherPlugin(teacherId, plugin.pluginId)),
      color: 'green',
    })
  } else if (plugin.status === 'approved') {
    actions.push({
      label: 'Deploy to Students',
      onClick: () => void runAction('Deploy', () => deployTeacherPlugin(teacherId, plugin.pluginId)),
    })
  } else if (plugin.status === 'deployed') {
    actions.push({
      label: 'Revoke',
      onClick: () =>
        confirmAndRun(
          'Revoke',
          'Students will no longer see this plugin after their next sync. You can re-deploy it later.',
          () => revokeTeacherPlugin(teacherId, plugin.pluginId)
        ),
      color: 'orange',
      variant: 'light',
    })
  } else if (plugin.status === 'revoked') {
    actions.push({
      label: 'Re-deploy',
      onClick: () => void runAction('Re-deploy', () => deployTeacherPlugin(teacherId, plugin.pluginId)),
    })
  }

  actions.push({
    label: 'Remove',
    onClick: () =>
      confirmAndRun(
        'Remove',
        'This removes the plugin from your classroom completely. You can add it again from the marketplace.',
        () => removeTeacherPlugin(teacherId, plugin.pluginId)
      ),
    variant: 'subtle',
    color: 'red',
  })

  return (
    <Card withBorder padding="md">
      <Group align="flex-start" wrap="nowrap">
        {plugin.screenshotKey ? (
          <Image
            src={getPluginImageUrl(plugin.pluginId)}
            alt={`Screenshot of ${plugin.pluginName}`}
            w={120}
            h={80}
            fit="cover"
            radius="sm"
          />
        ) : (
          <Box
            w={120}
            h={80}
            style={{
              borderRadius: 4,
              background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
              flexShrink: 0,
            }}
          />
        )}
        <Stack gap="xs" flex={1} style={{ minWidth: 0 }}>
          <Group justify="space-between" wrap="nowrap">
            <Text fw={600} size="sm" truncate>
              {plugin.pluginName}
            </Text>
            <Badge color={status.color} variant="light" size="sm">
              {status.label}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" truncate>
            by {plugin.author} · {plugin.category}
          </Text>
          <Group gap="xs">
            {actions.map((a) => (
              <Button
                key={a.label}
                size="xs"
                color={a.color}
                variant={a.variant ?? 'filled'}
                loading={busy}
                onClick={a.onClick}
              >
                {a.label}
              </Button>
            ))}
          </Group>
        </Stack>
      </Group>
    </Card>
  )
}
