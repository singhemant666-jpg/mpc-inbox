'use client';

import { useState } from 'react';
import type { Conversation } from '@/types';
import { ConversationItem } from './ConversationItem';
import { SearchBar } from './SearchBar';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  loading: boolean;
  searchQuery: string;
  totalUnread?: number;
  onSearchChange: (q: string) => void;
  onSelect: (conversation: Conversation) => void;
  onDeleteConversation?: (conversation: Conversation) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  loading,
  searchQuery,
  totalUnread,
  onSearchChange,
  onSelect,
  onDeleteConversation,
}: ConversationListProps) {
  const [activeFilter, setActiveFilter] = useState('All');

  // Count unread conversations and total unread messages
  const unreadChatsCount = conversations.filter(
    (c) => Number(c.unreadCount) > 0,
  ).length;
  const unreadBadgeCount =
    typeof totalUnread === 'number' && totalUnread > 0
      ? totalUnread
      : unreadChatsCount;

  // Filter conversations based on selected category (e.g. Unread) and active search query
  const filteredConversations = conversations.filter((c) => {
    // 1. Category filter
    if (activeFilter === 'Unread') {
      const isSelected = Boolean(selectedId && c.id === selectedId);
      // Show chats with unread messages, or currently open chat so it does not vanish
      if (!(Number(c.unreadCount) > 0) && !isSelected) {
        return false;
      }
    }

    // 2. Search query filter (instant client-side filtering)
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const cleanQ = q.replace(/\D/g, '');
      const nameMatch = c.patientName && c.patientName.toLowerCase().includes(q);
      const phoneClean = (c.phoneNumber || '').replace(/\D/g, '');
      const phoneMatch =
        (c.phoneNumber && c.phoneNumber.toLowerCase().includes(q)) ||
        (cleanQ.length > 0 && phoneClean.includes(cleanQ));
      const msgMatch = c.lastMessage && c.lastMessage.toLowerCase().includes(q);

      if (!nameMatch && !phoneMatch && !msgMatch) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#111B21]">
      {/* Sidebar Header */}
      <div className="px-4 py-3 flex items-center justify-between bg-[#111B21]">
        <h2 className="text-xl font-bold text-white tracking-wide">WhatsApp</h2>
        <div className="flex items-center gap-4 text-gray-300">
          {/* New Chat Icon */}
          <button className="hover:text-white transition-smooth" title="New chat">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>
          {/* Menu Dots */}
          <button className="hover:text-white transition-smooth" title="Menu">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Search Header */}
      <div className="px-3 pb-2 bg-[#111B21]">
        <SearchBar value={searchQuery} onChange={onSearchChange} />
      </div>

      {/* Categories Filters Row */}
      <div className="px-3 py-1 flex gap-2 overflow-x-auto bg-[#111B21] no-scrollbar shrink-0 select-none">
        {['All', 'Unread', 'Favourites', 'Groups'].map((filter) => {
          const isActive = activeFilter === filter;
          const isUnread = filter === 'Unread';
          return (
            <button
              key={filter}
              onClick={() => {
                if (isActive && filter !== 'All') {
                  setActiveFilter('All');
                } else {
                  setActiveFilter(filter);
                }
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-smooth whitespace-nowrap flex items-center gap-1.5
                ${
                  isActive
                    ? 'bg-[#0A332C] text-[#00A884]'
                    : 'bg-[#202C33] text-[#8696A0] hover:bg-[#374248]/70'
                }`}
            >
              <span>{filter}</span>
              {isUnread && unreadBadgeCount > 0 && (
                <span
                  className="min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold flex items-center justify-center bg-[#00A884] text-[#111B21]"
                >
                  {unreadBadgeCount}
                </span>
              )}
            </button>
          );
        })}
        <button className="w-6 h-6 rounded-full bg-[#202C33] flex items-center justify-center text-[#8696A0] hover:bg-[#374248]/70 shrink-0 text-sm">
          +
        </button>
      </div>

      {/* Archived Row */}
      <div className="border-t border-[#2A3942]/40 mt-2">
        <button className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-[#202C33]/50 transition-smooth text-left">
          <span className="text-[#00A884]">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.01 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.49-.17-.93-.46-1.27zM6.24 5h11.52l.83 1H5.41l.83-1zM5 19V8h14v11H5zm8-6h-2v-3H9l3-3 3 3h-2v3z"/>
            </svg>
          </span>
          <span className="text-sm font-medium text-gray-200 flex-1">Archived</span>
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto border-t border-[#2A3942]/40">
        {loading ? (
          // Skeleton loading
          <div className="p-2 space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                <div className="w-12 h-12 rounded-full skeleton shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 skeleton" />
                  <div className="h-3 w-48 skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[#202C33] flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-500"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-gray-400 text-sm font-medium">
              {searchQuery
                ? 'No conversations found'
                : activeFilter === 'Unread'
                ? 'No unread chats'
                : 'No conversations yet'}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              {searchQuery
                ? 'Try a different search term'
                : activeFilter === 'Unread'
                ? "You've read all your messages"
                : 'Messages from patients will appear here'}
            </p>
            {activeFilter === 'Unread' && (
              <button
                onClick={() => setActiveFilter('All')}
                className="mt-4 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#202C33] text-[#00A884] hover:bg-[#2A3942] transition-smooth"
              >
                View all chats
              </button>
            )}
          </div>
        ) : (
          // Conversation items
          <div className="divide-y divide-[#2A3942]/20">
            {filteredConversations.map((conversation, index) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isSelected={conversation.id === selectedId}
                onClick={() => onSelect(conversation)}
                onDelete={() => onDeleteConversation?.(conversation)}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
