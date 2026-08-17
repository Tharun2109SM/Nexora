'use client'

import { ErrorState } from '@/components/workflow-states'

export default function ImplementationError({ reset }: { reset: () => void }) {
  return <ErrorState message="Implementation could not be loaded." reset={reset} />
}
