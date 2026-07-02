'use client';

import type { Message } from '@/types';
import { formatMessageTime } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
  isHighlighted?: boolean;
}

export function MessageBubble({ message, isHighlighted }: MessageBubbleProps) {
  const isAgent = message.senderType === 'agent';
  const time = formatMessageTime(message.createdAt);

  // Status icon for agent messages
  const getStatusIcon = () => {
    switch (message.status) {
      case 'sent':
        return (
          <svg
            viewBox="0 0 16 11"
            width="14"
            height="9"
            className="text-gray-400 ml-1 shrink-0"
          >
            <path
              d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.336-.153.457.457 0 0 0-.336.153.462.462 0 0 0 0 .653l2.357 2.453a.454.454 0 0 0 .336.153.511.511 0 0 0 .381-.178l6.484-8.043a.397.397 0 0 0 0-.655z"
              fill="currentColor"
            />
          </svg>
        );
      case 'delivered':
        return (
          <svg
            viewBox="0 0 16 11"
            width="14"
            height="9"
            className="text-gray-400 ml-1 shrink-0"
          >
            <path
              d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.336-.153.457.457 0 0 0-.336.153.462.462 0 0 0 0 .653l2.357 2.453a.454.454 0 0 0 .336.153.511.511 0 0 0 .381-.178l6.484-8.043a.397.397 0 0 0 0-.655z"
              fill="currentColor"
            />
            <path
              d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.011-1.095-.653.653 1.357 1.453a.454.454 0 0 0 .336.153.511.511 0 0 0 .381-.178l6.484-8.043a.397.397 0 0 0 0-.655z"
              fill="currentColor"
            />
          </svg>
        );
      case 'read':
        return (
          <svg
            viewBox="0 0 16 11"
            width="14"
            height="9"
            className="text-sky-400 ml-1 shrink-0"
          >
            <path
              d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.463.463 0 0 0-.336-.153.457.457 0 0 0-.336.153.462.462 0 0 0 0 .653l2.357 2.453a.454.454 0 0 0 .336.153.511.511 0 0 0 .381-.178l6.484-8.043a.397.397 0 0 0 0-.655z"
              fill="currentColor"
            />
            <path
              d="M15.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.011-1.095-.653.653 1.357 1.453a.454.454 0 0 0 .336.153.511.511 0 0 0 .381-.178l6.484-8.043a.397.397 0 0 0 0-.655z"
              fill="currentColor"
            />
          </svg>
        );
      case 'failed':
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-red-400 ml-1 shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6" />
            <path d="m9 9 6 6" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Helper to parse URLs and render them as clickable anchor links
  const renderMessageContent = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      const isUrl = /^https?:\/\//i.test(part) || /^www\./i.test(part);
      if (isUrl) {
        const href = part.startsWith('http') ? part : `https://${part}`;
        return (
          <a
            key={index}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-sky-400 hover:text-sky-300 break-all cursor-pointer select-text"
          >
            {part}
          </a>
        );
      }
      return <span key={index} className="select-text">{part}</span>;
    });
  };

  return (
    <div
      id={`msg-${message.id}`}
      className={`flex ${isAgent ? 'justify-end' : 'justify-start'} mb-1.5 animate-slide-in-up`}
    >
      <div
        className={`max-w-[75%] md:max-w-[65%] px-3 py-1.5 rounded-lg shadow-sm select-text transition-all duration-500
          ${
            isHighlighted
              ? 'ring-2 ring-[#00A884] bg-[#007F63]/90 shadow-emerald-950/60 shadow-lg scale-[1.02]'
              : isAgent
              ? 'bg-[#005C4B] rounded-tr-none text-white'
              : 'bg-[#202C33] rounded-tl-none text-white'
          }
        `}
      >
        {/* Message text */}
        <p className="text-[14px] text-gray-100 leading-relaxed whitespace-pre-wrap break-words select-text">
          {renderMessageContent(message.message)}
        </p>

        {/* Timestamp + Status */}
        <div className="flex items-center justify-end gap-0.5 mt-1 -mb-0.5 select-none">
          <span className="text-[10px] text-gray-400">{time}</span>
          {isAgent && getStatusIcon()}
        </div>
      </div>
    </div>
  );
}
