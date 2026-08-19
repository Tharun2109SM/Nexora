export type FeedbackMutation =
  | { body: string; kind: 'message' | 'response' | 'internal-note' }
  | { kind: 'status'; status: string }
  | { isPublic: boolean; kind: 'triage'; priority: string | null; severity: string | null }
  | { kind: 'vote'; remove: boolean }

export function feedbackMutationRequest(id: string, mutation: FeedbackMutation) {
  const root = `/feedback/${id}`
  switch (mutation.kind) {
    case 'message':
      return { body: { body: mutation.body }, method: 'POST', path: `${root}/messages` }
    case 'response':
      return { body: { body: mutation.body }, method: 'POST', path: `${root}/responses` }
    case 'internal-note':
      return { body: { body: mutation.body }, method: 'POST', path: `${root}/internal-notes` }
    case 'status':
      return { body: { status: mutation.status }, method: 'PATCH', path: `${root}/status` }
    case 'triage':
      return {
        body: {
          isPublic: mutation.isPublic,
          priority: mutation.priority,
          severity: mutation.severity,
        },
        method: 'PATCH',
        path: `${root}/triage`,
      }
    case 'vote':
      return { body: undefined, method: mutation.remove ? 'DELETE' : 'POST', path: `${root}/vote` }
  }
}
