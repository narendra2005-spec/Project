import React, { useEffect, useState, FormEvent } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { UserProfile, Role } from './types';
import { LogIn, LogOut, User, BookOpen, UserPlus, Mail, Lock, AlertCircle, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, notifyUser } from './utils';
import { format, isAfter } from 'date-fns';

// Sub-components
import FacultyDashboard from './components/FacultyDashboard';
import StudentDashboard from './components/StudentDashboard';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [tempUser, setTempUser] = useState<{ uid: string; email: string; name: string } | null>(null);
  const [forceRender, setForceRender] = useState(0);
  
  // Email/Password states
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser(userDoc.data() as UserProfile);
            setShowRoleSelection(false);
          } else {
            setTempUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || name || '',
            });
            setShowRoleSelection(true);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setTempUser(null);
        setShowRoleSelection(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [name]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);
    setLoading(true);

    if (!email.trim()) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage('Password reset email sent. Please check your inbox.');
      notifyUser('Reset Email Sent', 'Please check your inbox for the password reset link.', 'info');
    } catch (err: any) {
      console.error('Reset password error:', err);
      notifyUser('Error', 'Failed to send password reset email.', 'error');
      if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No user found with this email address.');
      } else {
        setError('Failed to send password reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      if (isSignUp) {
        if (!name.trim()) {
          setError('Please enter your name');
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        notifyUser('Account Created', 'Welcome to InClass!', 'success');
        // onAuthStateChanged will handle the rest
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        notifyUser('Signed In', 'Welcome back!', 'success');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const errorCode = err.code;
      
      switch (errorCode) {
        case 'auth/email-already-in-use':
          setError('This email is already registered.');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address.');
          break;
        case 'auth/weak-password':
          setError('Password should be at least 6 characters.');
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Invalid email or password.');
          break;
        default:
          setError('Authentication failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleRoleSelect = async (role: Role, name: string, department: string, studentId?: string) => {
    if (!tempUser) return;
    
    if (role === 'student' && studentId) {
      const q = query(collection(db, 'users'), where('studentId', '==', studentId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        throw new Error('This Roll Number / Student ID is already registered.');
      }
    }

    const newUser: UserProfile = {
      uid: tempUser.uid,
      email: tempUser.email,
      name: name,
      role,
      department,
    };

    if (role === 'student' && studentId) {
      newUser.studentId = studentId;
    }

    try {
      await setDoc(doc(db, 'users', tempUser.uid), newUser);
      setUser(newUser);
      setShowRoleSelection(false);
      setTempUser(null);
      notifyUser('Profile Completed', 'Your profile has been set up successfully.', 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${tempUser.uid}`);
      notifyUser('Error', 'Failed to complete profile setup.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center pt-[calc(env(safe-area-inset-top)+2rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-zinc-900"></div>
      </div>
    );
  }

  if (showRoleSelection && tempUser) {
    return <RoleSelection onSelect={handleRoleSelect} name={tempUser.name} />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center justify-center p-4 pt-[calc(env(safe-area-inset-top)+2rem)]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-black/5 p-6 sm:p-8"
        >
          <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <BookOpen className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-semibold text-zinc-900 mb-2 tracking-tight text-center">InClass</h1>
          <p className="text-zinc-500 mb-8 text-center">Attendance & Notes Management System</p>
          
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          
          {resetMessage && (
            <div className="mb-6 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-xl flex items-center gap-2">
              <AlertCircle size={16} />
              {resetMessage}
            </div>
          )}

          {isForgotPassword ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-4 bg-zinc-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-zinc-900 transition-all outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Send Reset Link'}
              </button>
              <div className="mt-8 pt-6 border-t border-zinc-100 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError(null);
                    setResetMessage(null);
                  }}
                  className="text-zinc-500 hover:text-zinc-900 text-sm font-medium transition-colors"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleAuth} className="space-y-4">
                {isSignUp && (
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full pl-12 pr-4 py-4 bg-zinc-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-zinc-900 transition-all outline-none"
                    />
                  </div>
                )}
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-4 bg-zinc-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-zinc-900 transition-all outline-none"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-4 bg-zinc-100 border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-zinc-900 transition-all outline-none"
                  />
                </div>

                {!isSignUp && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError(null);
                        setResetMessage(null);
                      }}
                      className="text-sm text-zinc-500 hover:text-zinc-900 font-medium transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  {isSignUp ? <UserPlus size={20} /> : <LogIn size={20} />}
                  {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-zinc-100 text-center">
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                  }}
                  className="text-zinc-500 hover:text-zinc-900 text-sm font-medium transition-colors"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] pt-[calc(env(safe-area-inset-top)+1rem)] sm:pt-[calc(env(safe-area-inset-top)+2rem)]">
      <nav className="bg-white border border-black/5 shadow-sm sticky top-[calc(env(safe-area-inset-top)+1rem)] sm:top-[calc(env(safe-area-inset-top)+2rem)] z-50 max-w-7xl mx-4 xl:mx-auto rounded-2xl">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            <div className="flex items-center gap-2">
              <BookOpen className="text-zinc-900 w-6 h-6" />
              <span className="text-xl font-bold tracking-tight text-zinc-900">InClass</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-zinc-900">{user.name}</span>
                <span className="text-xs text-zinc-500 capitalize">{user.role}</span>
              </div>
              <button
                onClick={() => {
                  signOut(auth);
                  notifyUser('Signed Out', 'You have been signed out successfully.', 'info');
                }}
                className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {user.role === 'faculty' ? (
          <FacultyDashboard user={user} />
        ) : (
          <StudentDashboard user={user} />
        )}
      </main>
    </div>
  );
}

function RoleSelection({ onSelect, name: initialName }: { onSelect: (role: Role, name: string, department: string, studentId?: string) => Promise<void>, name: string }) {
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState(initialName);
  const [studentId, setStudentId] = useState('');
  const [department, setDepartment] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!role) return;
    setError('');
    setIsLoading(true);
    try {
      await onSelect(role, name, department, studentId);
    } catch (err: any) {
      setError(err.message || 'An error occurred during setup.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4 pt-[calc(env(safe-area-inset-top)+2rem)]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-black/5 p-8"
      >
        <h2 className="text-2xl font-semibold text-zinc-900 mb-2 tracking-tight">Welcome!</h2>
        <p className="text-zinc-500 mb-8">Please select your role and complete your profile.</p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => setRole('student')}
            className={cn(
              "p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3",
              role === 'student' ? "border-zinc-900 bg-zinc-50" : "border-transparent bg-zinc-100 hover:bg-zinc-200"
            )}
          >
            <User className={cn(role === 'student' ? "text-zinc-900" : "text-zinc-400")} size={32} />
            <span className="font-medium text-zinc-900">Student</span>
          </button>
          <button
            onClick={() => setRole('faculty')}
            className={cn(
              "p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3",
              role === 'faculty' ? "border-zinc-900 bg-zinc-50" : "border-transparent bg-zinc-100 hover:bg-zinc-200"
            )}
          >
            <Users className={cn(role === 'faculty' ? "text-zinc-900" : "text-zinc-400")} size={32} />
            <span className="font-medium text-zinc-900">Faculty</span>
          </button>
        </div>

        {role && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">
                {role === 'faculty' ? 'Faculty Name' : 'Student Name'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-zinc-900 transition-all outline-none"
              />
            </div>
            
            {role === 'student' && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Roll Number / Student ID</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-zinc-900 transition-all outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Department / Branch</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-100 border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-zinc-900 transition-all outline-none"
              />
            </div>
          </motion.div>
        )}

        <button
          disabled={!role || !name.trim() || !department.trim() || (role === 'student' && !studentId.trim()) || isLoading}
          onClick={handleSubmit}
          className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors flex items-center justify-center"
        >
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            'Complete Setup'
          )}
        </button>
      </motion.div>
    </div>
  );
}
