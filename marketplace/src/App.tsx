import { BrowserRouter, Route, Routes } from 'react-router-dom'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>{title}</h1>
      <p>Coming soon...</p>
    </div>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlaceholderPage title="Browse Marketplace" />} />
        <Route path="/plugin/:pluginId" element={<PlaceholderPage title="Plugin Detail" />} />
        <Route path="/classroom" element={<PlaceholderPage title="My Classroom" />} />
        <Route path="/submit" element={<PlaceholderPage title="Submit Plugin" />} />
        <Route path="/admin" element={<PlaceholderPage title="Admin Panel" />} />
      </Routes>
    </BrowserRouter>
  )
}
