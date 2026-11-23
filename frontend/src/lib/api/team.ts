import { apiClient } from './client';
import { InvitationRead, TeamMember, UserRole } from '../../types';

export const teamApi = {
  listMembers: async (): Promise<{ total: number; items: TeamMember[] }> => {
    return apiClient<{ total: number; items: TeamMember[] }>('/users');
  },

  inviteMember: async (email: string, role: UserRole): Promise<InvitationRead> => {
    return apiClient<InvitationRead>('/users/invite', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  },

  updateRole: async (userId: string, role: UserRole): Promise<TeamMember> => {
    return apiClient<TeamMember>(`/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  updateStatus: async (userId: string, isActive: boolean): Promise<TeamMember> => {
    return apiClient<TeamMember>(`/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  },
};
