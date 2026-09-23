'use client';

import type { Conversation } from '@/types';
import { formatConversationTime, getInitials, truncate } from '@/lib/utils';

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
  index: number;
}

// Avatar color palette — deterministic based on name
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

export function ConversationItem({
  conversation,
  isSelected,
  onClick,
  onDelete,
  index,
}: ConversationItemProps) {
  const initials = getInitials(conversation.patientName);
  const avatarColor = getAvatarColor(conversation.patientName);
  const hasUnread = conversation.unreadCount > 0;
  const timeStr = formatConversationTime(
    conversation.lastMessageTime || conversation.createdAt,
  );

  return (
    <button
      onClick={onClick}
      className={`w-full group relative flex items-center gap-3 px-4 py-3 transition-all duration-150 text-left border-b border-[#222E35]/60
        ${
          isSelected
            ? 'bg-[#2A3942]'
            : 'bg-[#111B21] hover:bg-[#202C33]'
        }`}
    >
      {/* Avatar */}
      <div
        className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center shrink-0`}
      >
        <span className="text-white font-semibold text-sm">{initials}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span
            className={`text-base truncate ${
              hasUnread ? 'text-white font-medium' : 'text-gray-200'
            }`}
          >
            {conversation.patientName}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <span
              className={`text-xs ${
                hasUnread ? 'text-[#00A884] font-medium' : 'text-[#8696A0]'
              }`}
            >
              {timeStr}
            </span>
            {onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(e);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#8696A0] hover:text-[#F15C6D] hover:bg-red-500/10 rounded-full"
                title="Delete chat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
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
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0">
            {/* Show double ticks ONLY if the last message was sent by the agent */}
            {conversation.lastMessageSender === 'agent' && conversation.lastMessage && (
              <span className="text-[#53bdeb] shrink-0">
                <svg viewBox="0 0 16 11" width="16" height="11" fill="currentColor">
                  <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.336-.153.457.457 0 0 0-.336.153.462.462 0 0 0 0 .653l2.357 2.453a.454.454 0 0 0 .336.153.511.511 0 0 0 .381-.178l6.484-8.043a.397.397 0 0 0 0-.655z"/>
                  <path d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.011-1.095-.653.653 1.357 1.453a.454.454 0 0 0 .336.153.511.511 0 0 0 .381-.178l6.484-8.043a.397.397 0 0 0 0-.655z"/>
                </svg>
              </span>
            )}
            <span
              className={`text-[13px] truncate ${
                hasUnread ? 'text-[#E9EDEF]' : 'text-[#8696A0]'
              }`}
            >
              {conversation.lastMessage || 'No messages'}
            </span>
          </div>
          {hasUnread && (
            <span className="ml-2 shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#00A884] text-[#111B21] text-xs font-bold flex items-center justify-center badge-pulse">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
