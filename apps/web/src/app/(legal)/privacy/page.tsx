import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Notice' }

export default function PrivacyPage() {
  return (
    <article className="rounded-xl border border-border bg-surface p-7 shadow-card sm:p-10">
      <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.035em]">
        Privacy Notice
      </h1>
      <p className="mt-3 text-sm text-subtle">Draft for company review · August 2026</p>
      <div className="mt-8 space-y-7 text-sm leading-7 text-muted">
        <section>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Information collected
          </h2>
          <p className="mt-2">
            NEXORA collects account, contact, organization, and product-operations information
            needed to provide the platform. Authentication credentials are handled by Supabase Auth;
            NEXORA does not store plain-text passwords.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-semibold text-foreground">
            How information is used
          </h2>
          <p className="mt-2">
            Information is used to operate customer workspaces, deliver support, coordinate
            implementation, maintain security, and improve Beau Roi products and services. Access is
            restricted by organization membership and assigned role.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Company approval required
          </h2>
          <p className="mt-2">
            This milestone notice is an implementation draft, not final legal advice. Beau Roi
            Technologies must approve retention periods, subprocessors, contact details, and
            data-subject procedures before production launch.
          </p>
        </section>
      </div>
    </article>
  )
}
