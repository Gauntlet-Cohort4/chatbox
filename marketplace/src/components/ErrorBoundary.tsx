import { Alert, Button, Center, Code, Stack, Title } from '@mantine/core'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console (in production, send to a monitoring service)
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <Center h="80vh">
          <Stack gap="md" maw={500}>
            <Title order={2}>Something went wrong</Title>
            <Alert color="red">
              The marketplace hit an unexpected error. Try refreshing, or go back to browsing.
            </Alert>
            <Code block>{this.state.error.message}</Code>
            <Button onClick={this.reset}>Try again</Button>
          </Stack>
        </Center>
      )
    }
    return this.props.children
  }
}
