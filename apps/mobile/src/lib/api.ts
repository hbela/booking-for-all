// @ts-ignore - env variables
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

export interface VoiceAgentRequest {
  audio: Blob | File;
  sessionId?: string;
}

export interface VoiceAgentResponse {
  audio: Blob;
  sessionId: string;
  sessionState: {
    currentStep: string;
    selectedOrganizationId?: string;
    selectedDepartmentId?: string;
    selectedProviderId?: string;
  };
  transcript?: string;
  responseText?: string;
}

export async function processVoiceInput(
  audio: Blob | File,
  sessionId?: string,
  authToken?: string
): Promise<VoiceAgentResponse> {
  const formData = new FormData();
  formData.append('audio', audio, 'audio.mp3');
  if (sessionId) {
    formData.append('sessionId', sessionId);
  }

  const headers: HeadersInit = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/voice-agent/process`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  // Get audio blob from response
  const audioBlob = await response.blob();
  
  // Get session data from headers or response
  const sessionIdHeader = response.headers.get('X-Session-Id');
  const sessionStateHeader = response.headers.get('X-Session-State');
  
  return {
    audio: audioBlob,
    sessionId: sessionIdHeader || sessionId || '',
    sessionState: sessionStateHeader ? JSON.parse(sessionStateHeader) : {},
  };
}

export async function getSession(sessionId: string, authToken?: string) {
  const headers: HeadersInit = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/voice-agent/session/${sessionId}`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to get session: ${response.status}`);
  }

  return response.json();
}

export async function clearSession(sessionId: string, authToken?: string) {
  const headers: HeadersInit = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}/api/voice-agent/session/${sessionId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to clear session: ${response.status}`);
  }

  return response.json();
}

export interface Organization {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
}

export async function getOrganizationById(orgId: string): Promise<Organization> {
  // Try external endpoint first (public)
  try {
    const response = await fetch(`${API_BASE_URL}/api/external/organization/${orgId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        return data.data;
      }
    }
  } catch (error) {
    console.log('External endpoint failed, trying client endpoint');
  }

  // Fallback to client endpoint (requires auth, but might work if user is logged in)
  const response = await fetch(`${API_BASE_URL}/api/client/organizations/${orgId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch organization: ${response.status}`);
  }

  const data = await response.json();
  if (data.success && data.data) {
    return data.data;
  }
  
  throw new Error('Invalid response format');
}

