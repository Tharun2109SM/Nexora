export function knowledgeParams(
  values: Record<string, string | string[] | undefined>,
  staff: boolean,
) {
  const params = new URLSearchParams({ limit: '24' })
  const allowed = ['categoryId', 'cursor', 'productId', 'search', 'sort', 'type']
  if (staff) allowed.push('status')
  for (const key of allowed) {
    const value = values[key]
    if (typeof value === 'string' && value) params.set(key, value)
  }
  return params
}
