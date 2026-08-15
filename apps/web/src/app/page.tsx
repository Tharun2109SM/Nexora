import {
  ArrowRight,
  BookOpen,
  Check,
  CircleGauge,
  ClipboardCheck,
  LifeBuoy,
  LockKeyhole,
  MessagesSquare,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react'

import { PublicFooter } from '@/components/public-footer'
import { PublicHeader } from '@/components/public-header'
import { ButtonLink } from '@/components/ui'

const capabilities = [
  {
    description: 'Coordinate plans, owners, training, documents, and implementation milestones.',
    icon: ClipboardCheck,
    title: 'Move from kickoff to value',
  },
  {
    description: 'Keep support conversations, priorities, SLAs, and product context in one place.',
    icon: LifeBuoy,
    title: 'Resolve issues with context',
  },
  {
    description: 'Connect feedback, releases, adoption signals, and customer health over time.',
    icon: CircleGauge,
    title: 'Turn signals into action',
  },
] as const

const workflow = [
  { icon: ClipboardCheck, label: 'Onboarding', note: 'Shared plan and customer actions' },
  { icon: PackageCheck, label: 'Implementation', note: 'Milestones, notes, and readiness' },
  { icon: MessagesSquare, label: 'Ongoing success', note: 'Support, feedback, and releases' },
] as const

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas">
      <PublicHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:72px_72px] opacity-[0.16] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
          />
          <div className="relative mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-10 lg:py-28">
            <div className="max-w-2xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-muted shadow-card">
                <span className="size-1.5 rounded-full bg-accent" />
                Product operations, connected end to end
              </p>
              <h1 className="font-display text-[clamp(2.75rem,6vw,5.25rem)] leading-[0.98] font-semibold tracking-[-0.055em] text-foreground">
                One operating system for every customer outcome.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-muted">
                NEXORA gives Beau Roi teams and their customers a secure shared workspace for
                onboarding, implementation, support, feedback, releases, and long-term success.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <ButtonLink className="h-11 px-5" href="/register">
                  Create your organization <ArrowRight aria-hidden size={17} />
                </ButtonLink>
                <ButtonLink className="h-11 px-5" href="/login" variant="secondary">
                  Sign in to NEXORA
                </ButtonLink>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
                {['Organization-isolated', 'Role-aware access', 'Built for both teams'].map(
                  (item) => (
                    <span className="inline-flex items-center gap-2" key={item}>
                      <Check aria-hidden className="text-success" size={15} /> {item}
                    </span>
                  ),
                )}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
              <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-accent-soft opacity-60 blur-2xl" />
              <div className="overflow-hidden rounded-xl border border-border-strong bg-surface-raised shadow-[0_24px_80px_rgb(15_23_42/0.14)]">
                <div className="flex h-11 items-center justify-between border-b border-border bg-surface-subtle px-4">
                  <div className="flex gap-1.5" aria-hidden="true">
                    <span className="size-2 rounded-full bg-border-strong" />
                    <span className="size-2 rounded-full bg-border-strong" />
                    <span className="size-2 rounded-full bg-border-strong" />
                  </div>
                  <p className="text-[0.7rem] font-semibold tracking-[0.12em] text-subtle uppercase">
                    Customer journey
                  </p>
                  <ShieldCheck aria-hidden className="text-success" size={15} />
                </div>
                <div className="p-5 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold text-accent">SHARED WORKSPACE</p>
                      <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
                        From agreement to adoption
                      </h2>
                    </div>
                    <span className="rounded-md border border-border bg-surface-subtle px-2.5 py-1 text-xs font-medium text-muted">
                      Secure
                    </span>
                  </div>
                  <div className="mt-7 space-y-3">
                    {workflow.map((item, index) => (
                      <div
                        className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 rounded-lg border border-border bg-canvas/45 p-3.5"
                        key={item.label}
                      >
                        <span className="grid size-9 place-items-center rounded-md bg-accent-soft text-accent">
                          <item.icon aria-hidden size={17} />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-foreground">
                            {item.label}
                          </span>
                          <span className="block text-xs text-muted">{item.note}</span>
                        </span>
                        <span className="font-display text-sm font-semibold text-subtle">
                          0{index + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-between rounded-lg border border-accent/25 bg-accent-soft px-4 py-3">
                    <span className="text-xs font-semibold text-foreground">
                      One current view for every stakeholder
                    </span>
                    <ArrowRight aria-hidden className="text-accent" size={16} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-10" id="platform">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
              The operating layer
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Keep work visible without adding noise.
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Each team sees the information and actions relevant to them, while the underlying
              customer record stays connected.
            </p>
          </div>
          <div className="mt-12 grid border-y border-border md:grid-cols-3 md:divide-x md:divide-y-0">
            {capabilities.map((item) => (
              <article
                className="border-b border-border px-1 py-8 last:border-b-0 md:border-b-0 md:px-8 md:first:pl-0 md:last:pr-0"
                key={item.title}
              >
                <item.icon aria-hidden className="text-accent" size={22} strokeWidth={1.8} />
                <h3 className="mt-5 font-display text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-surface" id="workspaces">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:px-10 lg:py-24">
            <article className="rounded-xl border border-border bg-canvas p-7 shadow-card sm:p-9">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent">
                  <CircleGauge aria-hidden size={19} />
                </span>
                <span className="text-xs font-semibold tracking-[0.12em] text-subtle uppercase">
                  Beau Roi portal
                </span>
              </div>
              <h2 className="mt-8 font-display text-3xl font-semibold tracking-[-0.025em]">
                Operate the customer portfolio.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Give product, implementation, support, and customer-success teams one governed view
                of each customer.
              </p>
              <ul className="mt-7 grid gap-3 text-sm text-foreground sm:grid-cols-2">
                {[
                  'Customer management',
                  'Implementation',
                  'Support & feedback',
                  'Releases & analytics',
                ].map((item) => (
                  <li className="flex items-center gap-2" key={item}>
                    <Check aria-hidden className="text-success" size={15} /> {item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-xl border border-border bg-canvas p-7 shadow-card sm:p-9">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent">
                  <BookOpen aria-hidden size={19} />
                </span>
                <span className="text-xs font-semibold tracking-[0.12em] text-subtle uppercase">
                  Customer portal
                </span>
              </div>
              <h2 className="mt-8 font-display text-3xl font-semibold tracking-[-0.025em]">
                Give customers a clear next step.
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Customers can follow progress, complete assigned actions, get help, and stay current
                without chasing status updates.
              </p>
              <ul className="mt-7 grid gap-3 text-sm text-foreground sm:grid-cols-2">
                {['Assigned actions', 'Project status', 'Support center', 'Product updates'].map(
                  (item) => (
                    <li className="flex items-center gap-2" key={item}>
                      <Check aria-hidden className="text-success" size={15} /> {item}
                    </li>
                  ),
                )}
              </ul>
            </article>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-10 lg:py-24" id="security">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <span className="grid size-11 place-items-center rounded-lg border border-border bg-surface text-accent shadow-card">
                <LockKeyhole aria-hidden size={20} />
              </span>
              <h2 className="mt-6 font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Tenant boundaries are part of the foundation.
              </h2>
            </div>
            <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              {[
                [
                  'Database-enforced isolation',
                  'Customer-owned records are scoped by organization at the database layer.',
                ],
                [
                  'Role-based authorization',
                  'Portal access follows stored memberships and roles—not an email-domain guess.',
                ],
                [
                  'Server-validated requests',
                  'Protected API operations verify the caller before business logic runs.',
                ],
                [
                  'Auditable by design',
                  'The data foundation includes timestamps, ownership, and audit-event support.',
                ],
              ].map(([title, description]) => (
                <div className="bg-surface p-6" key={title}>
                  <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-surface-subtle">
          <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-16 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-accent uppercase">
                Start together
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.03em]">
                Create your customer workspace.
              </h2>
            </div>
            <ButtonLink className="h-11 shrink-0 px-5" href="/register">
              Create organization <ArrowRight aria-hidden size={17} />
            </ButtonLink>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
