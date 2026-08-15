export function customerFilterUrl(
  pathname: string,
  current: { toString(): string },
  name: string,
  value: string,
): string {
  const params = new URLSearchParams(current.toString())
  if (value) params.set(name, value)
  else params.delete(name)
  params.delete('cursor')
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}
