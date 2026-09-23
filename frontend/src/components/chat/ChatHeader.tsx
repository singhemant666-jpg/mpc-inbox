'use client';

import { useState } from 'react';
import type { Conversation } from '@/types';
import { getInitials } from '@/lib/utils';

interface ChatHeaderProps {
  conversation: Conversation;
  onBack: () => void;
  onSearchClick?: () => void;
  onConvert?: () => void;
  onTransferToLeads?: () => void;
  onDeleteConversation?: () => void;
}

const AVATAR_COLORS = [
  'from-emerald-500 to-teal-600',
  'from-blue-500 to-indigo-600',
  'from-purple-500 to-violet-600',
  'from-pink-500 to-rose-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-sky-600',
  'from-lime-500 to-green-600',
  'from-fuchsia-500 to-purple-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function ChatHeader({
  conversation,
  onBack,
  onSearchClick,
  onConvert,
  onTransferToLeads,
  onDeleteConversation,
}: ChatHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);
  const initials = getInitials(conversation.patientName);
  const avatarColor = getAvatarColor(conversation.patientName);

  // Format phone for display: +91 9876543210 (no space between number digits)
  const formatPhone = (phone: string) => {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length >= 12) {
      return `+${clean.slice(0, 2)} ${clean.slice(2)}`;
    }
    if (clean.length === 10) {
      return `+91 ${clean}`;
    }
    return phone;
  };

  return (
    <div className="h-16 bg-[#202C33] flex items-center justify-between px-4 border-b border-[#2A3942]/20 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {/* Back button (mobile only) */}
        <button
          onClick={onBack}
          className="md:hidden p-1 rounded-lg hover:bg-wa-dark-hover transition-smooth text-gray-400"
        >
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
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        {/* Avatar */}
        <div
          className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0`}
        >
          <span className="text-white font-semibold text-sm">{initials}</span>
        </div>

        {/* Patient info */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-[#E9EDEF] truncate leading-tight">
              {conversation.patientName}
            </h2>
            <span className="text-[11px] text-[#8696A0] bg-[#111B21] border border-[#2A3942]/60 px-1.5 py-0.5 rounded font-normal shrink-0">
              {formatPhone(conversation.phoneNumber)}
            </span>
          </div>
          <span className="text-[11px] text-[#8696A0] leading-none mt-1">
            last seen today at {new Date(conversation.lastMessageTime || new Date()).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </span>
        </div>
      </div>

      {/* Right Side Header Controls */}
      <div className="flex items-center gap-2 text-[#AEBAC1]">
        {/* Convert Button (Only show if this is a new lead) */}
        {conversation.conversationType === 'new_lead' && onConvert && (
          <button
            onClick={onConvert}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00A884] text-[#111B21] hover:bg-[#008F72] transition-smooth select-none mr-1"
            title="Send this lead to Admin inbox"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <polyline points="16 11 18 13 22 9" />
            </svg>
            Send to Admin
          </button>
        )}

        {/* Transfer back to Leads Button (Only show if this is an existing patient) */}
        {conversation.conversationType === 'existing_patient' && onTransferToLeads && (
          <button
            onClick={onTransferToLeads}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#00A884] text-[#111B21] hover:bg-[#008F72] transition-smooth select-none mr-1"
            title="Move this conversation to Leads inbox"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 10H3M3 10L7 6M3 10L7 14" />
              <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Move to Leads
          </button>
        )}

        {/* Search Icon */}
        <button
          onClick={onSearchClick}
          className="hover:text-white transition-smooth p-1.5 hover:bg-[#374248]/40 rounded-full"
          title="Search messages"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </button>

        {/* Delete Chat Button (Header Shortcut) */}
        {onDeleteConversation && (
          <button
            onClick={onDeleteConversation}
            className="hover:text-[#F15C6D] transition-smooth p-1.5 hover:bg-[#F15C6D]/10 rounded-full"
            title="Delete this conversation"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="19"
              height="19"
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
          </button>
        )}

        {/* Menu Dots & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMenu((prev) => !prev)}
            className="hover:text-white transition-smooth p-1.5 hover:bg-[#374248]/40 rounded-full"
            title="More options"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#233138] rounded-xl shadow-xl border border-[#2A3942]/60 py-1.5 z-50">
                {onDeleteConversation && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDeleteConversation();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm text-[#F15C6D] hover:bg-[#111B21]/60 transition-smooth flex items-center gap-2.5 font-medium"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
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
                    </svg>
                    Delete chat
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
