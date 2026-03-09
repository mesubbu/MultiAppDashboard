import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';

import {
  withPermission,
  type AuthorizedAdminContext,
} from '@/app/api/admin/_helpers';
import { proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { applyLocalAgentAction, LocalControlPlaneError } from '@/lib/control-plane-state.server';
import { agentActionRequestSchema, agentActionResponseSchema } from '@/types/contracts';

export const POST = withPermission<{ agentId: string }>(
  adminRoutePermissions.agentActions,
  async (
    request: NextRequest,
    context: AuthorizedAdminContext<{ agentId: string }>,
  ) => {
    try {
      const body = agentActionRequestSchema.parse(await request.json());
      const { agentId } = await context.params;
      const proxied = await proxyCatalogRequest(`/admin/agents/${agentId}/actions`, context, {
        method: 'POST',
        body,
        responseSchema: agentActionResponseSchema,
      });
      if (proxied) {
        return proxied;
      }

      const result = await applyLocalAgentAction(context.session.user, agentId, body);
      return NextResponse.json(agentActionResponseSchema.parse({ ok: true, agent: result.agent, audit: result.audit }));
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_STAGE_MOVE_REQUEST',
              message: 'Provide a valid agent action payload.',
              details: error.flatten(),
            },
          },
          { status: 400 },
        );
      }

      if (error instanceof LocalControlPlaneError) {
        return NextResponse.json(
          {
            error: {
              code: error.code,
              message: error.message,
            },
          },
          { status: error.statusCode },
        );
      }

      throw error;
    }
  },
);
