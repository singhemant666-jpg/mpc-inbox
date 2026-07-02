'use client';

import { useState, useRef, useEffect } from 'react';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '@/lib/api';
import type { Template } from '@/types';

interface MessageInputProps {
  onSend: (text: string) => void;
  sending: boolean;
}

export function MessageInput({ onSend, sending }: MessageInputProps) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateText, setNewTemplateText] = useState('');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const templatesRef = useRef<HTMLDivElement>(null);

  // Common emojis for quick access
  const quickEmojis = [
    '😊', '👍', '🙏', '❤️', '👋', '✅', '🎉', '💊',
    '🏥', '📞', '📅', '⏰', '🩺', '💪', '🤝', '😷',
    '🌡️', '💉', '🩹', '🧑‍⚕️', '😀', '🙂', '👌', '🔔',
  ];

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Close popups on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
      if (templatesRef.current && !templatesRef.current.contains(e.target as Node)) {
        setShowTemplates(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSend = () => {
    if (!text.trim() || sending) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    textareaRef.current?.focus();
  };

  useEffect(() => {
    if (showTemplates) {
      loadCustomTemplates();
    }
  }, [showTemplates]);

  const loadCustomTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const data = await getTemplates();
      setCustomTemplates(data);
    } catch (error) {
      console.error('Failed to load custom templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateTitle.trim() || !newTemplateText.trim()) return;
    try {
      if (editingTemplateId) {
        // Update existing template
        const updatedTemp = await updateTemplate(
          editingTemplateId,
          newTemplateTitle.trim(),
          newTemplateText.trim(),
        );
        setCustomTemplates((prev) =>
          prev.map((t) => (t.id === editingTemplateId ? updatedTemp : t)),
        );
        setEditingTemplateId(null);
      } else {
        // Create new template
        const newTemp = await createTemplate(newTemplateTitle.trim(), newTemplateText.trim());
        setCustomTemplates((prev) => [newTemp, ...prev]);
      }
      setNewTemplateTitle('');
      setNewTemplateText('');
      setIsCreatingTemplate(false);
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template. Please try again.');
    }
  };

  const handleStartEditTemplate = (template: Template, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTemplateId(template.id);
    setNewTemplateTitle(template.title);
    setNewTemplateText(template.text);
    setIsCreatingTemplate(true);
  };

  const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await deleteTemplate(id);
      setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template. Please try again.');
    }
  };

  const insertTemplate = (templateText: string) => {
    setText(templateText);
    setShowTemplates(false);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Set cursor to select first placeholder if present
        const placeholderIndex = templateText.indexOf('[Patient Name]');
        if (placeholderIndex !== -1) {
          textareaRef.current.setSelectionRange(placeholderIndex, placeholderIndex + 14);
        }
      }
    }, 50);
  };

  return (
    <div className="bg-[#202C33] border-t border-[#2A3942]/10 px-4 py-2.5 shrink-0 relative">
      {/* Emoji Picker */}
      {showEmoji && (
        <div
          ref={emojiRef}
          className="absolute bottom-full left-4 mb-2 p-3 rounded-xl glass bg-[#111B21] border border-[#2A3942] shadow-2xl animate-slide-in-up z-50"
        >
          <div className="grid grid-cols-8 gap-1">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => insertEmoji(emoji)}
                className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-wa-dark-hover transition-smooth text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Template Picker */}
      {showTemplates && (
        <div
          ref={templatesRef}
          className="absolute bottom-full left-4 mb-2 w-80 p-2 rounded-xl bg-[#111B21] border border-[#2A3942] shadow-2xl animate-slide-in-up z-50 max-h-[350px] overflow-y-auto flex flex-col"
        >
          {isCreatingTemplate ? (
            // Create/Edit Template Form
            <form onSubmit={handleSaveTemplate} className="p-3 flex flex-col gap-2.5">
              <div className="text-xs font-semibold text-[#00A884]">
                {editingTemplateId ? '✏️ Edit Custom Template' : 'Create Custom Template'}
              </div>
              <input
                type="text"
                required
                placeholder="Template Title (e.g. Booking Confirm)"
                value={newTemplateTitle}
                onChange={(e) => setNewTemplateTitle(e.target.value)}
                className="w-full bg-[#202C33] text-[#E9EDEF] border border-[#2A3942] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#00A884] placeholder-gray-500"
              />
              <textarea
                required
                placeholder="Template Text... Use [Patient Name] as a placeholder if needed."
                value={newTemplateText}
                onChange={(e) => setNewTemplateText(e.target.value)}
                className="w-full bg-[#202C33] text-[#E9EDEF] border border-[#2A3942] rounded-lg px-2.5 py-1.5 text-xs h-24 focus:outline-none focus:border-[#00A884] placeholder-gray-500 resize-none font-sans"
              />
              <div className="flex gap-2 justify-end text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingTemplate(false);
                    setEditingTemplateId(null);
                    setNewTemplateTitle('');
                    setNewTemplateText('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#202C33] text-gray-300 hover:bg-[#374248] transition-smooth"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-[#00A884] text-white hover:bg-[#009675] font-semibold transition-smooth"
                >
                  {editingTemplateId ? 'Update Template' : 'Save Template'}
                </button>
              </div>
            </form>
          ) : (
            // Unified Template List
            <>
              <div className="text-xs font-semibold text-[#8696A0] px-3 py-2 border-b border-[#2A3942]/50 mb-1">
                Saved Templates
              </div>
              <div className="flex flex-col flex-1 overflow-y-auto max-h-[250px] min-h-[60px] bg-[#111B21] no-scrollbar">
                {loadingTemplates ? (
                  <div className="text-center py-6 text-xs text-gray-500">Loading templates...</div>
                ) : customTemplates.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-500 italic">
                    No templates found.<br />Click below to create one.
                  </div>
                ) : (
                  customTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="group flex items-center justify-between hover:bg-[#202C33] rounded-lg transition-smooth border-b border-[#2A3942]/10 last:border-0"
                    >
                      <button
                        onClick={() => insertTemplate(template.text)}
                        className="flex-1 text-left px-3 py-2 text-sm text-[#E9EDEF] min-w-0"
                      >
                        <div className="font-medium text-xs text-[#00A884] mb-0.5 truncate">{template.title}</div>
                        <div className="text-xs text-[#8696A0] truncate">{template.text.replace(/\n/g, ' ')}</div>
                      </button>
                      <div className="flex items-center gap-0.5 shrink-0 mr-1 select-none">
                        {/* Edit Button */}
                        <button
                          onClick={(e) => handleStartEditTemplate(template, e)}
                          className="p-1.5 text-gray-400 hover:text-[#00A884] transition-smooth"
                          title="Edit Template"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                          </svg>
                        </button>
                        {/* Delete Button */}
                        <button
                          onClick={(e) => handleDeleteTemplate(template.id, e)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-smooth"
                          title="Delete Template"
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Bottom Add Button */}
              <button
                onClick={() => setIsCreatingTemplate(true)}
                className="mt-2 w-full py-2 bg-[#202C33] hover:bg-[#374248] text-[#00A884] rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-smooth border border-[#2A3942]/30"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Create Custom Template
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 w-full">
        {/* Left Actions: Plus Attachment, Emoji Button, Templates Button */}
        <div className="flex items-center gap-1.5 text-[#AEBAC1] shrink-0">
          {/* Plus / Attach Button */}
          <button className="p-2 hover:bg-[#374248]/50 rounded-full transition-smooth" title="Attach file">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </button>

          {/* Emoji button */}
          <button
            onClick={() => {
              setShowEmoji(!showEmoji);
              setShowTemplates(false);
            }}
            className={`p-2 rounded-full transition-smooth ${
              showEmoji
                ? 'bg-[#374248] text-wa-accent'
                : 'hover:bg-[#374248]/50 hover:text-white'
            }`}
            title="Emojis"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-5-8c.78 0 1.5.67 1.5 1.5S7.78 15 7 15s-1.5-.67-1.5-1.5S6.22 12 7 12zm10 0c.78 0 1.5.67 1.5 1.5S17.78 15 17 15s-1.5-.67-1.5-1.5s.72-1.5 1.5-1.5zm-5 4c2.03 0 3.8-1.11 4.74-2.78l1.3 1.3C16.59 16.91 14.43 18 12 18s-4.59-1.09-6.04-3.48l1.3-1.3C8.2 14.89 9.97 16 12 16z"/>
            </svg>
          </button>

          {/* Canned Templates Button */}
          <button
            onClick={() => {
              setShowTemplates(!showTemplates);
              setShowEmoji(false);
            }}
            className={`p-2 rounded-full transition-smooth ${
              showTemplates
                ? 'bg-[#374248] text-[#00A884]'
                : 'hover:bg-[#374248]/50 hover:text-white'
            }`}
            title="Pre-defined Templates"
          >
            {/* Stamp/List icon */}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
          </button>
        </div>

        {/* Text Area Input */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            rows={1}
            className="w-full px-4 py-2.5 rounded-lg bg-[#2A3942] border border-transparent text-sm text-[#E9EDEF] placeholder-[#8696A0] focus:outline-none transition-smooth resize-none leading-5 max-h-[120px] overflow-y-auto"
          />
        </div>

        {/* Right Action: Send Button or Voice Mic Icon */}
        <div className="shrink-0 text-[#AEBAC1]">
          {text.trim() ? (
            <button
              onClick={handleSend}
              disabled={sending}
              className="p-2 hover:bg-[#374248]/50 rounded-full text-[#00A884] active:scale-95 transition-smooth"
              title="Send message"
            >
              {sending ? (
                <span className="w-5 h-5 border-2 border-[#00A884]/30 border-t-[#00A884] rounded-full animate-spin block" />
              ) : (
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              )}
            </button>
          ) : (
            <button
              className="p-2 hover:bg-[#374248]/50 rounded-full transition-smooth"
              title="Voice message"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
