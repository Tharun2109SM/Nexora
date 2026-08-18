interface StaffCustomerPresentationInput {
  canManageInvitations: boolean
  invitations: readonly unknown[]
  organization: { logoAvailable: boolean }
  storage: { logoUploadsAvailable: boolean }
}

export interface StaffCustomerPresentation {
  invitationControlsVisible: boolean
  invitationEmptyState: string | null
  logoStatus: string
  logoUploadUnavailable: boolean
}

export function staffCustomerPresentation(
  data: StaffCustomerPresentationInput,
): StaffCustomerPresentation {
  return {
    invitationControlsVisible: data.canManageInvitations,
    invitationEmptyState:
      data.canManageInvitations && data.invitations.length === 0
        ? 'No invitations have been created for this organization.'
        : null,
    logoStatus: data.organization.logoAvailable
      ? 'Private company logo available'
      : 'Professional lettermark fallback',
    logoUploadUnavailable: !data.storage.logoUploadsAvailable,
  }
}
