import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { randomCode } from './codes'
import { nowIso } from './db'

export type ClassroomStatus = 'active' | 'revoked'

export interface ClassroomRow {
  id: string
  owner_id: string
  name: string
  key: string
  status: ClassroomStatus
  course_id: string | null
  created_at: string
  revoked_at: string | null
}

export interface ClassroomMemberRow {
  id: string
  classroom_id: string
  user_id: string
  joined_at: string
}

export interface Classroom {
  id: string
  ownerId: string
  name: string
  key: string
  status: ClassroomStatus
  courseId: string | null
  createdAt: string
  revokedAt: string | null
  membersCount: number
}

/** A student who arrived through a class key. */
export interface ClassroomMember {
  userId: string
  username: string
  fullName: string
  status: string
  joinedAt: string
}

/**
 * What a student is told about a key before typing it into a form: that it is
 * real and who gave it. Deliberately not more - a key holder learns the class
 * name and the teacher's name, nothing else.
 */
export interface ClassPreview {
  className: string
  teacherName: string
}

function toClassroom(row: ClassroomRow, membersCount: number): Classroom {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    key: row.key,
    status: row.status,
    courseId: row.course_id,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    membersCount,
  }
}

/**
 * A key nobody has: 6 characters out of 32, which is about a billion
 * combinations. The uniqueness retry covers the birthday collision anyway,
 * because "two classes share a key" is the one failure a teacher cannot fix.
 */
function allocateKey(db: DatabaseSync): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = randomCode()
    const taken = db.prepare('SELECT 1 FROM classrooms WHERE key = ?').get(code)
    if (!taken) return code
  }
  throw new Error('could not allocate a unique class key')
}

export function createClassroom(
  db: DatabaseSync,
  input: { ownerId: string; name: string; courseId?: string | null },
): Classroom {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO classrooms (id, owner_id, name, key, status, course_id, created_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
  ).run(id, input.ownerId, input.name, allocateKey(db), input.courseId ?? null, nowIso())
  return toClassroom(findClassroomById(db, id) as ClassroomRow, 0)
}

export function findClassroomById(db: DatabaseSync, id: string): ClassroomRow | null {
  const row = db.prepare('SELECT * FROM classrooms WHERE id = ?').get(id)
  // Whole-row cast: node:sqlite types every column as SQLOutputValue, the same
  // way sessions.ts reads its rows.
  return (row as unknown as ClassroomRow | undefined) ?? null
}

/**
 * A key that opens a door, if it does. Revoked keys are treated as unknown on
 * purpose: telling a student "this class was closed" confirms the class exists.
 */
export function findActiveClassroomByKey(db: DatabaseSync, key: string): ClassroomRow | null {
  const row = db
    .prepare("SELECT * FROM classrooms WHERE key = ? AND status = 'active'")
    .get(key)
  return (row as unknown as ClassroomRow | undefined) ?? null
}

/** One class with its member count - what every mutating handler returns. */
export function getClassroom(db: DatabaseSync, id: string): Classroom | null {
  const row = findClassroomById(db, id)
  if (!row) return null
  const count = db
    .prepare('SELECT COUNT(*) AS total FROM classroom_members WHERE classroom_id = ?')
    .get(id) as { total: number }
  return toClassroom(row, count.total)
}

export function listClassrooms(
  db: DatabaseSync,
  ownerId: string | null,
): Classroom[] {
  const rows = (
    ownerId
      ? db.prepare('SELECT * FROM classrooms WHERE owner_id = ? ORDER BY created_at DESC').all(ownerId)
      : db.prepare('SELECT * FROM classrooms ORDER BY created_at DESC').all()
  ) as unknown as ClassroomRow[]
  const count = db.prepare(
    'SELECT COUNT(*) AS total FROM classroom_members WHERE classroom_id = ?',
  )
  return rows.map((row) => toClassroom(row, (count.get(row.id) as { total: number }).total))
}

export function renameClassroom(db: DatabaseSync, id: string, name: string): void {
  db.prepare('UPDATE classrooms SET name = ? WHERE id = ?').run(name, id)
}

/** The course is optional and can change without touching the key. */
export function setClassroomCourse(
  db: DatabaseSync,
  id: string,
  courseId: string | null,
): void {
  db.prepare('UPDATE classrooms SET course_id = ? WHERE id = ?').run(courseId, id)
}

export function revokeClassroom(db: DatabaseSync, id: string): void {
  db.prepare(
    "UPDATE classrooms SET status = 'revoked', revoked_at = ? WHERE id = ?",
  ).run(nowIso(), id)
}

export function regenerateClassroomKey(db: DatabaseSync, id: string): string {
  const key = allocateKey(db)
  db.prepare('UPDATE classrooms SET key = ? WHERE id = ?').run(key, id)
  return key
}

export function deleteClassroom(db: DatabaseSync, id: string): void {
  db.prepare('DELETE FROM classrooms WHERE id = ?').run(id)
}

/**
 * Records that a student arrived through this class. Idempotent: registering
 * twice from the same device is a normal thing to do, and a second row would
 * make the member count lie.
 */
export function addClassroomMember(
  db: DatabaseSync,
  classroomId: string,
  userId: string,
): void {
  db.prepare(
    `INSERT INTO classroom_members (id, classroom_id, user_id, joined_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(classroom_id, user_id) DO NOTHING`,
  ).run(randomUUID(), classroomId, userId, nowIso())
}

export function listClassroomMembers(db: DatabaseSync, classroomId: string): ClassroomMember[] {
  const rows = db
    .prepare(
      `SELECT m.user_id, m.joined_at, u.username, u.full_name, u.status
       FROM classroom_members m JOIN users u ON u.id = m.user_id
       WHERE m.classroom_id = ?
       ORDER BY m.joined_at ASC`,
    )
    .all(classroomId) as Array<{
    user_id: string
    username: string
    full_name: string
    status: string
    joined_at: string
  }>
  return rows.map((row) => ({
    userId: row.user_id,
    username: row.username,
    fullName: row.full_name,
    status: row.status,
    joinedAt: row.joined_at,
  }))
}

export function toClassPreview(db: DatabaseSync, row: ClassroomRow): ClassPreview {
  const teacher = db
    .prepare('SELECT full_name FROM users WHERE id = ?')
    .get(row.owner_id) as { full_name: string } | undefined
  return { className: row.name, teacherName: teacher?.full_name ?? '' }
}