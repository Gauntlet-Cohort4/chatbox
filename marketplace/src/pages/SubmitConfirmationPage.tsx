import { Alert, Anchor, Button, Center, Stack, Text, Title } from '@mantine/core'
import { Link, useSearchParams } from 'react-router-dom'

export function SubmitConfirmationPage() {
  const [params] = useSearchParams()
  const pluginId = params.get('id') ?? 'unknown'

  return (
    <Center h={400}>
      <Stack align="center" gap="md" maw={500} ta="center">
        <Title order={2}>Plugin submitted!</Title>
        <Alert color="green" w="100%">
          Your plugin is now pending review. You will receive an email when an admin approves or
          rejects it.
        </Alert>
        <Text size="sm" c="dimmed">
          Plugin ID: <code>{pluginId}</code>
        </Text>
        <Stack gap="xs" w="100%">
          <Button component={Link} to="/submit" variant="light">
            Submit another plugin
          </Button>
          <Anchor component={Link} to="/">
            Back to marketplace
          </Anchor>
        </Stack>
      </Stack>
    </Center>
  )
}
