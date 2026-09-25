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