import { Button, Center, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <Center h="60vh">
      <Stack gap="md" align="center">
        <Title order={1}>404</Title>
        <Text c="dimmed" size="lg">
          The page you're looking for doesn't exist.
        </Text>
        <Button component={Link} to="/" variant="light">
          Back to marketplace
        </Button>
      </Stack>
    </Center>
  )
}
