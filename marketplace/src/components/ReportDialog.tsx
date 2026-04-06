import { Button, Group, Modal, Select, Stack, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { createReport } from '../api/endpoints'

interface ReportDialogProps {
  pluginId: string
  opened: boolean
  onClose: () => void
}

const REASONS = [
  'Inappropriate content',
  'Not educational',
  'Broken/non-functional',
  'Security concern',
  'Other',
]

export function ReportDialog({ pluginId, opened, onClose }: ReportDialogProps) {
  const [reason, setReason] = useState<string>(REASONS[0])
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setSubmitting(true)
    try {
      await createReport(pluginId, { reportReason: reason, reportDetails: details.trim() || undefined })
      notifications.show({ title: 'Report submitted', message: 'Thanks — admins will review it.', color: 'green' })
      onClose()
      setDetails('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit report'
      notifications.show({ title: 'Error', message, color: 'red' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Report plugin" centered>
      <Stack>
        <Select
          label="Reason"
          value={reason}
          onChange={(v) => v && setReason(v)}
          data={REASONS}
          allowDeselect={false}
        />
        <Textarea
          label="Details (optional)"
          value={details}
          onChange={(e) => setDetails(e.currentTarget.value.slice(0, 1000))}
          rows={4}
          maxLength={1000}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" onClick={submit} loading={submitting}>
            Submit report
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
