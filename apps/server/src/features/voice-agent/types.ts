export type VoiceAgentStep =
  | 'org_search'
  | 'org_selected'
  | 'auth'
  | 'dept_selection'
  | 'provider_selection'
  | 'availability_query'
  | 'booking';

export interface VoiceAgentSession {
  sessionId: string;
  userId?: string;
  currentStep: VoiceAgentStep;
  selectedOrganizationId?: string;
  selectedDepartmentId?: string;
  selectedProviderId?: string;
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  lastActivityAt: Date;
}

export interface VoiceAgentAction {
  type:
    | 'search_org'
    | 'select_org'
    | 'list_departments'
    | 'list_providers'
    | 'query_availability'
    | 'create_booking'
    | 'continue_conversation';
  parameters?: {
    orgId?: string;
    deptId?: string;
    providerId?: string;
    eventId?: string;
    query?: string;
  };
}

