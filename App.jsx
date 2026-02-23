import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Clock, Download, Upload, LogIn, LogOut, Coffee, Play, Edit2, X, Check, Trash2, Users 
} from 'lucide-react';

const STAFF_OPTIONS = [
  { name: '查', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { name: '歐', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { name: '安', color: 'bg-purple-100 text-purple-700 border-purple-200' },
];

const App = () => {
  const [records, setRecords] = useState(() => {
    const saved = localStorage.getItem('sd_attendance_v1');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [quickSelect, setQuickSelect] = useState({ name: '查', date: new Date().toISOString().substring(0, 10) });
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('sd_attendance_v1', JSON.stringify(records));
  }, [records]);

  const getCurrentTime = () => new Date().toTimeString().split(' ')[0];
  const timeToSeconds = (t) => {
    if (!t || t === '00:00:00') return 0;
    const p = t.split(':').map(Number);
    return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0);
  };
  const secondsToTime = (s) => {
    if (s <= 0) return "00:00:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map(v => v.toString().padStart(2, '0')).join(':');
  };

  const calculateDailyStats = (r) => {
    const total = timeToSeconds(r.endTime) - timeToSeconds(r.startTime);
    const breakTime = timeToSeconds(r.breakEnd) - timeToSeconds(r.breakStart);
    return { workSec: Math.max(0, total - breakTime) };
  };

  const handleQuickClock = (field) => {
    const cur = getCurrentTime();
    const existingIndex = records.findIndex(r => r.name === quickSelect.name && r.date === quickSelect.date);
    if (existingIndex >= 0) {
      const newRecords = [...records];
      newRecords[existingIndex] = { ...newRecords[existingIndex], [field]: cur };
      setRecords(newRecords);
    } else {
      const newEntry = {
        id: Date.now(),
        name: quickSelect.name,
        date: quickSelect.date,
        startTime: field === 'startTime' ? cur : '00:00:00',
        endTime: field === 'endTime' ? cur : '00:00:00',
        breakStart: field === 'breakStart' ? cur : '00:00:00',
        breakEnd: field === 'breakEnd' ? cur : '00:00:00'
      };
      setRecords([newEntry, ...records].sort((a, b) => new Date(b.date) - new Date(a.date)));
    }
  };

  const exportCSV = () => {
    const headers = ["姓名", "日期", "上班", "下班", "休息始", "休息終", "工作時間"];
    const rows = records.map(r => [r.name, r.date, r.startTime, r.endTime, r.breakStart, r.breakEnd, secondsToTime(calculateDailyStats(r).workSec)]);
    const content = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    link.download = `伸動打卡紀錄_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  const importCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split('\n').slice(1);
      const newRecords = [...records];
      rows.forEach(row => {
        const cols = row.split(',');
        if (cols.length >= 6) {
          const [name, date, startTime, endTime, break
