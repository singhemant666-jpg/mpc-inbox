'use client';

import type { Conversation } from '@/types';
import { getInitials } from '@/lib/utils';

interface ChatHeaderProps {
  conversation: Conversation;
  onBack: () => void;
  onSearchClick?: () => void;
  onConvert?: () => void;
  onTransferToLeads?: () => void;
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

export function ChatHeader({ conversation, onBack, onSearchClick, onConvert, onTransferToLeads }: ChatHeaderProps) {
  const initials = getInitials(conversation.patientName);
  const avatarColor = getAvatarColor(conversation.patientName);

  // Format phone for display: +91 98765 43210
  const formatPhone = (phone: string) => {
    if (phone.length >= 12) {
      return `+${phone.slice(0, 2)} ${phone.slice(2, 7)} ${phone.slice(7)}`;
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
      <div className="flex items-center gap-4 text-[#AEBAC1]">
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
          className="hover:text-white transition-smooth p-1 hover:bg-[#374248]/40 rounded-full"
          title="Search messages"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
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
  );
}
