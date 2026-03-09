import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withPermission } from '@/app/api/admin/_helpers';
import { proxyCatalogRequest } from '@/app/api/admin/catalog-route-utils';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { LocalControlPlaneError, switchLocalModel } from '@/lib/control-plane-state.server';
import { modelSwitchRequestSchema, modelSwitchResponseSchema } from '@/types/contracts';

export const POST = withPermission(adminRoutePermissions.modelSwitch, async (request: NextRequest, context) => {
  try {
    const body = modelSwitchRequestSchema.parse(await request.json());
    const proxied = await proxyCatalogRequest('/admin/models/switch', context, {
      method: 'POST',
      body,
      responseSchema: modelSwitchResponseSchema,
    });
    if (proxied) {
      return proxied;
    }

    const result = await switchLocalModel(context.session.user, body);
    return NextResponse.json(modelSwitchResponseSchema.parse({ ok: true, model: result.model, audit: result.audit }));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { code: 'INVALID_MODEL_SWITCH_REQUEST', message: 'Provide a valid model switch payload.', details: error.flatten() } },
        { status: 400 },
      );
    }

    if (error instanceof LocalControlPlaneError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.statusCode });
    }

    throw error;
  }
});
