'use client';

import { useRef, useEffect } from 'react';
import type { Conversation, Message } from '@/types';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

interface ChatWindowProps {
  conversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  sending: boolean;
  onSend: (text: string) => void;
  onBack: () => void;
}

export function ChatWindow({
  conversation,
  messages,
  loading,
  sending,
  onSend,
  onBack,
}: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  // Group messages by date
  let lastDateLabel = '';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Chat Header */}
      <ChatHeader conversation={conversation} onBack={onBack} />

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
            
            {messages.map((message, index) => {
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
                  <MessageBubble message={message} />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <MessageInput onSend={onSend} sending={sending} />
    </div>
  );
}
