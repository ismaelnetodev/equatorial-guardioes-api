import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.js'
import { createSessionToken } from '../../lib/auth-session.js'
import { MAX_PHOTO_BYTES, reportPhotoUrl, uploadReportPhoto, validateReportPhoto } from './report-photo.service.js'

const userId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const imageId = '33333333-3333-4333-8333-333333333333'
const reference = `s3://relatos_imgs/reports/${userId}/${imageId}.jpg`
const mocks = vi.hoisted(() => ({ send: vi.fn(), signed: vi.fn(), user: vi.fn(), trail: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() }))
vi.mock('@aws-sdk/client-s3', async importOriginal => {
  const original = await importOriginal<typeof import('@aws-sdk/client-s3')>()
  return { ...original, S3Client: class { send = mocks.send; destroy() {} } }
})
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: mocks.signed }))
vi.mock('../../lib/prisma.js', () => ({ getPrisma: () => ({ user: { findUnique: mocks.user }, trail: { findFirst: mocks.trail }, report: { findMany: mocks.findMany, findFirst: mocks.findFirst, create: mocks.create } }) }))

let app: FastifyInstance
let image: Buffer
beforeEach(async () => {
  vi.resetAllMocks()
  for (const [name, value] of Object.entries({ AWS_ENDPOINT_URL_S3: 'https://storage.example.com', AWS_ACCESS_KEY_ID: 'test', AWS_SECRET_ACCESS_KEY: 'test', AWS_REGION: 'us-east-2', S3_REPORTS_BUCKET: 'relatos_imgs' })) vi.stubEnv(name, value)
  mocks.send.mockResolvedValue({})
  mocks.signed.mockResolvedValue('https://storage.example.com/signed-photo')
  mocks.user.mockResolvedValue({ id: userId, role: 'USER' })
  mocks.trail.mockResolvedValue({ modules: [{ progressRecords: [{ completedAt: new Date() }] }] })
  image = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fdbb12' } }).png().toBuffer()
  app = await buildApp({ logger: false })
})
afterEach(async () => { await app.close(); vi.unstubAllEnvs() })

function multipart(content: Buffer, mime = 'image/png', name = 'foto') {
  return Buffer.concat([Buffer.from(`--photo-boundary\r\nContent-Disposition: form-data; name="${name}"; filename="image.png"\r\nContent-Type: ${mime}\r\n\r\n`), content, Buffer.from('\r\n--photo-boundary--\r\n')])
}
const headers = () => ({ authorization: 'Bearer ' + createSessionToken(userId), 'content-type': 'multipart/form-data; boundary=photo-boundary' })

