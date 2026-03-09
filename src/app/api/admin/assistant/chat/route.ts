import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withPermission } from '@/app/api/admin/_helpers';
import { adminRoutePermissions } from '@/app/api/admin/permissions';
import { extractAssistantPreferences, getAssistantMemorySessionId, planAssistantGatewayRoute } from '@/lib/assistant';
import { getAssistantReply } from '@/lib/assistant.server';
import { AiGatewayServiceError, aiGatewayService } from '@/services/ai-gateway';
import { memoryService } from '@/services/memory';
import { memoryRetrieveResponseSchema } from '@/types/contracts';
import { assistantChatRequestSchema, assistantChatResponseSchema } from '@/types/contracts';

export const POST = withPermission(adminRoutePermissions.assistantChat, async (request: NextRequest, context) => {
  try {
    const body = assistantChatRequestSchema.parse(await request.json());
    const sessionId = getAssistantMemorySessionId(context.session.user);
    const inferredPreferences = extractAssistantPreferences(body.message);
    if (inferredPreferences.length) {
      await memoryService.upsertPreferences({ items: inferredPreferences }).catch(() => undefined);
    }
    const memoryContext = await memoryService.retrieveContext({ query: body.message, sessionId }).catch(() => memoryRetrieveResponseSchema.parse({}));
    let response;

    try {
      if (aiGatewayService.isConfigured()) {
        const route = planAssistantGatewayRoute(body.message, body.history, body.pathname);
        const gatewayResponse = route === 'command'
          ? await aiGatewayService.command({ ...body, memoryContext })
          : route === 'research'
          ? await aiGatewayService.research({ ...body, memoryContext })
          : route === 'recommend'
            ? await aiGatewayService.recommend({ ...body, memoryContext })
            : await aiGatewayService.analyze({ ...body, memoryContext });
        response = { message: gatewayResponse.message, suggestions: gatewayResponse.suggestions };
      } else {
        response = await getAssistantReply({
          message: body.message,
          history: body.history,
          pathname: body.pathname,
          memoryContext,
          sessionUser: context.session.user,
        });
      }
    } catch (error) {
      if (!(error instanceof AiGatewayServiceError)) {
        throw error;
      }

      response = await getAssistantReply({
        message: body.message,
        history: body.history,
        pathname: body.pathname,
        memoryContext,
        sessionUser: context.session.user,
      });
    }

    await memoryService.saveConversationTurn({
      sessionId,
      pathname: body.pathname,
      userMessage: body.message,
      assistantMessage: response.message.content,
      toolCalls: response.message.toolCalls,
    }).catch(() => undefined);

    return NextResponse.json(assistantChatResponseSchema.parse(response));
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_ASSISTANT_CHAT_REQUEST',
            message: 'Provide a valid assistant chat payload.',
            details: error.flatten(),
          },
        },
        { status: 400 },
      );
    }

    throw error;
  }
});