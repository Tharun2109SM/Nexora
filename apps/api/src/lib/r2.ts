import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import crypto from 'node:crypto'

import { environment, isR2Configured } from './env.js'
import { AppError } from './errors.js'

const allowedImages = {
  'image/jpeg': {
    extension: 'jpg',
    matches: (bytes: Buffer) => bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
  },
  'image/png': {
    extension: 'png',
    matches: (bytes: Buffer) =>
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    extension: 'webp',
    matches: (bytes: Buffer) =>
      bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP',
  },
} as const

type AllowedImageType = keyof typeof allowedImages

function client(): S3Client {
  if (
    !isR2Configured ||
    !environment.R2_ACCOUNT_ID ||
    !environment.R2_ACCESS_KEY_ID ||
    !environment.R2_SECRET_ACCESS_KEY
  ) {
    throw new AppError(
      503,
      'FILE_STORAGE_NOT_CONFIGURED',
      'Logo upload is unavailable until private file storage is configured.',
    )
  }
  return new S3Client({
    credentials: {
      accessKeyId: environment.R2_ACCESS_KEY_ID,
      secretAccessKey: environment.R2_SECRET_ACCESS_KEY,
    },
    endpoint: `https://${environment.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: 'auto',
  })
}

function bucket(): string {
  if (!environment.R2_BUCKET_NAME)
    throw new AppError(
      503,
      'FILE_STORAGE_NOT_CONFIGURED',
      'Logo upload is unavailable until private file storage is configured.',
    )
  return environment.R2_BUCKET_NAME
}

export function validateLogo(
  bytes: Buffer,
  contentType: string | undefined,
  fileName: string | undefined,
) {
  if (bytes.length === 0 || bytes.length > 2 * 1024 * 1024)
    throw new AppError(400, 'INVALID_LOGO', 'Use an image between 1 byte and 2 MB.')
  if (!contentType || !(contentType in allowedImages))
    throw new AppError(400, 'INVALID_LOGO_TYPE', 'Use a PNG, JPEG, or WebP image.')
  const type = contentType as AllowedImageType
  const definition = allowedImages[type]
  const suppliedExtension = fileName?.split('.').pop()?.toLowerCase()
  const validExtensions = definition.extension === 'jpg' ? ['jpg', 'jpeg'] : [definition.extension]
  if (
    !suppliedExtension ||
    !validExtensions.includes(suppliedExtension) ||
    !definition.matches(bytes)
  ) {
    throw new AppError(
      400,
      'INVALID_LOGO_SIGNATURE',
      'The file extension, media type, and image signature must match.',
    )
  }
  return { contentType: type, extension: definition.extension }
}

export async function putLogo(
  organizationId: string,
  bytes: Buffer,
  contentType: AllowedImageType,
  extension: string,
) {
  const key = `organizations/${organizationId}/logos/${crypto.randomUUID()}.${extension}`
  await client().send(
    new PutObjectCommand({ Body: bytes, Bucket: bucket(), ContentType: contentType, Key: key }),
  )
  return key
}

export async function getPrivateObject(key: string) {
  const result = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
  if (!result.Body)
    throw new AppError(404, 'LOGO_NOT_FOUND', 'The organization logo is unavailable.')
  return {
    bytes: Buffer.from(await result.Body.transformToByteArray()),
    contentType: result.ContentType ?? 'application/octet-stream',
  }
}

export async function deletePrivateObject(key: string) {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
}
