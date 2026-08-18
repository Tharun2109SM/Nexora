'use client'

import { ErrorState } from '@/components/workflow-states'

export default function OnboardingError({ reset }: { reset: () => void }) {
  return <ErrorState message="Onboarding could not be loaded." reset={reset} />
}
