'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  Eye,
  AlertTriangle,
  Download,
  Users,
  Smartphone,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Database,
  ImageIcon,
  AlertCircle,
  PhoneCall,
  ExternalLink,
  Link2,
  X,
} from 'lucide-react';

interface Contact {
  id: number;
  name: string;
  phone: string;
  isValid: boolean;
  status?: 'pending' | 'sending' | 'success' | 'failed';
  messageId?: string;
  error?: string;
  timestamp?: string;
}

const DEFAULT_TEMPLATE_ID = '24fe8d13-f39b-4bee-8599-850e0bea5bc9';
const DEFAULT_SOURCE_NUMBER = '917304226441';
const DEFAULT_APP_NAME = 'mpcUAT';
const DEFAULT_IMAGE_URL =
  'https://fss.gupshup.io/0/public/0/0/gupshup/917304226441/703b8507-c136-4dab-987f-5c3246bd16a7/1789813340846_WhatsApp%20Image%202026-09-19%20at%203.46.32%20PM.jpeg';

export default function BroadcastPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [templateId, setTemplateId] = useState<string>(DEFAULT_TEMPLATE_ID);
  const [sourceNumber, setSourceNumber] = useState<string>(DEFAULT_SOURCE_NUMBER);
  const [appName, setAppName] = useState<string>(DEFAULT_APP_NAME);
  const [imageUrl, setImageUrl] = useState<string>(DEFAULT_IMAGE_URL);

  // Sending state
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [broadcastProgress, setBroadcastProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Single test send state
  const [testPhone, setTestPhone] = useState<string>('9967904923');
  const [testName, setTestName] = useState<string>('Sahil Singh');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; messageId?: string } | null>(null);

  // Selected contact for live preview
  const [previewContactIndex, setPreviewContactIndex] = useState<number>(0);
  const [previewTime, setPreviewTime] = useState<string>('12:00 PM');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab & SQLite History State
  const [activeTab, setActiveTab] = useState<'audience' | 'history'>('audience');
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Available templates from Gupshup API
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([]);

  // Dynamic template preview from Gupshup
  const [templatePreview, setTemplatePreview] = useState<{
    body: string;
    name: string;
    category: string;
    status: string;
    templateType: string;
    mediaUrl?: string | null;
    buttons: any[];
    paramCount: number;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState<boolean>(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // Handle local image file upload to server
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/broadcast/upload-image', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setImageUrl(data.url);
      } else {
        alert(data.error || 'Failed to upload image file');
      }
    } catch (err: any) {
      alert('Error uploading image: ' + err.message);
    } finally {
      setIsUploadingImage(false);
      if (imageFileInputRef.current) imageFileInputRef.current.value = '';
    }
  };

  // Fetch all approved templates for dropdown
  const fetchTemplatesList = async () => {
    try {
      const res = await fetch('/api/broadcast/templates', {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.templates)) {
          setAvailableTemplates(data.templates);
        }
      }
    } catch (e) {
      console.error('Failed to load templates list', e);
    }
  };

  // Fetch template preview from Gupshup API
  const fetchTemplatePreview = async (tid: string) => {
    if (!tid || tid.trim().length < 8) {
      setTemplatePreview(null);
      return;
    }
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/broadcast/template-preview?templateId=${encodeURIComponent(tid.trim())}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && data.template) {
        setTemplatePreview(data.template);
        // If template has a sample mediaUrl and no image is currently entered, auto-fill it
        if (data.template.mediaUrl && !imageUrl) {
          setImageUrl(data.template.mediaUrl);
        }
      } else {
        setTemplatePreview(null);
      }
    } catch (e) {
      console.error('Error fetching template preview:', e);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Build params dynamically based on template paramCount
  const buildTemplateParams = (contactName: string) => {
    const count = templatePreview?.paramCount || 1;
    if (count === 0) return [];
    if (count === 1) return [contactName];
    const today = new Date().toLocaleDateString('en-GB');
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const defaults = [contactName, today, time, 'Confirmed / Active', 'Dr. MPC', 'MPC Global'];
    return defaults.slice(0, count);
  };

  // Fetch preview when templateId changes (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchTemplatePreview(templateId);
    }, 400);
    return () => clearTimeout(timeout);
  }, [templateId]);

  const fetchHistory = async (silent = false) => {
    if (!silent) setLoadingHistory(true);
    try {
      const res = await fetch('/api/broadcast/history?limit=100', {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        const sorted = [...data.logs].sort((a: any, b: any) => {
          const tA = new Date(a.createdAt).getTime() || 0;
          const tB = new Date(b.createdAt).getTime() || 0;
          return tB - tA;
        });
        setHistoryLogs(sorted);
      }
    } catch (e) {
      // Only log errors on explicit (non-silent) fetches to avoid console spam
      if (!silent) console.error('Error fetching SQLite history:', e);
    } finally {
      if (!silent) setLoadingHistory(false);
    }
  };

  useEffect(() => {
    setPreviewTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    fetchHistory();
    fetchTemplatesList();
  }, []);

  // Real-time polling for webhook status updates (delivered, read, failed)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchHistory(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Helper to validate and clean phone numbers
  const formatPhone = (raw: string): { formatted: string; isValid: boolean } => {
    let clean = String(raw).replace(/\D/g, '');
    if (clean.length === 10) {
      clean = '91' + clean;
    }
    const isValid = clean.length >= 10 && clean.length <= 14;
    return { formatted: clean, isValid };
  };

  // Process Excel File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        const parsedContacts: Contact[] = data.map((row, idx) => {
          const nameKey = Object.keys(row).find((k) => /name/i.test(k)) || Object.keys(row)[0];
          const phoneKey = Object.keys(row).find((k) => /num|phone|mobile|contact/i.test(k)) || Object.keys(row)[1];

          const name = String(row[nameKey] || '').trim() || `Customer ${idx + 1}`;
          const rawPhone = String(row[phoneKey] || '').replace(/\.0$/, '').trim();
          const { formatted, isValid } = formatPhone(rawPhone);

          return {
            id: idx + 1,
            name,
            phone: formatted,
            isValid,
            status: 'pending',
          };
        });

        setContacts(parsedContacts);
        setPreviewContactIndex(0);
      } catch (err) {
        alert('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Load default sahil number test.xlsx
  const handleLoadDefaultSheet = async () => {
    try {
      const res = await fetch('/api/broadcast/load-default-sheet', {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      const data = await res.json();

      if (data.success && data.rows) {
        setFileName(data.filename);
        const parsedContacts: Contact[] = data.rows.map((row: any, idx: number) => {
          const { formatted, isValid } = formatPhone(row.rawPhone);
          return {
            id: idx + 1,
            name: row.name,
            phone: formatted,
            isValid,
            status: 'pending',
          };
        });
        setContacts(parsedContacts);
        setPreviewContactIndex(0);
      } else {
        alert(data.error || 'Could not load default sheet');
      }
    } catch (err: any) {
      alert('Error loading default sheet: ' + err.message);
    }
  };

  // Send single test message
  const handleSendTest = async () => {
    if (!testPhone) {
      alert('Please enter a test phone number');
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    const { formatted } = formatPhone(testPhone);

    try {
      const res = await fetch('/api/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({
          destination: formatted,
          name: testName,
          templateId,
          sourceNumber,
          appName,
          params: buildTemplateParams(testName),
          imageUrl: imageUrl || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: `Submitted! Status: ${data.status}`,
          messageId: data.messageId,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Failed to send message',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error occurred',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Run Bulk Broadcast
  const handleStartBroadcast = async () => {
    const validContacts = contacts.filter((c) => c.isValid);
    if (validContacts.length === 0) {
      alert('No valid contacts found to broadcast.');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to broadcast this WhatsApp Marketing Template to ${validContacts.length} contacts?`
      )
    ) {
      return;
    }

    setIsBroadcasting(true);
    setBroadcastProgress({ current: 0, total: validContacts.length });

    // Copy contacts
    const updatedContacts = [...contacts];

    for (let i = 0; i < updatedContacts.length; i++) {
      const contact = updatedContacts[i];
      if (!contact.isValid) continue;

      // Update state to sending
      contact.status = 'sending';
      setContacts([...updatedContacts]);

      try {
        const res = await fetch('/api/broadcast/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify({
            destination: contact.phone,
            name: contact.name,
            templateId,
            sourceNumber,
            appName,
            params: buildTemplateParams(contact.name),
            imageUrl: imageUrl || undefined,
          }),
        });

        const data = await res.json();
        const now = new Date().toLocaleTimeString();

        if (data.success) {
          contact.status = 'success';
          contact.messageId = data.messageId;
          contact.timestamp = now;
        } else {
          contact.status = 'failed';
          contact.error = data.error || 'Failed to submit';
          contact.timestamp = now;
        }
      } catch (err: any) {
        contact.status = 'failed';
        contact.error = err.message || 'Network error';
        contact.timestamp = new Date().toLocaleTimeString();
      }

      setContacts([...updatedContacts]);
      setBroadcastProgress((prev) => ({ ...prev, current: prev.current + 1 }));

      // Small delay between requests to be polite with rate limits
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setIsBroadcasting(false);
    fetchHistory();
  };

  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export Results
  const handleExportResults = () => {
    if (contacts.length === 0) return;

    const exportData = contacts.map((c) => ({
      Name: c.name,
      Phone: c.phone,
      Valid: c.isValid ? 'Yes' : 'No',
      Status: c.status || 'Pending',
      MessageID: c.messageId || '',
      Error: c.error || '',
      Time: c.timestamp || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Broadcast Results');
    XLSX.writeFile(wb, `broadcast_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Current contact for preview
  const currentPreviewContact =
    contacts.length > 0 ? contacts[previewContactIndex] || contacts[0] : { name: 'Sahil Singh', phone: '919967904923' };

  const validCount = contacts.filter((c) => c.isValid).length;
  const successCount = contacts.filter((c) => c.status === 'success').length;
  const failedCount = contacts.filter((c) => c.status === 'failed').length;

  return (
    <div className="min-h-screen bg-[#0B141A] text-gray-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-[#202C33] border-b border-[#2A3942] px-6 py-3.5 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-4">
          <Link
            href="/inbox"
            className="flex items-center gap-2 text-xs font-medium text-gray-300 hover:text-white bg-[#111B21] px-3 py-1.5 rounded-lg border border-[#2A3942] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#00A884]" />
            Back to Inbox
          </Link>

          <div className="h-5 w-px bg-[#2A3942]" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00A884]/20 border border-[#00A884]/40 flex items-center justify-center text-[#00A884]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white flex items-center gap-2">
                WhatsApp Marketing Broadcast
                <span className="text-[10px] uppercase tracking-wider bg-[#00A884]/20 text-[#00A884] font-semibold px-2 py-0.5 rounded-full border border-[#00A884]/30">
                  Gupshup Live
                </span>
              </h1>
              <p className="text-xs text-gray-400">My Pain Clinic Global • Bulk Template Messenger</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 text-xs text-gray-300 bg-[#111B21] px-3 py-1.5 rounded-lg border border-[#2A3942]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-gray-400">Webhook:</span>
            <span className="text-white font-mono text-[11px] truncate max-w-[220px]">
              https://recast-glass-sixteen.ngrok-free.dev/api/webhook/gupshup
            </span>
            <button
              type="button"
              onClick={() => handleCopy('https://recast-glass-sixteen.ngrok-free.dev/api/webhook/gupshup')}
              className="p-1 hover:text-white rounded bg-[#202C33]"
              title="Copy Webhook URL"
            >
              {copiedId === 'https://recast-glass-sixteen.ngrok-free.dev/api/webhook/gupshup' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-gray-400" />
              )}
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400 bg-[#111B21] px-3 py-1.5 rounded-lg border border-[#2A3942]">
            <Smartphone className="w-3.5 h-3.5 text-[#00A884]" />
            Source: <span className="text-white font-mono">{sourceNumber}</span>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 pb-28">
        {/* Left Column: Upload & Audience Management (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Step 1: Upload Card */}
          <div className="bg-[#111B21] border border-[#2A3942] rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#00A884] text-black font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <h2 className="text-sm font-semibold text-white">Import Audience (Excel Sheet)</h2>
              </div>

              <button
                onClick={handleLoadDefaultSheet}
                className="text-xs font-medium text-[#00A884] hover:text-[#00C298] bg-[#00A884]/10 hover:bg-[#00A884]/20 px-3 py-1.5 rounded-lg border border-[#00A884]/30 flex items-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Load `sahil number test.xlsx`
              </button>
            </div>

            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#2A3942] hover:border-[#00A884] rounded-xl p-6 text-center cursor-pointer transition-colors bg-[#202C33]/40 hover:bg-[#202C33]/70 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Upload className="w-8 h-8 mx-auto text-gray-400 group-hover:text-[#00A884] transition-colors mb-2" />
              <p className="text-xs font-semibold text-white">
                {fileName ? fileName : 'Click to upload Excel sheet (.xlsx, .xls, .csv)'}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Must contain <code className="text-[#00A884]">Name</code> and <code className="text-[#00A884]">number</code> columns
              </p>
            </div>

            {/* Stats bar if contacts loaded */}
            {contacts.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#2A3942] flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-gray-300">
                    Total: <strong className="text-white">{contacts.length}</strong>
                  </span>
                  <span className="text-emerald-400">
                    Valid: <strong>{validCount}</strong>
                  </span>
                  {contacts.length - validCount > 0 && (
                    <span className="text-rose-400">
                      Invalid: <strong>{contacts.length - validCount}</strong>
                    </span>
                  )}
                </div>

                {contacts.some((c) => c.status !== 'pending') && (
                  <button
                    onClick={handleExportResults}
                    className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-[#202C33] px-2.5 py-1 rounded border border-[#2A3942]"
                  >
                    <Download className="w-3.5 h-3.5 text-[#00A884]" />
                    Export Report
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Contacts Table / SQLite History Card */}
          <div className="bg-[#111B21] border border-[#2A3942] rounded-xl p-5 shadow-lg flex-1 flex flex-col min-h-[350px]">
            {/* Tab Navigation */}
            <div className="flex items-center justify-between mb-4 border-b border-[#2A3942] pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('audience')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                    activeTab === 'audience'
                      ? 'bg-[#00A884] text-black'
                      : 'bg-[#202C33] text-gray-300 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Audience List ({contacts.length})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('history');
                    fetchHistory();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                    activeTab === 'history'
                      ? 'bg-[#00A884] text-black'
                      : 'bg-[#202C33] text-gray-300 hover:text-white'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  SQLite History ({historyLogs.length})
                </button>
              </div>

              {activeTab === 'history' ? (
                <button
                  type="button"
                  onClick={fetchHistory}
                  disabled={loadingHistory}
                  className="text-xs text-gray-300 hover:text-white flex items-center gap-1.5 bg-[#202C33] px-2.5 py-1 rounded border border-[#2A3942]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-[#00A884] ${loadingHistory ? 'animate-spin' : ''}`} />
                  Refresh SQLite
                </button>
              ) : (
                contacts.length > 0 && (
                  <span className="text-[11px] text-gray-400">
                    Click contact to preview live message
                  </span>
                )
              )}
            </div>

            {activeTab === 'history' ? (
              /* SQLite History Table */
              historyLogs.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500">
                  <Database className="w-12 h-12 text-[#2A3942] mb-3" />
                  <p className="text-sm font-medium text-gray-400">No SQLite history records yet</p>
                  <p className="text-xs text-gray-500 mt-1">
                    When you send template broadcasts, every result is stored permanently in SQLite.
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-x-auto border border-[#2A3942] rounded-lg max-h-[420px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#202C33] text-gray-300 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-[#2A3942]">
                      <tr>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3 min-w-[220px]">Status & Reason</th>
                        <th className="p-3">Message ID</th>
                        <th className="p-3 text-right">Date / Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A3942]/60">
                      {historyLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-[#202C33]/60 transition-colors">
                          <td className="p-3 font-semibold text-white">{log.name}</td>
                          <td className="p-3 font-mono text-gray-300">{log.phone}</td>
                          <td className="p-3">
                            {log.status === 'delivered' && (
                              <span className="text-[10px] bg-emerald-950/70 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/60 flex items-center gap-1 w-fit font-semibold">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Delivered
                              </span>
                            )}
                            {log.status === 'read' && (
                              <span className="text-[10px] bg-blue-950/70 text-blue-300 px-2 py-0.5 rounded border border-blue-700/60 flex items-center gap-1 w-fit font-semibold">
                                <CheckCircle2 className="w-3 h-3 text-blue-400" />
                                Read
                              </span>
                            )}
                            {log.status === 'sent' && (
                              <span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700 flex items-center gap-1 w-fit">
                                <Check className="w-3 h-3" />
                                Sent
                              </span>
                            )}
                            {log.status === 'submitted' && (
                              <span className="text-[10px] bg-emerald-950/50 text-emerald-400 px-2 py-0.5 rounded border border-emerald-700/40 flex items-center gap-1 w-fit font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                Submitted 202
                              </span>
                            )}
                            {log.status === 'failed' && (
                              <div className="flex flex-col gap-1 py-0.5 max-w-[320px]">
                                <span className="text-[10px] bg-rose-950/70 text-rose-400 px-2 py-0.5 rounded border border-rose-700/50 flex items-center gap-1 w-fit font-medium">
                                  <XCircle className="w-3 h-3 shrink-0" />
                                  Failed
                                </span>
                                {log.error && (
                                  <div className="text-[11px] text-rose-300 leading-snug bg-rose-950/40 border border-rose-800/50 rounded p-1.5 break-words font-sans">
                                    {log.error.replace(/^null,\s*/, '')}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-gray-400">
                            {log.messageId ? (
                              <div className="flex items-center gap-1.5">
                                <span className="truncate max-w-[120px]" title={log.messageId}>
                                  {log.messageId.slice(0, 8)}...
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(log.messageId)}
                                  className="p-1 hover:text-white rounded bg-[#202C33] border border-[#2A3942]"
                                  title="Copy Message ID"
                                >
                                  {copiedId === log.messageId ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-gray-400" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right text-[11px] text-gray-400">
                            {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : contacts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500">
                <FileSpreadsheet className="w-12 h-12 text-[#2A3942] mb-3" />
                <p className="text-sm font-medium text-gray-400">No contacts loaded yet</p>
                <p className="text-xs text-gray-500 mt-1">
                  Upload an Excel file or click "Load sahil number test.xlsx" above to get started
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto border border-[#2A3942] rounded-lg max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#202C33] text-gray-300 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-[#2A3942]">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Customer Name</th>
                      <th className="p-3">Phone (Destination)</th>
                      <th className="p-3 min-w-[220px]">Status & Reason</th>
                      <th className="p-3 text-right">Message ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A3942]/60">
                    {contacts.map((contact, idx) => {
                      const isSelected = previewContactIndex === idx;
                      return (
                        <tr
                          key={contact.id}
                          onClick={() => setPreviewContactIndex(idx)}
                          className={`hover:bg-[#202C33]/60 cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#00A884]/10 border-l-2 border-[#00A884]' : ''
                          }`}
                        >
                          <td className="p-3 text-gray-400 font-mono text-[11px]">{contact.id}</td>
                          <td className="p-3 font-semibold text-white">{contact.name}</td>
                          <td className="p-3 font-mono text-gray-300">
                            {contact.phone}
                            {!contact.isValid && (
                              <span className="ml-2 text-[10px] text-rose-400 font-sans">
                                (Invalid)
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {contact.status === 'pending' && (
                              <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700">
                                Pending
                              </span>
                            )}
                            {contact.status === 'sending' && (
                              <span className="text-[10px] bg-amber-950/60 text-amber-300 px-2 py-0.5 rounded border border-amber-800/40 flex items-center gap-1 w-fit animate-pulse">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Sending...
                              </span>
                            )}
                            {contact.status === 'success' && (
                              <span className="text-[10px] bg-emerald-950/70 text-emerald-400 px-2 py-0.5 rounded border border-emerald-700/50 flex items-center gap-1 w-fit font-medium">
                                <CheckCircle2 className="w-3 h-3" />
                                Submitted 202
                              </span>
                            )}
                            {contact.status === 'failed' && (
                              <div className="flex flex-col gap-1 py-0.5 max-w-[320px]">
                                <span className="text-[10px] bg-rose-950/70 text-rose-400 px-2 py-0.5 rounded border border-rose-700/50 flex items-center gap-1 w-fit font-medium">
                                  <XCircle className="w-3 h-3 shrink-0" />
                                  Failed
                                </span>
                                {contact.error && (
                                  <div className="text-[11px] text-rose-300 leading-snug bg-rose-950/40 border border-rose-800/50 rounded p-1.5 break-words font-sans">
                                    {contact.error.replace(/^null,\s*/, '')}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-[11px] text-gray-400">
                            {contact.messageId ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="truncate max-w-[120px]" title={contact.messageId}>
                                  {contact.messageId.slice(0, 8)}...
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy(contact.messageId!);
                                  }}
                                  className="p-1 hover:text-white rounded bg-[#202C33] border border-[#2A3942]"
                                  title="Copy Message ID"
                                >
                                  {copiedId === contact.messageId ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-gray-400" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Template Preview, Single Test & Launch Broadcast (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Step 2: Template Card */}
          <div className="bg-[#111B21] border border-[#2A3942] rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-full bg-[#00A884] text-black font-bold text-xs flex items-center justify-center">
                2
              </div>
              <h2 className="text-sm font-semibold text-white">Approved Marketing Template</h2>
            </div>

            {/* Template Meta Form */}
            <div className="space-y-3 mb-4 text-xs">
              {/* Template Selector Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] text-gray-400 font-medium">
                    Choose Template:
                  </label>
                  {availableTemplates.length > 0 && (
                    <span className="text-[10px] text-emerald-400 font-medium">
                      {availableTemplates.length} Approved Templates
                    </span>
                  )}
                </div>
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full bg-[#202C33] border border-[#2A3942] rounded-lg px-3 py-1.5 text-gray-200 text-xs focus:outline-none focus:border-[#00A884]"
                >
                  {availableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                  {!availableTemplates.some((t) => t.id === templateId) && (
                    <option value={templateId}>Custom: {templateId}</option>
                  )}
                </select>
              </div>

              {/* Manual Template ID */}
              <div>
                <label className="text-[11px] text-gray-400 font-medium block mb-1">
                  Template ID (UUID):
                </label>
                <input
                  type="text"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value.trim())}
                  placeholder="Paste Gupshup Template UUID"
                  className="w-full bg-[#202C33] border border-[#2A3942] rounded-lg px-3 py-1.5 text-gray-200 font-mono text-xs focus:outline-none focus:border-[#00A884]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-400 font-medium block mb-1">
                    App Name:
                  </label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="w-full bg-[#202C33] border border-[#2A3942] rounded-lg px-3 py-1.5 text-gray-200 font-mono text-xs focus:outline-none focus:border-[#00A884]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 font-medium block mb-1">
                    Sender Phone:
                  </label>
                  <input
                    type="text"
                    value={sourceNumber}
                    onChange={(e) => setSourceNumber(e.target.value)}
                    className="w-full bg-[#202C33] border border-[#2A3942] rounded-lg px-3 py-1.5 text-gray-200 font-mono text-xs focus:outline-none focus:border-[#00A884]"
                  />
                </div>
              </div>
            </div>

            {/* Image Header Section */}
            <div className="mt-4 pt-4 border-t border-[#2A3942]">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] text-gray-300 font-medium flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#00A884]" />
                  Header Media / Image
                  {templatePreview?.templateType === 'IMAGE' && (
                    <span className="bg-emerald-950/60 text-emerald-400 border border-emerald-700/50 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase">
                      Image Template
                    </span>
                  )}
                </label>

                {/* Upload from Computer & Actions */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="file"
                    ref={imageFileInputRef}
                    onChange={handleImageFileUpload}
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => imageFileInputRef.current?.click()}
                    disabled={isUploadingImage}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#202C33] hover:bg-[#2A3942] border border-[#2A3942] text-xs text-[#00A884] font-medium transition-colors"
                  >
                    {isUploadingImage ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-[#00A884]" />
                    ) : (
                      <Upload className="w-3 h-3 text-[#00A884]" />
                    )}
                    Upload Image
                  </button>

                  {/* Button to restore default sample image from Gupshup if available */}
                  {templatePreview?.mediaUrl && imageUrl !== templatePreview.mediaUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl(templatePreview.mediaUrl!)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-[#111B21] hover:bg-[#202C33] border border-[#2A3942] text-[10px] text-purple-300 transition-colors"
                      title="Use the sample image uploaded during template creation"
                    >
                      <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                      Use Gupshup Image
                    </button>
                  )}

                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-gray-400 hover:text-rose-400 p-1 rounded hover:bg-[#202C33]"
                      title="Clear image"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* URL Input */}
              <div className="relative">
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Upload an image from computer or paste public image URL (https://...)"
                  className="w-full bg-[#202C33] border border-[#2A3942] rounded-lg pl-8 pr-3 py-1.5 text-gray-200 font-mono text-xs focus:outline-none focus:border-[#00A884] placeholder:text-gray-600"
                />
                <Link2 className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>

              {templatePreview?.templateType === 'IMAGE' && !imageUrl && (
                <div className="mt-2 text-[10px] text-emerald-400/90 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>This template supports an image header. Click &ldquo;Upload Image&rdquo; or click &ldquo;Use Gupshup Image&rdquo;.</span>
                </div>
              )}

              {imageUrl && templatePreview?.templateType === 'TEXT' && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <strong>Note on Image Header:</strong> This template (<span className="font-mono">{templatePreview.name}</span>) is registered in Gupshup as a <em>TEXT</em> template. To send image headers on WhatsApp, select an image template (like <strong className="text-white">ganpati_marketing</strong>) or create one with <strong>Header Type: Media / Image</strong> in Gupshup.
                  </div>
                </div>
              )}
            </div>

            {/* WhatsApp Phone Mockup Preview */}
            <div className="bg-[#0B141A] border border-[#2A3942] rounded-xl p-4 shadow-inner relative overflow-hidden mt-4">
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2 border-b border-[#2A3942]/60 pb-2">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <Eye className="w-3.5 h-3.5" />
                  Live Preview for: <strong className="text-white">{currentPreviewContact.name}</strong>
                </span>
                <span className="font-mono text-gray-400">{currentPreviewContact.phone}</span>
              </div>

              {/* Template name & status badge */}
              {templatePreview && (
                <div className="flex items-center gap-2 mb-2 text-[10px] flex-wrap">
                  <span className="text-gray-300 font-medium">{templatePreview.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    templatePreview.status === 'APPROVED'
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
                      : templatePreview.status === 'REJECTED' || templatePreview.status === 'FAILED'
                      ? 'bg-rose-950/60 text-rose-400 border border-rose-700/50'
                      : 'bg-amber-950/60 text-amber-400 border border-amber-700/50'
                  }`}>
                    {templatePreview.status}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                    templatePreview.category === 'MARKETING'
                      ? 'bg-purple-950/60 text-purple-300 border border-purple-700/50'
                      : templatePreview.category === 'UTILITY'
                      ? 'bg-blue-950/60 text-blue-300 border border-blue-700/50'
                      : 'bg-gray-800 text-gray-300 border border-gray-700'
                  }`}>
                    {templatePreview.category}
                  </span>
                  <span className="text-gray-500 text-[10px]">
                    {templatePreview.paramCount} param{templatePreview.paramCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Chat Bubble - Dynamic */}
              {loadingPreview ? (
                <div className="flex items-center justify-center p-6 text-gray-500 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2 text-[#00A884]" />
                  Loading template preview...
                </div>
              ) : templatePreview ? (
                <div className="bg-[#202C33] text-gray-100 rounded-lg rounded-tl-none overflow-hidden shadow-md text-xs leading-relaxed max-w-[95%] border border-[#2A3942]">
                  {/* Header Image if provided */}
                  {imageUrl && (
                    <div className="w-full max-h-48 overflow-hidden bg-black/40 border-b border-[#2A3942]">
                      <img
                        src={imageUrl}
                        alt="Header media"
                        className="w-full h-auto object-cover max-h-48"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                  )}

                  <div className="p-3.5">
                    {/* Render template body with {{1}} replaced by contact name and other placeholders styled */}
                    <div className="whitespace-pre-wrap text-gray-200">
                      {templatePreview.body
                        .replace(/\{\{1\}\}/g, currentPreviewContact.name)
                        .replace(/\{\{2\}\}/g, '📅 [Date / Info]')
                        .replace(/\{\{3\}\}/g, '⏰ [Time / Detail]')
                        .replace(/\{\{4\}\}/g, '📌 [Status / Link]')
                        .replace(/\{\{5\}\}/g, 'ℹ️ [Extra 5]')
                        .replace(/\{\{6\}\}/g, 'ℹ️ [Extra 6]')}
                    </div>

                    {/* Render buttons if available */}
                    {templatePreview.buttons && templatePreview.buttons.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-[#2A3942]/80 space-y-1.5">
                        {templatePreview.buttons.map((btn: any, i: number) => (
                          <div
                            key={i}
                            className="text-center text-[#00A884] text-xs font-medium py-1.5 border border-[#2A3942] rounded-lg bg-[#111B21]/60 flex items-center justify-center gap-1.5"
                          >
                            {btn.type === 'PHONE_NUMBER' ? (
                              <>
                                <PhoneCall className="w-3.5 h-3.5" />
                                <span>{btn.text || btn.phone_number}</span>
                              </>
                            ) : btn.type === 'URL' ? (
                              <>
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>{btn.text}</span>
                              </>
                            ) : (
                              <span>{btn.text}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 text-right text-[10px] text-gray-400 flex items-center justify-end gap-1">
                      <span suppressHydrationWarning>{previewTime}</span>
                      <Check className="w-3 h-3 text-[#00A884]" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#202C33] text-gray-400 rounded-lg rounded-tl-none p-4 shadow-md text-xs text-center border border-[#2A3942]">
                  Enter a valid Template ID above to see the live preview
                </div>
              )}
            </div>
          </div>

          {/* Test Single Number Card */}
          <div className="bg-[#111B21] border border-[#2A3942] rounded-xl p-5 shadow-lg">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#00A884]" />
              Send Single Test Message
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3 text-xs">
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Recipient Name"
                className="bg-[#202C33] border border-[#2A3942] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-[#00A884]"
              />
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="Phone (e.g. 9967904923)"
                className="bg-[#202C33] border border-[#2A3942] rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#00A884]"
              />
            </div>
            <button
              type="button"
              disabled={isSendingTest}
              onClick={handleSendTest}
              className="w-full bg-[#202C33] hover:bg-[#2A3942] border border-[#2A3942] text-xs font-semibold text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSendingTest ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00A884]" />
                  Sending Test Message...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-[#00A884]" />
                  Send Test Now
                </>
              )}
            </button>

            {testResult && (
              <div
                className={`mt-3 p-2.5 rounded-lg text-xs flex flex-col gap-1 border ${
                  testResult.success
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-800 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-medium">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400" />
                  )}
                  {testResult.message}
                </div>
                {testResult.messageId && (
                  <div className="font-mono text-[11px] text-gray-400 flex items-center justify-between mt-1">
                    <span>ID: {testResult.messageId}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(testResult.messageId!)}
                      className="text-xs hover:text-white"
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Launch Broadcast Action Card */}
          <div className="bg-[#111B21] border border-[#2A3942] rounded-xl p-5 shadow-lg">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-full bg-[#00A884] text-black font-bold text-xs flex items-center justify-center">
                3
              </div>
              <h2 className="text-sm font-semibold text-white">Broadcast Execution</h2>
            </div>

            {/* Progress Bar during execution */}
            {isBroadcasting && (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-gray-300 mb-1.5 font-medium">
                  <span>Sending in progress...</span>
                  <span className="font-mono text-[#00A884]">
                    {broadcastProgress.current} / {broadcastProgress.total} (
                    {Math.round((broadcastProgress.current / broadcastProgress.total) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-[#202C33] rounded-full h-2.5 overflow-hidden border border-[#2A3942]">
                  <div
                    className="bg-[#00A884] h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Counters */}
            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <div className="bg-[#202C33] p-2.5 rounded-lg border border-[#2A3942]">
                <span className="text-[10px] text-gray-400 block uppercase">Ready</span>
                <span className="text-base font-bold text-white">{validCount}</span>
              </div>
              <div className="bg-[#202C33] p-2.5 rounded-lg border border-[#2A3942]">
                <span className="text-[10px] text-emerald-400 block uppercase">Submitted</span>
                <span className="text-base font-bold text-emerald-400">{successCount}</span>
              </div>
              <div className="bg-[#202C33] p-2.5 rounded-lg border border-[#2A3942]">
                <span className="text-[10px] text-rose-400 block uppercase">Failed</span>
                <span className="text-base font-bold text-rose-400">{failedCount}</span>
              </div>
            </div>

            {/* Big Launch Button */}
            <button
              type="button"
              disabled={isBroadcasting || validCount === 0}
              onClick={handleStartBroadcast}
              className="w-full bg-[#00A884] hover:bg-[#00C298] text-black font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isBroadcasting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Broadcasting {broadcastProgress.current}/{broadcastProgress.total}...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Launch Broadcast to {validCount} Customers
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
