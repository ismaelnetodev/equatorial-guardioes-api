import { randomUUID } from 'node:crypto'
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import sharp from 'sharp'

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const PHOTO_URL_SECONDS = 3600

export class ReportPhotoError extends Error {
  constructor(public readonly code: 'INVALID_PHOTO' | 'PHOTO_STORAGE_UNAVAILABLE', message: string) { super(message) }
}

function storage() {
  const endpoint = process.env['AWS_ENDPOINT_URL_S3']
  const accessKeyId = process.env['AWS_ACCESS_KEY_ID']
  const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY']
  const region = process.env['AWS_REGION']
  const bucket = process.env['S3_REPORTS_BUCKET']
  if (!endpoint || !accessKeyId || !secretAccessKey || !region || !bucket) {
    throw new ReportPhotoError('PHOTO_STORAGE_UNAVAILABLE', 'O envio de fotos está temporariamente indisponível.')
  }
  return {
    bucket,
    client: new S3Client({ endpoint, region, credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED', maxAttempts: 2,
      requestHandler: { connectionTimeout: 5000, requestTimeout: 30000 } }),
  }
}

function objectKey(reference: string, bucket: string) {
  const prefix = `s3://${bucket}/`
  if (!reference.startsWith(prefix)) throw new ReportPhotoError('INVALID_PHOTO', 'Foto inválida para este relato.')
  const key = reference.slice(prefix.length)
  if (!/^reports\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(key)) {
    throw new ReportPhotoError('INVALID_PHOTO', 'Foto inválida para este relato.')
  }
  return key
}

export async function uploadReportPhoto(userId: string, content: Buffer, mimeType: string) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || !content.length || content.length > MAX_PHOTO_BYTES) {
    throw new ReportPhotoError('INVALID_PHOTO', 'Envie uma foto JPEG, PNG ou WebP de até 10 MB.')
  }
  let image: Buffer
  try {
    const source = sharp(content, { limitInputPixels: 25000000, animated: false })
    const metadata = await source.metadata()
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Formato inválido')
    // A recodificação remove metadados, incluindo a localização EXIF da câmera.
    image = await source.rotate().resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()
  } catch {
    throw new ReportPhotoError('INVALID_PHOTO', 'Não foi possível ler a foto. Tire outra foto e tente novamente.')
  }
  const { client, bucket } = storage()
  const key = `reports/${userId}/${randomUUID()}.jpg`
  try {
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: image, ContentType: 'image/jpeg' }))
    return { photoUrl: `s3://${bucket}/${key}` }
  } catch {
    throw new ReportPhotoError('PHOTO_STORAGE_UNAVAILABLE', 'Não foi possível enviar a foto. Tente novamente.')
  } finally { client.destroy() }
}

export async function validateReportPhoto(userId: string, reference: string | null | undefined) {
  if (!reference) return
  const { client, bucket } = storage()
  try {
    const key = objectKey(reference, bucket)
    if (!key.startsWith(`reports/${userId}/`)) throw new ReportPhotoError('INVALID_PHOTO', 'A foto não pertence a este usuário.')
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  } catch (error) {
    if (error instanceof ReportPhotoError) throw error
    if (error instanceof Error && '$metadata' in error && (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404) {
      throw new ReportPhotoError('INVALID_PHOTO', 'A foto não está disponível. Envie a foto novamente.')
    }
    throw new ReportPhotoError('PHOTO_STORAGE_UNAVAILABLE', 'Não foi possível verificar a foto. Tente novamente.')
  } finally { client.destroy() }
}

export async function reportPhotoUrl(reference: string | null): Promise<string | null> {
  if (!reference || !reference.startsWith('s3://')) return reference
  const { client, bucket } = storage()
  try {
    return await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: objectKey(reference, bucket) }), { expiresIn: PHOTO_URL_SECONDS })
  } finally { client.destroy() }
}
