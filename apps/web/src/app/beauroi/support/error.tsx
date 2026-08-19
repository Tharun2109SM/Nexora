'use client'

import { ErrorState } from '@/components/workflow-states'

export default function SupportError({ reset }: { reset: () => void }) {
  return <ErrorState message="The Product Support workspace could not be loaded." reset={reset} />
}
