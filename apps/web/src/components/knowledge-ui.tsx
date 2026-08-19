'use client'

import type {
  customerKnowledgeArticleSchema,
  knowledgeMetadataResponseSchema,
  staffKnowledgeArticleDetailSchema,
  staffKnowledgeArticleSchema,
} from '@nexora/contracts'
import { ArrowRight, BookOpen, ExternalLink, FileWarning, Paperclip } from 'lucide-react'
import Link from 'next/link'
import { useActionState } from 'react'
import type { z } from 'zod'

import {
  createKnowledgeArticleAction,
  transitionKnowledgeAction,
  updateKnowledgeContentAction,
  updateKnowledgeScopeAction,
} from '@/app/knowledge-actions'
import { cn } from '@/lib/utils'

import { EmptyState, buttonClassName } from './ui'

type CustomerArticle = Omit<z.infer<typeof customerKnowledgeArticleSchema>, 'body'>
type StaffArticle = z.infer<typeof staffKnowledgeArticleSchema>
type StaffDetail = z.infer<typeof staffKnowledgeArticleDetailSchema>
type Metadata = z.infer<typeof knowledgeMetadataResponseSchema>
const inputClass =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20'
const textAreaClass = cn(inputClass, 'h-auto min-h-28 py-2')
export function KnowledgeBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-muted">
      {children.replaceAll('_', ' ')}
    </span>
  )
}
export function KnowledgePortfolio({
  articles,
  customer,
  nextHref,
}: {
  articles: (CustomerArticle | StaffArticle)[]
  customer: boolean
  nextHref: string | null
}) {
  if (!articles.length)
    return (
      <EmptyState
        description={
          customer
            ? 'No published guidance matches these filters. Only content approved for your organization appears here.'
            : 'No real knowledge articles match this view. Create the first article when approved content is ready.'
        }
        icon={<BookOpen aria-hidden size={19} />}
        note="NEXORA never inserts sample articles as production content."
        title="No knowledge articles"
      />
    )
  const root = customer ? '/portal/knowledge-base' : '/beauroi/knowledge-base'
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {articles.map((article) => (
          <article
            className="min-w-0 rounded-lg border border-border bg-surface p-5 shadow-card"
            key={article.id}
          >
            <div className="flex flex-wrap gap-2">
              <KnowledgeBadge>{article.articleType}</KnowledgeBadge>
              {'articleStatus' in article && (
                <KnowledgeBadge>{article.articleStatus}</KnowledgeBadge>
              )}
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold leading-tight">
              {article.title}
            </h2>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">
              {article.summary ?? 'No summary has been provided.'}
            </p>
            <dl className="mt-4 space-y-1 text-xs text-subtle">
              <div>
                <dt className="inline font-semibold">Product: </dt>
                <dd className="inline">{article.product?.name ?? 'All products'}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Category: </dt>
                <dd className="inline">{article.category?.name ?? 'Uncategorized'}</dd>
              </div>
            </dl>
            <div className="mt-5 flex justify-end">
              <Link className={buttonClassName('secondary')} href={`${root}/${article.id}`}>
                {customer ? 'Read article' : 'Open workspace'} <ArrowRight size={15} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      {nextHref && (
        <div className="flex justify-end">
          <Link className={buttonClassName('secondary')} href={nextHref}>
            Next page <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </div>
  )
}
export function KnowledgeFilters({ metadata, staff }: { metadata: Metadata; staff: boolean }) {
  return (
    <form
      className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5"
      method="get"
    >
      <label className="lg:col-span-2">
        <span className="sr-only">Search articles</span>
        <input className={inputClass} name="search" placeholder="Search approved content" />
      </label>
      <label>
        <span className="sr-only">Product</span>
        <select className={inputClass} name="productId">
          <option value="">All products</option>
          {metadata.products.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Article type</span>
        <select className={inputClass} name="type">
          <option value="">All types</option>
          {['GUIDE', 'FAQ', 'REFERENCE', 'TROUBLESHOOTING', 'ANNOUNCEMENT'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      {staff ? (
        <label>
          <span className="sr-only">Status</span>
          <select className={inputClass} name="status">
            <option value="">All states</option>
            {['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      ) : (
        <button className={buttonClassName()} type="submit">
          Search
        </button>
      )}
      {staff && (
        <button className={buttonClassName()} type="submit">
          Apply filters
        </button>
      )}
    </form>
  )
}
function ActionMessage({ state }: { state: { error?: string; success?: string } }) {
  if (!state.error && !state.success) return null
  return (
    <p className={cn('text-sm', state.error ? 'text-danger' : 'text-success')} role="status">
      {state.error ?? state.success}
    </p>
  )
}
function ScopeFields({ metadata, article }: { metadata: Metadata; article?: StaffDetail }) {
  return (
    <>
      <label className="space-y-1 text-sm">
        <span>Type</span>
        <select
          className={inputClass}
          defaultValue={article?.articleType ?? 'GUIDE'}
          name="articleType"
        >
          {['GUIDE', 'FAQ', 'REFERENCE', 'TROUBLESHOOTING', 'ANNOUNCEMENT'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span>Audience</span>
        <select
          className={inputClass}
          defaultValue={article?.audience ?? 'INTERNAL'}
          name="audience"
        >
          {['INTERNAL', 'ALL_CUSTOMERS', 'PRODUCT_SCOPED', 'SELECTED_ORGANIZATION'].map((value) => (
            <option key={value}>{value.replaceAll('_', ' ')}</option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span>Product</span>
        <select className={inputClass} defaultValue={article?.product?.id ?? ''} name="productId">
          <option value="">All products</option>
          {metadata.products.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span>Category</span>
        <select className={inputClass} defaultValue={article?.category?.id ?? ''} name="categoryId">
          <option value="">Uncategorized</option>
          {metadata.categories
            .filter((item) => item.isActive)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span>Selected organization</span>
        <select
          className={inputClass}
          defaultValue={article?.organization?.id ?? ''}
          name="organizationId"
        >
          <option value="">None</option>
          {metadata.organizations.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
export function KnowledgeCreateForm({ metadata }: { metadata: Metadata }) {
  const [state, action, pending] = useActionState(createKnowledgeArticleAction, {})
  return (
    <details className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <summary className="cursor-pointer font-semibold">Create knowledge article</summary>
      <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm md:col-span-2">
          <span>Title</span>
          <input className={inputClass} name="title" required />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>Summary</span>
          <textarea className={textAreaClass} name="summary" />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span>Content</span>
          <textarea className={cn(textAreaClass, 'min-h-56')} name="body" required />
        </label>
        <ScopeFields metadata={metadata} />
        <label className="space-y-1 text-sm md:col-span-2">
          <span>External resource URL (optional)</span>
          <input className={inputClass} name="externalUrl" type="url" />
        </label>
        <ActionMessage state={state} />
        <div className="flex justify-end md:col-span-2">
          <button className={buttonClassName()} disabled={pending} type="submit">
            {pending ? 'Creating…' : 'Create draft'}
          </button>
        </div>
      </form>
    </details>
  )
}
export function KnowledgeStaffEditor({
  article,
  metadata,
}: {
  article: StaffDetail
  metadata: Metadata
}) {
  const [contentState, contentAction, contentPending] = useActionState(
    updateKnowledgeContentAction.bind(null, article.id),
    {},
  )
  const [scopeState, scopeAction, scopePending] = useActionState(
    updateKnowledgeScopeAction.bind(null, article.id),
    {},
  )
  const [transitionState, transitionAction, transitionPending] = useActionState(
    transitionKnowledgeAction.bind(null, article.id),
    {},
  )
  const editable = ['DRAFT', 'IN_REVIEW'].includes(article.articleStatus)
  const transitions: Record<string, string[]> = {
    DRAFT: ['IN_REVIEW'],
    IN_REVIEW: ['DRAFT', 'PUBLISHED'],
    PUBLISHED: ['ARCHIVED'],
    ARCHIVED: [],
  }
  return (
    <div className="space-y-6">
      {editable && (
        <>
          <form
            action={contentAction}
            className="grid gap-4 rounded-lg border border-border bg-surface p-5 shadow-card"
          >
            <h2 className="font-display text-xl font-semibold">Article content</h2>
            <label className="space-y-1 text-sm">
              <span>Title</span>
              <input className={inputClass} defaultValue={article.title} name="title" required />
            </label>
            <label className="space-y-1 text-sm">
              <span>Summary</span>
              <textarea
                className={textAreaClass}
                defaultValue={article.summary ?? ''}
                name="summary"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>Plain-text content</span>
              <textarea
                className={cn(textAreaClass, 'min-h-80')}
                defaultValue={article.body}
                name="body"
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span>External URL</span>
              <input
                className={inputClass}
                defaultValue={article.externalUrl ?? ''}
                name="externalUrl"
                type="url"
              />
            </label>
            <ActionMessage state={contentState} />
            <button className={buttonClassName()} disabled={contentPending} type="submit">
              Save content
            </button>
          </form>
          <form
            action={scopeAction}
            className="grid gap-4 rounded-lg border border-border bg-surface p-5 shadow-card md:grid-cols-2"
          >
            <h2 className="font-display text-xl font-semibold md:col-span-2">
              Scope and classification
            </h2>
            <ScopeFields article={article} metadata={metadata} />
            <ActionMessage state={scopeState} />
            <button className={buttonClassName()} disabled={scopePending} type="submit">
              Save scope
            </button>
          </form>
        </>
      )}
      <form
        action={transitionAction}
        className="rounded-lg border border-border bg-surface p-5 shadow-card"
      >
        <h2 className="font-display text-xl font-semibold">Lifecycle</h2>
        <p className="mt-1 text-sm text-muted">
          Current state: {article.articleStatus.replaceAll('_', ' ')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {transitions[article.articleStatus]?.map((status) => (
            <button
              className={buttonClassName(status === 'PUBLISHED' ? 'primary' : 'secondary')}
              disabled={transitionPending}
              key={status}
              name="status"
              type="submit"
              value={status}
            >
              {status.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
        <ActionMessage state={transitionState} />
      </form>
      <AttachmentState available={metadata.attachmentsAvailable} />
    </div>
  )
}
export function AttachmentState({ available }: { available: boolean }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <div className="flex items-center gap-3">
        <Paperclip className="text-muted" size={19} />
        <h2 className="font-display text-xl font-semibold">Attachments</h2>
      </div>
      {available ? (
        <p className="mt-3 text-sm text-muted">
          Secure attachment controls are available through configured private storage.
        </p>
      ) : (
        <div className="mt-3 flex gap-3 rounded-md border border-warning/30 bg-warning-soft p-4">
          <FileWarning className="mt-0.5 shrink-0 text-warning" size={18} />
          <div>
            <p className="text-sm font-semibold">Attachments unavailable</p>
            <p className="mt-1 text-sm text-muted">
              Cloudflare R2 is not configured. Article content remains fully available; no upload
              control or private object key is exposed.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
export function KnowledgeArticleDocument({
  article,
}: {
  article: z.infer<typeof customerKnowledgeArticleSchema>
}) {
  return (
    <article className="mx-auto max-w-3xl">
      <div className="flex flex-wrap gap-2">
        <KnowledgeBadge>{article.articleType}</KnowledgeBadge>
        {article.product && <KnowledgeBadge>{article.product.name}</KnowledgeBadge>}
      </div>
      <h1 className="mt-5 font-display text-4xl font-semibold tracking-tight">{article.title}</h1>
      {article.summary && <p className="mt-4 text-lg leading-8 text-muted">{article.summary}</p>}
      <div className="mt-6 border-t border-border pt-6 whitespace-pre-wrap text-[0.98rem] leading-7">
        {article.body}
      </div>
      {article.externalUrl && (
        <a
          className={cn(buttonClassName('secondary'), 'mt-8')}
          href={article.externalUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open approved resource <ExternalLink size={15} />
        </a>
      )}
    </article>
  )
}
