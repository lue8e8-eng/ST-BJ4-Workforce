import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, addDoc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import { 
  Clock, 
  User, 
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  Calendar as CalendarIcon,
  Save,
  FileText,
  AlertCircle,
  Users,
  LogIn,
  LogOut,
  Coffee,
  Play,
  Edit2,
  X,
  Check
} from 'lucide-react';

// --- Firebase 配置 ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'attendance-system-001';

const STAFF_OPTIONS = [
  { name: '查', color: 'bg-blue-100 text-blue-700 border-blue-200', text: 'text-blue-400' },
  { name: '歐', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', text: 'text-emerald-400' },
  { name: '安', color: 'bg-purple-100 text-purple-700 border-purple-200', text: 'text-purple-400' },
];

const App = () => {
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  
  // 快速打卡選擇狀態
  const [quickSelect, setQuickSelect] = useState({
    name: '查',
    date: new Date().toISOString().substring(0, 10)
  });

  // 編輯狀態
  const [editingId, setEditingId] = useState(null);
  const [editBuffer, setEditBuffer] = useState(null);

  // 1. 身份驗證邏輯
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("驗證錯誤:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. 資料獲取
  useEffect(() => {
    if (!user) return;
    const recordsCol = collection(db, 'artifacts', appId, 'public', 'data', 'attendance');
    const unsubscribe = onSnapshot(recordsCol, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sortedData = data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRecords(sortedData);
      setLoading(false);
    }, (err) => {
      console.error("Firestore 錯誤:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // --- 工具函式 ---
  const getCurrentTime = () => {
    return new Date().toTimeString().split(' ')[0];
  };

  const timeToSeconds = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.split(':').map(Number);
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  };

  const secondsToTime = (totalSeconds) => {
    if (totalSeconds < 0) return "00:00:00";
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };

  const calculateDailyStats = (record) => {
    const start = timeToSeconds(record.startTime);
    const end = timeToSeconds(record.endTime);
    const bStart = timeToSeconds(record.breakStart);
    const bEnd = timeToSeconds(record.breakEnd);
    const breakDuration = Math.max(0, bEnd - bStart);
    const totalDuration = Math.max(0, end - start);
    return {
      workSec: Math.max(0, totalDuration - breakDuration),
      breakSec: breakDuration
    };
  };

  // --- 核心邏輯：快速打卡同步 ---
  const handleQuickClock = async (field) => {
    if (!user) return;
    const currentTime = getCurrentTime();
    
    // 尋找是否已有該人該天的紀錄
    const existingRecord = records.find(r => r.name === quickSelect.name && r.date === quickSelect.date);
    const recordsCol = collection(db, 'artifacts', appId, 'public', 'data', 'attendance');

    try {
      if (existingRecord) {
        // 更新現有紀錄
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'attendance', existingRecord.id);
        await updateDoc(docRef, { [field]: currentTime });
      } else {
        // 建立新紀錄，其他欄位預設 00:00:00
        await addDoc(recordsCol, {
          name: quickSelect.name,
          date: quickSelect.date,
          startTime: field === 'startTime' ? currentTime : '00:00:00',
          endTime: field === 'endTime' ? currentTime : '00:00:00',
          breakStart: field === 'breakStart' ? currentTime : '00:00:00',
          breakEnd: field === 'breakEnd' ? currentTime : '00:00:00',
          createdAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("同步失敗:", err);
    }
  };

  // --- 編輯功能 ---
  const startEditing = (record) => {
    setEditingId(record.id);
    setEditBuffer({ ...record });
  };

  const saveEdit = async () => {
    if (!editBuffer || !editingId) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'attendance', editingId);
      await updateDoc(docRef, editBuffer);
      setEditingId(null);
      setEditBuffer(null);
    } catch (err) {
      console.error("儲存失敗:", err);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBuffer(null);
  };

  const handleDelete = async (id) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'attendance', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("刪除失敗:", err);
    }
  };

  // --- CSV 功能 ---
  const exportCSV = () => {
    const headers = ["姓名", "日期", "上班時間", "下班時間", "休息開始", "休息結束", "工作時數", "休息時數"];
    const rows = records.map(r => {
      const stats = calculateDailyStats(r);
      return [r.name, r.date, r.startTime, r.endTime, r.breakStart, r.breakEnd, secondsToTime(stats.workSec), secondsToTime(stats.breakSec)];
    });
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `工時紀錄_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  // --- 統計數據 ---
  const personMonthlyStats = useMemo(() => {
    const filtered = records.filter(r => r.date.startsWith(selectedMonth));
    return STAFF_OPTIONS.map(staff => {
      const staffRecords = filtered.filter(r => r.name === staff.name);
      let totalWorkSec = 0, totalBreakSec = 0;
      staffRecords.forEach(r => {
        const { workSec, breakSec } = calculateDailyStats(r);
        totalWorkSec += workSec;
        totalBreakSec += breakSec;
      });
      return { ...staff, work: secondsToTime(totalWorkSec), break: secondsToTime(totalBreakSec), count: staffRecords.length };
    });
  }, [records, selectedMonth]);

  if (!user) return <div className="min-h-screen bg-slate-50 flex items-center justify-center animate-pulse">載入中...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans overflow-x-auto">
      <div className="max-w-[1600px] min-w-[1200px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Clock className="text-blue-600" /> 工時管理系統 v2.0
            </h1>
            <p className="text-slate-500 text-sm mt-1">智慧同步模式：按下打卡後清單資料將自動更新</p>
          </div>
          <button onClick={exportCSV} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all font-bold shadow-lg shadow-blue-100">
            <Download size={18} /> 匯出 CSV 報表
          </button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          
          {/* 左側：控制面板 */}
          <div className="col-span-3 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-3">
                <LogIn size={20} className="text-blue-600" /> 快速同步打卡
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">人員</label>
                    <select 
                      className="w-full p-2 bg-slate-100 border-none rounded-lg font-bold focus:ring-2 focus:ring-blue-500"
                      value={quickSelect.name}
                      onChange={(e) => setQuickSelect({...quickSelect, name: e.target.value})}
                    >
                      {STAFF_OPTIONS.map(opt => <option key={opt.name} value={opt.name}>{opt.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase">日期</label>
                    <input 
                      type="date"
                      className="w-full p-2 bg-slate-100 border-none rounded-lg text-sm"
                      value={quickSelect.date}
                      onChange={(e) => setQuickSelect({...quickSelect, date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button onClick={() => handleQuickClock('startTime')} className="flex flex-col items-center p-3 rounded-xl border border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all">
                    <LogIn size={22} className="mb-1" />
                    <span className="text-sm font-bold">上班</span>
                  </button>
                  <button onClick={() => handleQuickClock('endTime')} className="flex flex-col items-center p-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all">
                    <LogOut size={22} className="mb-1" />
                    <span className="text-sm font-bold">下班</span>
                  </button>
                  <button onClick={() => handleQuickClock('breakStart')} className="flex flex-col items-center p-3 rounded-xl border border-amber-100 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all">
                    <Coffee size={22} className="mb-1" />
                    <span className="text-sm font-bold">休息始</span>
                  </button>
                  <button onClick={() => handleQuickClock('breakEnd')} className="flex flex-col items-center p-3 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all">
                    <Play size={22} className="mb-1" />
                    <span className="text-sm font-bold">休息終</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center italic mt-2 italic">※ 點擊後，清單內對應日期的時間會立即跳動更新</p>
              </div>
            </div>

            {/* 月統計 */}
            <div className="bg-slate-900 p-6 rounded-2xl shadow-lg text-white">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Users size={20} className="text-blue-400" /> 每人月統計
                </h2>
                <input 
                  type="month"
                  className="bg-slate-800 border-none text-white text-[10px] rounded p-1 outline-none"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <div className="space-y-4">
                {personMonthlyStats.map(stat => (
                  <div key={stat.name} className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-black text-lg">{stat.name}</span>
                      <span className="text-[10px] opacity-50 uppercase tracking-widest">{stat.count} 筆紀錄</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-2 bg-blue-500/10 rounded-lg">
                        <div className="text-[9px] opacity-60">總工時</div>
                        <div className="font-mono text-blue-400 font-bold">{stat.work}</div>
                      </div>
                      <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <div className="text-[9px] opacity-60">總休息</div>
                        <div className="font-mono text-emerald-400 font-bold">{stat.break}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右側：打卡紀錄清單 */}
          <div className="col-span-9">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-xl font-black text-slate-800">打卡紀錄與工時清單</h2>
                <span className="text-xs text-slate-400">所有時間點皆可點擊右側鉛筆進行手動微調</span>
              </div>
              
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 text-[11px] font-black uppercase tracking-widest">
                    <th className="px-6 py-4">日期</th>
                    <th className="px-6 py-4">人員</th>
                    <th className="px-6 py-4">上班時間</th>
                    <th className="px-6 py-4">下班時間</th>
                    <th className="px-6 py-4">休息開始</th>
                    <th className="px-6 py-4">休息結束</th>
                    <th className="px-6 py-4">總工時</th>
                    <th className="px-6 py-4 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r) => {
                    const isEditing = editingId === r.id;
                    const stats = calculateDailyStats(isEditing ? editBuffer : r);
                    const staffColor = STAFF_OPTIONS.find(s => s.name === r.name)?.color || 'bg-slate-100';

                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-slate-700">{r.date}</td>
                        <td className="px-6 py-4">
                          <span className={`px-4 py-1.5 rounded-full text-sm font-black border ${staffColor}`}>
                            {r.name}
                          </span>
                        </td>
                        
                        {/* 時間欄位：正常 vs 編輯模式 */}
                        {['startTime', 'endTime', 'breakStart', 'breakEnd'].map(field => (
                          <td key={field} className="px-6 py-4 font-mono text-sm">
                            {isEditing ? (
                              <input 
                                className="w-24 p-1 border rounded text-center bg-blue-50 focus:ring-2 focus:ring-blue-400 outline-none"
                                value={editBuffer[field]}
                                onChange={(e) => setEditBuffer({...editBuffer, [field]: e.target.value})}
                              />
                            ) : (
                              <span className={field.includes('Time') ? 'text-slate-800 font-bold' : 'text-slate-400 italic'}>
                                {r[field]}
                              </span>
                            )}
                          </td>
                        ))}

                        <td className="px-6 py-4">
                          <span className="bg-slate-800 text-white font-mono px-3 py-1 rounded text-sm font-bold">
                            {secondsToTime(stats.workSec)}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {isEditing ? (
                              <>
                                <button onClick={saveEdit} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-full" title="儲存">
                                  <Check size={18} />
                                </button>
                                <button onClick={cancelEdit} className="p-2 text-slate-400 hover:bg-slate-50 rounded-full" title="取消">
                                  <X size={18} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEditing(r)} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
                                  <Edit2 size={16} />
                                </button>
                                <button onClick={() => handleDelete(r.id)} className="p-2 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all">
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {records.length === 0 && <div className="p-20 text-center text-slate-400 italic">目前尚無資料，請從左側開始打卡</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
