import {
  customerReleaseDetailSchema,
  customerReleaseListItemSchema,
  maintenanceListItemSchema,
  staffReleaseDetailSchema,
} from '@nexora/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { MaintenancePortfolio, ReleasePortfolio } from './release-portfolio'
import { ReleaseWorkspace } from './release-workspace'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const timestamp = '2026-08-19T15:00:00.000Z'
const item = customerReleaseListItemSchema.parse({
  createdAt: timestamp,
  customerVisible: true,
  id,
  lastActivityAt: timestamp,
  product: { code: 'NEXORA', id, name: 'NEXORA' },
  publishedAt: timestamp,
  releaseDate: timestamp,
  scheduledFor: null,
  status: 'PUBLISHED',
  summary: 'Release summary',
  title: 'Release title',
  version: '2.0.0',
})
const customer = customerReleaseDetailSchema.parse({
  ...item,
  events: [{ createdAt: timestamp, eventType: 'PUBLISHED', id }],
  releaseNotes: 'Customer-safe notes',
  sections: [
    { body: 'A new capability', category: 'NEW_FEATURE', id, sortOrder: 0, title: "What's new" },
  ],
  storage: { attachmentsAvailable: false },
})
const staff = staffReleaseDetailSchema.parse({
  ...customer,
  audience: 'SELECTED_ORGANIZATIONS',
  capabilities: {
    canArchive: true,
    canEdit: false,
    canManageAudience: false,
    canManageMaintenance: true,
    canPublish: false,
    canSchedule: false,
  },
  events: [{ createdAt: timestamp, customerVisible: true, eventType: 'PUBLISHED', id }],
  feedbackLinks: [],
  targetCount: 1,
  targets: [{ id, name: 'Customer A' }],
})

describe('release UI', () => {
  it('renders a responsive release portfolio and honest empty state', () => {
    expect(
      renderToStaticMarkup(
        <ReleasePortfolio filtered={false} nextHref={null} releases={[item]} staff={false} />,
      ),
    ).toContain('Release title')
    expect(
      renderToStaticMarkup(
        <ReleasePortfolio filtered={false} nextHref={null} releases={[]} staff={false} />,
      ),
    ).toContain('No releases yet')
  })
  it('renders structured customer release notes without rollout internals', () => {
    const html = renderToStaticMarkup(<ReleaseWorkspace data={customer} staff={false} />)
    expect(html).toContain('What&#x27;s new')
    expect(html).toContain('Released Aug 19, 2026')
    expect(html).toContain('Customer-safe notes')
    expect(html).toContain('File actions unavailable')
    expect(html).not.toContain('Rollout audience')
    expect(html).not.toContain('Customer A')
    expect(html).not.toContain('objectKey')
  })
  it('labels a scheduled release as scheduled rather than released', () => {
    const html = renderToStaticMarkup(
      <ReleaseWorkspace
        data={{
          ...customer,
          publishedAt: null,
          releaseDate: timestamp,
          scheduledFor: timestamp,
          status: 'SCHEDULED',
        }}
        staff={false}
      />,
    )
    expect(html).toContain('Scheduled Aug 19, 2026')
    expect(html).not.toContain('Released Aug 19, 2026')
  })
  it('shows staff lifecycle capability without permitting published edits', () => {
    const html = renderToStaticMarkup(
      <ReleaseWorkspace data={staff} organizations={staff.targets} staff />,
    )
    expect(html).toContain('Lifecycle')
    expect(html).toContain('value="ARCHIVED"')
    expect(html).not.toContain('Save content')
    expect(html).not.toContain('Update audience')
  })
  it('keeps staff controls hidden when all capabilities are false', () => {
    const html = renderToStaticMarkup(
      <ReleaseWorkspace
        data={{
          ...staff,
          capabilities: {
            canArchive: false,
            canEdit: false,
            canManageAudience: false,
            canManageMaintenance: false,
            canPublish: false,
            canSchedule: false,
          },
        }}
        staff
      />,
    )
    expect(html).toContain('Read-only release view')
    expect(html).not.toContain('Update status')
  })
  it('shows maintenance editing and audience controls only in the authorized staff view', () => {
    const notice = maintenanceListItemSchema.parse({
      audience: 'SELECTED_ORGANIZATIONS',
      createdAt: timestamp,
      customerVisible: false,
      description: 'Maintenance details',
      endsAt: null,
      id,
      lastActivityAt: timestamp,
      product: { code: 'NEXORA', id, name: 'NEXORA' },
      startsAt: '2026-08-21T15:00:00.000Z',
      status: 'DRAFT',
      targetCount: 1,
      targets: [{ id, name: 'Customer A' }],
      title: 'Maintenance notice',
    })
    const staffHtml = renderToStaticMarkup(
      <MaintenancePortfolio
        canManage
        maintenance={[notice]}
        organizations={notice.targets}
        staff
      />,
    )
    expect(staffHtml).toContain('Save notice')
    expect(staffHtml).toContain('Update audience')
    const readonlyHtml = renderToStaticMarkup(<MaintenancePortfolio maintenance={[notice]} staff />)
    expect(readonlyHtml).not.toContain('Save notice')
    expect(readonlyHtml).not.toContain('Update audience')
  })
})
