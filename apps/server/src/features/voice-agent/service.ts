import type { FastifyInstance } from 'fastify';
import FormData from 'form-data';
import { createSession, getSession, updateSession } from './session.js';
import type { VoiceAgentSession } from './types.js';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

if (!N8N_WEBHOOK_URL) {
  console.warn('⚠️ N8N_WEBHOOK_URL not set. Voice agent will not work.');
}

export async function processVoiceInput(
  app: FastifyInstance,
  audioBuffer: Buffer,
  sessionId: string | undefined,
  userId: string | undefined,
  authToken: string | undefined
): Promise<{
  audioBuffer: Buffer;
  sessionId: string;
  sessionState: VoiceAgentSession;
  transcript?: string;
  responseText?: string;
}> {
  if (!N8N_WEBHOOK_URL) {
    throw new Error('N8N webhook URL not configured');
  }

  // Get or create session
  let session = sessionId ? getSession(sessionId) : null;
  if (!session) {
    session = createSession(userId);
  }

  // Prepare form data for n8n webhook
  const formData = new FormData();
  formData.append('audio', audioBuffer, {
    filename: 'audio.mp3',
    contentType: 'audio/mpeg',
  });
  formData.append('sessionId', session.sessionId);
  formData.append('sessionState', JSON.stringify({
    currentStep: session.currentStep,
    selectedOrganizationId: session.selectedOrganizationId,
    selectedDepartmentId: session.selectedDepartmentId,
    selectedProviderId: session.selectedProviderId,
    userId: session.userId,
  }));
  
  if (authToken) {
    formData.append('authToken', authToken);
  }

  // Call n8n webhook
  const webhookHeaders = formData.getHeaders();
  const internalSecret = process.env.INTERNAL_WEBHOOK_SECRET;
  if (internalSecret) {
    webhookHeaders['x-internal-secret'] = internalSecret;
  }

  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    // @ts-ignore - form-data types are compatible with fetch
    body: formData as any,
    headers: webhookHeaders,
  });

  if (!response.ok) {
    const errorText = await response.text();
    app.log.error({ status: response.status, error: errorText }, 'n8n webhook error');
    throw new Error(`n8n webhook failed: ${response.status}`);
  }

  // Get audio response
  const audioBufferResponse = Buffer.from(await response.arrayBuffer());

  // Get session state from response headers
  const updatedSessionState = response.headers.get('X-Session-State');
  const transcript = response.headers.get('X-Transcript');
  const responseText = response.headers.get('X-Response-Text');

  // Update session with new state
  if (updatedSessionState) {
    try {
      const state = JSON.parse(updatedSessionState);
      updateSession(session.sessionId, {
        currentStep: state.currentStep,
        selectedOrganizationId: state.selectedOrganizationId,
        selectedDepartmentId: state.selectedDepartmentId,
        selectedProviderId: state.selectedProviderId,
        conversationHistory: [
          ...session.conversationHistory,
          ...(transcript ? [{
            role: 'user' as const,
            text: transcript,
            timestamp: new Date(),
          }] : []),
          ...(responseText ? [{
            role: 'assistant' as const,
            text: responseText,
            timestamp: new Date(),
          }] : []),
        ],
      });
    } catch (parseError) {
      app.log.warn({ error: parseError, sessionId: session.sessionId }, 'Failed to parse session state from n8n response');
      // Continue with existing session state
    }
  }

  // Get updated session
  const updatedSession = getSession(session.sessionId);
  if (!updatedSession) {
    throw new Error('Session not found after update');
  }

  return {
    audioBuffer: audioBufferResponse,
    sessionId: updatedSession.sessionId,
    sessionState: updatedSession,
    transcript: transcript || undefined,
    responseText: responseText || undefined,
  };
}

