'use client'

import { ErrorState } from '@/components/workflow-states'

export default function CustomerImplementationError({ reset }: { reset: () => void }) {
  return <ErrorState message="Your implementation status could not be loaded." reset={reset} />
}
