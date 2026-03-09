import http from 'node:http';
import { randomUUID } from 'node:crypto';

import { createHandlers } from './handlers.mjs';
import { assertPermission, parseAdminRoles } from './authz.mjs';
import { getControlPlaneConfig } from './config.mjs';
import { adminHeadersSchema } from './contracts.mjs';
import {
  HttpError,
  readJsonBody,
  sendJson,
  sendNoContent,
  toErrorResponse,
} from './http.mjs';
import { createPostgresControlPlaneStore } from './postgres-store.mjs';
import { createRateLimiter, resolveRateLimit } from './rate-limit.mjs';
import { createRoutes, matchRoute } from './router.mjs';
import { createControlPlaneStateRepository } from './state-repository.mjs';
import { createControlPlaneStore } from './store.mjs';

function getAdminContext(request, config) {
  const authorization = request.headers.authorization;
  if (!authorization) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing Authorization header.');
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || token !== config.token) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Invalid bearer token.');
  }

  const headers = adminHeadersSchema.parse({
    authorization,
    'x-tenant-id': request.headers['x-tenant-id'] ?? '',
    'x-app-id': request.headers['x-app-id'] ?? '',
    'x-user-id': request.headers['x-user-id'] ?? '',
    'x-user-roles': request.headers['x-user-roles'] ?? '',
  });

  return {
    tenantId: headers['x-tenant-id'],
    appId: headers['x-app-id'],
    userId: headers['x-user-id'],
    roles: parseAdminRoles(headers['x-user-roles']),
  };
}

export async function startControlPlaneServer(overrides = {}) {
  const config = getControlPlaneConfig(overrides);
  const repository = config.databaseUrl
    ? null
    : await createControlPlaneStateRepository({ filePath: config.stateFile });
  const store = config.databaseUrl
    ? createPostgresControlPlaneStore(config)
    : createControlPlaneStore({ repository, prometheus: config });
  const startedAt = Date.now();
  const handlers = createHandlers({ store, config, startedAt });
  const routes = createRoutes(handlers);
  const rateLimiter = createRateLimiter();

  const server = http.createServer(async (request, response) => {
    const requestId = randomUUID();
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (request.method === 'OPTIONS') {
      sendNoContent(response, config.allowedOrigin, requestId);
      return;
    }

    try {
      const matched = matchRoute(routes, request.method ?? 'GET', url.pathname);
      if (!matched) {
        throw new HttpError(404, 'NOT_FOUND', `No route found for ${url.pathname}.`);
      }

      const body = ['POST', 'PUT', 'PATCH'].includes(request.method ?? '')
        ? await readJsonBody(request)
        : {};
      const adminContext = matched.route.protected
        ? getAdminContext(request, config)
        : null;

      if (matched.route.permission && adminContext) {
        try {
          assertPermission(adminContext.roles, matched.route.permission);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('FORBIDDEN:')) {
            throw new HttpError(403, 'FORBIDDEN', `This action requires the ${matched.route.permission} permission.`);
          }
          throw error;
        }
      }

      const rateLimit = matched.route.protected
        ? resolveRateLimit(matched.route, request.method ?? 'GET')
        : null;
      const rateLimitHeaders = rateLimit
        ? rateLimiter.check(
            `${matched.route.path}:${adminContext?.userId ?? request.socket.remoteAddress ?? 'anonymous'}`,
            rateLimit.limit,
            rateLimit.windowMs,
          )
        : undefined;

      const result = await matched.route.handler({
        request,
        response,
        url,
        params: matched.params,
        body,
        adminContext,
      });

      if (result?.handled) {
        return;
      }

      sendJson(response, result.statusCode ?? 200, result.body, config.allowedOrigin, requestId, rateLimitHeaders);
    } catch (error) {
      const normalized = toErrorResponse(error);
      sendJson(
        response,
        normalized.statusCode,
        normalized.body,
        config.allowedOrigin,
        requestId,
        normalized.headers,
      );
    }
  });

  server.keepAliveTimeout = 60_000;
  server.headersTimeout = 65_000;

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, resolve);
  });

  const address = server.address();
  const resolvedPort = typeof address === 'object' && address ? address.port : config.port;
  const url = `http://${config.host}:${resolvedPort}`;

  console.log(`[control-plane-api] listening on ${url}`);

  return {
    url,
    config,
    store,
    server,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          Promise.resolve(store.close?.())
            .catch(reject)
            .then(() => resolve());
        });
      }),
  };
}
