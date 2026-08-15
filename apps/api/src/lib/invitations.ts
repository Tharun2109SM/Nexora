export interface InvitationDelivery {
  configured: boolean
  deliver(input: { email: string; invitationUrl: string }): Promise<void>
}

class DisabledInvitationDelivery implements InvitationDelivery {
  readonly configured = false

  deliver(): Promise<void> {
    return Promise.resolve()
  }
}

export const invitationDelivery: InvitationDelivery = new DisabledInvitationDelivery()
