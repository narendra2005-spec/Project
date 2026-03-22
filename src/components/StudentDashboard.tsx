import React, { useState, useEffect } from 'react';
import { Browser } from '@capacitor/browser';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Capacitor } from '@capacitor/core';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, getDocs, doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { UserProfile, Group, Note, Deadline, AttendanceSession, AttendanceRecord, Marks, Attachment } from '../types';
import { Clock, FileText, Calendar as CalendarIcon, BarChart3, CheckCircle2, AlertCircle, Search, BookOpen, ExternalLink, Download, File as FileIcon, Image as ImageIcon, Paperclip, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';
import { format, isAfter, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from 'date-fns';
import { CustomSelect } from './CustomSelect';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function StudentDashboard({ user }: { user: UserProfile }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeTab, setActiveTab] = useState<'attendance' | 'notes' | 'deadlines' | 'marks'>('attendance');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'groups'), where('studentIds', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'groups'));

    return () => unsubscribe();
  }, [user.uid]);

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div></div>;

  return (
    <div className="space-y-4 sm:space-y-8">
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        <TabButton active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={<Clock size={18} />} label="Attendance" />
        <TabButton active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} icon={<FileText size={18} />} label="Notes" />
        <TabButton active={activeTab === 'deadlines'} onClick={() => setActiveTab('deadlines')} icon={<CalendarIcon size={18} />} label="Deadlines" />
        <TabButton active={activeTab === 'marks'} onClick={() => setActiveTab('marks')} icon={<BarChart3 size={18} />} label="Marks" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'attendance' && <StudentAttendance user={user} groups={groups} />}
          {activeTab === 'notes' && <StudentNotes user={user} groups={groups} />}
          {activeTab === 'deadlines' && <StudentDeadlines user={user} groups={groups} />}
          {activeTab === 'marks' && <StudentMarks user={user} groups={groups} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-medium transition-all whitespace-nowrap text-sm sm:text-base",
        active ? "bg-zinc-900 text-white shadow-md" : "bg-white text-zinc-500 hover:bg-zinc-100 border border-black/5"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// --- Student Attendance ---
function StudentAttendance({ user, groups }: { user: UserProfile; groups: Group[] }) {
  const [code, setCode] = useState('');
  const [allSessions, setAllSessions] = useState<AttendanceSession[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (groups.length === 0) return;
    
    const groupIds = groups.map(g => g.id);
    const q = query(collection(db, 'attendanceSessions'), where('groupId', 'in', groupIds));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceSession)));
    });

    const recordQuery = query(collection(db, 'attendanceRecords'), where('studentId', '==', user.uid));
    const unsubscribeRecords = onSnapshot(recordQuery, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
    });

    return () => {
      unsubscribe();
      unsubscribeRecords();
    };
  }, [groups, user.uid]);

  const activeSessions = allSessions.filter(s => isAfter(new Date(s.expiresAt), new Date()));

  const submitCode = async () => {
    const session = activeSessions.find(s => s.code === code);
    if (!session) {
      setStatus({ type: 'error', message: 'Invalid or expired code' });
      return;
    }

    const alreadyMarked = records.some(r => r.sessionId === session.id);
    if (alreadyMarked) {
      setStatus({ type: 'error', message: 'Attendance already marked for this session' });
      return;
    }

    try {
      await addDoc(collection(db, 'attendanceRecords'), {
        sessionId: session.id,
        studentId: user.uid,
        groupId: session.groupId,
        timestamp: new Date().toISOString()
      });
      setStatus({ type: 'success', message: 'Attendance marked successfully!' });
      setCode('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'attendanceRecords');
    }
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth))
  });

  const sessionsOnDate = (date: Date) => {
    return allSessions.filter(s => isSameDay(new Date(s.createdAt), date));
  };

  const isPresent = (sessionId: string) => records.some(r => r.sessionId === sessionId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          <div className="bg-white p-4 sm:p-8 rounded-3xl border border-black/5 shadow-sm text-center">
            <h3 className="text-xl font-bold text-zinc-900 mb-6">Mark Attendance</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-2">Enter 6-Digit Code</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-4 bg-zinc-50 border-transparent rounded-2xl text-center text-3xl font-mono font-bold tracking-widest focus:bg-white focus:ring-2 focus:ring-zinc-900 transition-all outline-none"
                />
              </div>
              <button
                disabled={code.length !== 6}
                onClick={submitCode}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-medium disabled:opacity-50 hover:bg-zinc-800 transition-colors"
              >
                Submit Code
              </button>
              {status && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-4 rounded-xl text-sm flex items-center gap-2",
                    status.type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"
                  )}
                >
                  {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {status.message}
                </motion.div>
              )}
            </div>
          </div>

          <div className="bg-zinc-900 text-white p-4 sm:p-8 rounded-3xl shadow-lg text-center">
            <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Active Classes</h4>
            <div className="space-y-3">
              {activeSessions.map(session => {
                const group = groups.find(g => g.id === session.groupId);
                return (
                  <div key={session.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 gap-2">
                    <span className="font-medium truncate min-w-0">{group?.name}</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">Live</span>
                  </div>
                );
              })}
              {activeSessions.length === 0 && <p className="text-zinc-500 text-sm italic">No active sessions</p>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-black/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-center sm:text-left">
              <h3 className="text-xl font-bold text-zinc-900">Attendance Calendar</h3>
              <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-4 w-full sm:w-auto">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <ChevronLeft size={20} />
                </button>
                <span className="font-bold text-zinc-900 min-w-[120px] text-center">
                  {format(currentMonth, 'MMMM yyyy')}
                </span>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-7 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest py-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-zinc-100 border border-zinc-100 rounded-2xl overflow-hidden">
                {days.map((day, i) => {
                  const daySessions = sessionsOnDate(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <div
                      key={i}
                      onClick={() => {
                        setSelectedDate(day);
                        if (sessionsOnDate(day).length > 0) {
                          setShowModal(true);
                        }
                      }}
                      className={cn(
                        "min-h-[80px] sm:min-h-[100px] p-2 bg-white transition-all cursor-pointer hover:bg-zinc-50 relative",
                        !isCurrentMonth && "bg-zinc-50/50 text-zinc-300",
                        isSelected && "ring-2 ring-inset ring-zinc-900 z-10"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <span className={cn(
                          "text-sm font-medium",
                          isToday && "w-6 h-6 bg-zinc-900 text-white rounded-full flex items-center justify-center -mt-0.5 -ml-0.5"
                        )}>
                          {format(day, 'd')}
                        </span>
                      </div>
                      <div className="mt-2" />
                    </div>
                  );
                })}
              </div>

              <AnimatePresence>
                {showModal && selectedDate && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
                    >
                      <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                        <div>
                          <h4 className="text-xl font-bold text-zinc-900">
                            {format(selectedDate, 'MMMM d, yyyy')}
                          </h4>
                          <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-1">
                            Attendance Details
                          </p>
                        </div>
                        <button
                          onClick={() => setShowModal(false)}
                          className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-400 hover:text-zinc-600"
                        >
                          <X size={24} />
                        </button>
                      </div>

                      <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                        {sessionsOnDate(selectedDate).map((session, idx) => {
                          const group = groups.find(g => g.id === session.groupId);
                          const present = isPresent(session.id);
                          const record = records.find(r => r.sessionId === session.id);
                          
                          return (
                            <div key={idx} className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-black/5 hover:border-zinc-200 transition-all">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                                  present ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                                )}>
                                  {present ? <CheckCircle2 size={24} /> : <X size={24} />}
                                </div>
                                <div>
                                  <p className="text-base font-bold text-zinc-900">{group?.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Clock size={12} className="text-zinc-400" />
                                    <p className="text-xs text-zinc-500">
                                      {format(new Date(session.createdAt), 'HH:mm')}
                                      {present && record && ` • Marked at ${format(new Date(record.timestamp), 'HH:mm')}`}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <span className={cn(
                                "px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border",
                                present 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                  : "bg-red-50 text-red-700 border-red-100"
                              )}>
                                {present ? 'Present' : 'Absent'}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="p-6 bg-zinc-50 border-t border-zinc-100">
                        <button
                          onClick={() => setShowModal(false)}
                          className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/20"
                        >
                          Close
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentProfile({ user }: { user: UserProfile }) {
  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 bg-zinc-900 rounded-3xl flex items-center justify-center mb-4">
          <BookOpen className="text-white w-12 h-12" />
        </div>
        <h3 className="text-2xl font-bold text-zinc-900">{user.name}</h3>
        <p className="text-zinc-500 capitalize">{user.role}</p>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="p-4 bg-zinc-50 rounded-2xl border border-black/5">
            <p className="text-xs text-zinc-400 font-bold uppercase mb-1">Email Address</p>
            <p className="font-medium text-zinc-900">{user.email}</p>
          </div>
          <div className="p-4 bg-zinc-50 rounded-2xl border border-black/5">
            <p className="text-xs text-zinc-400 font-bold uppercase mb-1">Student ID / Roll No</p>
            <p className="font-medium text-zinc-900">{user.studentId || 'Not set'}</p>
          </div>
        </div>

        <div className="p-4 bg-zinc-50 rounded-2xl border border-black/5">
          <p className="text-xs text-zinc-400 font-bold uppercase mb-1">Account ID</p>
          <p className="font-mono text-xs text-zinc-500">{user.uid}</p>
        </div>
      </div>
    </div>
  );
}

// --- Student Notes ---
function StudentNotes({ user, groups }: { user: UserProfile; groups: Group[] }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  useEffect(() => {
    if (groups.length === 0) return;
    
    let q;
    if (selectedGroupId) {
      q = query(collection(db, 'notes'), where('groupId', '==', selectedGroupId));
    } else {
      const groupIds = groups.map(g => g.id);
      q = query(collection(db, 'notes'), where('groupId', 'in', groupIds));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sortedNotes = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Note))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotes(sortedNotes);
    });
    return () => unsubscribe();
  }, [groups, selectedGroupId]);

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return <ImageIcon size={20} className="text-blue-500" />;
    if (type.includes('pdf')) return <FileText size={20} className="text-red-500" />;
    if (type.includes('word') || type.includes('officedocument.wordprocessingml')) return <FileIcon size={20} className="text-blue-600" />;
    if (type.includes('presentation') || type.includes('powerpoint')) return <FileIcon size={20} className="text-orange-500" />;
    return <FileIcon size={20} className="text-zinc-400" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>, file: Attachment, fileId: string) => {
    e.preventDefault();
    if (downloadingFileId) return;
    
    setDownloadingFileId(fileId);
    
    // We DO NOT use fl_attachment because it breaks Android Custom Tabs and some native viewers
    const downloadUrl = file.url;
    
    const isPdf = file.type === 'application/pdf' || 
                  downloadUrl.toLowerCase().endsWith('.pdf') || 
                  (file.name && file.name.toLowerCase().endsWith('.pdf'));
    
    try {
      if (Capacitor.isNativePlatform()) {
        // Download directly to device filesystem (bypasses CORS and memory limits)
        // Sanitize filename to prevent filesystem errors
        let fileName = (file.name || `download_${Date.now()}`).replace(/[^a-zA-Z0-9.\-_]/g, '_');
        if (!fileName.toLowerCase().endsWith('.pdf') && isPdf) {
          fileName += '.pdf';
        }
        
        const result = await Filesystem.downloadFile({
          url: downloadUrl,
          path: fileName,
          directory: Directory.Cache
        });
        
        // Get the full path and try to open it natively
        if (result.path) {
          try {
            let filePath = result.path;
            // FileOpener requires the file:// prefix on Android
            if (!filePath.startsWith('file://')) {
              filePath = 'file://' + filePath;
            }
            
            await FileOpener.open({
              filePath: filePath,
              // Force application/pdf for PDFs so Android routes to the correct viewer
              contentType: isPdf ? 'application/pdf' : (file.type || 'application/octet-stream')
            });
          } catch (fileOpenerErr) {
             console.error('FileOpener failed', fileOpenerErr);
             // Fallback to external system browser
             await Browser.open({ url: downloadUrl });
          }
        } else {
          await Browser.open({ url: downloadUrl });
        }
      } else {
        // On web, just open in a new tab
        window.open(downloadUrl, '_blank');
      }
    } catch (downloadErr) {
      console.error('Download failed', downloadErr);
      // Last resort: external system browser
      try {
        await Browser.open({ url: downloadUrl });
      } catch (browserErr) {
        window.open(downloadUrl, '_blank');
      }
    } finally {
      setDownloadingFileId(null);
    }
  };

  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-zinc-900">Class Stream</h3>
          <p className="text-zinc-500 text-sm">View announcements and materials from your faculty</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
            />
          </div>
          <CustomSelect
            value={selectedGroupId}
            onChange={setSelectedGroupId}
            options={[{ value: '', label: 'All Classes' }, ...groups.map(g => ({ value: g.id, label: g.name }))]}
            className="w-full sm:w-48"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredNotes.map(note => {
          const group = groups.find(g => g.id === note.groupId);
          return (
            <motion.div 
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key={note.id} 
              className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-900 font-bold">
                      {group?.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-zinc-900">Faculty</h4>
                        <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full font-bold uppercase">{group?.name}</span>
                      </div>
                      <p className="text-xs text-zinc-400">{format(new Date(note.createdAt), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                  </div>
                </div>

                {note.title && note.title !== 'Announcement' && (
                  <h5 className="text-lg font-bold text-zinc-900 mb-2">{note.title}</h5>
                )}
                
                <div className="text-zinc-600 whitespace-pre-wrap break-words text-sm leading-relaxed mb-6">
                  {note.content}
                </div>

                {/* Attachments */}
                {note.attachments && note.attachments.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {note.attachments.map((file, idx) => (
                      <a 
                        key={idx} 
                        href={file.url} 
                        onClick={(e) => handleDownload(e, file, `${note.id}-${idx}`)}
                        className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-black/5 hover:bg-zinc-100 transition-all group/file gap-2"
                      >
                        <div className="flex items-center gap-3 overflow-hidden min-w-0">
                          <div className="shrink-0">{getFileIcon(file.type)}</div>
                          <div className="truncate min-w-0">
                            <p className="text-sm font-bold truncate text-zinc-900">{file.name}</p>
                            <p className="text-[10px] text-zinc-400 uppercase">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        {downloadingFileId === `${note.id}-${idx}` ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-zinc-900 shrink-0"></div>
                        ) : (
                          <Download size={16} className="text-zinc-400 group-hover/file:text-zinc-900 transition-colors shrink-0" />
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {filteredNotes.length === 0 && (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-zinc-200">
            <BookOpen className="mx-auto text-zinc-200 mb-4" size={48} />
            <p className="text-zinc-400 font-medium">{searchQuery ? 'No announcements match your search.' : 'No announcements yet.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Student Deadlines ---
function StudentDeadlines({ user, groups }: { user: UserProfile; groups: Group[] }) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);

  useEffect(() => {
    if (groups.length === 0) return;
    const groupIds = groups.map(g => g.id);
    const q = query(collection(db, 'deadlines'), where('groupId', 'in', groupIds));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDeadlines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deadline)));
    });
    return () => unsubscribe();
  }, [groups]);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {deadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(deadline => {
        const group = groups.find(g => g.id === deadline.groupId);
        const isOverdue = !isAfter(new Date(deadline.dueDate), new Date());
        
        return (
          <div key={deadline.id} className="bg-white p-4 sm:p-6 rounded-3xl border border-black/5 shadow-sm flex items-center gap-4 sm:gap-6">
            <div className={cn(
              "w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0",
              deadline.type === 'assignment' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
            )}>
              {deadline.type === 'assignment' ? <FileText size={24} /> : <CheckSquare size={24} />}
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{group?.name}</span>
                    <span className="w-1 h-1 bg-zinc-300 rounded-full" />
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest",
                      deadline.type === 'assignment' ? "text-blue-600" : "text-purple-600"
                    )}>{deadline.type}</span>
                  </div>
                  <h4 className="text-xl font-bold text-zinc-900">{deadline.title}</h4>
                </div>
                <div className={cn(
                  "px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl text-center w-fit sm:min-w-[120px]",
                  isOverdue ? "bg-red-50 text-red-600" : "bg-zinc-900 text-white"
                )}>
                  <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-0.5 opacity-60">
                    {isOverdue ? 'Overdue' : 'Due Date'}
                  </div>
                  <div className="text-xs sm:text-sm font-bold">{format(new Date(deadline.dueDate), 'MMM d, HH:mm')}</div>
                </div>
              </div>
              <p className="text-zinc-500 text-sm mt-2">{deadline.description}</p>
            </div>
          </div>
        );
      })}
      {deadlines.length === 0 && (
        <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-zinc-200">
          <CalendarIcon className="mx-auto text-zinc-200 mb-4" size={48} />
          <p className="text-zinc-400">No upcoming deadlines</p>
        </div>
      )}
    </div>
  );
}

// --- Student Marks ---
function StudentMarks({ user, groups }: { user: UserProfile; groups: Group[] }) {
  const [marks, setMarks] = useState<Marks[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'marks'), where('studentId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMarks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Marks)));
    });
    return () => unsubscribe();
  }, [user.uid]);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {marks.map(mark => (
          <div key={mark.id} className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 border-b border-black/5 bg-zinc-50">
              <h4 className="text-lg font-bold text-zinc-900">{mark.subject}</h4>
              <p className="text-xs text-zinc-400 uppercase tracking-widest font-bold">Internal Assessment</p>
            </div>
            <div className="p-4 sm:p-6 flex-1 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <ScoreCard label="Test 1" score={mark.test1} />
                <ScoreCard label="Test 2" score={mark.test2} />
                <ScoreCard label="Test 3" score={mark.test3} />
              </div>
              <div className="mt-6 pt-6 border-t border-black/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Final Average</div>
                  <div className="text-3xl font-bold text-zinc-900">{mark.average.toFixed(2)}</div>
                </div>
                <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center text-white">
                  <BarChart3 size={24} />
                </div>
              </div>
              <p className="text-[10px] text-zinc-400 italic">* Average of best two scores</p>
            </div>
          </div>
        ))}
      </div>
      {marks.length === 0 && (
        <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-zinc-200">
          <BarChart3 className="mx-auto text-zinc-200 mb-4" size={48} />
          <p className="text-zinc-400">No marks recorded yet</p>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, score }: { label: string; score: number }) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-xl font-mono font-bold text-zinc-900">{score}</div>
    </div>
  );
}

function CheckSquare({ size }: { size: number }) {
  return <CheckCircle2 size={size} />;
}
