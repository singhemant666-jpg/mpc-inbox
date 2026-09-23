'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getConversations,
  getMessages,
  sendMessage,
  markAsRead,
  deleteConversation,
  getTotalUnreadCount,
  convertConversationToPatient,
  transferConversationToLeads,
  login,
  initiateConversation,
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

// Helper to process reaction type messages and attach them to their target messages in memory
function processReactions(rawMessages: Message[]): Message[] {
  // Deep clone to avoid mutating standard objects directly
  const list = rawMessages.map(m => ({ ...m, reaction: undefined as string | undefined }));
  
  // Find all reactions
  const reactions = list.filter(m => m.messageType === 'reaction');
  const normalMessages = list.filter(m => m.messageType !== 'reaction');
  
  for (const rx of reactions) {
    try {
      const parsed = JSON.parse(rx.message);
      const emoji = parsed.emoji;
      const targetId = parsed.targetMessageId;
      const contextId = parsed.contextId;
      const contextGsId = parsed.contextGsId;
      
      if (emoji && (targetId || contextId || contextGsId)) {
        // Find the original message being reacted to using any of the available IDs
        const targetMsg = normalMessages.find(m => 
          (targetId && m.gupshupMessageId === targetId) ||
          (contextId && m.gupshupMessageId === contextId) ||
          (contextGsId && m.gupshupMessageId === contextGsId) ||
          (targetId && m.id === targetId) ||
          (contextId && m.id === contextId) ||
          (contextGsId && m.id === contextGsId)
        );
        
        if (targetMsg) {
          if (emoji === 'Reaction removed') {
            targetMsg.reaction = undefined;
          } else {
            targetMsg.reaction = emoji;
          }
        }
      }
    } catch (e) {
      // Ignore if not valid JSON
    }
  }
  
  return normalMessages;
}

function InboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phoneParam = searchParams?.get('phone') || null;

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
  const [conversationToDelete, setConversationToDelete] = useState<Conversation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const selectedConvRef = useRef<string | null>(null);
  const userRef = useRef<User | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const initiatedPhoneRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  // ---- Auth check with seamless auto-login fallback ----
  useEffect(() => {
    const checkAuth = async () => {
      let token = localStorage.getItem('inbox_token');
      let localUser = localStorage.getItem('inbox_user');

      if (!token || !localUser) {
        try {
          const loginData = await login('admin@mypainclnic.com', 'admin123');
          if (loginData?.access_token && loginData?.user) {
            localStorage.setItem('inbox_token', loginData.access_token);
            localStorage.setItem('inbox_user', JSON.stringify(loginData.user));
            setUser(loginData.user);
            return;
          }
        } catch (e) {
          router.replace('/login');
          return;
        }
      }

      try {
        const parsedUser = JSON.parse(localUser!);
        setUser(parsedUser);
      } catch (e) {
        router.replace('/login');
      }
    };

    checkAuth();
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
      const [result, unreadRes] = await Promise.all([
        getConversations({ search, limit: 100 }),
        getTotalUnreadCount().catch(() => ({ totalUnread: 0 })),
      ]);
      setConversations(result.data);

      if (unreadRes && typeof unreadRes.totalUnread === 'number') {
        setTotalUnread(unreadRes.totalUnread);
      } else {
        const unread = result.data.reduce(
          (sum, c) => sum + (Number(c.unreadCount) || 0),
          0,
        );
        setTotalUnread(unread);
      }
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
      setMessages(processReactions(result.data));
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // ---- Silently sync messages without flickering or wiping active chat ----
  const syncMessagesSilently = useCallback(async (conversationId: string) => {
    try {
      const result = await getMessages(conversationId, { limit: 100 });
      const processed = processReactions(result.data);
      setMessages((prev) => {
        const map = new Map<string, Message>();
        for (const m of prev) {
          map.set(m.id, m);
        }
        for (const m of processed) {
          map.set(m.id, m);
        }
        const merged = Array.from(map.values());
        merged.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        return processReactions(merged);
      });
    } catch (err) {
      // Ignore background sync errors
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

  // ---- Auto-select or initiate conversation if phone param is present in URL ----
  useEffect(() => {
    if (!phoneParam || loadingConversations) return;
    const cleanTarget = phoneParam.replace(/\D/g, '');
    if (!cleanTarget) return;

    // Check if conversation already selected
    if (selectedConversation?.phoneNumber?.replace(/\D/g, '').endsWith(cleanTarget.slice(-10))) {
      return;
    }

    // Try finding in loaded conversations
    const found = conversations.find((c) => {
      const p = (c.phoneNumber || '').replace(/\D/g, '');
      return p.endsWith(cleanTarget.slice(-10)) || cleanTarget.endsWith(p.slice(-10));
    });

    if (found) {
      handleSelectConversation(found);
    } else if (initiatedPhoneRef.current !== cleanTarget) {
      initiatedPhoneRef.current = cleanTarget;
      // Initiate conversation on backend so staff can chat immediately
      initiateConversation(cleanTarget)
        .then((newConv) => {
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === newConv.id);
            return exists ? prev : [newConv, ...prev];
          });
          handleSelectConversation(newConv);
        })
        .catch((err) => {
          console.error('Failed to initiate conversation for phone:', cleanTarget, err);
        });
    }
  }, [phoneParam, loadingConversations, conversations, selectedConversation, handleSelectConversation]);

  // ---- Send message ----
  const handleSendMessage = useCallback(
    async (text: string, messageType: string = 'text') => {
      if (!selectedConversation || !text.trim()) return;
      setSendingMessage(true);
      setSendError(null);
      try {
        const res = await sendMessage(selectedConversation.id, text, messageType);
        // Optimistically ensure message is in local messages state
        if (res?.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === res.message.id)) return prev;
            return processReactions([...prev, res.message]);
          });
        }
      } catch (err: any) {
        console.warn('Send message notice:', err?.response?.data?.message || err?.message);
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

  // ---- Delete conversation handler ----
  const confirmDeleteConversation = async () => {
    if (!conversationToDelete) return;
    const target = conversationToDelete;
    setIsDeleting(true);

    try {
      await deleteConversation(target.id);

      // Optimistically update conversation list
      setConversations((prev) => prev.filter((c) => c.id !== target.id));

      // If active conversation was deleted, clear chat pane
      if (selectedConvRef.current === target.id) {
        setSelectedConversation(null);
        selectedConvRef.current = null;
        setMessages([]);
        setIsMobileShowChat(false);
      }

      // Deduct unread count if it had unread messages
      if (target.unreadCount > 0) {
        setTotalUnread((prev) => Math.max(0, prev - target.unreadCount));
      }

      setConversationToDelete(null);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      alert('Failed to delete conversation. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

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
          return processReactions([...prev, message]);
        });

        // Auto-mark as read if we're viewing it
        if (message.senderType === 'patient') {
          markAsRead(conversationId).catch(() => {});
          playNotificationSound();
        }
      } else {
        // Play notification sound and show browser notification for incoming patient messages
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
          } else {
            // New conversation — add to top for all staff accounts
            nextList = [event as any, ...prev];
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

    socket.on('conversation_deleted', ({ conversationId }: { conversationId: string }) => {
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      if (selectedConvRef.current === conversationId) {
        setSelectedConversation(null);
        selectedConvRef.current = null;
        setMessages([]);
        setIsMobileShowChat(false);
      }
    });

    socket.on('connect', () => {
      loadConversations(searchQuery || undefined);
      if (selectedConvRef.current) {
        syncMessagesSilently(selectedConvRef.current);
      }
    });

    socket.on('reconnect', () => {
      loadConversations(searchQuery || undefined);
      if (selectedConvRef.current) {
        syncMessagesSilently(selectedConvRef.current);
      }
    });

    // Auto-sync when tab gains focus or user switches back
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        connectSocket();
        loadConversations(searchQuery || undefined);
        if (selectedConvRef.current) {
          syncMessagesSilently(selectedConvRef.current);
        }
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    // Periodic silent sync every 8 seconds to ensure state never desyncs
    const syncInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadConversations(searchQuery || undefined);
        if (selectedConvRef.current) {
          syncMessagesSilently(selectedConvRef.current);
        }
      }
    }, 8000);

    return () => {
      socket.off('new_message');
      socket.off('conversation_updated');
      socket.off('conversation_deleted');
      socket.off('message_status');
      socket.off('connect');
      socket.off('reconnect');
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      clearInterval(syncInterval);
      disconnectSocket();
    };
  }, [loadConversations, syncMessagesSilently]);

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
      let bodyText = message.message;
      if (message.messageType === 'reaction') {
        try {
          const parsed = JSON.parse(message.message);
          bodyText = parsed.emoji === 'Reaction removed'
            ? 'Removed a reaction'
            : `Reacted ${parsed.emoji}`;
        } catch (e) {
          bodyText = 'Reacted';
        }
      }

      new Notification('New Patient Message', {
        body: bodyText.slice(0, 100),
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
              {user?.role === 'super_admin' && (
                <Link
                  href="/super-admin"
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-[#00A884]/20 border border-[#00A884]/40 text-[#00A884] hover:bg-[#00A884]/30 hover:text-white transition-smooth flex items-center gap-1"
                  title="Super Admin Panel"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                  Admin Panel
                </Link>
              )}
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
            totalUnread={totalUnread}
            onSearchChange={setSearchQuery}
            onSelect={handleSelectConversation}
            onDeleteConversation={(conv) => setConversationToDelete(conv)}
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
            onDeleteConversation={() =>
              selectedConversation && setConversationToDelete(selectedConversation)
            }
            sendError={sendError}
          />
        </div>
      </div>

      {/* Delete Conversation Confirmation Modal */}
      {conversationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#202C33] border border-[#2A3942] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Delete chat?</h3>
                <p className="text-xs text-[#8696A0] mt-0.5">
                  {conversationToDelete.patientName} ({conversationToDelete.phoneNumber})
                </p>
              </div>
            </div>

            <p className="text-sm text-[#D1D7DB] leading-relaxed">
              Are you sure you want to delete this chat? All messages and media in this conversation will be permanently removed. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConversationToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[#111B21] text-[#E9EDEF] hover:bg-[#374248]/50 transition-smooth disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteConversation}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[#EA4335] text-white hover:bg-[#D93025] transition-smooth disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Chat</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen flex items-center justify-center bg-wa-dark-bg text-gray-400">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#00A884] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading Patient Inbox...</span>
          </div>
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  );
}

