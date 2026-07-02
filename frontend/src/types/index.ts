// ============================================
// WhatsApp Patient Inbox - Type Definitions
// ============================================

export interface Conversation {
  id: string;
  patientName: string;
  phoneNumber: string;
  lastMessage: string | null;
  lastMessageSender?: 'patient' | 'agent' | null;
  lastMessageTime: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  gupshupMessageId?: string;
  senderType: 'patient' | 'agent';
  message: string;
  messageType: string;
  status: 'sent' | 'delivered' | 'read' | 'received' | 'failed';
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface MessagesResponse {
  data: Message[];
  conversation: {
    id: string;
    patientName: string;
    phoneNumber: string;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Socket.IO event payloads
export interface NewMessageEvent {
  conversationId: string;
  message: Message;
}

export interface ConversationUpdatedEvent {
  id: string;
  patientName: string;
  phoneNumber: string;
  lastMessage: string;
  lastMessageSender?: 'patient' | 'agent' | null;
  lastMessageTime: string;
  unreadCount: number;
}

export interface MessageStatusEvent {
  messageId: string;
  status: string;
}

export interface Template {
  id: string;
  title: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}
