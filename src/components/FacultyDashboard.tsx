import React, { useState, useEffect, useMemo } from 'react';
import { Browser } from '@capacitor/browser';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Capacitor } from '@capacitor/core';
import { Share as CapacitorShare } from '@capacitor/share';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { UserProfile, Group, Note, Deadline, AttendanceSession, Marks, Attachment } from '../types';
import { Users, Plus, BookOpen, Clock, CheckSquare, BarChart3, Trash2, UserPlus, X, Send, Calendar as CalendarIcon, AlertCircle, FileText, Paperclip, File as FileIcon, Image as ImageIcon, Download, ExternalLink, MoreVertical, User, Search, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';
import { format, addMinutes, isAfter, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval } from 'date-fns';
import { CustomSelect } from './CustomSelect';
import { ChevronLeft, ChevronRight, FileDown, Share } from 'lucide-react';

export default function FacultyDashboard({ user }: { user: UserProfile }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [allStudents, setAllStudents] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'groups' | 'attendance' | 'notes' | 'deadlines' | 'marks' | 'system'>('groups');
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = user.email === 'narendraga2005@gmail.com' || user.email === 'narendraf@gmail.com';

  useEffect(() => {
    const q = query(collection(db, 'groups'), where('facultyId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'groups'));

    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllStudents(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    return () => unsubscribe();
  }, []);

  // Global Cleanup: Removed in favor of targeted cleanup in GroupsManager for better performance
  
  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900"></div></div>;

  return (
    <div className="space-y-4 sm:space-y-8">
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        <TabButton active={activeTab === 'groups'} onClick={() => setActiveTab('groups')} icon={<Users size={18} />} label="Groups" />
        <TabButton active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={<Clock size={18} />} label="Attendance" />
        <TabButton active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} icon={<FileText size={18} />} label="Notes" />
        <TabButton active={activeTab === 'deadlines'} onClick={() => setActiveTab('deadlines')} icon={<CalendarIcon size={18} />} label="Deadlines" />
        <TabButton active={activeTab === 'marks'} onClick={() => setActiveTab('marks')} icon={<BarChart3 size={18} />} label="Marks" />
        {isSuperAdmin && (
          <TabButton active={activeTab === 'system'} onClick={() => setActiveTab('system')} icon={<AlertCircle size={18} />} label="Admin" />
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'groups' && <GroupsManager user={user} groups={groups} allStudents={allStudents} />}
          {activeTab === 'attendance' && <AttendanceManager user={user} groups={groups} allStudents={allStudents} />}
          {activeTab === 'notes' && <NotesManager user={user} groups={groups} />}
          {activeTab === 'deadlines' && <DeadlinesManager user={user} groups={groups} />}
          {activeTab === 'marks' && <MarksManager user={user} groups={groups} allStudents={allStudents} />}
          {activeTab === 'system' && isSuperAdmin && <SystemManager allStudents={allStudents} currentUser={user} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function FacultyProfile({ user }: { user: UserProfile }) {
  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
      <div className="flex flex-col items-center mb-8">
        <div className="w-24 h-24 bg-zinc-900 rounded-3xl flex items-center justify-center mb-4">
          <Users className="text-white w-12 h-12" />
        </div>
        <h3 className="text-2xl font-bold text-zinc-900">{user.name}</h3>
        <p className="text-zinc-500 capitalize">{user.role}</p>
      </div>

      <div className="space-y-6">
        <div className="p-4 bg-zinc-50 rounded-2xl border border-black/5">
          <p className="text-xs text-zinc-400 font-bold uppercase mb-1">Email Address</p>
          <p className="font-medium text-zinc-900">{user.email}</p>
        </div>

        <div className="p-4 bg-zinc-50 rounded-2xl border border-black/5">
          <p className="text-xs text-zinc-400 font-bold uppercase mb-1">Account ID</p>
          <p className="font-mono text-xs text-zinc-500">{user.uid}</p>
        </div>
      </div>
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

// --- Groups Manager ---
function GroupsManager({ user, groups, allStudents }: { user: UserProfile; groups: Group[]; allStudents: UserProfile[] }) {
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const departments = useMemo(() => {
    const deps = new Set(allStudents.map(s => s.department).filter(Boolean));
    return ['All Departments', ...Array.from(deps).sort()];
  }, [allStudents]);

  const selectedGroup = groups.find(g => g.id === selectedGroupId) || null;

  // Targeted Cleanup: Self-heal the selected group if ghosts are detected
  useEffect(() => {
    if (!selectedGroup || allStudents.length === 0) return;
    
    const studentUids = new Set(allStudents.map(s => s.uid));
    const validStudentIds = selectedGroup.studentIds.filter(id => studentUids.has(id));
    
    if (validStudentIds.length !== selectedGroup.studentIds.length) {
      updateDoc(doc(db, 'groups', selectedGroup.id), { 
        studentIds: validStudentIds 
      }).catch(err => console.error('Self-healing failed:', err));
    }
  }, [selectedGroupId, allStudents]);

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      await addDoc(collection(db, 'groups'), {
        name: newGroupName,
        facultyId: user.uid,
        studentIds: [],
        createdAt: new Date().toISOString()
      });
      setNewGroupName('');
      setIsCreating(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'groups');
    }
  };

  const toggleStudentInGroup = async (group: Group, studentUid: string) => {
    const isMember = group.studentIds.includes(studentUid);
    const newStudentIds = isMember 
      ? group.studentIds.filter(id => id !== studentUid)
      : [...group.studentIds, studentUid];
    
    try {
      await updateDoc(doc(db, 'groups', group.id), { studentIds: newStudentIds });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${group.id}`);
    }
  };

  const filteredStudents = allStudents.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
      s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(studentSearch.toLowerCase());
    
    const matchesDept = selectedDepartment === 'All Departments' || s.department === selectedDepartment;
    
    return matchesSearch && matchesDept;
  });

  const bulkAddByDepartment = async () => {
    if (!selectedGroup || selectedDepartment === 'All Departments') return;
    
    const studentsInDept = allStudents.filter(s => s.department === selectedDepartment);
    const newStudentIds = Array.from(new Set([...selectedGroup.studentIds, ...studentsInDept.map(s => s.uid)]));
    
    try {
      await updateDoc(doc(db, 'groups', selectedGroup.id), { studentIds: newStudentIds });
      alert(`Added ${studentsInDept.length} students from ${selectedDepartment} to the group.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `groups/${selectedGroup.id}`);
    }
  };

  const groupStudentCount = (group: Group) => {
    return group.studentIds.filter(id => allStudents.some(s => s.uid === id)).length;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
      <div className="lg:col-span-1 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-zinc-900">Your Groups</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={async () => {
                let totalRemoved = 0;
                const studentUids = new Set(allStudents.map(s => s.uid));
                const updatePromises = groups.map(async (group) => {
                  const validStudentIds = group.studentIds.filter(id => studentUids.has(id));
                  if (validStudentIds.length !== group.studentIds.length) {
                    totalRemoved += (group.studentIds.length - validStudentIds.length);
                    await updateDoc(doc(db, 'groups', group.id), { studentIds: validStudentIds });
                  }
                });
                await Promise.all(updatePromises);
                alert(`Cleanup complete! Removed ${totalRemoved} ghost accounts from your groups.`);
              }}
              className="p-2 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 rounded-lg transition-all"
              title="Clean ghost accounts from all your groups"
            >
              <CheckSquare size={20} />
            </button>
            <button 
              onClick={() => setIsCreating(true)}
              className="p-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {isCreating && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-4 rounded-2xl border border-zinc-900/10 shadow-sm space-y-3">
            <input
              autoFocus
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 rounded-lg outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
            />
            <div className="flex gap-2">
              <button onClick={createGroup} className="flex-1 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium">Create</button>
              <button onClick={() => setIsCreating(false)} className="flex-1 py-2 bg-zinc-100 text-zinc-600 rounded-lg text-sm font-medium">Cancel</button>
            </div>
          </motion.div>
        )}

        <div className="space-y-2">
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              className={cn(
                "w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group",
                selectedGroupId === group.id ? "bg-zinc-900 border-zinc-900 text-white" : "bg-white border-black/5 text-zinc-900 hover:border-zinc-900/20"
              )}
            >
              <div>
                <div className="font-semibold">{group.name}</div>
                <div className={cn("text-xs opacity-60", selectedGroupId === group.id ? "text-white" : "text-zinc-500")}>
                  {groupStudentCount(group)} Students
                </div>
              </div>
              <Users size={18} className={cn("opacity-40 group-hover:opacity-100 transition-opacity", selectedGroupId === group.id && "text-white opacity-100")} />
            </button>
          ))}
          {groups.length === 0 && !isCreating && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-zinc-300">
              <Users className="mx-auto text-zinc-300 mb-2" size={32} />
              <p className="text-zinc-400 text-sm">No groups created yet</p>
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        {selectedGroup ? (
          <div className="bg-white rounded-3xl border border-black/5 p-4 sm:p-8 shadow-sm h-full">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-zinc-900">{selectedGroup.name}</h3>
                <p className="text-zinc-500 text-sm">Manage students in this group</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const studentUids = new Set(allStudents.map(s => s.uid));
                    const validStudentIds = selectedGroup.studentIds.filter(id => studentUids.has(id));
                    if (validStudentIds.length !== selectedGroup.studentIds.length) {
                      updateDoc(doc(db, 'groups', selectedGroup.id), { studentIds: validStudentIds })
                        .then(() => alert('Group cleaned successfully! Removed ghost accounts.'))
                        .catch(err => console.error('Cleanup failed:', err));
                    } else {
                      alert('This group is already clean! No ghost accounts found.');
                    }
                  }}
                  className="p-2 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900 rounded-xl transition-all"
                  title="Clean ghost accounts from this group"
                >
                  <CheckSquare size={20} />
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showDeleteConfirm && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full border border-black/5 text-center"
                  >
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Trash2 size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 mb-2">Delete Group?</h3>
                    <p className="text-zinc-500 text-sm mb-8">This will permanently delete the group "{selectedGroup.name}" and all associated data.</p>
                    <div className="flex gap-3">
                      <button 
                        onClick={async () => {
                          try {
                            await deleteDoc(doc(db, 'groups', selectedGroup.id));
                            setSelectedGroupId(null);
                            setShowDeleteConfirm(false);
                          } catch (err) {
                            handleFirestoreError(err, OperationType.DELETE, `groups/${selectedGroup.id}`);
                          }
                        }}
                        className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                      >
                        Delete
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-medium hover:bg-zinc-200 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                  />
                </div>
                <div className="w-full sm:w-48">
                  <CustomSelect
                    value={selectedDepartment}
                    onChange={setSelectedDepartment}
                    options={departments.map(d => ({ value: d!, label: d! }))}
                  />
                </div>
                {selectedDepartment !== 'All Departments' && (
                  <button
                    onClick={bulkAddByDepartment}
                    className="px-4 py-3 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all flex items-center gap-2 whitespace-nowrap"
                  >
                    <UserPlus size={18} />
                    Add All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredStudents.map(student => {
                  const isMember = selectedGroup.studentIds.includes(student.uid);
                  return (
                    <div 
                      key={student.uid}
                      className={cn(
                        "p-4 rounded-2xl border flex items-center justify-between transition-all group/item",
                        isMember ? "border-zinc-900 bg-zinc-50" : "border-black/5 bg-white"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-900 truncate">{student.name}</div>
                        <div className="text-[10px] text-zinc-400 truncate">{student.email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="text-xs text-zinc-500 truncate">{student.studentId}</div>
                          {student.department && (
                            <div className="px-1.5 py-0.5 bg-zinc-100 text-zinc-500 text-[10px] rounded font-bold uppercase tracking-wider">
                              {student.department}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleStudentInGroup(selectedGroup, student.uid)}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            isMember ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                          )}
                        >
                          {isMember ? <X size={16} /> : <Plus size={16} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-zinc-200 text-zinc-400 p-12">
            <Users size={48} className="mb-4 opacity-20" />
            <p>Select a group to manage students</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Attendance Manager ---
function AttendanceManager({ user, groups, allStudents }: { user: UserProfile; groups: Group[]; allStudents: UserProfile[] }) {
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<AttendanceSession[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const studentsInGroup = useMemo(() => {
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return [];
    return allStudents.filter(s => group.studentIds.includes(s.uid));
  }, [selectedGroupId, groups, allStudents]);

  useEffect(() => {
    if (!selectedGroupId) return;
    
    // Fetch sessions for the group
    const q = query(
      collection(db, 'attendanceSessions'), 
      where('groupId', '==', selectedGroupId),
      where('facultyId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceSession));
      setAllSessions(sessions);
      const active = sessions.find(s => isAfter(new Date(s.expiresAt), new Date()));
      setActiveSession(active || null);
    });

    return () => unsubscribe();
  }, [selectedGroupId, user.uid]);

  useEffect(() => {
    if (!activeSession) {
      setRecords([]);
      return;
    }
    const q = query(collection(db, 'attendanceRecords'), where('sessionId', '==', activeSession.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => doc.data()));
    });
    return () => unsubscribe();
  }, [activeSession]);

  const generateCode = async () => {
    if (!selectedGroupId) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = addMinutes(new Date(), 5).toISOString();
    
    try {
      await addDoc(collection(db, 'attendanceSessions'), {
        groupId: selectedGroupId,
        code,
        expiresAt,
        facultyId: user.uid,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'attendanceSessions');
    }
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth))
  });

  const sessionsOnDate = (date: Date) => {
    return allSessions.filter(s => isSameDay(new Date(s.createdAt), date));
  };

  const exportMonthlyReport = async () => {
    if (!selectedGroupId) return;
    setIsExporting(true);
    try {
      const group = groups.find(g => g.id === selectedGroupId);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const monthSessions = allSessions.filter(s => 
        isWithinInterval(new Date(s.createdAt), { start: monthStart, end: monthEnd })
      );

      if (monthSessions.length === 0) {
        alert('No sessions found for this month.');
        setIsExporting(false);
        return;
      }

      // Fetch all records for these sessions in chunks of 30 (Firestore limit)
      const sessionIds = monthSessions.map(s => s.id);
      const allMonthRecords: any[] = [];
      
      for (let i = 0; i < sessionIds.length; i += 30) {
        const chunk = sessionIds.slice(i, i + 30);
        const recordsSnapshot = await getDocs(
          query(collection(db, 'attendanceRecords'), where('sessionId', 'in', chunk))
        );
        allMonthRecords.push(...recordsSnapshot.docs.map(doc => doc.data()));
      }

      // Sort sessions by date
      const sortedSessions = [...monthSessions].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const headers = [
        'Student Name', 
        'Roll Number', 
        ...sortedSessions.map(s => format(new Date(s.createdAt), 'dd/MM HH:mm')),
        '%'
      ];

      const tableData = studentsInGroup.map(student => {
        const studentRecords = allMonthRecords.filter(r => r.studentId === student.uid);
        const sessionStatuses = sortedSessions.map(session => {
          const isPresent = allMonthRecords.some(r => r.sessionId === session.id && r.studentId === student.uid);
          return isPresent ? 'P' : 'A';
        });
        
        const percentage = monthSessions.length > 0 
          ? ((studentRecords.length / monthSessions.length) * 100).toFixed(1) 
          : '0.0';
        
        return [
          student.name,
          student.studentId || 'N/A',
          ...sessionStatuses,
          `${percentage}%`
        ];
      });

      // Generate CSV string
      const csvContent = [
        headers.join(','),
        ...tableData.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const safeGroupName = (group?.name || 'Group').replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const fileName = `Attendance_${safeGroupName}_${format(currentMonth, 'MMM_yyyy')}.csv`;

      if (Capacitor.isNativePlatform()) {
        try {
          const result = await Filesystem.writeFile({
            path: fileName,
            data: csvContent,
            directory: Directory.Cache,
            encoding: Encoding.UTF8
          });
          
          let filePath = result.uri;
          // Ensure file:// prefix for Android FileOpener
          if (filePath && !filePath.startsWith('file://') && !filePath.startsWith('content://')) {
            filePath = 'file://' + filePath;
          }

          try {
            await FileOpener.open({
              filePath: filePath,
              contentType: 'text/csv'
            });
          } catch (openerError) {
            console.error('FileOpener failed, falling back to Share:', openerError);
            // Fallback to native share sheet if no CSV viewer is installed
            await CapacitorShare.share({
              title: 'Attendance Report',
              text: `Attendance report for ${group?.name}`,
              url: filePath,
              dialogTitle: 'Share or Save Report'
            });
          }
        } catch (e: any) {
          console.error('Native export failed:', e);
          alert(`Failed to save or open the file: ${e.message || 'Unknown error'}`);
        }
      } else {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', fileName);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to generate report.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-black/5 shadow-sm">
        <label className="block text-sm font-medium text-zinc-700 mb-3">Select Group to Manage Attendance</label>
        <div className="flex flex-col sm:flex-row gap-4">
          <CustomSelect
            value={selectedGroupId}
            onChange={setSelectedGroupId}
            options={[{ value: '', label: 'Choose a group...' }, ...groups.map(g => ({ value: g.id, label: g.name }))]}
            className="flex-1"
          />
          <div className="flex gap-2">
            <button
              disabled={!selectedGroupId || !!activeSession}
              onClick={generateCode}
              className="flex-1 sm:flex-none px-6 py-3 bg-zinc-900 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Generate Code
            </button>
            <button
              disabled={!selectedGroupId || isExporting}
              onClick={exportMonthlyReport}
              className="flex-1 sm:flex-none px-6 py-3 bg-white border border-black/10 text-zinc-900 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-zinc-50 transition-colors"
            >
              {isExporting ? <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" /> : <FileDown size={18} />}
              Report
            </button>
          </div>
        </div>
      </div>

      {activeSession && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-zinc-900 text-white p-6 sm:p-12 rounded-3xl text-center shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <Clock size={16} />
              Expires at {format(new Date(activeSession.expiresAt), 'HH:mm')}
            </div>
          </div>
          <p className="text-zinc-400 uppercase tracking-widest text-sm font-bold mb-4">Active Attendance Code</p>
          <h2 className="text-7xl font-mono font-bold tracking-tighter mb-4">{activeSession.code}</h2>
          <p className="text-zinc-500 text-sm">Students have 5 minutes to enter this code</p>
          
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8 border-t border-white/10 pt-8">
            <div>
              <div className="text-3xl font-bold">{studentsInGroup.length}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Total Students</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-emerald-400">{records.length}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Present</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-red-400">{studentsInGroup.length - records.length}</div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">Absent</div>
            </div>
          </div>
        </motion.div>
      )}

      {selectedGroupId && (
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
                      if (daySessions.length > 0) {
                        setShowModal(true);
                        setSearchQuery('');
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
                    <div className="mt-2 space-y-1">
                      {daySessions.map((session, idx) => (
                        <div key={idx} className="text-[9px] sm:text-[10px] px-1.5 py-0.5 bg-zinc-100 text-zinc-700 rounded-md font-bold truncate border border-zinc-200">
                          Session {format(new Date(session.createdAt), 'HH:mm')}
                        </div>
                      ))}
                    </div>
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
                    className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
                  >
                    <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                      <div>
                        <h4 className="text-xl font-bold text-zinc-900">
                          {format(selectedDate, 'MMMM d, yyyy')}
                        </h4>
                        <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mt-1">
                          Attendance Verification
                        </p>
                      </div>
                      <button
                        onClick={() => setShowModal(false)}
                        className="p-2 hover:bg-zinc-200 rounded-full transition-colors text-zinc-400 hover:text-zinc-600"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <div className="p-6">
                      <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-zinc-50 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-zinc-900 transition-all outline-none"
                        />
                      </div>

                      <div className="max-h-[50vh] overflow-y-auto space-y-6 custom-scrollbar pr-2">
                        {sessionsOnDate(selectedDate).map((session, idx) => (
                          <div key={idx} className="space-y-4">
                            <div className="flex items-center gap-3 p-3 bg-zinc-900 text-white rounded-2xl">
                              <Clock size={18} />
                              <span className="font-bold">Session at {format(new Date(session.createdAt), 'HH:mm')}</span>
                              <span className="ml-auto text-xs text-zinc-400 font-mono">Code: {session.code}</span>
                            </div>
                            
                            <FacultyAttendanceList 
                              session={session} 
                              students={studentsInGroup} 
                              searchQuery={searchQuery} 
                            />
                          </div>
                        ))}
                      </div>
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
      )}

      {!selectedGroupId && (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-zinc-200 text-center text-zinc-400">
          <Clock size={48} className="mx-auto mb-4 opacity-20" />
          <p>Select a group to view attendance calendar</p>
        </div>
      )}
    </div>
  );
}

function FacultyAttendanceList({ session, students, searchQuery }: { session: AttendanceSession; students: UserProfile[]; searchQuery: string }) {
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'attendanceRecords'), where('sessionId', '==', session.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => doc.data()));
    });
    return () => unsubscribe();
  }, [session.id]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return students.filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.studentId && s.studentId.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [students, searchQuery]);

  if (!searchQuery.trim()) {
    return (
      <div className="text-center py-4 text-zinc-400 text-sm italic">
        Enter a name or roll number to check attendance
      </div>
    );
  }

  if (filteredStudents.length === 0) {
    return (
      <div className="text-center py-4 text-zinc-400 text-sm">
        No students found matching "{searchQuery}"
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredStudents.map(student => {
        const present = records.some(r => r.studentId === student.uid);
        return (
          <div key={student.uid} className="flex items-center justify-between p-3 bg-white rounded-xl border border-black/5">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                present ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
              )}>
                {present ? <CheckCircle2 size={16} /> : <X size={16} />}
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-900">{student.name}</p>
                <p className="text-xs text-zinc-500">{student.studentId || 'No Roll No.'}</p>
              </div>
            </div>
            <span className={cn(
              "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
              present ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            )}>
              {present ? 'Present' : 'Absent'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SessionStats({ session, allStudents, groups }: { session: AttendanceSession; allStudents: UserProfile[]; groups: Group[] }) {
  const [records, setRecords] = useState<any[]>([]);
  
  const studentsInGroup = useMemo(() => {
    const group = groups.find(g => g.id === session.groupId);
    if (!group) return [];
    return allStudents.filter(s => group.studentIds.includes(s.uid));
  }, [session.groupId, groups, allStudents]);

  useEffect(() => {
    const q = query(collection(db, 'attendanceRecords'), where('sessionId', '==', session.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => doc.data()));
    });
    return () => unsubscribe();
  }, [session.id]);

  return (
    <div className="grid grid-cols-3 gap-4 text-center">
      <div className="p-2 bg-white rounded-xl border border-black/5">
        <div className="text-lg font-bold text-zinc-900">{studentsInGroup.length}</div>
        <div className="text-[10px] text-zinc-400 uppercase font-bold">Total</div>
      </div>
      <div className="p-2 bg-white rounded-xl border border-black/5">
        <div className="text-lg font-bold text-emerald-600">{records.length}</div>
        <div className="text-[10px] text-zinc-400 uppercase font-bold">Present</div>
      </div>
      <div className="p-2 bg-white rounded-xl border border-black/5">
        <div className="text-lg font-bold text-red-600">{studentsInGroup.length - records.length}</div>
        <div className="text-[10px] text-zinc-400 uppercase font-bold">Absent</div>
      </div>
    </div>
  );
}

// --- Notes Manager ---
function NotesManager({ user, groups }: { user: UserProfile; groups: Group[] }) {
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  const selectedGroup = groups.find(g => g.id === selectedGroupId);

  useEffect(() => {
    if (!selectedGroupId) {
      setNotes([]);
      return;
    }
    const q = query(collection(db, 'notes'), where('groupId', '==', selectedGroupId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sortedNotes = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Note))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotes(sortedNotes);
    });
    return () => unsubscribe();
  }, [selectedGroupId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      const validFiles = newFiles.filter(file => {
        // Increased limit to 50MB since we are using Firebase Cloud Storage
        if (file.size > 50 * 1024 * 1024) {
          console.error(`File ${file.name} is too large. Maximum size is 50MB.`);
          return false;
        }
        return true;
      });
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const postNote = async () => {
    if ((!newNote.title && !newNote.content && files.length === 0) || !selectedGroupId) return;
    setUploading(true);
    setUploadError(null);
    try {
      // Upload files to Firebase Storage
      const uploadPromises = files.map(async (file) => {
        // Sanitize filename for storage path
        const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileRef = ref(storage, `notes/${selectedGroupId}/${Date.now()}_${safeFileName}`);
        
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        
        return {
          name: file.name,
          url: url,
          type: file.type,
          size: file.size
        };
      });

      const uploadedAttachments = await Promise.all(uploadPromises);

      await addDoc(collection(db, 'notes'), {
        title: newNote.title || 'Announcement',
        content: newNote.content,
        groupId: selectedGroupId,
        facultyId: user.uid,
        createdAt: new Date().toISOString(),
        attachments: uploadedAttachments
      });

      setNewNote({ title: '', content: '' });
      setFiles([]);
      setIsPosting(false);
    } catch (err) {
      console.error('Failed to post note:', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to post note. Please try again.');
    } finally {
      setUploading(false);
    }
  };

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
      {/* Header / Group Selector */}
      <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-zinc-900">{selectedGroup ? selectedGroup.name : 'Class Stream'}</h3>
          <p className="text-zinc-500 text-sm">Share materials and announcements with your students</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {selectedGroupId && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border-transparent rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
              />
            </div>
          )}
          <CustomSelect
            value={selectedGroupId}
            onChange={setSelectedGroupId}
            options={[{ value: '', label: 'Select a group...' }, ...groups.map(g => ({ value: g.id, label: g.name }))]}
            className="w-full sm:w-64"
          />
        </div>
      </div>

      {selectedGroupId && (
        <div className="space-y-6">
          {/* Post Box */}
          {!isPosting ? (
            <button
              onClick={() => setIsPosting(true)}
              className="w-full p-4 bg-white rounded-2xl border border-black/5 shadow-sm flex items-center gap-4 hover:bg-zinc-50 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-zinc-200 transition-colors">
                <Plus size={20} />
              </div>
              <span className="text-zinc-400 font-medium">Announce something to your class...</span>
            </button>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: -20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="bg-white p-6 rounded-3xl border border-zinc-900/10 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-zinc-900">New Announcement</h4>
                <button onClick={() => { setIsPosting(false); setUploadError(null); }} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                  <X size={20} className="text-zinc-400" />
                </button>
              </div>
              
              {uploadError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-red-600 text-sm">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <p>{uploadError}</p>
                </div>
              )}
              
              <input
                type="text"
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                className="w-full px-4 py-3 bg-zinc-50 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-medium"
              />
              
              <textarea
                rows={4}
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                className="w-full px-4 py-3 bg-zinc-50 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all resize-none"
              />

              {/* File Preview */}
              {files.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-black/5 gap-2">
                      <div className="flex items-center gap-3 overflow-hidden min-w-0">
                        <div className="shrink-0">{getFileIcon(file.type)}</div>
                        <div className="truncate min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-[10px] text-zinc-400 uppercase">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <button onClick={() => removeFile(idx)} className="p-1 hover:bg-zinc-200 rounded-md transition-colors shrink-0">
                        <X size={14} className="text-zinc-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                <div className="flex items-center gap-2">
                  <label className="p-2 hover:bg-zinc-100 rounded-full transition-all cursor-pointer text-zinc-500 hover:text-zinc-900" title="Attach files">
                    <Paperclip size={20} />
                    <input type="file" multiple className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setIsPosting(false); setUploadError(null); }} 
                    className="px-6 py-2 text-zinc-500 font-bold hover:bg-zinc-100 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={postNote} 
                    disabled={uploading || (!newNote.content && files.length === 0)}
                    className={cn(
                      "px-8 py-2 rounded-xl font-bold transition-all shadow-md flex items-center gap-2",
                      uploading ? "bg-zinc-100 text-zinc-400" : "bg-zinc-900 text-white hover:bg-zinc-800"
                    )}
                  >
                    {uploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                        {files.length > 0 ? 'Uploading...' : 'Posting...'}
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        Post
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Feed */}
          <div className="space-y-4">
            {filteredNotes.map(note => (
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
                      <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-white font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-900">{user.name}</h4>
                        <p className="text-xs text-zinc-400">{format(new Date(note.createdAt), 'MMM d, yyyy HH:mm')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => deleteDoc(doc(db, 'notes', note.id))}
                        className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
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
            ))}

            {filteredNotes.length === 0 && !isPosting && (
              <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-zinc-200">
                <FileText className="mx-auto text-zinc-200 mb-4" size={48} />
                <p className="text-zinc-400 font-medium">
                  {searchQuery ? 'No announcements match your search.' : 'No announcements yet. Start the conversation!'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedGroupId && (
        <div className="text-center py-32 bg-white rounded-[2.5rem] border border-dashed border-zinc-200">
          <BookOpen className="mx-auto text-zinc-100 mb-6" size={80} />
          <h3 className="text-xl font-bold text-zinc-900 mb-2">Welcome to Class Stream</h3>
          <p className="text-zinc-400 max-w-xs mx-auto">Select a group from the dropdown above to view and share materials.</p>
        </div>
      )}
    </div>
  );
}

// --- Deadlines Manager ---
function DeadlinesManager({ user, groups }: { user: UserProfile; groups: Group[] }) {
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newDeadline, setNewDeadline] = useState({ title: '', description: '', dueDate: '', type: 'assignment' as 'assignment' | 'experiment' });

  useEffect(() => {
    if (!selectedGroupId) {
      setDeadlines([]);
      return;
    }
    const q = query(collection(db, 'deadlines'), where('groupId', '==', selectedGroupId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDeadlines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deadline)));
    });
    return () => unsubscribe();
  }, [selectedGroupId]);

  const createDeadline = async () => {
    if (!newDeadline.title || !newDeadline.dueDate || !selectedGroupId) return;
    try {
      await addDoc(collection(db, 'deadlines'), {
        ...newDeadline,
        groupId: selectedGroupId,
        facultyId: user.uid,
        createdAt: new Date().toISOString()
      });
      setNewDeadline({ title: '', description: '', dueDate: '', type: 'assignment' });
      setIsCreating(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'deadlines');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-black/5 shadow-sm">
          <label className="block text-sm font-medium text-zinc-700 mb-3">Select Group</label>
          <CustomSelect
            value={selectedGroupId}
            onChange={setSelectedGroupId}
            options={[{ value: '', label: 'Choose a group...' }, ...groups.map(g => ({ value: g.id, label: g.name }))]}
          />
        </div>

        {selectedGroupId && (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors"
          >
            <Plus size={20} />
            Add Deadline
          </button>
        )}
      </div>

      <div className="lg:col-span-2 space-y-4">
        {isCreating && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-4 sm:p-8 rounded-3xl border border-zinc-900/10 shadow-lg space-y-4">
            <h4 className="text-xl font-bold text-zinc-900">New Deadline</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={newDeadline.title}
                  onChange={(e) => setNewDeadline({ ...newDeadline, title: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 ml-1">Type</label>
                <CustomSelect
                  value={newDeadline.type}
                  onChange={(val) => setNewDeadline({ ...newDeadline, type: val as any })}
                  options={[
                    { value: 'assignment', label: 'Assignment' },
                    { value: 'experiment', label: 'Experiment' }
                  ]}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase mb-1 ml-1">Due Date</label>
                <input
                  type="datetime-local"
                  value={newDeadline.dueDate}
                  onChange={(e) => setNewDeadline({ ...newDeadline, dueDate: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
                />
              </div>
              <div className="sm:col-span-2">
                <textarea
                  rows={3}
                  value={newDeadline.description}
                  onChange={(e) => setNewDeadline({ ...newDeadline, description: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-50 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all resize-none"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={createDeadline} className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-medium">Create Deadline</button>
              <button onClick={() => setIsCreating(false)} className="px-6 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-medium">Cancel</button>
            </div>
          </motion.div>
        )}

        <div className="space-y-4">
          {deadlines.map(deadline => (
            <div key={deadline.id} className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm flex items-center gap-6 group">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
                deadline.type === 'assignment' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
              )}>
                {deadline.type === 'assignment' ? <FileText size={24} /> : <CheckSquare size={24} />}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-bold text-zinc-900">{deadline.title}</h4>
                    <p className="text-sm text-zinc-500">{deadline.description}</p>
                  </div>
                  <button 
                    onClick={() => deleteDoc(doc(db, 'deadlines', deadline.id))}
                    className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                    <Clock size={14} />
                    Due {format(new Date(deadline.dueDate), 'MMM d, yyyy HH:mm')}
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                    deadline.type === 'assignment' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                  )}>
                    {deadline.type}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {selectedGroupId && deadlines.length === 0 && !isCreating && (
            <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-zinc-200">
              <CalendarIcon className="mx-auto text-zinc-200 mb-4" size={48} />
              <p className="text-zinc-400">No deadlines set for this group</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Marks Manager ---
function MarksManager({ user, groups, allStudents }: { user: UserProfile; groups: Group[]; allStudents: UserProfile[] }) {
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [marks, setMarks] = useState<Marks[]>([]);
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [editMarks, setEditMarks] = useState({ test1: 0, test2: 0, test3: 0 });

  const students = useMemo(() => {
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return [];
    return allStudents.filter(s => group.studentIds.includes(s.uid));
  }, [selectedGroupId, groups, allStudents]);

  useEffect(() => {
    if (!selectedGroupId) return;
    
    const marksQuery = query(collection(db, 'marks'), where('groupId', '==', selectedGroupId));
    const unsubscribe = onSnapshot(marksQuery, (snapshot) => {
      setMarks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Marks)));
    });
    return () => unsubscribe();
  }, [selectedGroupId]);

  const saveMarks = async (closeModal = true) => {
    if (!editingStudent || !selectedGroupId) return;
    
    const scores = [editMarks.test1, editMarks.test2, editMarks.test3].sort((a, b) => b - a);
    const average = (scores[0] + scores[1]) / 2;

    const existingMark = marks.find(m => m.studentId === editingStudent.uid);
    const group = groups.find(g => g.id === selectedGroupId);

    const markData = {
      studentId: editingStudent.uid,
      groupId: selectedGroupId,
      subject: group?.name || '',
      ...editMarks,
      average,
      facultyId: user.uid,
      updatedAt: new Date().toISOString()
    };

    try {
      if (existingMark) {
        await updateDoc(doc(db, 'marks', existingMark.id), markData);
      } else {
        await addDoc(collection(db, 'marks'), markData);
      }
      
      if (closeModal) {
        setEditingStudent(null);
      } else {
        // Find next student
        const currentIndex = students.findIndex(s => s.uid === editingStudent.uid);
        const nextStudent = students[currentIndex + 1];
        if (nextStudent) {
          const nextMarks = marks.find(m => m.studentId === nextStudent.uid);
          setEditingStudent(nextStudent);
          setEditMarks({
            test1: nextMarks?.test1 || 0,
            test2: nextMarks?.test2 || 0,
            test3: nextMarks?.test3 || 0,
          });
        } else {
          setEditingStudent(null);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'marks');
    }
  };

  const currentAverage = useMemo(() => {
    const scores = [editMarks.test1, editMarks.test2, editMarks.test3].sort((a, b) => b - a);
    return (scores[0] + scores[1]) / 2;
  }, [editMarks]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-black/5 shadow-sm max-w-md">
        <label className="block text-sm font-medium text-zinc-700 mb-3">Select Group</label>
        <CustomSelect
          value={selectedGroupId}
          onChange={setSelectedGroupId}
          options={[{ value: '', label: 'Choose a group...' }, ...groups.map(g => ({ value: g.id, label: g.name }))]}
        />
      </div>

      {selectedGroupId && (
        <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-zinc-50 border-b border-black/5">
                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider text-center">Test 1</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider text-center">Test 2</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider text-center">Test 3</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-900 uppercase tracking-wider text-center bg-zinc-100/50">Avg (Best 2)</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {students.map(student => {
                const studentMarks = marks.find(m => m.studentId === student.uid);
                return (
                  <tr key={student.uid} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-900">{student.name}</div>
                      <div className="text-[10px] text-zinc-400">{student.email}</div>
                      <div className="text-xs text-zinc-500">{student.studentId}</div>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-sm">{studentMarks?.test1 ?? '-'}</td>
                    <td className="px-6 py-4 text-center font-mono text-sm">{studentMarks?.test2 ?? '-'}</td>
                    <td className="px-6 py-4 text-center font-mono text-sm">{studentMarks?.test3 ?? '-'}</td>
                    <td className="px-6 py-4 text-center font-bold text-zinc-900 bg-zinc-100/30">{studentMarks?.average?.toFixed(2) ?? '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setEditingStudent(student);
                          setEditMarks({
                            test1: studentMarks?.test1 || 0,
                            test2: studentMarks?.test2 || 0,
                            test3: studentMarks?.test3 || 0,
                          });
                        }}
                        className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all"
                      >
                        <Plus size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {students.length === 0 && (
            <div className="p-12 text-center text-zinc-400">No students in this group</div>
          )}
        </div>
      )}

      <AnimatePresence>
        {editingStudent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl max-w-md w-full border border-black/5"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">Enter Marks</h3>
                  <p className="text-zinc-500 text-sm">{editingStudent.name}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-zinc-900">{currentAverage.toFixed(1)}</div>
                  <div className="text-[10px] text-zinc-400 uppercase font-bold">Current Avg</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 mb-8">
                {['test1', 'test2', 'test3'].map((test, i) => (
                  <div key={test}>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1.5 ml-1">Test {i + 1}</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100"
                      value={(editMarks as any)[test]}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setEditMarks({ ...editMarks, [test]: Number(e.target.value) })}
                      className="w-full px-3 py-4 bg-zinc-50 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-mono text-center text-lg font-bold"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={() => saveMarks(false)} 
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm shadow-lg shadow-zinc-200 active:scale-95 transition-all"
                  >
                    Save & Next
                  </button>
                  <button 
                    onClick={() => saveMarks(true)} 
                    className="px-6 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-bold text-sm active:scale-95 transition-all w-full sm:w-auto"
                  >
                    Save
                  </button>
                </div>
                <button 
                  onClick={() => setEditingStudent(null)} 
                  className="w-full py-3 text-zinc-400 font-medium text-sm hover:text-zinc-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- System Manager ---
function SystemManager({ allStudents, currentUser }: { allStudents: UserProfile[]; currentUser: UserProfile }) {
  const [search, setSearch] = useState('');
  const [deletingStudentId, setDeletingStudentId] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<UserProfile | null>(null);
  const [editDept, setEditDept] = useState('');
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ count: number; timestamp: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleFactoryReset = async () => {
    setIsResetting(true);
    try {
      const collections = ['groups', 'marks', 'attendanceSessions', 'attendanceRecords', 'notes', 'deadlines', 'users'];
      
      for (const collName of collections) {
        const snap = await getDocs(collection(db, collName));
        const deletePromises = snap.docs
          .filter(doc => {
            // DO NOT delete the current faculty member's account
            if (collName === 'users' && doc.id === currentUser.uid) return false;
            return true;
          })
          .map(doc => deleteDoc(doc.ref));
        
        await Promise.all(deletePromises);
      }
      
      setShowResetConfirm(false);
      alert('Database reset successful. All data except your account has been cleared.');
      window.location.reload();
    } catch (err) {
      console.error('Factory reset failed:', err);
      alert('Failed to reset database. Check console for details.');
    } finally {
      setIsResetting(false);
    }
  };

  const runCleanup = async () => {
    setIsCleaning(true);
    setCleanupResult(null);
    let removedCount = 0;

    try {
      const groupsSnap = await getDocs(collection(db, 'groups'));
      const studentUids = new Set(allStudents.map(s => s.uid));

      const updatePromises = groupsSnap.docs.map(async (groupDoc) => {
        const groupData = groupDoc.data() as Group;
        const validStudentIds = groupData.studentIds.filter(id => studentUids.has(id));
        
        if (validStudentIds.length !== groupData.studentIds.length) {
          removedCount += (groupData.studentIds.length - validStudentIds.length);
          await updateDoc(doc(db, 'groups', groupDoc.id), { studentIds: validStudentIds });
        }
      });

      await Promise.all(updatePromises);
      setCleanupResult({ count: removedCount, timestamp: new Date().toLocaleTimeString() });
    } catch (err) {
      console.error('Cleanup failed:', err);
    } finally {
      setIsCleaning(false);
    }
  };
  const deleteStudentFromSystem = async (studentUid: string) => {
    try {
      // 1. Delete user document
      await deleteDoc(doc(db, 'users', studentUid));
      
      // 2. Remove from all groups
      const groupsSnap = await getDocs(collection(db, 'groups'));
      const updatePromises = groupsSnap.docs
        .filter(doc => (doc.data() as Group).studentIds.includes(studentUid))
        .map(groupDoc => {
          const newStudentIds = (groupDoc.data() as Group).studentIds.filter(id => id !== studentUid);
          return updateDoc(doc(db, 'groups', groupDoc.id), { studentIds: newStudentIds });
        });
      
      await Promise.all(updatePromises);
      setDeletingStudentId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${studentUid}`);
    }
  };

  const updateStudentDepartment = async () => {
    if (!editingStudent) return;
    try {
      await updateDoc(doc(db, 'users', editingStudent.uid), { department: editDept });
      setEditingStudent(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${editingStudent.uid}`);
    }
  };

  const filtered = allStudents.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.studentId?.toLowerCase().includes(search.toLowerCase()) ||
    s.department?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-4 sm:p-8 rounded-3xl border border-black/5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="text-2xl font-bold text-zinc-900">System Accounts</h3>
            <p className="text-zinc-500 text-sm">Manage all student accounts in the database</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-all flex items-center gap-2"
            >
              <Trash2 size={16} />
              Factory Reset
            </button>
            <button
              onClick={runCleanup}
              disabled={isCleaning}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                isCleaning ? "bg-zinc-100 text-zinc-400" : "bg-zinc-900 text-white hover:bg-zinc-800 shadow-md"
              )}
            >
              <CheckSquare size={16} />
              {isCleaning ? 'Scanning...' : 'Run System Scan'}
            </button>
            <div className="bg-zinc-100 px-4 py-2 rounded-xl text-sm font-bold text-zinc-600">
              {allStudents.length} Total Students
            </div>
          </div>
        </div>

        {cleanupResult && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3 text-emerald-700">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckSquare size={16} />
              </div>
              <div>
                <div className="text-sm font-bold">System Scan Complete</div>
                <div className="text-xs opacity-70">Removed {cleanupResult.count} ghost IDs from groups</div>
              </div>
            </div>
            <div className="text-[10px] font-bold text-emerald-600 uppercase">
              at {cleanupResult.timestamp}
            </div>
          </motion.div>
        )}

        <div className="relative mb-6">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-zinc-50 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(student => (
            <div key={student.uid} className="p-4 rounded-2xl border border-black/5 bg-white flex items-center justify-between group/item">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-zinc-900 truncate">{student.name}</div>
                <div className="text-xs text-zinc-400 truncate">{student.email}</div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="text-[10px] text-zinc-500 font-mono">{student.uid}</div>
                  {student.department ? (
                    <button 
                      onClick={() => {
                        setEditingStudent(student);
                        setEditDept(student.department || '');
                      }}
                      className="px-1.5 py-0.5 bg-zinc-100 text-zinc-500 text-[10px] rounded font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors"
                    >
                      {student.department}
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        setEditingStudent(student);
                        setEditDept('');
                      }}
                      className="text-[10px] text-zinc-400 hover:text-zinc-900 transition-colors"
                    >
                      + Add Dept
                    </button>
                  )}
                </div>
              </div>
              <button
                onClick={() => setDeletingStudentId(student.uid)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover/item:opacity-100"
                title="Permanently delete from database"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-zinc-400">
              No accounts found matching your search
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {editingStudent && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full border border-black/5"
            >
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Update Department</h3>
              <p className="text-zinc-500 text-sm mb-6">Set the department for {editingStudent.name}</p>
              
              <input
                autoFocus
                type="text"
                value={editDept}
                onChange={(e) => setEditDept(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 rounded-xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all mb-6"
              />

              <div className="flex gap-3">
                <button 
                  onClick={updateStudentDepartment}
                  className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
                >
                  Save
                </button>
                <button 
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-medium hover:bg-zinc-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showResetConfirm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] p-10 shadow-2xl max-w-md w-full border border-black/5 text-center"
            >
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-3">Factory Reset?</h3>
              <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                This will <span className="font-bold text-red-600">permanently delete</span> all students, groups, marks, attendance, and notes. 
                <br/><br/>
                Your account will be preserved, but everything else will be wiped to zero. This cannot be undone.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleFactoryReset}
                  disabled={isResetting}
                  className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50"
                >
                  {isResetting ? 'Wiping Database...' : 'Yes, Reset Everything'}
                </button>
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isResetting}
                  className="w-full py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {deletingStudentId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full border border-black/5 text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">Delete Student?</h3>
              <p className="text-zinc-500 text-sm mb-8">This will permanently delete the student from the entire system and remove them from all groups.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => deleteStudentFromSystem(deletingStudentId)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
                <button 
                  onClick={() => setDeletingStudentId(null)}
                  className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-xl font-medium hover:bg-zinc-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
