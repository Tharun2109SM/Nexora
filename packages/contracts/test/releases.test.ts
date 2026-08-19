import { describe, expect, it } from 'vitest'

import {
  createMaintenanceSchema,
  createReleaseSchema,
  customerReleaseDetailSchema,
  customerMaintenanceListItemSchema,
  maintenanceListItemSchema,
  customerReleaseListQuerySchema,
  staffReleaseDetailSchema,
  staffReleaseListQuerySchema,
  transitionReleaseSchema,
  updateReleaseAudienceSchema,
} from '../src/index.js'

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const timestamp = '2026-08-19T15:00:00.000Z'
const base = {
  createdAt: timestamp,
  customerVisible: true,
  events: [],
  id,
  lastActivityAt: timestamp,
  product: { code: 'NEXORA', id, name: 'NEXORA' },
  publishedAt: timestamp,
  releaseDate: timestamp,
  releaseNotes: 'Safe notes',
  scheduledFor: null,
  sections: [],
  status: 'PUBLISHED',
  storage: { attachmentsAvailable: false },
  summary: 'Summary',
  title: 'Release title',
  version: '2.4.0',
}
describe('release contracts', () => {
  it('validates bounded product versions and rejects ownership spoofing', () => {
    expect(
      createReleaseSchema.safeParse({
        productId: id,
        title: 'Release title',
        version: '2.4.0-rc.1',
      }).success,
    ).toBe(true)
    expect(
      createReleaseSchema.safeParse({
        organizationId: id,
        productId: id,
        title: 'Release title',
        version: '2.4.0',
      }).success,
    ).toBe(false)
    expect(
      createReleaseSchema.safeParse({
        productId: id,
        title: 'Release title',
        version: 'bad version',
      }).success,
    ).toBe(false)
  })
  it('requires selected rollout audiences to contain organizations', () => {
    expect(
      updateReleaseAudienceSchema.safeParse({ mode: 'ALL_SUBSCRIBERS', organizationIds: [] })
        .success,
    ).toBe(true)
    expect(
      updateReleaseAudienceSchema.safeParse({ mode: 'SELECTED_ORGANIZATIONS', organizationIds: [] })
        .success,
    ).toBe(false)
  })
  it('keeps staff-only audience data out of customer release projections', () => {
    expect(customerReleaseDetailSchema.safeParse(base).success).toBe(true)
    expect(
      customerReleaseDetailSchema.safeParse({
        ...base,
        audience: 'SELECTED_ORGANIZATIONS',
        targetCount: 2,
      }).success,
    ).toBe(false)
  })
  it('permits private rollout metadata only in the staff contract', () => {
    expect(
      staffReleaseDetailSchema.safeParse({
        ...base,
        audience: 'ALL_SUBSCRIBERS',
        capabilities: {
          canArchive: false,
          canEdit: true,
          canManageAudience: true,
          canManageMaintenance: true,
          canPublish: true,
          canSchedule: true,
        },
        feedbackLinks: [],
        targetCount: 0,
        targets: [],
      }).success,
    ).toBe(true)
  })
  it('strictly separates staff status filtering', () => {
    expect(customerReleaseListQuerySchema.safeParse({ status: 'DRAFT' }).success).toBe(false)
    expect(staffReleaseListQuerySchema.safeParse({ status: 'DRAFT' }).success).toBe(true)
  })
  it('accepts narrow release transitions only', () => {
    expect(
      transitionReleaseSchema.safeParse({ scheduledFor: timestamp, status: 'SCHEDULED' }).success,
    ).toBe(true)
    expect(transitionReleaseSchema.safeParse({ status: 'ACTIVE' }).success).toBe(false)
  })
  it('validates maintenance time ordering', () => {
    expect(
      createMaintenanceSchema.safeParse({
        description: 'Maintenance',
        endsAt: timestamp,
        productId: id,
        startsAt: '2026-08-20T15:00:00.000Z',
        title: 'Maintenance notice',
      }).success,
    ).toBe(false)
  })
  it('keeps maintenance rollout targets staff-only', () => {
    const notice = {
      createdAt: timestamp,
      customerVisible: true,
      description: 'Planned maintenance',
      endsAt: null,
      id,
      lastActivityAt: timestamp,
      product: { code: 'NEXORA', id, name: 'NEXORA' },
      startsAt: timestamp,
      status: 'SCHEDULED',
      title: 'Maintenance notice',
    }
    expect(customerMaintenanceListItemSchema.safeParse(notice).success).toBe(true)
    expect(
      customerMaintenanceListItemSchema.safeParse({
        ...notice,
        audience: 'SELECTED_ORGANIZATIONS',
        targetCount: 1,
        targets: [{ id, name: 'Customer A' }],
      }).success,
    ).toBe(false)
    expect(
      maintenanceListItemSchema.safeParse({
        ...notice,
        audience: 'SELECTED_ORGANIZATIONS',
        targetCount: 1,
        targets: [{ id, name: 'Customer A' }],
      }).success,
    ).toBe(true)
  })
})
