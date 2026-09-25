export type UserRole = 'admin' | 'teacher' | 'student'
export type UserStatus = 'pending' | 'approved' | 'blocked'

export interface PublicUser {
  id: string
  role: UserRole
  status: UserStatus
  username: string
  fullName: string
  createdAt: string
  updatedAt: string
}

export const ROLE_ORDER: UserRole[] = ['student', 'teacher', 'admin']

export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'matching'

export const QUESTION_TYPES: QuestionType[] = [
  'single_choice',
  'multiple_choice',
  'true_false',
  'short_answer',
  'matching',
]

export interface ChoiceOption {
  key: string
  text: string
}

export interface QuestionInput {
  type: QuestionType
  body: string
  points: number
  position: number
  payload: Record<string, unknown>
}

export interface Question {
  id: string
  type: QuestionType
  body: string
  points: number
  position: number
  payload: Record<string, unknown>
}

export interface TestSummary {
  id: string
  ownerId: string
  title: string
  description: string
  timeLimitSec: number | null
  passingPercent: number | null
  questionCount: number
  createdAt: string
  updatedAt: string
}

export interface TestDetails extends Omit<TestSummary, 'questionCount'> {
  questions: Question[]
}

export interface TestInput {
  title: string
  description?: string
  timeLimitSec?: number | null
  passingPercent?: number | null
  questions?: QuestionInput[]
}

export interface CourseSummary {
  id: string
  ownerId: string
  title: string
  description: string
  materialsCount: number
  testsCount: number
  studentsCount: number
  createdAt: string
  updatedAt: string
}

export interface CourseDetails extends CourseSummary {
  materials: Material[]
  tests: Array<{ id: string; title: string }>
  students: Array<{ id: string; username: string; fullName: string }>
}

export interface CourseInput {
  title: string
  description?: string
}

export interface Material {
  id: string
  courseId: string
  title: string
  mimeType: string
  sizeBytes: number
  createdAt: string
}

export interface ParticipationEntry {
  courseId: string
  courseTitle: string
  studentId: string
  username: string
  fullName: string
  status: UserStatus
  enrolledAt: string
}

export interface TableCounts {
  users: number
  admins: number
  teachers: number
  students: number
  pendingUsers: number
  approvedUsers: number
  blockedUsers: number
  tests: number
  questions: number
  courses: number
  enrollments: number
  materials: number
}

export interface SystemStats {
  version: string
  uptimeMs: number
  schemaVersion: number
  database: 'ok' | 'error'
  counts: TableCounts
}