import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(statusCode, code, message, details = undefined, headers = undefined) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }
}

function setExtraHeaders(response, headers) {
  if (!headers) {
    return;
  }
  for (const [key, value] of Object.entries(headers)) {
    response.setHeader(key, value);
  }
}

export function setCorsHeaders(response, allowedOrigin) {
  response.setHeader('access-control-allow-origin', allowedOrigin);
  response.setHeader('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
  response.setHeader(
    'access-control-allow-headers',
    'content-type, authorization, x-tenant-id, x-app-id, x-user-id, x-user-roles',
  );
}

export function sendJson(response, statusCode, payload, allowedOrigin, requestId, extraHeaders = undefined) {
  setCorsHeaders(response, allowedOrigin);
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('x-request-id', requestId);
  setExtraHeaders(response, extraHeaders);
  response.end(JSON.stringify(payload));
}

export function sendNoContent(response, allowedOrigin, requestId, extraHeaders = undefined) {
  setCorsHeaders(response, allowedOrigin);
  response.statusCode = 204;
  response.setHeader('x-request-id', requestId);
  setExtraHeaders(response, extraHeaders);
  response.end();
}

export async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
}

export function toErrorResponse(error) {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      headers: error.headers,
      body: {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      headers: undefined,
      body: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed.',
          details: error.flatten(),
        },
      },
    };
  }

  return {
    statusCode: 500,
    headers: undefined,
    body: {
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected server error occurred.',
      },
    },
  };
}
