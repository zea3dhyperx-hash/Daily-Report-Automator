
import React, { useState, useEffect, useRef } from 'react';
import { User, DailyReport, TaskRow, PlanningTask } from '../types.ts';
import { dbService } from '../services/db.ts';
import { parseTaskWithAI } from '../services/openai.ts';
import { format, differenceInMinutes } from 'date-fns';
import { 
  ArrowLeft, Check, Copy, Play, Square, Trash2, 
  ChevronDown, History, Sparkles, Database, CheckCircle, Eye,
  ExternalLink, Info, MousePointer2, Plus, Calendar, Download, Palette, Type as FontIcon,
  X, ChevronRight, BookmarkPlus, BookmarkX, Sun, Moon, PlusSquare
} from 'lucide-react';

interface ReportEditorProps {
  user: User;
  report: DailyReport;
  onClose: () => void;
  onUpdateUser: (user: User) => void;
}

const DEFAULT_COLOR_SUGGESTIONS = [
  { name: 'Plain', color: 'white' },
  { name: 'Green', color: '#70ad47' },
  { name: 'Blue', color: '#4472c4' },
  { name: 'Orange', color: '#ed7d31' },
  { name: 'Red', color: '#c00000' }
];

const ReportEditor: React.FC<ReportEditorProps> = ({ user, report, onClose, onUpdateUser }) => {
  const [localReport, setLocalReport] = useState<DailyReport>({
    ...report,
    preText: report.preText || `Hi Team,\n\nPlease find my work report for ${report.date}:`,
    postText: report.postText || `Best Regards,\n${user.name}\nEmp ID: ${user.employeeId}`,
    planningTasks: report.planningTasks || [],
    themeColor: report.themeColor || '#70ad47',
    isPlainTheme: report.isPlainTheme || false
  });
  const [taskInput, setTaskInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showFinishPopup, setShowFinishPopup] = useState(false);
  const [showContinueMenu, setShowContinueMenu] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSelectedReport, setImportSelectedReport] = useState<DailyReport | null>(null);
  const [historyReports, setHistoryReports] = useState<DailyReport[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'info'} | null>(null);
  const [showPasteGuide, setShowPasteGuide] = useState(false);

  const syncTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    setIsSaving(true);
    syncTimeoutRef.current = window.setTimeout(async () => {
      await dbService.saveReport(localReport);
      setIsSaving(false);
    }, 500);
    return () => { if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current); };
  }, [localReport]);

  useEffect(() => {
    const fetchHistory = async () => {
      const data = await dbService.getReports(user.id);
      setHistoryReports(data.filter(r => r.id !== localReport.id));
    };
    fetchHistory();
  }, [user.id, localReport.id]);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleToggleTheme = async () => {
    const newTheme = user.theme === 'dark' ? 'light' : 'dark';
    const updatedUser = { ...user, theme: newTheme };
    await dbService.updateUser(updatedUser);
    onUpdateUser(updatedUser);
  };

  const handleSaveColor = async () => {
    const currentColor = localReport.themeColor;
    if (!currentColor || currentColor === 'white') return;
    
    const currentSaved = user.savedColors || [];
    if (currentSaved.includes(currentColor)) {
      showToast("Color already in library", "info");
      return;
    }

    const updatedUser = {
      ...user,
      savedColors: [...currentSaved, currentColor]
    };
    
    await dbService.updateUser(updatedUser);
    onUpdateUser(updatedUser);
    showToast("Color saved to your account");
  };

  const handleDeleteColor = async (colorToDelete: string) => {
    const updatedUser = {
      ...user,
      savedColors: (user.savedColors || []).filter(c => c !== colorToDelete)
    };
    await dbService.updateUser(updatedUser);
    onUpdateUser(updatedUser);
    showToast("Color removed");
  };

  const calculateWorkingHours = (start: string, end: string): string => {
    if (!start || !end) return '0.00';
    try {
      const startTime = new Date(`2000-01-01T${start}`);
      const endTime = new Date(`2000-01-01T${end}`);
      let diff = differenceInMinutes(endTime, startTime);
      if (diff < 0) diff += 24 * 60; 
      return (diff / 60).toFixed(2);
    } catch { return '0.00'; }
  };

  const handleStartTask = async (taskData?: Partial<TaskRow>) => {
    const now = format(new Date(), 'HH:mm');
    const updatedTasks = localReport.tasks.map(task => 
      task.isRunning ? { 
        ...task, 
        isRunning: false, 
        endTime: now, 
        workingHours: calculateWorkingHours(task.startTime, now) 
      } : task
    );

    const newTask: TaskRow = {
      id: crypto.randomUUID(),
      date: localReport.date,
      day: localReport.day,
      projectName: taskData?.projectName || 'New Project',
      projectType: taskData?.projectType || 'General',
      assignedBy: taskData?.assignedBy || 'Self',
      employeeName: user.name,
      employeeId: user.employeeId,
      teamName: user.teamName,
      startTime: now,
      endTime: '',
      workingHours: '0.00',
      remarks: taskData?.remarks || '',
      isRunning: true,
    };

    setLocalReport({ ...localReport, tasks: [...updatedTasks, newTask] });
    setTaskInput('');
    setShowContinueMenu(false);
  };

  const handleAddPlanningRow = () => {
    const newPlanningTask: PlanningTask = {
      id: crypto.randomUUID(),
      label: "Next Working Day Task",
      description: ''
    };
    setLocalReport({
      ...localReport,
      planningTasks: [...(localReport.planningTasks || []), newPlanningTask]
    });
    showToast('Next Working Day row added');
  };

  const processWithAI = async () => {
    if (!taskInput.trim()) return;
    setIsLoadingAI(true);
    try {
      const result = await parseTaskWithAI(taskInput);
      await handleStartTask(result);
      showToast('Task added via AI');
    } catch (error) {
      console.error('AI Processing Error:', error);
      showToast('AI failed. Adding generic task.', 'info');
      await handleStartTask({ projectName: taskInput });
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleImportSingleTask = (task: TaskRow) => {
    const imported: TaskRow = {
      ...task,
      id: crypto.randomUUID(),
      date: localReport.date,
      day: localReport.day,
      isRunning: false,
      startTime: '09:00',
      endTime: '09:00',
      workingHours: '0.00'
    };
    setLocalReport({ ...localReport, tasks: [...localReport.tasks, imported] });
    showToast(`Imported: ${task.projectName}`);
  };

  const handleStopTask = (id: string) => {
    const now = format(new Date(), 'HH:mm');
    setLocalReport(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.id === id) {
          const hours = calculateWorkingHours(t.startTime, now);
          return { ...t, isRunning: false, endTime: now, workingHours: hours };
        }
        return t;
      })
    }));
    showToast('Task Stopped');
  };

  const handleEditRow = (id: string, field: keyof TaskRow, value: any) => {
    setLocalReport(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.id === id) {
          const updated = { ...t, [field]: value } as any;
          if (field === 'startTime' || field === 'endTime') {
            updated.workingHours = calculateWorkingHours(updated.startTime, updated.endTime);
          }
          return updated as TaskRow;
        }
        return t;
      })
    }));
  };

  const handleEditPlanningRow = (id: string, field: keyof PlanningTask, value: string) => {
    setLocalReport(prev => ({
      ...prev,
      planningTasks: (prev.planningTasks || []).map(p => p.id === id ? { ...p, [field]: value } : p)
    }));
  };

  const generateFullReportHtml = () => {
    const isPlain = localReport.isPlainTheme;
    const themeColor = localReport.themeColor || '#70ad47';
    const headBg = isPlain ? 'white' : themeColor;
    const headText = isPlain ? 'black' : 'white';
    const rowBg = isPlain ? 'white' : '#f8fafc';
    const borderColor = isPlain ? '#000000' : '#e2e8f0';

    const preHtml = (localReport.preText || '').replace(/\n/g, '<br/>');
    const postHtml = (localReport.postText || '').replace(/\n/g, '<br/>');

    const taskRows = localReport.tasks.map(t => `
      <tr style="background-color: ${rowBg};">
        <td style="border: 1px solid ${borderColor}; padding: 12px; white-space: nowrap !important; font-size: 16px;">${t.date}</td>
        <td style="border: 1px solid ${borderColor}; padding: 12px; white-space: nowrap !important; font-size: 16px;">${t.day}</td>
        <td style="border: 1px solid ${borderColor}; padding: 12px; font-weight: bold; white-space: nowrap !important; font-size: 16px;">${t.projectName}</td>
        <td style="border: 1px solid ${borderColor}; padding: 12px; white-space: nowrap !important; font-size: 16px;">${t.projectType}</td>
        <td style="border: 1px solid ${borderColor}; padding: 12px; white-space: nowrap !important; font-size: 16px;">${t.assignedBy}</td>
        <td style="border: 1px solid ${borderColor}; padding: 12px; white-space: nowrap !important; font-size: 16px;">${t.employeeName}</td>
        <td style="border: 1px solid ${borderColor}; padding: 12px; white-space: nowrap !important; font-size: 16px;">${t.employeeId}</td>
        <td style="border: 1px solid ${borderColor}; padding: 12px; white-space: nowrap !important; font-size: 16px;">${t.teamName}</td>
        <td style="border: 1px solid ${borderColor}; padding: 12px; text-align: center; white-space: nowrap !important; font-size: 16px;">${t.startTime}</td>
        <td style="border: 1px solid ${borderColor}; padding: 12px; text-align: center; white-space: nowrap !important; font-size: 16px;">${t.endTime}</td>
        <td style="border: 1px solid ${borderColor}; padding: 12px; text-align: center; font-weight: 900; color: #4f46e5; white-space: nowrap !important; font-size: 16px;">${t.workingHours}</td>
        <td style="border: 1px solid ${borderColor}; padding: 12px; white-space: nowrap !important; font-size: 16px;">${t.remarks || '-'}</td>
      </tr>
    `).join('');

    const planningRows = (localReport.planningTasks || []).map(p => `
      <tr>
        <td colspan="2" style="border: 1px solid ${borderColor}; padding: 12px; font-weight: bold; background-color: ${isPlain ? 'white' : '#f1f5f9'}; width: 1px; white-space: nowrap; font-size: 16px;">${p.label}</td>
        <td colspan="10" style="border: 1px solid ${borderColor}; padding: 12px; line-height: 1.5; background-color: ${rowBg}; font-size: 16px;">${p.description.replace(/\n/g, '<br/>')}</td>
      </tr>
    `).join('');

    return `
      <html><body>
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; line-height: 1.6; font-size: 16px;">
        <p style="margin: 0 0 20px 0;">${preHtml}</p>
        <table style="border-collapse: collapse; margin: 24px 0; font-size: 16px; border: 1px solid ${borderColor}; width: 100%;">
          <thead>
            <tr style="background-color: ${headBg}; color: ${headText};">
              <th style="border: 1px solid ${borderColor}; padding: 12px; text-align: left; white-space: nowrap !important; font-weight: bold;">Date</th>
              <th style="border: 1px solid ${borderColor}; padding: 12px; text-align: left; white-space: nowrap !important; font-weight: bold;">Day</th>
              <th style="border: 1px solid ${borderColor}; padding: 12px; text-align: left; white-space: nowrap !important; font-weight: bold;">Project Name</th>
              <th style="border: 1px solid ${borderColor}; padding: 12px; text-align: left; white-space: nowrap !important; font-weight: bold;">Project Type</th>
              <th style="border: 1px solid ${borderColor}; padding: 12px; text-align: left; white-space: nowrap !important; font-weight: bold;">Assigned by</th>
              <th style="border: 1px solid ${borderColor}; padding: 12px; text-align: left; white-space: nowrap !important; font-weight: bold;">Employee Name</th>
              <th style="border: 1px solid ${borderColor}; padding: 12px; text-align: left; white-space: nowrap !important; font-weight: bold;">Employee ID</th>
              <th style="border: 1px solid ${borderColor}; padding: 12px; text-align: left; white-space: nowrap !important; font-weight: bold;">Team Name</th>
              <th style="border: 1px solid ${borderColor}; padding: 12px; text-align: center; white-space: nowrap !important; font-weight: bold;">Start Time</th>
              <th style="border: 1px solid ${borderColor}; padding: 12px; text-align: center; white-space: nowrap !important; font-weight: bold;">End Time</th>
              <th style="border: 1px solid ${borderColor}; padding: 12px; text-align: center; font-weight: bold;">Hours</th>
              <th style="border: 1px solid ${borderColor}; padding: 12px; text-align: left; white-space: nowrap !important; font-weight: bold;">Remarks</th>
            </tr>
          </thead>
          <tbody>
            ${taskRows}
            ${planningRows}
          </tbody>
        </table>
        <p style="margin: 20px 0 0 0;">${postHtml}</p>
      </div>
      </body></html>
    `;
  };

  const copyFullReportToClipboard = async () => {
    try {
      const fullHtml = generateFullReportHtml();
      const type = "text/html";
      const blob = new Blob([fullHtml], { type });
      const data = [new ClipboardItem({ [type]: blob })];
      await navigator.clipboard.write(data);
      return true;
    } catch (err) {
      console.error("Clipboard Error:", err);
      return false;
    }
  };

  const handleOutlookDispatch = async () => {
    const to = (user.defaultTo || "").trim();
    if (!to) {
      showToast("Attention: No 'To' recipient email found. Update Dashboard settings first.", "info");
      return;
    }

    const success = await copyFullReportToClipboard();
    if (!success) return;
    
    const cc = (user.defaultCc || "").trim();
    const subject = `Daily Work Report - ${localReport.date} (${user.name})`;
    
    let mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}`;
    if (cc) {
      mailtoUrl += `&cc=${encodeURIComponent(cc)}`;
    }
    
    window.location.href = mailtoUrl;
    setShowPasteGuide(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-300">
      {toast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] px-8 py-4 bg-indigo-600 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5 text-white font-bold">
          <CheckCircle size={20} /> {toast.message}
        </div>
      )}

      {showPasteGuide && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-indigo-950/90 backdrop-blur-md p-6">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-12 max-w-lg w-full text-center shadow-2xl animate-in zoom-in-95 relative overflow-hidden transition-colors">
             <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500"></div>
             <div className="w-20 h-20 bg-indigo-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-8 text-indigo-600 dark:text-indigo-400">
               <MousePointer2 size={40} className="animate-bounce" />
             </div>
             <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 text-slate-800 dark:text-white">Dispatch Successful</h2>
             <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">
               Recipients and Subject are ready. <br/>
               In Outlook, click the message body and press:
             </p>
             <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-3xl inline-flex items-center gap-3 mb-8 transition-colors">
               <kbd className="px-5 py-3 bg-white dark:bg-slate-700 border-b-4 border-slate-300 dark:border-slate-600 rounded-xl font-black text-2xl text-slate-800 dark:text-white">Ctrl</kbd>
               <span className="text-2xl font-black text-slate-400">+</span>
               <kbd className="px-5 py-3 bg-white dark:bg-slate-700 border-b-4 border-slate-300 dark:border-slate-600 rounded-xl font-black text-2xl text-slate-800 dark:text-white">V</kbd>
             </div>
             <button onClick={() => { setShowPasteGuide(false); setShowFinishPopup(false); }} className="w-full py-5 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 shadow-xl transition-all">Finalized</button>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-10 max-w-4xl w-full shadow-2xl max-h-[90vh] flex flex-col overflow-hidden transition-colors">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white flex items-center gap-2">
                <Download className="text-indigo-600 dark:text-indigo-400" /> 
                {importSelectedReport ? 'Select Tasks' : 'Import Previous Reports'}
              </h2>
              <button onClick={() => { setShowImportModal(false); setImportSelectedReport(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all text-slate-400"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              {!importSelectedReport ? (
                <div className="space-y-3">
                  {historyReports.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">No history available</div>
                  ) : historyReports.map(r => (
                    <div key={r.id} onClick={() => setImportSelectedReport(r)} className="p-6 border border-slate-100 dark:border-slate-800 rounded-2xl flex justify-between items-center bg-slate-50 dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400"><Calendar size={20} /></div>
                        <div>
                          <div className="font-black text-slate-700 dark:text-white uppercase text-base">{r.date}</div>
                          <div className="text-base font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{r.tasks.length} Tasks Recorded</div>
                        </div>
                      </div>
                      <ChevronRight className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <button onClick={() => setImportSelectedReport(null)} className="mb-4 text-indigo-600 dark:text-indigo-400 font-black uppercase text-base tracking-widest flex items-center gap-2"><ArrowLeft size={14} /> Back to Reports List</button>
                  <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 transition-colors">
                    <h3 className="font-black text-slate-700 dark:text-white uppercase text-base mb-4">Tasks from {importSelectedReport.date}</h3>
                    <div className="space-y-2">
                      {importSelectedReport.tasks.map(t => (
                        <div key={t.id} className="bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl flex justify-between items-center hover:shadow-md transition-all">
                          <div>
                            <div className="font-black text-slate-800 dark:text-white text-base">{t.projectName}</div>
                            <div className="text-base font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.projectType} • {t.workingHours} hrs</div>
                          </div>
                          <button onClick={() => handleImportSingleTask(t)} className="p-3 bg-indigo-50 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white transition-all active:scale-90"><Plus size={18} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-6 py-4 shadow-sm flex items-center justify-between transition-colors">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500 dark:text-slate-400"><ArrowLeft size={22} /></button>
          <div>
            <h1 className="font-black text-lg text-slate-800 dark:text-white uppercase tracking-tighter">{localReport.date}</h1>
            <div className="flex items-center gap-2 text-base">
              <span className="font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{localReport.day}</span>
              <span className={`flex items-center gap-1 font-bold uppercase tracking-widest ${isSaving ? 'text-slate-400 animate-pulse' : 'text-emerald-500 dark:text-emerald-400'}`}>
                <CheckCircle size={10} /> {isSaving ? 'SYNCING...' : 'SAVED'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleToggleTheme} className="p-3 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-2xl transition-all">
            {user.theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
          </button>
          <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black px-5 py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all uppercase tracking-widest text-base"><Download size={14} /> Import Tasks</button>
          <button onClick={() => setShowFinishPopup(true)} className="flex items-center gap-3 bg-indigo-600 text-white font-black px-8 py-4 rounded-xl hover:bg-indigo-700 shadow-xl transition-all uppercase tracking-widest text-base"><Eye size={18} /> Review & Dispatch</button>
        </div>
      </nav>

      <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full space-y-6">
        {/* Two-Line Task Control Area */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-6 transition-colors">
          {/* Line 1: AI Prompt Input */}
          <div className="relative w-full">
            <input 
              className="w-full pl-6 pr-14 py-5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 dark:text-slate-100 text-base transition-all placeholder:text-slate-400" 
              placeholder="Briefly describe your task (e.g. Spent 2 hours on UI design for payment module) - AI will parse into the table" 
              value={taskInput} 
              onChange={e => setTaskInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && processWithAI()} 
            />
            <button 
              onClick={processWithAI} 
              disabled={isLoadingAI || !taskInput.trim()} 
              className="absolute right-3 top-2.5 p-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md active:scale-90 disabled:bg-slate-300 dark:disabled:bg-slate-700"
            >
              {isLoadingAI ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Sparkles size={22} />}
            </button>
          </div>
          
          {/* Line 2: Manual Actions & Utilities */}
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => handleStartTask({})} 
              className="px-6 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest text-base rounded-2xl hover:bg-indigo-700 flex items-center gap-2 transition-all shadow-lg active:scale-95"
            >
              <PlusSquare size={20} /> New Task (Manual)
            </button>
            <button 
              onClick={handleAddPlanningRow} 
              className="px-6 py-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest text-base rounded-2xl hover:bg-emerald-100 dark:hover:bg-emerald-900/40 flex items-center gap-2 transition-all border border-emerald-100 dark:border-emerald-900/30 active:scale-95"
            >
              <Plus size={20} /> Add Next Day Plan
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowContinueMenu(!showContinueMenu)} 
                className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase tracking-widest text-base rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-2 transition-all active:scale-95"
              >
                <History size={20} /> Recent Projects <ChevronDown size={14} />
              </button>
              {showContinueMenu && (
                <div className="absolute top-full mt-2 left-0 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-3 space-y-1 animate-in slide-in-from-top-2 transition-colors">
                  <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 border-b border-slate-100 dark:border-slate-700">Quick Start Project</div>
                  {Array.from(new Set(localReport.tasks.map(t => t.projectName))).length > 0 ? (
                    Array.from(new Set(localReport.tasks.map(t => t.projectName))).map(p => (
                      <button key={p} onClick={() => handleStartTask(localReport.tasks.find(t => t.projectName === p))} className="w-full text-left px-4 py-3 text-base font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-xl transition-all truncate">{p}</button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-slate-400 text-sm font-bold italic">No recent projects found</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[2400px]">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-base">
                <tr>
                  <th className="px-6 py-5 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date</th>
                  <th className="px-4 py-5 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Day</th>
                  <th className="px-6 py-5 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Project Name</th>
                  <th className="px-4 py-5 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Project Type</th>
                  <th className="px-4 py-5 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Assigned by</th>
                  <th className="px-4 py-5 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Employee Name</th>
                  <th className="px-4 py-5 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Employee ID</th>
                  <th className="px-4 py-5 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Team Name</th>
                  <th className="px-4 py-5 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Start Time</th>
                  <th className="px-4 py-5 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">End Time</th>
                  <th className="px-4 py-5 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Hours</th>
                  <th className="px-6 py-5 font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Remarks</th>
                  <th className="px-6 py-5 sticky right-0 bg-slate-50 dark:bg-slate-800 shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-base">
                {localReport.tasks.map(t => (
                  <tr key={t.id} className={`${t.isRunning ? 'bg-indigo-50/40 dark:bg-indigo-900/10 animate-pulse' : ''} hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors`}>
                    <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300"><input value={t.date} onChange={e => handleEditRow(t.id, 'date', e.target.value)} className="w-full bg-transparent outline-none text-base" /></td>
                    <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-300"><input value={t.day} onChange={e => handleEditRow(t.id, 'day', e.target.value)} className="w-full bg-transparent outline-none text-base" /></td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-white whitespace-nowrap"><input value={t.projectName} onChange={e => handleEditRow(t.id, 'projectName', e.target.value)} className="w-full bg-transparent outline-none font-black text-base" /></td>
                    <td className="px-4 py-4 font-bold text-slate-600 dark:text-slate-400"><input value={t.projectType} onChange={e => handleEditRow(t.id, 'projectType', e.target.value)} className="w-full bg-transparent outline-none text-base" /></td>
                    <td className="px-4 py-4 font-bold text-slate-600 dark:text-slate-400"><input value={t.assignedBy} onChange={e => handleEditRow(t.id, 'assignedBy', e.target.value)} className="w-full bg-transparent outline-none text-base" /></td>
                    <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-300"><input value={t.employeeName} onChange={e => handleEditRow(t.id, 'employeeName', e.target.value)} className="w-full bg-transparent outline-none text-base" /></td>
                    <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-300"><input value={t.employeeId} onChange={e => handleEditRow(t.id, 'employeeId', e.target.value)} className="w-full bg-transparent outline-none text-base" /></td>
                    <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-300"><input value={t.teamName} onChange={e => handleEditRow(t.id, 'teamName', e.target.value)} className="w-full bg-transparent outline-none text-base" /></td>
                    <td className="px-4 py-4 text-center font-bold dark:text-slate-200"><input type="time" value={t.startTime} onChange={e => handleEditRow(t.id, 'startTime', e.target.value)} className="bg-transparent text-center outline-none text-base" /></td>
                    <td className="px-4 py-4 text-center font-bold dark:text-slate-200"><input type="time" value={t.endTime} onChange={e => handleEditRow(t.id, 'endTime', e.target.value)} className="bg-transparent text-center outline-none text-base" /></td>
                    <td className="px-4 py-4 text-center font-black text-indigo-600 dark:text-indigo-400">{t.workingHours}</td>
                    <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400"><input value={t.remarks} onChange={e => handleEditRow(t.id, 'remarks', e.target.value)} className="w-full bg-transparent outline-none text-base" placeholder="Details..." /></td>
                    <td className="px-6 py-4 sticky right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-[-10px_0_10px_-10px_rgba(0,0,0,0.1)] flex justify-end gap-2 transition-colors">
                      {t.isRunning ? (
                        <button onClick={() => handleStopTask(t.id)} className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 shadow-lg active:scale-95 transition-all"><Square size={16} fill="currentColor"/></button>
                      ) : (
                        <button onClick={() => handleStartTask(t)} className="p-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 shadow-lg active:scale-95 transition-all"><Play size={16} fill="currentColor"/></button>
                      )}
                      <button onClick={() => setLocalReport({ ...localReport, tasks: localReport.tasks.filter(rt => rt.id !== t.id) })} className="p-3 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash2 size={18}/></button>
                    </td>
                  </tr>
                ))}
                {(localReport.planningTasks || []).map(p => (
                  <tr key={p.id} className="bg-emerald-50/20 dark:bg-emerald-900/10 group text-base transition-colors">
                    <td colSpan={2} className="px-6 py-4 w-1 whitespace-nowrap border-r border-slate-100 dark:border-slate-800">
                      <div className="font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-100/50 dark:bg-emerald-800/30 px-3 py-2 rounded-lg inline-block">Next Working Day Task</div>
                    </td>
                    <td colSpan={11} className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <input value={p.description} onChange={e => handleEditPlanningRow(p.id, 'description', e.target.value)} className="w-full bg-transparent font-bold text-slate-700 dark:text-slate-200 outline-none text-base" placeholder="Task description for next working day..." />
                        <button onClick={() => setLocalReport({...localReport, planningTasks: localReport.planningTasks?.filter(rt => rt.id !== p.id)})} className="p-3 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash2 size={18}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showFinishPopup && (
        <div className="fixed inset-0 bg-white dark:bg-slate-950 z-[100] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300 transition-colors">
          <header className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-10 py-6 shrink-0 flex items-center justify-between transition-colors">
            <div className="flex items-center gap-6">
              <button onClick={() => setShowFinishPopup(false)} className="p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl transition-all flex items-center justify-center border border-slate-100 dark:border-slate-700"><ArrowLeft size={24} /></button>
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Dispatch Terminal</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-base font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em] bg-indigo-50 dark:bg-slate-800 px-3 py-1 rounded-lg">Live Professional Preview</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
               <button onClick={handleToggleTheme} className="p-3 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-2xl transition-all">
                  {user.theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
               </button>
               <div className="text-right mr-4 hidden md:block">
                  <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Active Report</div>
                  <div className="text-base font-bold text-slate-700 dark:text-white">{localReport.date}</div>
               </div>
               <button onClick={handleOutlookDispatch} className="bg-indigo-600 text-white font-black px-8 py-4 rounded-2xl hover:bg-indigo-700 shadow-xl transition-all uppercase tracking-widest text-base flex items-center gap-3"><ExternalLink size={20} /> Dispatch Now</button>
            </div>
          </header>
          
          <div className="flex-1 flex min-h-0 bg-white dark:bg-slate-950 transition-colors">
            {/* Split Page Layout - Left: Config */}
            <div className="w-[420px] p-10 space-y-10 overflow-y-auto shrink-0 border-r border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50 flex flex-col transition-colors">
              <div className="space-y-10 flex-1">
                <div>
                  <label className="text-base font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 block px-1">Visual Branding</label>
                  
                  <div className="mb-6">
                    <div className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] mb-3">Core Suggestions</div>
                    <div className="flex flex-wrap gap-3">
                      {DEFAULT_COLOR_SUGGESTIONS.map(s => (
                        <button 
                          key={s.name} 
                          onClick={() => setLocalReport({ ...localReport, themeColor: s.color, isPlainTheme: s.name === 'Plain' })} 
                          className={`w-10 h-10 rounded-xl transition-all border-4 ${localReport.themeColor === s.color && !localReport.isPlainTheme ? 'border-indigo-600 scale-110' : s.name === 'Plain' && localReport.isPlainTheme ? 'border-indigo-600 scale-110' : 'border-white dark:border-slate-700 shadow-sm hover:scale-105'}`} 
                          style={{ backgroundColor: s.name === 'Plain' ? 'white' : s.color }} 
                        />
                      ))}
                    </div>
                  </div>

                  {(user.savedColors || []).length > 0 && (
                    <div className="mb-6">
                      <div className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] mb-3">Your Saved Palette</div>
                      <div className="flex flex-wrap gap-3">
                        {user.savedColors?.map(color => (
                          <div key={color} className="relative group">
                            <button 
                              onClick={() => setLocalReport({ ...localReport, themeColor: color, isPlainTheme: false })} 
                              className={`w-10 h-10 rounded-xl transition-all border-4 ${localReport.themeColor === color && !localReport.isPlainTheme ? 'border-indigo-600 scale-110' : 'border-white dark:border-slate-700 shadow-sm hover:scale-105'}`} 
                              style={{ backgroundColor: color }} 
                            />
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteColor(color); }}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity shadow-lg"
                            >
                              <BookmarkX size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] mb-3">Multi-Color Picker</div>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 via-emerald-500 to-pink-500 flex items-center justify-center text-white cursor-pointer relative shadow-sm hover:scale-105 transition-transform overflow-hidden">
                         <Plus size={20} className="relative z-10 pointer-events-none" />
                         <input type="color" value={localReport.themeColor} onChange={e => setLocalReport({...localReport, themeColor: e.target.value, isPlainTheme: false})} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150" />
                      </div>
                      {localReport.themeColor && localReport.themeColor !== 'white' && !user.savedColors?.includes(localReport.themeColor) && (
                        <button 
                          onClick={handleSaveColor}
                          className="flex-1 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 transition-all flex items-center justify-center gap-2"
                        >
                          <BookmarkPlus size={14} /> Add to Library
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-base font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 block px-1">Greeting Text</label>
                  <textarea className="w-full h-32 p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-base leading-relaxed resize-none text-slate-700 dark:text-slate-200 shadow-sm transition-all" value={localReport.preText} onChange={e => setLocalReport({ ...localReport, preText: e.target.value })} />
                </div>
                <div>
                  <label className="text-base font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 block px-1">Closing Signature</label>
                  <textarea className="w-full h-32 p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-base leading-relaxed resize-none text-slate-700 dark:text-slate-200 shadow-sm transition-all" value={localReport.postText} onChange={e => setLocalReport({ ...localReport, postText: e.target.value })} />
                </div>
              </div>

              <div className="sticky bottom-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md -mx-10 px-10 py-8 space-y-4 border-t border-slate-100 dark:border-slate-800 transition-colors">
                <button onClick={handleOutlookDispatch} className="w-full bg-indigo-600 text-white font-black py-6 rounded-2xl hover:bg-indigo-700 shadow-2xl flex items-center justify-center gap-4 uppercase tracking-widest transition-all group active:scale-95"><ExternalLink size={24} className="group-hover:rotate-12 transition-transform" /> Dispatch Outlook</button>
                <button onClick={async () => { const success = await copyFullReportToClipboard(); if (success) showToast("Rich Table Copied!"); }} className="w-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-black py-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-4 uppercase tracking-widest transition-all"><Copy size={20} /> Copy HTML Table</button>
              </div>
            </div>

            {/* Split Page Layout - Right: Preview */}
            <div className={`flex-1 p-20 overflow-auto border-l transition-colors duration-300 ${user.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="max-w-7xl mx-auto">
                <div className="mt-8">
                  <p className={`mb-10 whitespace-pre-wrap font-bold text-base leading-relaxed ${user.theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{localReport.preText}</p>
                  <div className={`overflow-x-auto my-12 border shadow-2xl rounded-2xl w-full ${user.theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                    <table className="border-collapse text-base w-full">
                      <thead style={{ backgroundColor: localReport.isPlainTheme ? (user.theme === 'dark' ? '#1e293b' : 'white') : localReport.themeColor, color: localReport.isPlainTheme ? (user.theme === 'dark' ? 'white' : 'black') : 'white' }}>
                        <tr className={localReport.isPlainTheme ? (user.theme === 'dark' ? 'border-b border-slate-700' : 'border-b-2 border-black') : ''}>
                          {['Date', 'Day', 'Project Name', 'Project Type', 'Assigned by', 'Employee Name', 'Employee ID', 'Team Name', 'Start Time', 'End Time', 'Hours', 'Remarks'].map(h => (
                            <th key={h} className="p-4 border border-black/5 text-left whitespace-nowrap font-black uppercase tracking-wider">
                              <span className="text-base">{h}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {localReport.tasks.map(t => (
                          <tr key={t.id} style={{ backgroundColor: localReport.isPlainTheme ? (user.theme === 'dark' ? '#0f172a' : 'white') : (user.theme === 'dark' ? '#1e293b' : '#f8fafc') }}>
                            <td className={`p-4 border border-black/5 font-bold whitespace-nowrap text-base ${user.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t.date}</td>
                            <td className={`p-4 border border-black/5 font-bold whitespace-nowrap text-base ${user.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t.day}</td>
                            <td className={`p-4 border border-black/5 font-black whitespace-nowrap text-base ${user.theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{t.projectName}</td>
                            <td className={`p-4 border border-black/5 font-bold whitespace-nowrap text-base ${user.theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t.projectType}</td>
                            <td className={`p-4 border border-black/5 font-bold whitespace-nowrap text-base ${user.theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{t.assignedBy}</td>
                            <td className={`p-4 border border-black/5 font-bold whitespace-nowrap text-base ${user.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t.employeeName}</td>
                            <td className={`p-4 border border-black/5 font-bold whitespace-nowrap text-base ${user.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t.employeeId}</td>
                            <td className={`p-4 border border-black/5 font-bold whitespace-nowrap text-base ${user.theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{t.teamName}</td>
                            <td className={`p-4 border border-black/5 text-center font-black whitespace-nowrap text-base ${user.theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{t.startTime}</td>
                            <td className={`p-4 border border-black/5 text-center font-black whitespace-nowrap text-base ${user.theme === 'dark' ? 'text-slate-100' : 'text-slate-800'}`}>{t.endTime}</td>
                            <td className={`p-4 border border-black/5 text-center font-black whitespace-nowrap text-lg ${user.theme === 'dark' ? 'text-indigo-400' : 'text-indigo-700'}`}>{t.workingHours}</td>
                            <td className={`p-4 border border-black/5 whitespace-nowrap font-medium text-base ${user.theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>{t.remarks || '-'}</td>
                          </tr>
                        ))}
                        {(localReport.planningTasks || []).map(p => (
                          <tr key={p.id}>
                            <td colSpan={2} style={{ border: '1px solid #e2e8f0', padding: '12px', fontWeight: 'bold', backgroundColor: localReport.isPlainTheme ? (user.theme === 'dark' ? '#0f172a' : 'white') : (user.theme === 'dark' ? '#020617' : '#f1f5f9'), color: user.theme === 'dark' ? 'white' : 'black', whiteSpace: 'nowrap', width: '1px', fontSize: '16px' }}>{p.label}</td>
                            <td colSpan={10} style={{ border: '1px solid #e2e8f0', padding: '12px', lineHeight: '1.5', backgroundColor: localReport.isPlainTheme ? (user.theme === 'dark' ? '#0f172a' : 'white') : (user.theme === 'dark' ? '#1e293b' : '#f8fafc'), color: user.theme === 'dark' ? '#cbd5e1' : '#334155', fontSize: '16px' }}>{p.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className={`whitespace-pre-wrap font-bold text-base leading-relaxed mt-12 ${user.theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{localReport.postText}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportEditor;
