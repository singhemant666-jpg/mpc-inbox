'use client';

import { useState, useRef, useEffect } from 'react';
import type { Message } from '@/types';
import { formatMessageTime } from '@/lib/utils';

function VoiceMessagePlayer({ audioUrl }: { audioUrl: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // For local files (/public/uploads/...) use directly.
  // For external URLs (old Gupshup links), try proxy.
  const resolvedUrl = (() => {
    if (typeof window === 'undefined') return audioUrl;
    // Local files served by the backend - use directly
    if (audioUrl.startsWith('/public/') || audioUrl.startsWith('/uploads/')) {
      return audioUrl;
    }
    // External URLs - proxy through backend
    if (audioUrl.startsWith('http') && !audioUrl.includes(window.location.host)) {
      return `/api/media/proxy?url=${encodeURIComponent(audioUrl)}`;
    }
    return audioUrl;
  })();

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => {
        console.error('Audio play failed:', err);
        setError(true);
      });
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // For local files, fetch and trigger download
    fetch(resolvedUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'voice-message.ogg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        window.open(audioUrl, '_blank');
      });
  };

  return (
    <div className="flex items-center gap-3 py-2 px-2.5 bg-[#111B21]/50 rounded-xl border border-[#2A3942]/20 w-[275px] select-none text-left mb-1">
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={resolvedUrl}
        preload="metadata"
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration || 0);
          }
        }}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime || 0);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => {
          setError(true);
          setIsPlaying(false);
        }}
        style={{ display: 'none' }}
      />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={error ? () => window.open(audioUrl, '_blank') : togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-smooth shrink-0 ${
          error ? 'bg-red-500/80 text-white' : 'bg-[#00A884] text-[#111B21]'
        }`}
        title={error ? 'Open in new tab' : isPlaying ? 'Pause' : 'Play'}
      >
        {error ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        ) : isPlaying ? (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <rect x="5" y="4" width="4" height="16" rx="1"/>
            <rect x="15" y="4" width="4" height="16" rx="1"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="ml-0.5">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>

      {/* Progress Bar & Details */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {error ? (
          <span className="text-[10px] text-red-400">Audio expired. Click to open.</span>
        ) : (
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-[#00A884] bg-gray-600 h-1 rounded-lg appearance-none cursor-pointer"
          />
        )}
        
        <div className="flex justify-between items-center text-[9px] text-[#8696A0]">
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
          <button
            type="button"
            onClick={handleDownload}
            className="hover:text-white transition-smooth flex items-center gap-0.5"
            title="Download Audio"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>
        </div>
      </div>

      {/* Mic Icon */}
      <div className="text-[#8696A0] shrink-0 pr-0.5">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
        </svg>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isHighlighted?: boolean;
}

export function MessageBubble({ message, isHighlighted }: MessageBubbleProps) {
  const isAgent = message.senderType === 'agent';
  const time = formatMessageTime(message.createdAt);

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showMenu]);

  const handleDownloadImage = (e: React.MouseEvent, imageUrl: string) => {
    e.preventDefault();
    e.stopPropagation();
    fetch(imageUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = blob.type.split('/')[1]?.split(';')[0] || 'jpg';
        a.download = `whatsapp-image.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      })
      .catch(() => {
        window.open(imageUrl, '_blank');
      });
  };

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
      className={`flex ${isAgent ? 'justify-end' : 'justify-start'} ${
        message.reaction ? 'mb-3.5' : 'mb-1' // Snug, tight spacing by default, clears space only when reacted
      } animate-slide-in-up`}
    >
      <div
        className={`relative max-w-[75%] md:max-w-[65%] rounded-lg shadow-sm select-text transition-all duration-500 group
          ${
            message.messageType === 'image' || message.messageType === 'video' || message.messageType === 'sticker'
              ? message.reaction ? 'p-1 pb-4' : 'p-1'
              : message.reaction
              ? 'px-3 pt-1.5 pb-4' // Extra bottom padding to push text/timestamp away from the reaction pill
              : 'px-3 py-1.5'
          }
          ${
            isHighlighted
              ? 'ring-2 ring-[#00A884] bg-[#007F63]/90 shadow-emerald-950/60 shadow-lg scale-[1.02]'
              : isAgent
              ? 'bg-[#005C4B] rounded-tr-none text-white'
              : 'bg-[#202C33] rounded-tl-none text-white'
          }
        `}
      >
        {/* Dropdown Menu Trigger Arrow */}
        {(message.messageType === 'text' || message.messageType === 'text_edited') && (
          <div className={`absolute top-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 ${
            isAgent ? 'left-1' : 'right-1'
          }`}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="text-gray-400 hover:text-gray-200 transition-smooth p-0.5 rounded"
            >
              <svg viewBox="0 0 19 20" width="12" height="12" className="fill-current">
                <path d="M3.8 6.7l5.7 5.7 5.7-5.7 1.6 1.6-7.3 7.2-7.3-7.2 1.6-1.6z" />
              </svg>
            </button>
          </div>
        )}

        {/* Dropdown Menu Panel */}
        {showMenu && (
          <div
            ref={menuRef}
            className={`absolute top-7 bg-[#233138] border border-[#2F3B43] rounded-lg shadow-xl py-1 z-30 min-w-[110px] overflow-hidden text-left ${
              isAgent ? 'left-1' : 'right-1'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(message.message);
                setShowMenu(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-[#E9EDEF] hover:bg-[#182229] transition-smooth flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
              Copy
            </button>
          </div>
        )}

        {/* Message text / media */}
        {message.messageType === 'image' || message.messageType === 'sticker' ? (
          <div className="relative rounded-md overflow-hidden border border-[#2A3942]/20 max-w-[280px] bg-[#111B21] group">
            <img
              src={message.message}
              alt="Sent image"
              className="w-full h-auto object-cover max-h-[260px] hover:opacity-90 transition-opacity cursor-pointer"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const event = new CustomEvent('open-lightbox', {
                    detail: { url: message.message, type: 'image' },
                  });
                  window.dispatchEvent(event);
                }
              }}
            />
            {/* Hover Download Button */}
            <button
              type="button"
              onClick={(e) => handleDownloadImage(e, message.message)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-[#111B21]/80 hover:bg-[#202C33] text-gray-200 hover:text-white flex items-center justify-center shadow-lg transition-smooth opacity-0 group-hover:opacity-100 z-10"
              title="Download Image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          </div>
        ) : message.messageType === 'video' ? (
          <div className="relative rounded-md overflow-hidden border border-[#2A3942]/20 max-w-[280px] bg-[#111B21]">
            <video
              src={message.message}
              controls
              className="w-full h-auto max-h-[260px] object-cover"
            />
          </div>
        ) : message.messageType === 'document' || message.messageType === 'file' ? (
          <a
            href={message.message}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-2 bg-[#111B21] rounded-lg border border-[#2A3942]/20 hover:bg-[#182229] transition-smooth max-w-[280px] text-left cursor-pointer mb-1"
          >
            <div className="w-10 h-10 rounded-lg bg-[#7f66ff]/15 flex items-center justify-center text-[#7f66ff] shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6z"/>
                <path d="M14 2v6h6"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-[#E9EDEF] block truncate leading-tight">
                {decodeURIComponent(message.message.substring(message.message.lastIndexOf('/') + 1)) || 'Document'}
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">Click to view file</span>
            </div>
            <div className="text-gray-400 p-1 hover:text-white shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
          </a>
        ) : message.messageType === 'audio' ? (
          <VoiceMessagePlayer audioUrl={message.message} />
        ) : message.messageType === 'reaction' ? (
          <div className="flex items-center gap-2 py-0.5 select-none">
            <span className="text-2xl leading-none animate-scale-up">{message.message}</span>
            <span className="text-[11px] text-gray-400 font-medium">
              {message.message === 'Reaction removed' ? 'reaction removed' : 'reacted'}
            </span>
          </div>
        ) : (
          <p className="text-[14px] text-gray-100 leading-relaxed whitespace-pre-wrap break-words select-text">
            {renderMessageContent(message.message)}
          </p>
        )}

        {/* Timestamp + Status */}
        <div className={`flex items-center justify-end gap-0.5 mt-1 -mb-0.5 select-none ${
          message.messageType === 'image' || message.messageType === 'video' ? 'px-2 pb-1.5' : ''
        }`}>
          {message.messageType === 'text_edited' && (
            <span className="text-[9px] text-[#8696A0] mr-1 italic select-none">edited</span>
          )}
          <span className="text-[10px] text-gray-400">{time}</span>
          {isAgent && getStatusIcon()}
        </div>

        {/* Floating Reaction Pill (WhatsApp Style) */}
        {message.reaction && (
          <div 
            className={`absolute -bottom-2.5 flex items-center justify-center bg-[#202C33] border border-[#2A3942] rounded-full px-1.5 py-0.5 shadow-md select-none animate-scale-up z-10
              ${isAgent ? 'left-2.5' : 'right-2.5'}
            `}
            title={`Reacted ${message.reaction}`}
          >
            <span className="text-[13px] leading-none">{message.reaction}</span>
          </div>
        )}
      </div>
    </div>
  );
}
