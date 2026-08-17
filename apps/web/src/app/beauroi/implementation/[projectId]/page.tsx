import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ImplementationWorkspace } from '@/components/implementation-workspace'
import { apiRequest, ApiRequestError } from '@/lib/api'
import { implementationDetailSchema, workflowOptionsSchema } from '@/lib/workflow-data'

export const metadata: Metadata = { title: 'Implementation workspace' }

export default async function ImplementationDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  let detail: unknown
  let options: unknown
  try {
    ;[detail, options] = await Promise.all([
      apiRequest(`/implementations/${projectId}`),
      apiRequest('/workflow-options'),
    ])
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === 'NOT_FOUND') notFound()
    throw error
  }
  return (
    <ImplementationWorkspace
      data={implementationDetailSchema.parse(detail).data}
      editable
      options={workflowOptionsSchema.parse(options).data}
    />
  )
}
