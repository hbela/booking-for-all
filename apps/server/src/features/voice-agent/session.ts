import crypto from 'crypto';
import type { VoiceAgentSession, VoiceAgentStep } from './types.js';

// In-memory session storage (consider Redis for production)
const sessions = new Map<string, VoiceAgentSession>();

const SESSION_TTL = Number(process.env.VOICE_AGENT_SESSION_TTL) || 1800; // 30 minutes default

export function createSession(userId?: string): VoiceAgentSession {
  const sessionId = crypto.randomUUID();
  const now = new Date();

  const session: VoiceAgentSession = {
    sessionId,
    userId,
    currentStep: 'org_search',
    conversationHistory: [],
    createdAt: now,
    lastActivityAt: now,
  };

  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): VoiceAgentSession | null {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }

  // Check if session expired
  const now = new Date();
  const elapsed = (now.getTime() - session.lastActivityAt.getTime()) / 1000;
  if (elapsed > SESSION_TTL) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export function updateSession(
  sessionId: string,
  updates: Partial<{
    currentStep: VoiceAgentStep;
    selectedOrganizationId: string;
    selectedDepartmentId: string;
    selectedProviderId: string;
    conversationHistory: VoiceAgentSession['conversationHistory'];
  }>
): VoiceAgentSession | null {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  Object.assign(session, updates, {
    lastActivityAt: new Date(),
  });

  sessions.set(sessionId, session);
  return session;
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export function cleanupExpiredSessions(): number {
  const now = new Date();
  let cleaned = 0;

  for (const [sessionId, session] of sessions.entries()) {
    const elapsed = (now.getTime() - session.lastActivityAt.getTime()) / 1000;
    if (elapsed > SESSION_TTL) {
      sessions.delete(sessionId);
      cleaned++;
    }
  }

  return cleaned;
}

// Cleanup expired sessions every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);

