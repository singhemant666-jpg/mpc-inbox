import { useState, useRef, useEffect } from 'react';
import type { Conversation, Message } from '@/types';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  sending: boolean;
  onSend: (text: string, messageType?: string) => void;
  onBack: () => void;
  onConvert?: () => void;
  onTransferToLeads?: () => void;
  sendError?: string | null;
}

export function ChatWindow({
  conversation,
  messages,
  loading,
  sending,
  onSend,
  onBack,
  onConvert,
  onTransferToLeads,
  sendError,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Message Search States
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Lightbox Modal State
  const [lightbox, setLightbox] = useState<{ url: string; type: string } | null>(null);

  // Listen to custom lightbox events from message bubbles
  useEffect(() => {
    const handleOpenLightbox = (e: Event) => {
      const customEvent = e as CustomEvent;
      setLightbox({
        url: customEvent.detail.url,
        type: customEvent.detail.type,
      });
    };
    window.addEventListener('open-lightbox', handleOpenLightbox);
    return () => window.removeEventListener('open-lightbox', handleOpenLightbox);
  }, []);

  // Auto-scroll to bottom on new messages (unless highlighting/searching is active)
  useEffect(() => {
    if (messagesEndRef.current && !highlightedMessageId) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, highlightedMessageId]);

  // Reset search state when switching chats
  useEffect(() => {
    setShowSearch(false);
    setSearchQuery('');
    setHighlightedMessageId(null);
  }, [conversation?.id]);

  // ---- Empty State: No conversation selected ----
  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#222E35] relative select-none px-6">
        <div className="text-center max-w-md animate-fade-in flex flex-col items-center">
          {/* Laptop & Devices illustration */}
          <div className="text-[#6A7B85] mb-8">
            <svg viewBox="0 0 355 186" width="300" height="157" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M30 156h295M45 156l15-50h235l15 50M60 106V20c0-5.5 4.5-10 10-10h215c5.5 0 10 4.5 10 10v86"/>
              <rect x="150" y="50" width="55" height="100" rx="6" fill="#111B21" stroke="currentColor" strokeWidth="2"/>
              <circle cx="177" cy="135" r="4" fill="currentColor"/>
              <path strokeLinecap="round" d="M165 70h25M170 30a20 20 0 0 1 15 0"/>
            </svg>
          </div>
          <h2 className="text-[32px] font-light text-[#E9EDEF] mb-4">
            WhatsApp Web
          </h2>
          <p className="text-[14px] text-[#8696A0] leading-relaxed mb-2">
            Send and receive messages without keeping your phone online.
          </p>
          <p className="text-[14px] text-[#8696A0] leading-relaxed">
            Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
          </p>
        </div>

        {/* Lock footer */}
        <div className="absolute bottom-10 flex items-center gap-1.5 text-[#8696A0] text-xs">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
          End-to-end encrypted
        </div>
      </div>
    );
  }

  // ---- Date separator helper ----
  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Filter messages for search query
  const filteredSearchMessages = messages.filter((m) =>
    m.message.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Scroll to targeted message bubble and activate glow
  const scrollToMessage = (id: string) => {
    const element = document.getElementById(`msg-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(id);
      setTimeout(() => {
        setHighlightedMessageId((curr) => (curr === id ? null : curr));
      }, 2000);
    }
  };

  // Group messages by date
  let lastDateLabel = '';

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#0B141A] relative">
      {/* Left Main Chat Box Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 border-r border-[#2A3942]/10">
        {/* Chat Header */}
        <ChatHeader
          conversation={conversation}
          onBack={onBack}
          onSearchClick={() => setShowSearch(!showSearch)}
          onConvert={onConvert}
          onTransferToLeads={onTransferToLeads}
        />

        {/* Messages Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto chat-bg px-4 md:px-6 py-4 flex flex-col"
        >
          {loading ? (
            // Loading skeleton
            <div className="space-y-4 py-4 w-full">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`skeleton rounded-xl ${
                      i % 2 === 0 ? 'w-48 h-12' : 'w-56 h-16'
                    }`}
                  />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full w-full">
              <p className="text-gray-500 text-sm">
                No messages yet. Send a message to start the conversation.
              </p>
            </div>
          ) : (
            <div className="flex flex-col min-h-full space-y-1 max-w-3xl mx-auto w-full">
              {/* Spacer pushes messages to the bottom when there are only a few */}
              <div className="flex-1" />
              
              {messages.map((message) => {
                const dateLabel = getDateLabel(message.createdAt);
                const showDateSeparator = dateLabel !== lastDateLabel;
                lastDateLabel = dateLabel;

                return (
                  <div key={message.id} className="w-full">
                    {showDateSeparator && (
                      <div className="flex items-center justify-center my-4">
                        <span className="px-3 py-1 rounded-lg bg-wa-dark-header text-gray-400 text-[11px] font-medium shadow-sm">
                          {dateLabel}
                        </span>
                      </div>
                    )}
                    <MessageBubble
                      message={message}
                      isHighlighted={highlightedMessageId === message.id}
                    />
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error Alert Banner */}
        {sendError && (
          <div className="mx-4 md:mx-6 mb-2 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-start gap-2.5 text-red-200 text-xs animate-fade-in shrink-0 select-text">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-400 shrink-0 mt-0.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="flex-1">
              <span className="font-semibold block mb-0.5">Cannot Send Message</span>
              <span>{sendError}</span>
            </div>
          </div>
        )}

        {/* Message Input */}
        <MessageInput onSend={onSend} sending={sending} />
      </div>

      {/* Right Drawer: Search Messages Panel */}
      {showSearch && (
        <div className="w-80 bg-[#111B21] border-l border-[#2A3942]/60 flex flex-col h-full shrink-0 z-10 animate-slide-in-right">
          {/* Header */}
          <div className="h-16 px-4 flex items-center justify-between bg-[#202C33] border-b border-[#2A3942]/20">
            <span className="text-[#E9EDEF] font-medium text-sm">Search Messages</span>
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              className="text-gray-400 hover:text-white p-1 hover:bg-[#374248]/50 rounded-full transition-smooth"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          {/* Search Field */}
          <div className="p-3 bg-[#111B21] border-b border-[#2A3942]/30">
            <div className="relative flex items-center bg-[#202C33] rounded-lg px-3 py-1.5">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="text-gray-400 mr-2 shrink-0">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-[#E9EDEF] focus:outline-none placeholder-gray-500"
              />
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {searchQuery.trim() === '' ? (
              <div className="text-center py-16 text-xs text-gray-500">
                Search for messages in this chat.
              </div>
            ) : filteredSearchMessages.length === 0 ? (
              <div className="text-center py-16 text-xs text-gray-500">
                No messages found.
              </div>
            ) : (
              filteredSearchMessages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => scrollToMessage(msg.id)}
                  className="w-full text-left p-3 rounded-lg bg-[#182229] hover:bg-[#202C33] transition-smooth border border-[#2A3942]/30 flex flex-col gap-1.5"
                >
                  <div className="flex justify-between items-center w-full">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${msg.senderType === 'agent' ? 'text-[#00A884]' : 'text-sky-400'}`}>
                      {msg.senderType === 'agent' ? 'You' : 'Patient'}
                    </span>
                    <span className="text-[9px] text-[#8696A0]">
                      {new Date(msg.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-[#E9EDEF] leading-relaxed line-clamp-3 select-none">
                    {msg.message}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal Overlay */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4 animate-fade-in cursor-zoom-out select-none"
          onClick={() => setLightbox(null)}
        >
          {/* Close Button */}
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-smooth border border-white/5 shadow-lg"
            onClick={() => setLightbox(null)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
          
          {/* Main Media Preview */}
          <div className="relative max-w-full max-h-[85vh] flex items-center justify-center">
            {lightbox.type === 'image' ? (
              <img
                src={lightbox.url}
                alt="Preview"
                className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl animate-scale-up"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <video
                src={lightbox.url}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl animate-scale-up"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
