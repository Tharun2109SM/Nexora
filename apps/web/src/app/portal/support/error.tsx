'use client'

import { ErrorState } from '@/components/workflow-states'

export default function CustomerSupportError({ reset }: { reset: () => void }) {
  return <ErrorState message="The customer Support Center could not be loaded." reset={reset} />
}
