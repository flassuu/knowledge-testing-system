import { apiFetch } from './client'
import type { Classroom, ClassroomDetail, ClassPreview, CreateClassroom } from './types'

/** The signed-in teacher's own classes; an admin sees every class. */
export async function listClassrooms(): Promise<Classroom[]> {
  const result = await apiFetch<{ classrooms: Classroom[] }>('/api/classrooms')
  return result.classrooms
}

export async function getClassroom(id: string): Promise<ClassroomDetail> {
  return apiFetch<ClassroomDetail>(`/api/classrooms/${id}`)
}

export async function createClassroom(
  input: CreateClassroom,
): Promise<Classroom> {
  const result = await apiFetch<{ classroom: Classroom }>('/api/classrooms', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return result.classroom
}

export async function renameClassroom(
  id: string,
  input: { name: string; courseId?: string | null },
): Promise<Classroom> {
  const result = await apiFetch<{ classroom: Classroom }>(`/api/classrooms/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  return result.classroom
}

export async function revokeClassroom(id: string): Promise<Classroom> {
  const result = await apiFetch<{ classroom: Classroom }>(`/api/classrooms/${id}/revoke`, {
    method: 'POST',
  })
  return result.classroom
}

/** A new key for a room whose code was photographed and left on a wall. */
export async function regenerateClassKey(id: string): Promise<string> {
  const result = await apiFetch<{ key: string }>(`/api/classrooms/${id}/key`, {
    method: 'POST',
  })
  return result.key
}

export async function deleteClassroom(id: string): Promise<void> {
  await apiFetch<void>(`/api/classrooms/${id}`, { method: 'DELETE' })
}

/** Public: what a class key leads to, checked before a student types a password. */
export async function previewClassKey(key: string): Promise<ClassPreview> {
  const result = await apiFetch<{ preview: ClassPreview }>(
    `/api/classrooms/preview?key=${encodeURIComponent(key)}`,
  )
  return result.preview
}
