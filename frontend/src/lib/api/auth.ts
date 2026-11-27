import { apiClient } from './client';
import { AuthResponse, User, InvitationVerifyResponse } from '../../types';

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    return apiClient<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register: async (email: string, password: string): Promise<AuthResponse> => {
    return apiClient<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  getMe: async (): Promise<User> => {
    return apiClient<User>('/auth/me');
  },

  verifyInvitation: async (token: string): Promise<InvitationVerifyResponse> => {
    return apiClient<InvitationVerifyResponse>(`/auth/invitations/verify?token=${encodeURIComponent(token)}`);
  },

  acceptInvitation: async (token: string, password: string): Promise<AuthResponse> => {
    return apiClient<AuthResponse>('/auth/invitations/accept', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  resetPassword: async (email: string, password: string): Promise<{ success: boolean; message: string }> => {
    return apiClient('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
};
