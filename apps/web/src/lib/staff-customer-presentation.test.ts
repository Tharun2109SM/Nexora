import { describe, expect, it } from 'vitest'

import { staffCustomerPresentation } from './staff-customer-presentation'

describe('staff customer administration presentation', () => {
  it('shows the invitation empty state and controls to authorized administrators', () => {
    const presentation = staffCustomerPresentation({
      canManageInvitations: true,
      invitations: [],
      organization: { logoAvailable: false },
      storage: { logoUploadsAvailable: false },
    })

    expect(presentation.invitationControlsVisible).toBe(true)
    expect(presentation.invitationEmptyState).toBe(
      'No invitations have been created for this organization.',
    )
  })

  it('withholds invitation controls from Beau Roi employees', () => {
    const presentation = staffCustomerPresentation({
      canManageInvitations: false,
      invitations: [],
      organization: { logoAvailable: false },
      storage: { logoUploadsAvailable: false },
    })

    expect(presentation.invitationControlsVisible).toBe(false)
    expect(presentation.invitationEmptyState).toBeNull()
  })

  it('presents an honest unavailable state when R2 is not configured', () => {
    const presentation = staffCustomerPresentation({
      canManageInvitations: true,
      invitations: [],
      organization: { logoAvailable: false },
      storage: { logoUploadsAvailable: false },
    })

    expect(presentation.logoUploadUnavailable).toBe(true)
    expect(presentation.logoStatus).toBe('Professional lettermark fallback')
    expect(() => structuredClone(presentation)).not.toThrow()
    expect(JSON.stringify(presentation)).not.toMatch(
      /token_hash|logo_object_key|internal_note|requirement/i,
    )
  })
})
