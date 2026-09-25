import type { FastifyReply } from 'fastify'

export interface ApiErrorBody {
  error: { code: string; message: string }
}

/** Uniform error envelope: `{ "error": { "code", "message" } }`. */
export function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
): FastifyReply {
  return reply
    .code(status)
    .send({ error: { code, message } } satisfies ApiErrorBody)
}