describe('upload de foto do relato', () => {
  it('exige sessão antes de receber o arquivo', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/relatos/foto', headers: { 'content-type': headers()['content-type'] }, payload: multipart(image) })
    expect(response.statusCode).toBe(401)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('exige a conclusão do módulo inicial', async () => {
    mocks.trail.mockResolvedValue(null)
    const response = await app.inject({ method: 'POST', url: '/api/v1/relatos/foto', headers: headers(), payload: multipart(image) })
    expect(response.statusCode).toBe(409)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('rejeita JSON no endpoint de arquivo', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/relatos/foto', headers: { authorization: headers().authorization }, payload: { foto: { file: true } } })
    expect(response.statusCode).toBe(415)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('rejeita tipos de arquivo não suportados', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/relatos/foto', headers: headers(), payload: multipart(image, 'application/pdf') })
    expect(response.statusCode).toBe(422)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('recebe multipart, recodifica para JPEG e guarda no prefixo do usuário', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/relatos/foto', headers: headers(), payload: multipart(image) })
    expect(response.statusCode).toBe(201)
    expect(response.json().photoUrl).toMatch(new RegExp(`^s3://relatos_imgs/reports/${userId}/[0-9a-f-]+\\.jpg$`))
    const input = mocks.send.mock.calls[0]![0].input
    expect(input).toMatchObject({ Bucket: 'relatos_imgs', ContentType: 'image/jpeg' })
    expect(await sharp(input.Body).metadata()).toMatchObject({ format: 'jpeg', width: 4, height: 4 })
  })
  it('rejeita conteúdo inválido mesmo que declarado como imagem', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/relatos/foto', headers: headers(), payload: multipart(Buffer.from('<script>test</script>'), 'image/jpeg') })
    expect(response.statusCode).toBe(422)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('rejeita arquivos acima de 10 MB', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/relatos/foto', headers: headers(), payload: multipart(Buffer.alloc(MAX_PHOTO_BYTES + 1)) })
    expect(response.statusCode).toBe(413)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('retorna falha recuperável quando o bucket recusa a foto', async () => {
    mocks.send.mockRejectedValue(new Error('storage down'))
    await expect(uploadReportPhoto(userId, image, 'image/png')).rejects.toMatchObject({ code: 'PHOTO_STORAGE_UNAVAILABLE' })
  })
  it('impede anexar fotos de outro usuário, outro bucket ou URL externa', async () => {
    for (const value of [reference.replace(userId, otherId), reference.replace('relatos_imgs', 'outro'), 'https://external.example/image.jpg']) {
      await expect(validateReportPhoto(userId, value)).rejects.toMatchObject({ code: 'INVALID_PHOTO' })
    }
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('confere a existência da foto antes de anexar', async () => {
    await validateReportPhoto(userId, reference)
    expect(mocks.send.mock.calls[0]![0].input).toEqual({ Bucket: 'relatos_imgs', Key: `reports/${userId}/${imageId}.jpg` })
  })
  it('grava a referência permanente no relato e devolve somente o link de leitura', async () => {
    const now = new Date()
    mocks.create.mockResolvedValue({ id: imageId, title: 'Risco', description: 'Fio caído', address: 'Rua', neighborhood: 'Centro', photoUrl: reference, latitude: null, longitude: null, status: 'SENT', urgency: 'HIGH', pointsAwarded: 0, submittedAt: now, timeline: [{ status: 'SENT', occurredAt: now }] })
    const response = await app.inject({ method: 'POST', url: '/api/v1/relatos/', headers: { authorization: headers().authorization }, payload: { title: 'Risco', description: 'Fio caído', address: 'Rua', neighborhood: 'Centro', photoUrl: reference } })
    expect(response.statusCode).toBe(201)
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId, photoUrl: reference }) }))
    expect(response.json().photoUrl).toBe('https://storage.example.com/signed-photo')
  })
  it('bloqueia na criação um relato com foto de outro usuário', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/relatos/', headers: { authorization: headers().authorization }, payload: { title: 'Risco', description: 'Fio caído', address: 'Rua', neighborhood: 'Centro', photoUrl: reference.replace(userId, otherId) } })
    expect(response.statusCode).toBe(422)
    expect(mocks.create).not.toHaveBeenCalled()
  })
  it('renova o link privado nas consultas e preserva relatos sem foto', async () => {
    expect(await reportPhotoUrl(null)).toBeNull()
    expect(await reportPhotoUrl(reference)).toBe('https://storage.example.com/signed-photo')
    expect(mocks.signed.mock.calls[0]![2]).toEqual({ expiresIn: 3600 })
    expect(await reportPhotoUrl('https://legacy.example/photo.jpg')).toBe('https://legacy.example/photo.jpg')
  })
  it.each(['USER', 'ADMIN'])('entrega URL de leitura ao consultar relatos como %s', async role => {
    mocks.user.mockResolvedValue({ id: userId, role })
    mocks.findMany.mockResolvedValue([{ id: imageId, userId, title: 'Risco', address: 'Rua', neighborhood: 'Centro', description: 'Fio caído', photoUrl: reference, latitude: null, longitude: null, status: 'SENT', urgency: 'HIGH', pointsAwarded: 0, submittedAt: new Date() }])
    const response = await app.inject({ method: 'GET', url: role === 'ADMIN' ? '/api/v1/admin/relatos' : '/api/v1/relatos/', headers: { authorization: headers().authorization } })
    expect(response.statusCode).toBe(200)
    const data = role === 'ADMIN' ? response.json() : response.json().reports
    expect(data[0].photoUrl).toBe('https://storage.example.com/signed-photo')
  })
})
