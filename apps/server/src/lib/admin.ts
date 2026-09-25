import type { DatabaseSync } from 'node:sqlite'
import type { Database } from './db'
import type { UserStatus } from './users'

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

export interface ParticipationRow {
  course_id: string
  course_title: string
  student_id: string
  username: string
  full_name: string
  student_status: UserStatus
  enrolled_at: string
}

function scalarCount(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as { n: number }
  return Number(row.n)
}

export function tableCounts(db: Database): TableCounts {
  const raw = db.raw
  return {
    users: scalarCount(raw, 'SELECT COUNT(*) AS n FROM users'),
    admins: scalarCount(raw, "SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"),
    teachers: scalarCount(raw, "SELECT COUNT(*) AS n FROM users WHERE role = 'teacher'"),
    students: scalarCount(raw, "SELECT COUNT(*) AS n FROM users WHERE role = 'student'"),
    pendingUsers: scalarCount(raw, "SELECT COUNT(*) AS n FROM users WHERE status = 'pending'"),
    approvedUsers: scalarCount(raw, "SELECT COUNT(*) AS n FROM users WHERE status = 'approved'"),
    blockedUsers: scalarCount(raw, "SELECT COUNT(*) AS n FROM users WHERE status = 'blocked'"),
    tests: scalarCount(raw, 'SELECT COUNT(*) AS n FROM tests'),
    questions: scalarCount(raw, 'SELECT COUNT(*) AS n FROM questions'),
    courses: scalarCount(raw, 'SELECT COUNT(*) AS n FROM courses'),
    enrollments: scalarCount(raw, 'SELECT COUNT(*) AS n FROM course_enrollments'),
    materials: scalarCount(raw, 'SELECT COUNT(*) AS n FROM materials'),
  }
}

export function listParticipants(db: Database): ParticipationRow[] {
  const rows = db.raw
    .prepare(
      `SELECT c.id AS course_id, c.title AS course_title,
              u.id AS student_id, u.username, u.full_name, u.status AS student_status,
              e.enrolled_at AS enrolled_at
       FROM course_enrollments e
       JOIN courses c ON c.id = e.course_id
       JOIN users u ON u.id = e.user_id
       ORDER BY c.title ASC, e.enrolled_at ASC`,
    )
    .all() as unknown as ParticipationRow[]
  return rows
}