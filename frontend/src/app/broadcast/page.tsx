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
  RotateCcw,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// Bulletproof Excel download helper that ensures proper MIME type, clean filename, and .xlsx extension in all browsers
function downloadWorkbookAsExcel(wb: XLSX.WorkBook, filename: string) {
  let safeName = filename.trim().replace(/[/\\?%*:|"<>]/g, '_');
  if (!safeName.toLowerCase().endsWith('.xlsx')) safeName += '.xlsx';
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.style.display = 'none';
  anchor.href = url;
  anchor.download = safeName;
  anchor.setAttribute('download', safeName);
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }, 1500);
}

interface Contact {
  id: number;
  name: string;
  phone: string;
  isValid: boolean;
  status?: 'pending' | 'sending' | 'success' | 'failed' | 'replied';
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
  const [historyFilter, setHistoryFilter] = useState<'all' | 'replies' | 'read' | 'delivered' | 'failed'>('all');

  // Broadcast Campaign Name & Confirmation Modal
  const [broadcastCampaignName, setBroadcastCampaignName] = useState<string>('');
  const [showConfirmBroadcastModal, setShowConfirmBroadcastModal] = useState<boolean>(false);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportFileName, setExportFileName] = useState<string>('');
  const [exportSource, setExportSource] = useState<'audience' | 'history'>('audience');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [exportCampaignFilter, setExportCampaignFilter] = useState<string>('all');
  // Audience Pagination & Search (crucial for smooth 10k+ performance)
  const [audiencePage, setAudiencePage] = useState<number>(1);
  const [audiencePageSize, setAudiencePageSize] = useState<number>(50);
  const [audienceSearch, setAudienceSearch] = useState<string>('');

  // History Pagination & Search
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(50);
  const [historySearch, setHistorySearch] = useState<string>('');




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
  const shouldStopBroadcastRef = useRef<boolean>(false);

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
    const count = typeof templatePreview?.paramCount === 'number' ? templatePreview.paramCount : 1;
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
      const res = await fetch('/api/broadcast/history?limit=100000', {
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

  // Auto-suggest campaign name when template is ready
  useEffect(() => {
    if (!broadcastCampaignName && templatePreview?.name) {
      const tName = templatePreview.name.replace(/_/g, ' ');
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setBroadcastCampaignName(`${tName} - ${dateStr}`);
    }
  }, [templatePreview?.name]);

  // Open Broadcast Confirmation Modal to ask for Campaign Name before sending
  const handleOpenBroadcastModal = () => {
    const validContacts = contacts.filter((c) => c.isValid);
    if (validContacts.length === 0) {
      alert('No valid contacts found to broadcast. Please load an Excel list first.');
      return;
    }

    if (!broadcastCampaignName.trim()) {
      const tName = templatePreview?.name ? templatePreview.name.replace(/_/g, ' ') : 'Broadcast';
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setBroadcastCampaignName(`${tName} - ${dateStr}`);
    }

    setShowConfirmBroadcastModal(true);
  };

  // Run Bulk Broadcast with the confirmed Campaign Name
  const handleConfirmAndStartBroadcast = async () => {
    const validContacts = contacts.filter((c) => c.isValid);
    if (validContacts.length === 0) {
      alert('No valid contacts found to broadcast. Please load an Excel or CSV file first.');
      return;
    }

    const finalCampaignName =
      broadcastCampaignName.trim() ||
      `Broadcast_${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(/\s+/g, '_')}`;

    const currentCampaignId = 'camp_' + Date.now();

    setShowConfirmBroadcastModal(false);
    setIsBroadcasting(true);
    shouldStopBroadcastRef.current = false;
    setBroadcastProgress({ current: 0, total: validContacts.length });

    try {
      // Copy contacts
      const updatedContacts = [...contacts];

      for (let i = 0; i < updatedContacts.length; i++) {
        if (shouldStopBroadcastRef.current) {
          console.warn('Broadcast stopped by user.');
          break;
        }

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
              campaignId: currentCampaignId,
              campaignName: finalCampaignName,
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
    } catch (fatalErr: any) {
      console.error('Broadcast execution error:', fatalErr);
      alert('Broadcast stopped unexpectedly: ' + (fatalErr?.message || 'Unknown error'));
    } finally {
      setIsBroadcasting(false);
      fetchHistory();
    }
  };

  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Group history logs by campaign / broadcast batch
  const campaigns = React.useMemo(() => {
    const map = new Map<string, {
      id: string;
      label: string;
      total: number;
      replied: number;
      read: number;
      delivered: number;
      failed: number;
      timestamp: string;
    }>();

    for (const log of historyLogs) {
      let cId = log.campaignId;
      let label = log.campaignName;

      if (!label) {
        if (cId) {
          label = cId.startsWith('camp_') ? `Campaign ${cId.replace('camp_', '#')}` : cId;
        } else {
          const d = log.createdAt ? new Date(log.createdAt) : new Date();
          const dateStr = d.toISOString().slice(0, 10);
          const hourStr = String(d.getHours()).padStart(2, '0');
          cId = `batch_${dateStr}_${hourStr}`;
          label = `Broadcast (${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
        }
      } else {
        if (!cId) {
          cId = `name_${label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
        }
      }

      if (!map.has(cId)) {
        map.set(cId, {
          id: cId,
          label,
          total: 0,
          replied: 0,
          read: 0,
          delivered: 0,
          failed: 0,
          timestamp: log.createdAt || '',
        });
      }

      const item = map.get(cId)!;
      item.total++;
      if (log.status === 'replied' || log.replyText) item.replied++;
      else if (log.status === 'read') item.read++;
      else if (log.status === 'delivered') item.delivered++;
      else if (log.status === 'failed') item.failed++;
    }

    return Array.from(map.values()).sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
  }, [historyLogs]);

  // Open Export Modal to configure report filename & campaign selection
  const openExportModal = (source: 'audience' | 'history' = 'audience', specificCampaignId?: string) => {
    setExportSource(source);
    const campaignToExport = specificCampaignId || selectedCampaignId || 'all';
    setExportCampaignFilter(campaignToExport);

    const dateStr = new Date().toISOString().slice(0, 10);
    let defaultName = '';
    if (source === 'history') {
      if (campaignToExport !== 'all') {
        const cObj = campaigns.find((c) => c.id === campaignToExport);
        const slug = cObj ? cObj.label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : campaignToExport;
        defaultName = `mpc_broadcast_${slug}_${dateStr}`;
      } else {
        defaultName = `mpc_all_broadcast_campaigns_${dateStr}`;
      }
    } else {
      const templateName = templatePreview?.name ? `${templatePreview.name.replace(/\s+/g, '_')}_` : '';
      defaultName = `mpc_audience_report_${templateName}${dateStr}`;
    }
    setExportFileName(defaultName);
    setShowExportModal(true);
  };

  // Confirm and download report with user's customized name and dedicated reply / error columns
  const handleConfirmExport = () => {
    let cleanName = (exportFileName.trim() || `broadcast_report_${new Date().toISOString().slice(0, 10)}`);
    cleanName = cleanName.replace(/\.xlsx$/i, '') + '.xlsx';

    if (exportSource === 'audience') {
      if (contacts.length === 0) return;
      const exportData = contacts.map((c, idx) => {
        const matchedReply = historyLogs.find(
          (h) =>
            h.phone === c.phone ||
            (h.phone && c.phone && h.phone.replace(/\D/g, '').endsWith(c.phone.replace(/\D/g, '').slice(-10)))
        );

        const isReplied = c.status === 'replied' || matchedReply?.status === 'replied' || !!matchedReply?.replyText;
        const replyText = isReplied
          ? (matchedReply?.replyText || (matchedReply?.error?.startsWith('Reply:') ? matchedReply.error.replace(/^Reply:\s*"?/, '').replace(/"?$/, '') : '') || c.error || 'Yes')
          : '';
        const isFailed = c.status === 'failed';
        const errorReason = isFailed ? (c.error || '').replace(/^null,\s*/, '') : '';

        return {
          '#': idx + 1,
          'Customer Name': c.name,
          'Phone Number': c.phone,
          'Overall Status': isReplied ? 'Replied 💬' : c.status === 'success' ? 'Submitted ✅' : c.status === 'failed' ? 'Failed ❌' : (c.status || 'Pending'),
          'Customer Replied?': isReplied ? 'YES' : 'NO',
          'Customer Reply Message': replyText || '',
          'Failure / Error Reason': errorReason || '',
          'Valid Number': c.isValid ? 'Yes' : 'No',
          'Gupshup Message ID': c.messageId || '',
          'Sent Date & Time': c.timestamp || new Date().toLocaleString(),
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Audience Report');
      downloadWorkbookAsExcel(wb, cleanName);
    } else {
      // Filter by exportCampaignFilter
      let logsToExport = historyLogs;
      if (exportCampaignFilter !== 'all') {
        logsToExport = historyLogs.filter((log) => {
          if (log.campaignId && log.campaignId === exportCampaignFilter) return true;
          if (!log.campaignId) {
            const d = log.createdAt ? new Date(log.createdAt) : new Date();
            const dateStr = d.toISOString().slice(0, 10);
            const hourStr = String(d.getHours()).padStart(2, '0');
            return `batch_${dateStr}_${hourStr}` === exportCampaignFilter;
          }
          return false;
        });
      }

      if (logsToExport.length === 0) return;

      const exportData = logsToExport.map((l, idx) => {
        const isReplied = l.status === 'replied' || !!l.replyText || (l.error && /^Reply:\s*"?/i.test(l.error));
        const isRead = l.status === 'read';
        const isDelivered = l.status === 'delivered' || isRead || isReplied;
        const isFailed = l.status === 'failed';

        // Clean customer reply (NO "Reply: " or outer quotes)
        let replyMessage = '';
        if (isReplied) {
          replyMessage = l.replyText || (l.error ? l.error.replace(/^Reply:\s*"?/i, '').replace(/"?$/, '').trim() : 'Yes');
        }

        // Clean failure reason (ONLY when failed or actual error exists)
        let failureReason = '';
        if (isFailed && l.error) {
          failureReason = l.error.replace(/^null,\s*/, '').trim();
        }

        return {
          '#': idx + 1,
          'Customer Name': l.name,
          'Phone Number': l.phone,
          'Overall Status': isReplied
            ? 'Replied 💬'
            : isRead
            ? 'Read 👁️'
            : isDelivered
            ? 'Delivered ✅'
            : isFailed
            ? 'Failed ❌'
            : 'Submitted / Sent',
          'Delivered to Phone?': isDelivered ? 'YES' : isFailed ? 'NO' : 'Pending',
          'Read by Customer?': isRead ? 'YES' : isFailed ? 'NO' : 'Unread',
          'Customer Replied?': isReplied ? 'YES' : 'NO',
          'Customer Reply Message': replyMessage || '',
          'Failure / Error Reason': failureReason || '',
          'Gupshup Message ID': l.messageId || '',
          'Sent Date & Time': l.createdAt ? new Date(l.createdAt).toLocaleString() : '',
          'Campaign Name': l.campaignName || l.campaignId || 'Default Campaign',
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Campaign Broadcast Report');
      downloadWorkbookAsExcel(wb, cleanName);
    }

    setShowExportModal(false);
  };

  // Filter logs by selected campaign first
  const campaignFilteredLogs = React.useMemo(() => {
    if (selectedCampaignId === 'all') return historyLogs;
    return historyLogs.filter((log) => {
      if (log.campaignId && log.campaignId === selectedCampaignId) return true;
      if (!log.campaignId) {
        const d = log.createdAt ? new Date(log.createdAt) : new Date();
        const dateStr = d.toISOString().slice(0, 10);
        const hourStr = String(d.getHours()).padStart(2, '0');
        return `batch_${dateStr}_${hourStr}` === selectedCampaignId;
      }
      return false;
    });
  }, [historyLogs, selectedCampaignId]);

  // Current contact for preview
  const currentPreviewContact =
    contacts.length > 0 ? contacts[previewContactIndex] || contacts[0] : { name: 'Sahil Singh', phone: '919967904923' };

  const validCount = contacts.filter((c) => c.isValid).length;
  const successCount = contacts.filter((c) => c.status === 'success').length;
  const failedCount = contacts.filter((c) => c.status === 'failed').length;

  // Pre-index replies into a Map for instant O(1) lookups instead of O(N*M)
  const repliesMap = React.useMemo(() => {
    const map = new Map<string, { status: string; error?: string; replyText?: string }>();
    for (let i = 0; i < historyLogs.length; i++) {
      const h = historyLogs[i];
      if (h.phone) {
        const clean = h.phone.replace(/\D/g, '').slice(-10);
        if (clean && (h.status === 'replied' || h.replyText)) {
          map.set(clean, {
            status: h.status,
            error: h.error,
            replyText: h.replyText,
          });
        }
      }
    }
    return map;
  }, [historyLogs]);

  // Audience Filtered & Paginated (renders only visible 50 contacts, making 10k+ rows instant)
  const filteredContacts = React.useMemo(() => {
    if (!audienceSearch.trim()) return contacts;
    const q = audienceSearch.toLowerCase().trim();
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [contacts, audienceSearch]);

  const totalAudiencePages = Math.max(1, Math.ceil(filteredContacts.length / audiencePageSize));
  const paginatedContacts = React.useMemo(() => {
    const start = (audiencePage - 1) * audiencePageSize;
    return filteredContacts.slice(start, start + audiencePageSize);
  }, [filteredContacts, audiencePage, audiencePageSize]);

  // Keep audience page bounded
  useEffect(() => {
    if (audiencePage > totalAudiencePages) {
      setAudiencePage(1);
    }
  }, [totalAudiencePages, audiencePage]);

  const repliesCount = campaignFilteredLogs.filter((l) => l.status === 'replied' || !!l.replyText).length;
  const readCount = campaignFilteredLogs.filter((l) => l.status === 'read').length;
  const deliveredCount = campaignFilteredLogs.filter((l) => l.status === 'delivered').length;
  const historyFailedCount = campaignFilteredLogs.filter((l) => l.status === 'failed').length;

  const filteredHistoryLogs = React.useMemo(() => {
    let list = campaignFilteredLogs.filter((log) => {
      if (historyFilter === 'replies') return log.status === 'replied' || !!log.replyText;
      if (historyFilter === 'read') return log.status === 'read';
      if (historyFilter === 'delivered') return log.status === 'delivered';
      if (historyFilter === 'failed') return log.status === 'failed';
      return true;
    });
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase().trim();
      list = list.filter((l) => (l.name && l.name.toLowerCase().includes(q)) || (l.phone && l.phone.includes(q)));
    }
    return list;
  }, [campaignFilteredLogs, historyFilter, historySearch]);

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistoryLogs.length / historyPageSize));
  const paginatedHistoryLogs = React.useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredHistoryLogs.slice(start, start + historyPageSize);
  }, [filteredHistoryLogs, historyPage, historyPageSize]);

  return (
    <div className="min-h-screen bg-[#0B141A] text-gray-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="bg-[#202C33] border-b border-[#2A3942] px-6 py-3.5 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-4">
          <Link
            href="/inbox"
            className="flex items-center gap-2 text-xs font-bold text-black bg-[#00A884] hover:bg-[#00C298] px-3 py-1.5 rounded-lg shadow-sm transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Patient Inbox</span>
            {repliesCount > 0 && (
              <span className="bg-black/80 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {repliesCount} {repliesCount === 1 ? 'reply' : 'replies'}
              </span>
            )}
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

                {contacts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => openExportModal('audience')}
                    className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white bg-[#202C33] px-2.5 py-1 rounded border border-[#2A3942] transition-colors"
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openExportModal('history')}
                    disabled={historyLogs.length === 0}
                    className="text-xs font-semibold text-[#00A884] hover:text-emerald-300 flex items-center gap-1.5 bg-[#00A884]/15 hover:bg-[#00A884]/25 px-3 py-1.5 rounded-lg border border-[#00A884]/40 disabled:opacity-50 transition-colors shadow-sm"
                    title="Export campaign report with delivery, read & reply breakdown"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Campaign Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fetchHistory()}
                    disabled={loadingHistory}
                    className="text-xs text-gray-300 hover:text-white flex items-center gap-1.5 bg-[#202C33] hover:bg-[#2A3942] px-2.5 py-1.5 rounded-lg border border-[#2A3942] transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#00A884] ${loadingHistory ? 'animate-spin' : ''}`} />
                    <span>Refresh SQLite</span>
                  </button>
                </div>
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
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Campaign selector and History Filter Bar */}
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap text-xs">
                    {/* Left: Campaign Dropdown */}
                    <div className="flex items-center gap-2 bg-[#202C33] border border-[#2A3942] rounded-lg px-2.5 py-1.5 shadow-sm">
                      <span className="text-[11px] text-gray-400 font-medium">Broadcast Campaign:</span>
                      <select
                        value={selectedCampaignId}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                        className="bg-transparent text-xs text-[#00A884] font-bold focus:outline-none cursor-pointer pr-1"
                      >
                        <option value="all" className="bg-[#111B21] text-white">
                          All Campaigns Combined ({historyLogs.length} logs)
                        </option>
                        {campaigns.map((c) => (
                          <option key={c.id} value={c.id} className="bg-[#111B21] text-white">
                            {c.label} ({c.total} sent, {c.replied} replied)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Right: History Filter Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setHistoryFilter('all')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          historyFilter === 'all'
                            ? 'bg-[#202C33] text-white border border-[#00A884]'
                            : 'bg-[#111B21] text-gray-400 hover:text-white border border-[#2A3942]'
                        }`}
                      >
                        All ({campaignFilteredLogs.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setHistoryFilter('replies')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          historyFilter === 'replies'
                            ? 'bg-emerald-950 text-emerald-200 border border-emerald-500 shadow-sm shadow-emerald-950/60'
                            : 'bg-[#111B21] text-emerald-400 hover:text-emerald-300 border border-emerald-900/50'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Patient Replies ({repliesCount})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHistoryFilter('read')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          historyFilter === 'read'
                            ? 'bg-sky-950 text-sky-200 border border-sky-400 shadow-sm shadow-sky-950/60'
                            : 'bg-[#111B21] text-sky-400 hover:text-sky-300 border border-sky-900/50'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5 text-sky-400" />
                        <span>Read by Patient ({readCount})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHistoryFilter('delivered')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          historyFilter === 'delivered'
                            ? 'bg-teal-950 text-teal-200 border border-teal-500 shadow-sm shadow-teal-950/60'
                            : 'bg-[#111B21] text-teal-400 hover:text-teal-300 border border-teal-900/50'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                        <span>Delivered ({deliveredCount})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setHistoryFilter('failed')}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                          historyFilter === 'failed'
                            ? 'bg-rose-950/80 text-rose-200 border border-rose-600'
                            : 'bg-[#111B21] text-rose-400 hover:text-rose-300 border border-rose-900/50'
                        }`}
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Failed ({historyFailedCount})</span>
                      </button>
                    </div>
                  </div>

                    {/* Search & Count Bar for History */}
                    <div className="flex items-center justify-between gap-3 mb-2 flex-wrap text-xs">
                      <div className="relative flex-1 min-w-[180px] max-w-xs">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" />
                        <input
                          type="text"
                          value={historySearch}
                          onChange={(e) => {
                            setHistorySearch(e.target.value);
                            setHistoryPage(1);
                          }}
                          placeholder="Filter history by name or phone..."
                          className="w-full bg-[#202C33] border border-[#2A3942] focus:border-[#00A884] rounded-lg pl-8 pr-8 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none"
                        />
                        {historySearch && (
                          <button
                            type="button"
                            onClick={() => {
                              setHistorySearch('');
                              setHistoryPage(1);
                            }}
                            className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>Rows:</span>
                        <select
                          value={historyPageSize}
                          onChange={(e) => {
                            setHistoryPageSize(Number(e.target.value));
                            setHistoryPage(1);
                          }}
                          className="bg-[#202C33] border border-[#2A3942] rounded-md px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
                        >
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                          <option value={500}>500</option>
                          <option value={1000}>1000</option>
                          <option value={100000}>All ({filteredHistoryLogs.length.toLocaleString()})</option>
                        </select>
                        <span className="text-[11px] font-mono text-gray-300 ml-1">
                          {(historyPage - 1) * historyPageSize + 1} -{' '}
                          {Math.min(historyPage * historyPageSize, filteredHistoryLogs.length)} of{' '}
                          {filteredHistoryLogs.length.toLocaleString()}
                        </span>
                      </div>
                    </div>

                  <div className="flex-1 overflow-x-auto border border-[#2A3942] rounded-lg max-h-[400px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#202C33] text-gray-300 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-[#2A3942]">
                        <tr>
                          <th className="p-3">Customer</th>
                          <th className="p-3">Phone</th>
                          <th className="p-3 min-w-[260px]">Status & Patient Reply / Failure Reason</th>
                          <th className="p-3">Message ID</th>
                          <th className="p-3 text-right">Date / Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2A3942]/60">
                        {paginatedHistoryLogs.map((log: any) => {
                          const isReplied = log.status === 'replied' || !!log.replyText;
                          const replyMessage = log.replyText || (log.error && /^Reply:\s*"?/i.test(log.error) ? log.error.replace(/^Reply:\s*"?/i, '').replace(/"?$/, '').trim() : '');

                          return (
                            <tr key={log.id} className="hover:bg-[#202C33]/60 transition-colors">
                              <td className="p-3 font-semibold text-white">
                                <div>{log.name}</div>
                                <Link
                                  href={`/inbox?phone=${encodeURIComponent(log.phone)}`}
                                  className="text-[11px] text-[#00A884] hover:text-[#00C298] hover:underline flex items-center gap-1 font-medium mt-0.5"
                                  title="Open chat with this patient in Patient Inbox"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  Chat in Inbox &rarr;
                                </Link>
                              </td>
                              <td className="p-3 font-mono text-gray-300">{log.phone}</td>
                              <td className="p-3">
                                {isReplied ? (
                                  /* DISTINCT PATIENT REPLY CARD (WHATSAPP INBOUND) */
                                  <div className="flex flex-col gap-2 py-1 max-w-[340px]">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/70 flex items-center gap-1.5 font-bold shadow-sm shadow-emerald-950/60">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                        <MessageSquare className="w-3 h-3 text-emerald-400" />
                                        Patient Replied 💬
                                      </span>
                                      <span className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">
                                        WhatsApp Inbound
                                      </span>
                                    </div>

                                    {/* Authentic WhatsApp Speech Bubble */}
                                    <div className="bg-[#1F2C34] border-l-4 border-l-[#00A884] border border-[#2A3942] rounded-r-lg rounded-tl-lg p-2.5 shadow-md">
                                      <div className="text-[10px] text-emerald-400 font-semibold mb-0.5 flex items-center gap-1">
                                        Patient Said:
                                      </div>
                                      <p className="text-xs text-white font-medium italic font-sans">
                                        &ldquo;{replyMessage || 'Hi'}&rdquo;
                                      </p>
                                    </div>

                                    <Link
                                      href={`/inbox?phone=${encodeURIComponent(log.phone)}`}
                                      className="inline-flex items-center gap-1.5 text-xs text-black font-bold bg-[#00A884] hover:bg-[#00C298] px-2.5 py-1.5 rounded-lg shadow-sm transition-colors w-fit"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      Reply to Patient in Inbox &rarr;
                                    </Link>
                                  </div>
                                ) : log.status === 'read' ? (
                                  <span className="text-[11px] bg-sky-950/90 text-sky-200 px-2.5 py-1 rounded-md border border-sky-400/80 flex items-center gap-1.5 w-fit font-bold shadow-sm shadow-sky-950/60">
                                    <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                    <span>Read by Patient</span>
                                  </span>
                                ) : log.status === 'delivered' ? (
                                  <span className="text-[11px] bg-teal-950/80 text-teal-300 px-2.5 py-1 rounded-md border border-teal-600/70 flex items-center gap-1.5 w-fit font-semibold shadow-sm shadow-teal-950/40">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                                    <span>Delivered (Unread)</span>
                                  </span>
                                ) : log.status === 'sent' ? (
                                  <span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded border border-gray-700 flex items-center gap-1 w-fit">
                                    <Check className="w-3 h-3" />
                                    Sent
                                  </span>
                                ) : log.status === 'submitted' ? (
                                  <span className="text-[10px] bg-emerald-950/50 text-emerald-400 px-2 py-0.5 rounded border border-emerald-700/40 flex items-center gap-1 w-fit font-medium">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Submitted (HTTP 202)
                                  </span>
                                ) : log.status === 'failed' ? (
                                  /* DISTINCT FAILURE CARD */
                                  <div className="flex flex-col gap-1.5 py-0.5 max-w-[320px]">
                                    <span className="text-[10px] bg-rose-950/70 text-rose-400 px-2 py-0.5 rounded border border-rose-700/50 flex items-center gap-1 w-fit font-semibold">
                                      <XCircle className="w-3 h-3 shrink-0" />
                                      Delivery Failed
                                    </span>
                                    {log.error && (
                                      <div className="text-[11px] text-rose-300 leading-snug bg-rose-950/40 border border-rose-800/50 rounded p-2 break-words font-sans">
                                        {log.error.replace(/^null,\s*/, '')}
                                      </div>
                                    )}
                                  </div>
                                ) : null}
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
                        );
                      })}
                    </tbody>
                    </table>
                  </div>

                  {/* History Pagination Controls */}
                  {totalHistoryPages > 1 && (
                    <div className="flex items-center justify-between pt-3 mt-1 text-xs text-gray-400 border-t border-[#2A3942]/60">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={historyPage === 1}
                          onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded bg-[#202C33] hover:bg-[#2A3942] border border-[#2A3942] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-gray-200"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          Prev
                        </button>
                        <button
                          type="button"
                          disabled={historyPage === totalHistoryPages}
                          onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                          className="px-2.5 py-1 rounded bg-[#202C33] hover:bg-[#2A3942] border border-[#2A3942] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-gray-200"
                        >
                          Next
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        <span>Page</span>
                        <span className="text-white font-bold">{historyPage}</span>
                        <span>of</span>
                        <span className="text-white font-bold">{totalHistoryPages}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px]">Go to:</span>
                        <input
                          type="number"
                          min={1}
                          max={totalHistoryPages}
                          value={historyPage}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 1 && val <= totalHistoryPages) {
                              setHistoryPage(val);
                            }
                          }}
                          className="w-12 bg-[#202C33] border border-[#2A3942] rounded px-1.5 py-0.5 text-center text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
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
              <div className="flex-1 flex flex-col min-h-0">
                {/* Search & Pagination Toolbar */}
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap text-xs">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={audienceSearch}
                      onChange={(e) => setAudienceSearch(e.target.value)}
                      placeholder={`Search ${contacts.length.toLocaleString()} contacts by name or phone...`}
                      className="w-full bg-[#202C33] border border-[#2A3942] focus:border-[#00A884] rounded-lg pl-8 pr-8 py-1.5 text-xs text-white placeholder:text-gray-500 focus:outline-none"
                    />
                    {audienceSearch && (
                      <button
                        type="button"
                        onClick={() => setAudienceSearch('')}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>Rows:</span>
                    <select
                      value={audiencePageSize}
                      onChange={(e) => {
                        setAudiencePageSize(Number(e.target.value));
                        setAudiencePage(1);
                      }}
                      className="bg-[#202C33] border border-[#2A3942] rounded-md px-2 py-1 text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                      <option value={500}>500</option>
                      <option value={1000}>1000</option>
                      <option value={100000}>All ({filteredContacts.length.toLocaleString()})</option>
                    </select>
                    <span className="text-[11px] font-mono text-gray-300 ml-1">
                      {(audiencePage - 1) * audiencePageSize + 1} -{' '}
                      {Math.min(audiencePage * audiencePageSize, filteredContacts.length)} of{' '}
                      {filteredContacts.length.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Table View */}
                <div className="flex-1 overflow-x-auto border border-[#2A3942] rounded-lg max-h-[400px] overflow-y-auto">
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
                      {paginatedContacts.map((contact) => {
                        const isSelected = contacts[previewContactIndex]?.phone === contact.phone;
                        const cleanCPhone = contact.phone.replace(/\D/g, '').slice(-10);
                        const matchedReply = repliesMap.get(cleanCPhone);
                        const hasReplied = contact.status === 'replied' || !!matchedReply;
                        const replyText = contact.error || matchedReply?.replyText || matchedReply?.error;

                        return (
                          <tr
                            key={contact.id}
                            onClick={() => {
                              const origIdx = contacts.findIndex((c) => c.phone === contact.phone);
                              if (origIdx !== -1) setPreviewContactIndex(origIdx);
                            }}
                            className={`hover:bg-[#202C33]/60 cursor-pointer transition-colors ${
                              isSelected ? 'bg-[#00A884]/10 border-l-2 border-[#00A884]' : ''
                            }`}
                          >
                            <td className="p-3 text-gray-400 font-mono text-[11px]">{contact.id}</td>
                            <td className="p-3 font-semibold text-white">
                              <div>{contact.name}</div>
                              <Link
                                href={`/inbox?phone=${encodeURIComponent(contact.phone)}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] text-[#00A884] hover:text-[#00C298] hover:underline flex items-center gap-1 font-medium mt-0.5"
                                title="Open chat with this customer in Patient Inbox"
                              >
                                <MessageSquare className="w-3 h-3" />
                                Chat in Inbox &rarr;
                              </Link>
                            </td>
                            <td className="p-3 font-mono text-gray-300">
                              {contact.phone}
                              {!contact.isValid && (
                                <span className="ml-2 text-[10px] text-rose-400 font-sans">
                                  (Invalid)
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {hasReplied ? (
                                <div className="flex flex-col gap-2 py-1 max-w-[340px]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/70 flex items-center gap-1.5 font-bold shadow-sm shadow-emerald-950/60">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                      <MessageSquare className="w-3 h-3 text-emerald-400" />
                                      Patient Replied 💬
                                    </span>
                                    <span className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">
                                      WhatsApp Inbound
                                    </span>
                                  </div>

                                  {/* Authentic WhatsApp Speech Bubble */}
                                  <div className="bg-[#1F2C34] border-l-4 border-l-[#00A884] border border-[#2A3942] rounded-r-lg rounded-tl-lg p-2.5 shadow-md">
                                    <div className="text-[10px] text-emerald-400 font-semibold mb-0.5 flex items-center gap-1">
                                      Patient Said:
                                    </div>
                                    <p className="text-xs text-white font-medium italic font-sans">
                                      &ldquo;{replyText ? replyText.replace(/^Reply:\s*"?/i, '').replace(/"?$/, '') : 'Hi'}&rdquo;
                                    </p>
                                  </div>

                                  <Link
                                    href={`/inbox?phone=${encodeURIComponent(contact.phone)}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 text-xs text-black font-bold bg-[#00A884] hover:bg-[#00C298] px-2.5 py-1.5 rounded-lg shadow-sm transition-colors w-fit"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    Reply to Patient in Inbox &rarr;
                                  </Link>
                                </div>
                              ) : contact.status === 'pending' ? (
                                <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700">
                                  Pending
                                </span>
                              ) : contact.status === 'sending' ? (
                                <span className="text-[10px] bg-amber-950/60 text-amber-300 px-2 py-0.5 rounded border border-amber-800/40 flex items-center gap-1 w-fit animate-pulse">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Sending...
                                </span>
                              ) : contact.status === 'success' ? (
                                <span className="text-[10px] bg-emerald-950/70 text-emerald-400 px-2 py-0.5 rounded border border-emerald-700/50 flex items-center gap-1 w-fit font-medium">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Submitted 202
                                </span>
                              ) : contact.status === 'failed' ? (
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
                              ) : null}
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

                {/* Pagination Controls */}
                {totalAudiencePages > 1 && (
                  <div className="flex items-center justify-between pt-3 mt-1 text-xs text-gray-400 border-t border-[#2A3942]/60">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={audiencePage === 1}
                        onClick={() => setAudiencePage((p) => Math.max(1, p - 1))}
                        className="px-2.5 py-1 rounded bg-[#202C33] hover:bg-[#2A3942] border border-[#2A3942] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-gray-200"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Prev
                      </button>
                      <button
                        type="button"
                        disabled={audiencePage === totalAudiencePages}
                        onClick={() => setAudiencePage((p) => Math.min(totalAudiencePages, p + 1))}
                        className="px-2.5 py-1 rounded bg-[#202C33] hover:bg-[#2A3942] border border-[#2A3942] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-gray-200"
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <span>Page</span>
                      <span className="text-white font-bold">{audiencePage}</span>
                      <span>of</span>
                      <span className="text-white font-bold">{totalAudiencePages}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px]">Go to:</span>
                      <input
                        type="number"
                        min={1}
                        max={totalAudiencePages}
                        value={audiencePage}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 1 && val <= totalAudiencePages) {
                            setAudiencePage(val);
                          }
                        }}
                        className="w-12 bg-[#202C33] border border-[#2A3942] rounded px-1.5 py-0.5 text-center text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}
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

            {/* Broadcast Campaign Name Input */}
            <div className="mb-4 bg-[#202C33]/60 p-3 rounded-xl border border-[#2A3942]">
              <label className="block text-xs font-bold text-gray-200 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-white">
                  <Sparkles className="w-3.5 h-3.5 text-[#00A884]" />
                  Broadcast Campaign Name:
                </span>
                <span className="text-[10px] text-[#00A884] font-medium">Editable before sending</span>
              </label>
              <input
                type="text"
                value={broadcastCampaignName}
                onChange={(e) => setBroadcastCampaignName(e.target.value)}
                placeholder="e.g. Ganpati Dental Camp Sep 2026"
                className="w-full bg-[#111B21] border border-[#2A3942] focus:border-[#00A884] rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-500 font-semibold focus:outline-none"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Name your campaign here. Reports and SQLite history will be grouped under this name.
              </p>
            </div>

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

            {/* Big Launch Button with Stop control and Reset helper */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isBroadcasting || validCount === 0}
                onClick={handleOpenBroadcastModal}
                className="flex-1 bg-[#00A884] hover:bg-[#00C298] text-black font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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

              {isBroadcasting && (
                <button
                  type="button"
                  onClick={() => {
                    shouldStopBroadcastRef.current = true;
                  }}
                  className="bg-rose-950 hover:bg-rose-900 border border-rose-700/60 text-rose-300 font-semibold py-3.5 px-4 rounded-xl transition-all flex items-center gap-1.5 text-xs shadow-md"
                  title="Pause / Stop sending remaining messages"
                >
                  <XCircle className="w-4 h-4" />
                  Stop
                </button>
              )}
            </div>

            {!isBroadcasting && (successCount > 0 || failedCount > 0) && (
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-400">
                <span>Finished: {successCount} sent, {failedCount} failed</span>
                <button
                  type="button"
                  onClick={() => {
                    setContacts((prev) =>
                      prev.map((c) => ({
                        ...c,
                        status: 'pending',
                        error: undefined,
                        messageId: undefined,
                      }))
                    );
                    setBroadcastProgress({ current: 0, total: validCount });
                  }}
                  className="text-[#00A884] hover:text-[#00C298] flex items-center gap-1 hover:underline font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset to re-send
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Export Report Filename Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111B21] border border-[#2A3942] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 border-b border-[#2A3942] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#00A884]/20 border border-[#00A884]/40 flex items-center justify-center text-[#00A884]">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Export Report to Excel</h3>
                  <p className="text-[11px] text-gray-400">
                    {exportSource === 'audience'
                      ? `Audience Results (${contacts.length} records)`
                      : `SQLite Broadcast History (${historyLogs.length} records)`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#202C33] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Source switcher if both are available */}
            {contacts.length > 0 && historyLogs.length > 0 && (
              <div className="mb-4 bg-[#202C33] p-1 rounded-lg grid grid-cols-2 gap-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => openExportModal('audience')}
                  className={`py-1.5 px-2 rounded-md transition-colors ${
                    exportSource === 'audience'
                      ? 'bg-[#00A884] text-black font-semibold'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Audience List ({contacts.length})
                </button>
                <button
                  type="button"
                  onClick={() => openExportModal('history')}
                  className={`py-1.5 px-2 rounded-md transition-colors ${
                    exportSource === 'history'
                      ? 'bg-[#00A884] text-black font-semibold'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  SQLite History ({historyLogs.length})
                </button>
              </div>
            )}

            {/* Campaign Selector if exporting history */}
            {exportSource === 'history' && campaigns.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-300 mb-1.5">
                  Select Broadcast Campaign to Export:
                </label>
                <select
                  value={exportCampaignFilter}
                  onChange={(e) => {
                    const newCamp = e.target.value;
                    setExportCampaignFilter(newCamp);
                    const dateStr = new Date().toISOString().slice(0, 10);
                    if (newCamp === 'all') {
                      setExportFileName(`mpc_all_broadcast_campaigns_${dateStr}`);
                    } else {
                      const cObj = campaigns.find((c) => c.id === newCamp);
                      const slug = cObj ? cObj.label.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : newCamp;
                      setExportFileName(`mpc_broadcast_${slug}_${dateStr}`);
                    }
                  }}
                  className="w-full bg-[#202C33] border border-[#2A3942] focus:border-[#00A884] rounded-lg px-3 py-2 text-xs text-white focus:outline-none cursor-pointer font-medium"
                >
                  <option value="all">
                    All Broadcast Campaigns Combined ({historyLogs.length} total messages)
                  </option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} ({c.total} sent, {c.replied} replies, {c.failed} failed)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Preview breakdown chips */}
            {exportSource === 'history' && (
              <div className="mb-4 bg-[#202C33]/60 border border-[#2A3942] rounded-lg p-2.5 grid grid-cols-5 gap-2 text-center text-[11px]">
                <div>
                  <span className="text-gray-400 block text-[10px]">Total</span>
                  <span className="font-bold text-white">
                    {exportCampaignFilter === 'all'
                      ? historyLogs.length
                      : historyLogs.filter((l) => (l.campaignId || `batch_${(l.createdAt || '').slice(0, 10)}_${new Date(l.createdAt || '').getHours()}`) === exportCampaignFilter).length}
                  </span>
                </div>
                <div>
                  <span className="text-sky-300 block text-[10px]">Read 👁️</span>
                  <span className="font-bold text-sky-400">
                    {exportCampaignFilter === 'all'
                      ? historyLogs.filter((l) => l.status === 'read').length
                      : historyLogs.filter((l) => (l.campaignId || `batch_${(l.createdAt || '').slice(0, 10)}_${new Date(l.createdAt || '').getHours()}`) === exportCampaignFilter && l.status === 'read').length}
                  </span>
                </div>
                <div>
                  <span className="text-teal-300 block text-[10px]">Delivered ✅</span>
                  <span className="font-bold text-teal-400">
                    {exportCampaignFilter === 'all'
                      ? historyLogs.filter((l) => l.status === 'delivered').length
                      : historyLogs.filter((l) => (l.campaignId || `batch_${(l.createdAt || '').slice(0, 10)}_${new Date(l.createdAt || '').getHours()}`) === exportCampaignFilter && l.status === 'delivered').length}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-300 block text-[10px]">Replied 💬</span>
                  <span className="font-bold text-emerald-400">
                    {exportCampaignFilter === 'all'
                      ? historyLogs.filter((l) => l.status === 'replied' || !!l.replyText).length
                      : historyLogs.filter((l) => (l.campaignId || `batch_${(l.createdAt || '').slice(0, 10)}_${new Date(l.createdAt || '').getHours()}`) === exportCampaignFilter && (l.status === 'replied' || !!l.replyText)).length}
                  </span>
                </div>
                <div>
                  <span className="text-rose-300 block text-[10px]">Failed ❌</span>
                  <span className="font-bold text-rose-400">
                    {exportCampaignFilter === 'all'
                      ? historyLogs.filter((l) => l.status === 'failed').length
                      : historyLogs.filter((l) => (l.campaignId || `batch_${(l.createdAt || '').slice(0, 10)}_${new Date(l.createdAt || '').getHours()}`) === exportCampaignFilter && l.status === 'failed').length}
                  </span>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Set Report File Name:
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  placeholder="e.g. clinic_broadcast_campaign_sep21"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmExport();
                  }}
                  className="w-full bg-[#202C33] border border-[#2A3942] focus:border-[#00A884] rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-gray-500 font-mono pr-14 focus:outline-none"
                />
                <span className="absolute right-3 text-xs text-gray-500 font-mono pointer-events-none">
                  .xlsx
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                Will be downloaded as:{' '}
                <strong className="text-[#00A884]">
                  {(exportFileName.trim() || 'broadcast_report').replace(/\.xlsx$/i, '')}.xlsx
                </strong>
              </p>
            </div>

            {/* Note highlighting separated reply and error columns */}
            <div className="mb-5 p-2.5 rounded-lg bg-[#00A884]/10 border border-[#00A884]/30 text-[11px] text-gray-300 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-[#00A884] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#00A884]">Clean Excel Layout:</strong> Patient replies and system errors are exported into separate dedicated columns: <span className="text-white font-mono font-semibold">Customer Replied?</span>, <span className="text-white font-mono font-semibold">Customer Reply Message</span>, and <span className="text-white font-mono font-semibold">Failure / Error Reason</span>.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#2A3942]">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-gray-300 hover:text-white bg-[#202C33] hover:bg-[#2A3942] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExport}
                className="px-4 py-2 rounded-lg text-xs font-bold text-black bg-[#00A884] hover:bg-[#00C298] transition-colors flex items-center gap-1.5 shadow-md shadow-[#00A884]/20"
              >
                <Download className="w-3.5 h-3.5" />
                Download Excel (.xlsx)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Broadcast Campaign Name Modal */}
      {showConfirmBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#111B21] border border-[#2A3942] rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 border-b border-[#2A3942] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#00A884]/20 border border-[#00A884]/40 flex items-center justify-center text-[#00A884]">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Start WhatsApp Broadcast</h3>
                  <p className="text-[11px] text-gray-400">
                    Confirm your campaign name before sending begins
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmBroadcastModal(false)}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#202C33] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Campaign Name Input */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-emerald-400 mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Broadcast Campaign Name:
              </label>
              <input
                type="text"
                value={broadcastCampaignName}
                onChange={(e) => setBroadcastCampaignName(e.target.value)}
                placeholder="e.g. Ganpati Dental Camp 2026"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmAndStartBroadcast();
                }}
                className="w-full bg-[#202C33] border border-[#2A3942] focus:border-[#00A884] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-500 font-semibold focus:outline-none"
              />
              <p className="text-[11px] text-gray-400 mt-1.5">
                Reports will be saved and exported as:{' '}
                <strong className="text-emerald-400 font-mono">
                  {broadcastCampaignName.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'broadcast'}_report.xlsx
                </strong>
              </p>
            </div>

            {/* Summary Checklist */}
            <div className="bg-[#202C33]/70 rounded-xl p-3.5 border border-[#2A3942] mb-5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-300">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#00A884]" />
                  Recipients:
                </span>
                <strong className="text-white font-mono">{validCount} valid contacts</strong>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#00A884]" />
                  Template:
                </span>
                <strong className="text-emerald-400">{templatePreview?.name || 'Approved Template'}</strong>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#00A884]" />
                  Header Media:
                </span>
                <span className="text-gray-300">{imageUrl ? 'Image Attached ✅' : 'Text Only'}</span>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-[#00A884]" />
                  Database Tracking:
                </span>
                <span className="text-[#00A884] font-medium">SQLite WAL Enabled</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#2A3942]">
              <button
                type="button"
                onClick={() => setShowConfirmBroadcastModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white bg-[#202C33] hover:bg-[#2A3942] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAndStartBroadcast}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-black bg-[#00A884] hover:bg-[#00C298] transition-all flex items-center gap-2 shadow-lg shadow-[#00A884]/20"
              >
                <Send className="w-4 h-4" />
                Confirm & Start Broadcasting 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

