import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Terms and Conditions' }

export default function TermsPage() {
  return (
    <article className="rounded-xl border border-border bg-surface p-7 shadow-card sm:p-10">
      <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">Legal</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.035em]">
        Terms and Conditions
      </h1>
      <p className="mt-3 text-sm text-subtle">Draft for company review · August 2026</p>
      <div className="mt-8 space-y-7 text-sm leading-7 text-muted">
        <section>
          <h2 className="font-display text-xl font-semibold text-foreground">Use of NEXORA</h2>
          <p className="mt-2">
            NEXORA is provided for authorized business use by Beau Roi Technologies Private Limited,
            its employees, customers, and approved collaborators. Users must keep account
            credentials confidential and use only information they are authorized to access.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Customer responsibilities
          </h2>
          <p className="mt-2">
            Customer administrators are responsible for the accuracy of organization details and for
            ensuring that invited users are authorized to act for their company. Misuse, attempted
            unauthorized access, or disruption of the service is prohibited.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-semibold text-foreground">
            Company approval required
          </h2>
          <p className="mt-2">
            These milestone terms are an implementation draft and must be reviewed and approved by
            Beau Roi Technologies before production launch. The approved legal text will replace
            this notice before public deployment.
          </p>
        </section>
      </div>
    </article>
  )
}
