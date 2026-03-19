export type Role = 'student' | 'faculty';

export interface UserProfile {
  uid: string;
  email: string;
  role: Role;
  name: string;
  studentId?: string;
  department?: string;
}

export interface Group {
  id: string;
  name: string;
  facultyId: string;
  studentIds: string[];
  createdAt: string;
}

export interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Note {
  id: string;
  groupId: string;
  title: string;
  content: string;
  facultyId: string;
  createdAt: string;
  attachments?: Attachment[];
}

export interface Deadline {
  id: string;
  groupId: string;
  title: string;
  description: string;
  dueDate: string;
  type: 'assignment' | 'experiment';
  facultyId: string;
  createdAt: string;
}

export interface AttendanceSession {
  id: string;
  groupId: string;
  code: string;
  expiresAt: string;
  facultyId: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  groupId: string;
  timestamp: string;
}

export interface Marks {
  id: string;
  studentId: string;
  groupId: string;
  subject: string;
  test1: number;
  test2: number;
  test3: number;
  average: number;
  facultyId: string;
  updatedAt: string;
}

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}
