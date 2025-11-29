import { z } from 'zod';

export const VoiceAgentProcessRequestSchema = z.object({
  audio: z.instanceof(File).or(z.instanceof(Blob)),
  sessionId: z.string().uuid().optional(),
});

export const VoiceAgentProcessResponseSchema = z.object({
  sessionId: z.string().uuid(),
  sessionState: z.object({
    currentStep: z.enum([
      'org_search',
      'org_selected',
      'auth',
      'dept_selection',
      'provider_selection',
      'availability_query',
      'booking',
    ]),
    selectedOrganizationId: z.string().uuid().optional(),
    selectedDepartmentId: z.string().uuid().optional(),
    selectedProviderId: z.string().uuid().optional(),
  }),
  transcript: z.string().optional(),
  responseText: z.string().optional(),
});

export const VoiceAgentSessionSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  currentStep: z.enum([
    'org_search',
    'org_selected',
    'auth',
    'dept_selection',
    'provider_selection',
    'availability_query',
    'booking',
  ]),
  selectedOrganizationId: z.string().uuid().optional(),
  selectedDepartmentId: z.string().uuid().optional(),
  selectedProviderId: z.string().uuid().optional(),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      text: z.string(),
      timestamp: z.date(),
    })
  ),
  createdAt: z.date(),
  lastActivityAt: z.date(),
});

export const VoiceAgentActionSchema = z.object({
  type: z.enum([
    'search_org',
    'select_org',
    'list_departments',
    'list_providers',
    'query_availability',
    'create_booking',
    'continue_conversation',
  ]),
  parameters: z
    .object({
      orgId: z.string().uuid().optional(),
      deptId: z.string().uuid().optional(),
      providerId: z.string().uuid().optional(),
      eventId: z.string().uuid().optional(),
      query: z.string().optional(),
    })
    .optional(),
});

export type VoiceAgentProcessRequest = z.infer<typeof VoiceAgentProcessRequestSchema>;
export type VoiceAgentProcessResponse = z.infer<typeof VoiceAgentProcessResponseSchema>;
export type VoiceAgentSession = z.infer<typeof VoiceAgentSessionSchema>;
export type VoiceAgentAction = z.infer<typeof VoiceAgentActionSchema>;

