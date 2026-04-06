import { Button, Group, Rating, Stack, Textarea } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { createReview, updateReview } from '../api/endpoints'

interface ReviewFormProps {
  pluginId: string
  mode: 'create' | 'edit'
  initialRating?: number
  initialText?: string | null
  onSubmitted: () => void
}

export function ReviewForm({
  pluginId,
  mode,
  initialRating = 0,
  initialText = '',
  onSubmitted,
}: ReviewFormProps) {
  const [rating, setRating] = useState(initialRating)
  const [text, setText] = useState(initialText ?? '')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (rating < 1 || rating > 5) {
      notifications.show({ title: 'Rating required', message: 'Select 1-5 stars.', color: 'yellow' })
      return
    }
    setSubmitting(true)
    try {
      const payload = { rating, reviewText: text.trim() || undefined }
      if (mode === 'create') {
        await createReview(pluginId, payload)
      } else {
        await updateReview(pluginId, payload)
      }
      notifications.show({ title: 'Review saved', message: 'Thanks for your feedback!', color: 'green' })
      onSubmitted()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save review'
      notifications.show({ title: 'Error', message, color: 'red' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack gap="xs">
      <Rating value={rating} onChange={setRating} size="lg" aria-label="Rate this plugin" />
      <Textarea
        placeholder="Share your experience (optional)"
        value={text}
        onChange={(e) => setText(e.currentTarget.value.slice(0, 500))}
        rows={3}
        maxLength={500}
        description={`${text.length} / 500`}
      />
      <Group justify="flex-end">
        <Button onClick={submit} loading={submitting} disabled={rating === 0}>
          {mode === 'create' ? 'Submit review' : 'Update review'}
        </Button>
      </Group>
    </Stack>
  )
}
