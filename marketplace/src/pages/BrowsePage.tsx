import { Group, Pagination, Stack, Text } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listCategories, listPlugins, type ListPluginsOptions } from '../api/endpoints'
import { CategoryPills } from '../components/CategoryPills'
import { PluginGrid } from '../components/PluginGrid'
import { SearchBar } from '../components/SearchBar'
import { SortDropdown, type SortKey } from '../components/SortDropdown'
import { useDebounce } from '../hooks/useDebounce'
import type { PluginListItem } from '../types/api'

const PAGE_SIZE = 24

export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const category = searchParams.get('category') ?? 'All'
  const search = searchParams.get('search') ?? ''
  const sort = (searchParams.get('sort') as SortKey) ?? 'rating'
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)

  const [searchInput, setSearchInput] = useState(search)
  const debouncedSearch = useDebounce(searchInput, 300)

  const [plugins, setPlugins] = useState<PluginListItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({})

  // Sync debounced search back into URL
  useEffect(() => {
    if (debouncedSearch === search) return
    const next = new URLSearchParams(searchParams)
    if (debouncedSearch) next.set('search', debouncedSearch)
    else next.delete('search')
    next.set('page', '1')
    setSearchParams(next, { replace: true })
  }, [debouncedSearch, search, searchParams, setSearchParams])

  // Fetch category counts once
  useEffect(() => {
    listCategories()
      .then((res) => {
        const counts: Record<string, number> = {}
        let total = 0
        for (const c of res.categories) {
          counts[c.name] = c.count
          total += c.count
        }
        counts.All = total
        setCategoryCounts(counts)
      })
      .catch(() => setCategoryCounts({}))
  }, [])

  // Fetch plugins whenever filters change
  useEffect(() => {
    setIsLoading(true)
    const opts: ListPluginsOptions = {
      category: category === 'All' ? undefined : category,
      search: search || undefined,
      sort,
      page,
      limit: PAGE_SIZE,
    }
    listPlugins(opts)
      .then((res) => {
        setPlugins(res.plugins)
        setTotal(res.total)
        setIsLoading(false)
      })
      .catch(() => {
        setPlugins([])
        setTotal(0)
        setIsLoading(false)
      })
  }, [category, search, sort, page])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total])

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams)
    if (value && value !== 'All') next.set(key, value)
    else next.delete(key)
    next.set('page', '1')
    setSearchParams(next, { replace: true })
  }

  return (
    <Stack gap="lg">
      <SearchBar value={searchInput} onChange={setSearchInput} />
      <CategoryPills selected={category} counts={categoryCounts} onSelect={(c) => updateParam('category', c)} />
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {isLoading ? 'Loading…' : `Showing ${plugins.length} of ${total} plugin${total === 1 ? '' : 's'}`}
        </Text>
        <SortDropdown value={sort} onChange={(s) => updateParam('sort', s)} />
      </Group>
      <PluginGrid plugins={plugins} isLoading={isLoading} />
      {totalPages > 1 && (
        <Group justify="center">
          <Pagination
            value={page}
            onChange={(p) => {
              const next = new URLSearchParams(searchParams)
              next.set('page', String(p))
              setSearchParams(next, { replace: true })
            }}
            total={totalPages}
          />
        </Group>
      )}
    </Stack>
  )
}
