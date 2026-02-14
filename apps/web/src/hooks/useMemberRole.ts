import { useQuery } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';

export type MemberRole = 'OWNER' | 'PROVIDER' | 'CLIENT';

export interface Member {
  id: string;
  userId: string;
  organizationId: string;
  email: string;
  role: MemberRole;
  createdAt: string;
}

interface UseMemberRoleOptions {
  organizationId?: string;
  enabled?: boolean;
}

/**
 * Hook to fetch the current user's member role for a specific organization
 * @param organizationId - The organization ID to fetch the member role for
 * @param enabled - Whether to enable the query (defaults to true if orgId and session exist)
 * @returns Query result with member data including role
 */
export function useMemberRole({ organizationId, enabled = true }: UseMemberRoleOptions = {}) {
  const { data: session } = authClient.useSession();

  const query = useQuery({
    queryKey: ['member', session?.user?.id, organizationId],
    queryFn: async () => {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      // First, try to fetch existing member record
      let res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/members/${organizationId}/me`,
        { 
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // If member not found (404), try to create one automatically
      if (res.status === 404) {
        console.log(`📝 Member record not found for org ${organizationId}, creating one...`);
        
        const createRes = await fetch(
          `${import.meta.env.VITE_SERVER_URL}/api/members/${organizationId}/ensure`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!createRes.ok) {
          console.error('Failed to create member record');
          throw new Error('NOT_A_MEMBER');
        }

        const createData = await createRes.json();
        console.log(`✅ Member record created:`, createData.data);
        return createData.data as Member;
      }

      if (!res.ok) {
        throw new Error('Failed to fetch member role');
      }

      const data = await res.json();
      return data.data as Member;
    },
    enabled: enabled && !!session?.user && !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  return {
    ...query,
    member: query.data,
    role: query.data?.role,
    isOwner: query.data?.role === 'OWNER',
    isProvider: query.data?.role === 'PROVIDER',
    isClient: query.data?.role === 'CLIENT',
  };
}

/**
 * Hook to fetch all organizations the current user is a member of
 */
export function useMyOrganizations() {
  const { data: session } = authClient.useSession();

  return useQuery({
    queryKey: ['my-organizations', session?.user?.id],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_SERVER_URL}/api/members/my-organizations`,
        { 
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch organizations');
      }

      const data = await res.json();
      return data.data as Array<{
        id: string;
        role: MemberRole;
        organization: {
          id: string;
          name: string;
          domain: string | null;
          timezone: string;
        };
        createdAt: string;
      }>;
    },
    enabled: !!session?.user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

