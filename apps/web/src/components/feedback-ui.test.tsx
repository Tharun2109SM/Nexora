import {
  customerFeedbackDetailSchema,
  feedbackListResponseSchema,
  staffFeedbackDetailSchema,
} from '@nexora/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { FeedbackQueue } from './feedback-queue'
import { FeedbackWorkspace } from './feedback-workspace'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const timestamp = '2026-08-19T08:00:00.000Z'
const person = { designation: null, fullName: 'Customer User', id }
const row = feedbackListResponseSchema.parse({
  data: [
    {
      createdAt: timestamp,
      id,
      isPublic: true,
      lastActivityAt: timestamp,
      organization: { id, name: 'Customer' },
      priority: 'HIGH',
      product: { id, name: 'NEXORA' },
      requester: person,
      severity: null,
      status: 'UNDER_REVIEW',
      title: 'Feature request',
      type: 'FEATURE_REQUEST',
      votes: { count: 3, hasVoted: false },
    },
  ],
  nextCursor: null,
}).data[0]
if (!row) throw new Error('Feedback fixture is required')
const base = {
  ...row,
  bug: null,
  description: 'Customer-visible detail',
  events: [{ actor: person, createdAt: timestamp, eventType: 'SUBMITTED', id }],
  feature: { desiredOutcome: 'Less manual work', problemStatement: 'Manual work is slow' },
  messages: [{ author: person, body: 'Customer-visible response', createdAt: timestamp, id }],
  storage: { attachmentsAvailable: false },
  updatedAt: timestamp,
}
const customer = customerFeedbackDetailSchema.parse(base)
const staff = staffFeedbackDetailSchema.parse({
  ...base,
  capabilities: {
    canAddInternalNote: true,
    canChangeStatus: true,
    canPublish: true,
    canRespond: true,
    canTriage: true,
  },
  events: [
    { actor: person, createdAt: timestamp, customerVisible: true, eventType: 'SUBMITTED', id },
  ],
  messages: [
    ...base.messages.map((message) => ({ ...message, isInternal: false })),
    {
      author: { ...person, id: second, fullName: 'Staff User' },
      body: 'PRIVATE TRIAGE NOTE',
      createdAt: timestamp,
      id: second,
      isInternal: true,
    },
  ],
})

describe('feedback UI', () => {
  it('renders responsive queue and honest empty states', () => {
    const html = renderToStaticMarkup(
      <FeedbackQueue filtered={false} nextHref={null} rows={[row]} staff />,
    )
    expect(html).toContain('Feature request')
    expect(html).toContain('3 votes')
    expect(
      renderToStaticMarkup(<FeedbackQueue filtered={false} nextHref={null} rows={[]} staff />),
    ).toContain('No feedback yet')
  })
  it('renders staff triage and isolated internal notes', () => {
    const html = renderToStaticMarkup(<FeedbackWorkspace data={staff} staff />)
    expect(html).toContain('Internal triage notes')
    expect(html).toContain('PRIVATE TRIAGE NOTE')
    expect(html).toContain('Triage controls')
    expect(html).toContain('Status workflow')
    expect(html).toContain('value="IN_PROGRESS"')
    expect(html).toContain('>IN PROGRESS</option>')
    expect(html).toContain('File actions unavailable')
    expect(html).not.toContain('objectKey')
  })
  it('keeps customer presentation free of internal content and controls', () => {
    const html = renderToStaticMarkup(<FeedbackWorkspace data={customer} staff={false} />)
    expect(html).toContain('Customer-visible response')
    expect(html).toContain('Vote for this request')
    expect(html).not.toContain('PRIVATE TRIAGE NOTE')
    expect(html).not.toContain('Internal triage notes')
    expect(html).not.toContain('Triage controls')
  })
  it('removes staff mutation controls when capabilities are false', () => {
    const html = renderToStaticMarkup(
      <FeedbackWorkspace
        data={{
          ...staff,
          capabilities: {
            canAddInternalNote: false,
            canChangeStatus: false,
            canPublish: false,
            canRespond: false,
            canTriage: false,
          },
        }}
        staff
      />,
    )
    expect(html).toContain('Read-only feedback view')
    expect(html).not.toContain('Update triage')
    expect(html).not.toContain('Publish response')
  })
})
