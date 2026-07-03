'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  getTotalUnreadCount,
  convertConversationToPatient,
  transferConversationToLeads,
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

// App styles are loaded from global CSS

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
  const [sendError, setSendError] = useState<string | null>(null);
  const selectedConvRef = useRef<string | null>(null);
  const userRef = useRef<User | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);

  // Keep refs in sync with state
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // ---- Auth check ----
  useEffect(() => {
    const token = localStorage.getItem('inbox_token');
    const localUser = localStorage.getItem('inbox_user');

    if (!token || !localUser) {
      router.replace('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(localUser);
      if (parsedUser.role === 'super_admin') {
        router.replace('/inbox/super-admin');
        return;
      }
      setUser(parsedUser);
    } catch (e) {
      router.replace('/login');
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
      setSendError(null); // Clear any previous send errors
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
    async (text: string, messageType: string = 'text') => {
      if (!selectedConversation || !text.trim()) return;
      setSendingMessage(true);
      setSendError(null);
      try {
        await sendMessage(selectedConversation.id, text, messageType);
        // The Socket.IO event will update the UI in real-time
      } catch (err: any) {
        console.error('Failed to send message:', err);
        const errMsg = err.response?.data?.message || 'Failed to send message. Please try again.';
        setSendError(errMsg);
      } finally {
        setSendingMessage(false);
      }
    },
    [selectedConversation],
  );

  // ---- Convert Lead to Patient ----
  const handleConvertConversation = useCallback(async () => {
    if (!selectedConversation) return;
    try {
      await convertConversationToPatient(selectedConversation.id);
      
      // Instantly clear local UI states so we don't display stale data
      setSelectedConversation(null);
      selectedConvRef.current = null;
      setIsMobileShowChat(false);
      setMessages([]);
      setConversations((prev) =>
        prev.filter((c) => c.id !== selectedConversation.id),
      );
      setTotalUnread((prev) =>
        Math.max(0, prev - selectedConversation.unreadCount),
      );
    } catch (err) {
      console.error('Failed to convert conversation:', err);
    }
  }, [selectedConversation]);

  // ---- Transfer Patient back to Leads ----
  const handleTransferToLeads = useCallback(async () => {
    if (!selectedConversation) return;
    try {
      await transferConversationToLeads(selectedConversation.id);
      
      // Instantly clear local UI states so we don't display stale data
      setSelectedConversation(null);
      selectedConvRef.current = null;
      setIsMobileShowChat(false);
      setMessages([]);
      setConversations((prev) =>
        prev.filter((c) => c.id !== selectedConversation.id),
      );
      setTotalUnread((prev) =>
        Math.max(0, prev - selectedConversation.unreadCount),
      );
    } catch (err) {
      console.error('Failed to transfer conversation to leads:', err);
    }
  }, [selectedConversation]);



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
          playNotificationSound();
        }
      } else {
        // Play notification sound and show browser notification
        // Only if this conversation belongs to the current user
        const belongsToUser = conversationsRef.current.some(
          (c) => c.id === conversationId,
        );
        if (message.senderType === 'patient' && belongsToUser) {
          playNotificationSound();
          showBrowserNotification(message);
        }
      }
    });

    socket.on(
      'conversation_updated',
      (event: ConversationUpdatedEvent) => {
        // Only process events for conversations assigned to the current user
        const currentUserId = userRef.current?.id;
        const isAssignedToMe =
          event.assignedUserId === currentUserId;

        setConversations((prev) => {
          const exists = prev.some((c) => c.id === event.id);
          let nextList = [];
          
          if (exists) {
            const updated = prev.map((c) =>
              c.id === event.id
                ? {
                    ...c,
                    lastMessage: event.lastMessage,
                    lastMessageSender: event.lastMessageSender,
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
            nextList = updated.sort(
              (a, b) =>
                new Date(b.lastMessageTime || 0).getTime() -
                new Date(a.lastMessageTime || 0).getTime(),
            );
          } else if (isAssignedToMe) {
            // New conversation assigned to me — add to top
            nextList = [event as any, ...prev];
          } else {
            nextList = prev;
          }

          // Calculate total unread count on the new list immediately
          const unread = nextList.reduce((sum, c) => sum + c.unreadCount, 0);
          setTotalUnread(unread);

          return nextList;
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Notification helpers ----
  const playNotificationSound = () => {
    try {
      // Check if AudioContext is supported
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      
      const audioCtx = new AudioCtx();
      const now = audioCtx.currentTime;
      
      // WhatsApp notification is a double chime: high note then higher note (ding-ding)
      
      // Tone 1 (soft, high frequency)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5 note
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.08, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Tone 2 (higher frequency, delayed by 80ms)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.5, now + 0.08); // C6 note
      gain2.gain.setValueAtTime(0, now + 0.08);
      gain2.gain.linearRampToValueAtTime(0.08, now + 0.095);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.4);
    } catch (e) {
      console.warn('Browser audio playback blocked or not supported:', e);
    }
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
    <div className="h-screen w-screen flex bg-wa-dark-bg text-gray-200 overflow-hidden font-sans">
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
              <div className="w-10 h-10 rounded-full overflow-hidden border border-[#2A3942] bg-[#202C33] shrink-0 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="Clinic Logo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent && !parent.querySelector('.avatar-fallback')) {
                      const fallback = document.createElement('span');
                      fallback.className = 'text-white font-semibold text-sm avatar-fallback';
                      fallback.innerText = user ? user.name.slice(0, 2).toUpperCase() : 'AG';
                      parent.appendChild(fallback);
                    }
                  }}
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white leading-tight">
                  {user ? user.name : 'Agent'}
                </h3>
                <span className="text-xs text-[#8696A0]">My Pain Clinic</span>
              </div>
            </div>
            
            {/* Header Right Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg text-xs bg-[#111B21] text-gray-300 hover:text-white hover:bg-[#374248]/50 transition-smooth"
              >
                Logout
              </button>
            </div>
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
            onConvert={handleConvertConversation}
            onTransferToLeads={handleTransferToLeads}
            sendError={sendError}
          />
        </div>
      </div>
    </div>
  );
}
