import type { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { processVoiceInput } from './service.js';
import { getSession, deleteSession } from './session.js';
import { requireAuthHook } from '../../plugins/authz.js';
import { AppError } from '../../errors/AppError.js';

const MAX_AUDIO_SIZE = Number(process.env.VOICE_AGENT_MAX_AUDIO_SIZE) || 10 * 1024 * 1024; // 10MB default

const voiceAgentRoutes: FastifyPluginAsync = async (app) => {
  // Register rate limiting for voice agent routes
  await app.register(rateLimit, {
    global: false,
    max: 10, // 10 requests per minute
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      // Rate limit by user ID if authenticated, otherwise by IP
      const user = (req as any).user;
      if (user?.id) {
        return `voice-agent:${user.id}`;
      }
      return `voice-agent:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    },
    errorResponseBuilder: (req, context) => {
      return {
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again after ${context.after} seconds.`,
        retryAfter: context.after,
      };
    },
  });
  // POST /api/voice-agent/process - Process voice input
  app.post('/process', async (req, reply) => {
      try {
        const data = await req.file();
        
        if (!data) {
          throw new AppError('Audio file is required', 'AUDIO_REQUIRED', 400);
        }

        // Validate file size
        const fileBuffer = await data.toBuffer();
        if (fileBuffer.length > MAX_AUDIO_SIZE) {
          throw new AppError(
            `Audio file too large. Maximum size is ${MAX_AUDIO_SIZE / 1024 / 1024}MB`,
            'AUDIO_TOO_LARGE',
            400
          );
        }

        // Validate file type (MP3)
        const mimetype = data.mimetype || '';
        if (!mimetype.includes('audio') && !mimetype.includes('mpeg')) {
          app.log.warn({ mimetype }, 'Unexpected audio mimetype');
        }

        // Get optional session ID from form data
        const sessionId = (data.fields.sessionId as any)?.value;

        // Get user info if authenticated (optional for org search)
        let userId: string | undefined;
        let authToken: string | undefined;
        
        try {
          // Try to get auth, but don't fail if not authenticated
          const user = (req as any).user;
          if (user) {
            userId = user.id;
            authToken = req.headers.authorization?.replace('Bearer ', '');
          }
        } catch {
          // Not authenticated - this is OK for org search
        }

        // Process voice input
        const result = await processVoiceInput(
          app,
          fileBuffer,
          sessionId,
          userId,
          authToken
        );

        // Set response headers
        reply.header('X-Session-Id', result.sessionId);
        reply.header('X-Session-State', JSON.stringify(result.sessionState));
        if (result.transcript) {
          reply.header('X-Transcript', result.transcript);
        }
        if (result.responseText) {
          reply.header('X-Response-Text', result.responseText);
        }

        // Send audio response
        reply
          .type('audio/mpeg')
          .send(result.audioBuffer);
      } catch (error) {
        if (error.isAppError) {
          throw error;
        }
        app.log.error(error, 'Error processing voice input');
        throw new AppError(
          'Failed to process voice input',
          'VOICE_PROCESSING_FAILED',
          500
        );
      }
    }
  );

  // GET /api/voice-agent/session/:sessionId - Get session state
  app.get(
    '/session/:sessionId',
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      const { sessionId } = req.params as { sessionId: string };
      const session = getSession(sessionId);

      if (!session) {
        throw new AppError('Session not found', 'SESSION_NOT_FOUND', 404);
      }

      // Verify user owns this session
      const user = (req as any).user;
      if (session.userId && session.userId !== user.id) {
        throw new AppError('Unauthorized', 'UNAUTHORIZED', 403);
      }

      reply.send({
        success: true,
        data: session,
      });
    }
  );

  // DELETE /api/voice-agent/session/:sessionId - Clear session
  app.delete(
    '/session/:sessionId',
    { preValidation: [requireAuthHook] },
    async (req, reply) => {
      const { sessionId } = req.params as { sessionId: string };
      const session = getSession(sessionId);

      if (!session) {
        throw new AppError('Session not found', 'SESSION_NOT_FOUND', 404);
      }

      // Verify user owns this session
      const user = (req as any).user;
      if (session.userId && session.userId !== user.id) {
        throw new AppError('Unauthorized', 'UNAUTHORIZED', 403);
      }

      deleteSession(sessionId);

      reply.send({
        success: true,
        message: 'Session cleared',
      });
    }
  );
};

export default voiceAgentRoutes;

