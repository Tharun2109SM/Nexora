'use client'

import { ErrorState } from '@/components/workflow-states'

export default function CustomerOnboardingError({ reset }: { reset: () => void }) {
  return <ErrorState message="Your onboarding status could not be loaded." reset={reset} />
}
