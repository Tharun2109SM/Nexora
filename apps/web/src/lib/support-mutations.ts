export type SupportMutation =
  | { assigneeId: string | null; kind: 'assignee' }
  | { body: string; kind: 'internal-note' | 'reply' }
  | { categoryId: string; kind: 'category' }
  | { kind: 'priority'; priority: string }
  | { kind: 'status'; resolutionSummary?: string; status: string }

export function supportMutationRequest(ticketId: string, mutation: SupportMutation) {
  const base = `/support/tickets/${ticketId}`
  switch (mutation.kind) {
    case 'assignee':
      return {
        body: { assigneeId: mutation.assigneeId },
        method: 'PATCH',
        path: `${base}/assignee`,
      } as const
    case 'reply':
      return { body: { body: mutation.body }, method: 'POST', path: `${base}/replies` } as const
    case 'internal-note':
      return {
        body: { body: mutation.body },
        method: 'POST',
        path: `${base}/internal-notes`,
      } as const
    case 'status':
      return {
        body: {
          ...(mutation.resolutionSummary ? { resolutionSummary: mutation.resolutionSummary } : {}),
          status: mutation.status,
        },
        method: 'PATCH',
        path: `${base}/status`,
      } as const
    case 'priority':
      return {
        body: { priority: mutation.priority },
        method: 'PATCH',
        path: `${base}/priority`,
      } as const
    case 'category':
      return {
        body: { categoryId: mutation.categoryId },
        method: 'PATCH',
        path: `${base}/category`,
      } as const
  }
}
