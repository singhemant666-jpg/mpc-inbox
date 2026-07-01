'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  getTotalUnreadCount,
} from '@/lib/api';
import { getSocket, connectSocket, disconnectSocket } from '@/lib/socket';
import type {
  Conversation,
  Message,
  NewMessageEvent,
  ConversationUpdatedEvent,
  MessageStatusEvent,
  User,
} from '@/types';
import { ConversationList } from '@/components/sidebar/ConversationList';
import { ChatWindow } from '@/components/chat/ChatWindow';

// Notification sound (base64 short beep)
const NOTIFICATION_SOUND_URL =
  'data:audio/wav;base64,UklGRl9vT19teleXHcAASBhBVhwb3YAAABEYXRhAAAYQBAAAA==';

export default function InboxPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalUnread, setTotalUnread] = useState(0);
  const [isMobileShowChat, setIsMobileShowChat] = useState(false);
  const selectedConvRef = useRef<string | null>(null);

  // ---- Auth check ----
  useEffect(() => {
    const token = localStorage.getItem('inbox_token');
    const userData = localStorage.getItem('inbox_user');
    if (!token) {
      router.replace('/login');
      return;
    }
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, [router]);

  // ---- Update page title with unread count ----
  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) WhatsApp Inbox — My Pain Clinic`;
    } else {
      document.title = 'WhatsApp Inbox — My Pain Clinic';
    }
  }, [totalUnread]);

  // ---- Load conversations ----
  const loadConversations = useCallback(async (search?: string) => {
    try {
      const result = await getConversations({ search, limit: 100 });
      setConversations(result.data);

      // Calculate total unread
      const unread = result.data.reduce(
        (sum, c) => sum + c.unreadCount,
        0,
      );
      setTotalUnread(unread);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ---- Search with debounce ----
  useEffect(() => {
    const timer = setTimeout(() => {
      loadConversations(searchQuery || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, loadConversations]);

  // ---- Load messages for selected conversation ----
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const result = await getMessages(conversationId, { limit: 100 });
      setMessages(result.data);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // ---- Select conversation ----
  const handleSelectConversation = useCallback(
    async (conversation: Conversation) => {
      setSelectedConversation(conversation);
      selectedConvRef.current = conversation.id;
      setIsMobileShowChat(true);
      await loadMessages(conversation.id);

      // Mark as read
      if (conversation.unreadCount > 0) {
        await markAsRead(conversation.id);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversation.id ? { ...c, unreadCount: 0 } : c,
          ),
        );
        // Recalculate total unread
        setTotalUnread((prev) => Math.max(0, prev - conversation.unreadCount));
      }
    },
    [loadMessages],
  );

  // ---- Send message ----
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!selectedConversation || !text.trim()) return;
      setSendingMessage(true);
      try {
        await sendMessage(selectedConversation.id, text);
        // The Socket.IO event will update the UI in real-time
      } catch (err) {
        console.error('Failed to send message:', err);
      } finally {
        setSendingMessage(false);
      }
    },
    [selectedConversation],
  );

  // ---- Socket.IO real-time events ----
  useEffect(() => {
    connectSocket();
    const socket = getSocket();

    socket.on('new_message', (event: NewMessageEvent) => {
      const { conversationId, message } = event;

      // Add message to chat if viewing that conversation
      if (selectedConvRef.current === conversationId) {
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });

        // Auto-mark as read if we're viewing it
        if (message.senderType === 'patient') {
          markAsRead(conversationId).catch(() => {});
        }
      } else {
        // Play notification sound and show browser notification
        if (message.senderType === 'patient') {
          playNotificationSound();
          showBrowserNotification(message);
        }
      }
    });

    socket.on(
      'conversation_updated',
      (event: ConversationUpdatedEvent) => {
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === event.id);
          if (exists) {
            const updated = prev.map((c) =>
              c.id === event.id
                ? {
                    ...c,
                    lastMessage: event.lastMessage,
                    lastMessageTime: event.lastMessageTime,
                    unreadCount:
                      selectedConvRef.current === event.id
                        ? 0
                        : event.unreadCount,
                    patientName: event.patientName,
                  }
                : c,
            );
            // Re-sort by last message time
            return updated.sort(
              (a, b) =>
                new Date(b.lastMessageTime || 0).getTime() -
                new Date(a.lastMessageTime || 0).getTime(),
            );
          } else {
            // New conversation — add to top
            return [event as any, ...prev];
          }
        });

        // Update total unread
        setConversations((prev) => {
          const unread = prev.reduce((sum, c) => sum + c.unreadCount, 0);
          setTotalUnread(unread);
          return prev;
        });
      },
    );

    socket.on('message_status', (event: MessageStatusEvent) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === event.messageId ? { ...m, status: event.status as any } : m,
        ),
      );
    });

    return () => {
      socket.off('new_message');
      socket.off('conversation_updated');
      socket.off('message_status');
      disconnectSocket();
    };
  }, []);

  // ---- Notification helpers ----
  const playNotificationSound = () => {
    try {
      const audio = new Audio(NOTIFICATION_SOUND_URL);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {}
  };

  const showBrowserNotification = (message: Message) => {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification('New Patient Message', {
        body: message.message.slice(0, 100),
        icon: '/favicon.ico',
        tag: message.conversationId,
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  };

  // ---- Request notification permission on mount ----
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ---- Logout ----
  const handleLogout = () => {
    localStorage.removeItem('inbox_token');
    localStorage.removeItem('inbox_user');
    disconnectSocket();
    router.replace('/login');
  };

  // ---- Back button for mobile ----
  const handleMobileBack = () => {
    setIsMobileShowChat(false);
    setSelectedConversation(null);
    selectedConvRef.current = null;
  };

  return (
    <div className="h-screen w-screen flex bg-wa-dark-bg text-gray-200 overflow-hidden font-sans select-none">
      {/* ---- Sidebar & Chat Window Container ---- */}
      <div className="flex flex-1 h-full overflow-hidden">
        {/* Sidebar — conversation list */}
        <div
          className={`${
            isMobileShowChat ? 'hidden md:flex' : 'flex'
          } w-full md:w-[380px] lg:w-[420px] flex-col border-r border-[#2A3942] bg-wa-dark-sidebar shrink-0 h-full overflow-hidden`}
        >
          {/* Header block with Profile and Logout */}
          <div className="px-4 py-3 flex items-center justify-between bg-[#202C33] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-wa-secondary text-white font-semibold text-sm flex items-center justify-center border border-[#2A3942]">
                {user ? user.name.slice(0, 2).toUpperCase() : 'AG'}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white leading-tight">
                  {user ? user.name : 'Agent'}
                </h3>
                <span className="text-xs text-[#8696A0]">My Pain Clinic</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-lg text-xs bg-[#111B21] text-gray-300 hover:text-white hover:bg-[#374248]/50 transition-smooth"
            >
              Logout
            </button>
          </div>

          <ConversationList
            conversations={conversations}
            selectedId={selectedConversation?.id || null}
            loading={loadingConversations}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelect={handleSelectConversation}
          />
        </div>

        {/* Chat window */}
        <div
          className={`${
            isMobileShowChat ? 'flex' : 'hidden md:flex'
          } flex-1 flex-col h-full overflow-hidden`}
        >
          <ChatWindow
            conversation={selectedConversation}
            messages={messages}
            loading={loadingMessages}
            sending={sendingMessage}
            onSend={handleSendMessage}
            onBack={handleMobileBack}
          />
        </div>
      </div>
    </div>
  );
}
