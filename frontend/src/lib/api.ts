import axios from 'axios';
import type {
  AuthResponse,
  PaginatedResponse,
  Conversation,
  MessagesResponse,
  Template,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('inbox_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('inbox_token');
      localStorage.removeItem('inbox_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// ---- Auth ----
export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  return data;
}

export async function getProfile() {
  const { data } = await api.get('/auth/profile');
  return data;
}

export async function seedAdmin() {
  const { data } = await api.post('/auth/seed');
  return data;
}

// ---- Conversations ----
export async function getConversations(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<Conversation>> {
  const { data } = await api.get<PaginatedResponse<Conversation>>(
    '/conversations',
    { params },
  );
  return data;
}

export async function getConversation(id: string): Promise<Conversation> {
  const { data } = await api.get<Conversation>(`/conversations/${id}`);
  return data;
}

export async function markAsRead(conversationId: string) {
  const { data } = await api.post('/conversations/read', { conversationId });
  return data;
}

export async function getTotalUnreadCount(): Promise<{ totalUnread: number }> {
  const { data } = await api.get<{ totalUnread: number }>(
    '/conversations/unread-count',
  );
  return data;
}

// ---- Messages ----
export async function getMessages(
  conversationId: string,
  params?: { page?: number; limit?: number },
): Promise<MessagesResponse> {
  const { data } = await api.get<MessagesResponse>(
    `/conversations/${conversationId}/messages`,
    { params },
  );
  return data;
}

export async function sendMessage(
  conversationId: string,
  message: string,
  messageType: string = 'text',
) {
  const { data } = await api.post('/messages/send', {
    conversationId,
    message,
    messageType,
  });
  return data;
}

export async function deleteMessage(messageId: string) {
  const { data } = await api.delete(`/messages/${messageId}`);
  return data;
}

export async function uploadFile(file: File): Promise<{ url: string; filename: string; mimetype: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/messages/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

export async function convertConversationToPatient(conversationId: string): Promise<any> {
  const { data } = await api.post(`/conversations/${conversationId}/convert`);
  return data;
}

export async function transferConversationToLeads(conversationId: string): Promise<any> {
  const { data } = await api.post(`/conversations/${conversationId}/transfer-to-leads`);
  return data;
}

// ---- Custom Templates ----
export async function getTemplates(): Promise<Template[]> {
  const { data } = await api.get<Template[]>('/templates');
  return data;
}

export async function createTemplate(title: string, text: string): Promise<Template> {
  const { data } = await api.post<Template>('/templates', { title, text });
  return data;
}

export async function updateTemplate(id: string, title: string, text: string): Promise<Template> {
  const { data } = await api.patch<Template>(`/templates/${id}`, { title, text });
  return data;
}

export async function deleteTemplate(id: string): Promise<any> {
  const { data } = await api.delete(`/templates/${id}`);
  return data;
}

// ---- User Management (Admin Only) ----
export async function getUsers(): Promise<any[]> {
  const { data } = await api.get<any[]>('/users');
  return data;
}

export async function createUser(userData: any): Promise<any> {
  const { data } = await api.post<any>('/users', userData);
  return data;
}

export async function changeUserPassword(userId: string, password: string): Promise<any> {
  const { data } = await api.post<any>(`/users/${userId}/change-password`, { password });
  return data;
}

export default api;
