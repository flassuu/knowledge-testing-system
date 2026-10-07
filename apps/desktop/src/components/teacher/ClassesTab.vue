<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CircleCheck,
  Copy,
  KeyRound,
  Plus,
  QrCode,
  RefreshCw,
  Trash2,
  Users,
} from '@lucide/vue'
import { ApiError } from '../../api/client'
import {
  createClassroom,
  deleteClassroom,
  getClassroom,
  listClassrooms,
  regenerateClassKey,
  renameClassroom,
  revokeClassroom,
} from '../../api/classrooms'
import { listCourses } from '../../api/courses'
import type { Classroom, ClassroomMember, CourseSummary } from '../../api/types'
import EmptyState from '../common/EmptyState.vue'
import QrCodeCard from '../common/QrCode.vue'
import SkeletonList from '../common/SkeletonList.vue'
import AppButton from '../../components/common/AppButton.vue'
import AppCard from '../../components/common/AppCard.vue'
import AppInput from '../../components/common/AppInput.vue'
import { useConfirm } from '../../composables/confirm'
import { effectiveBaseUrl, loadSettings } from '../../composables/settings'
import { useToast } from '../../composables/toast'
import { isReachableFromPhone, registrationLink } from '../../utils/links'

/**
 * The teacher's own classes.
 *
 * A class is a key: something a student can type or scan to get an approved
 * account without an admin in the room. Everything on this tab serves that one
 * moment - the key is shown big enough to read from a desk, offered as a QR for
 * the whole room to scan, and replaceable when it has been photographed and left
 * on a wall. Nothing here grants a teacher anything over anybody else.
 */
const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()

const classrooms = ref<Classroom[]>([])
const courses = ref<CourseSummary[]>([])
const loading = ref(true)
const errorKey = ref('')

const members = ref<Record<string, ClassroomMember[]>>({})
const openDetails = ref<string | null>(null)
const showQr = ref<string | null>(null)
const copiedKey = ref<string | null>(null)
const renaming = ref<string | null>(null)
const renameDraft = ref('')

const newName = ref('')
const newCourseId = ref('')
const creating = ref(false)

/** The address a student's phone will be told to open for registration. */
const baseUrl = ref(effectiveBaseUrl())
const baseReachable = computed(() => isReachableFromPhone(baseUrl.value))

async function load(): Promise<void> {
  loading.value = true
  errorKey.value = ''
  try {
    const [list, courseList] = await Promise.all([listClassrooms(), listCourses()])
    classrooms.value = list
    courses.value = courseList
  } catch (error) {
    errorKey.value = error instanceof ApiError ? error.code : ''
  } finally {
    loading.value = false
  }
}

function errorKeyOf(error: unknown): string {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.code === 'NETWORK') return 'network'
  if (error.status === 400) return 'validation'
  return 'generic'
}

function report(error: unknown): void {
  toast.error(t(`teacher.errors.${errorKeyOf(error)}`))
}

async function create(): Promise<void> {
  const name = newName.value.trim()
  if (name === '' || creating.value) return
  creating.value = true
  try {
    await createClassroom({
      name,
      courseId: newCourseId.value === '' ? null : newCourseId.value,
    })
    newName.value = ''
    newCourseId.value = ''
    await load()
  } catch (error) {
    report(error)
  } finally {
    creating.value = false
  }
}

function startRename(classroom: Classroom): void {
  renaming.value = classroom.id
  renameDraft.value = classroom.name
}

async function saveRename(classroom: Classroom): Promise<void> {
  const name = renameDraft.value.trim()
  if (name === '') return
  try {
    await renameClassroom(classroom.id, { name })
    renaming.value = null
    await load()
  } catch (error) {
    report(error)
  }
}

async function toggleDetails(classroom: Classroom): Promise<void> {
  if (openDetails.value === classroom.id) {
    openDetails.value = null
    return
  }
  openDetails.value = classroom.id
  if (members.value[classroom.id]) return
  try {
    const detail = await getClassroom(classroom.id)
    members.value[classroom.id] = detail.members
  } catch (error) {
    report(error)
  }
}

async function newKey(classroom: Classroom): Promise<void> {
  if (!(await confirm({ message: t('teacher.classes.newKeyConfirm') }))) return
  try {
    const key = await regenerateClassKey(classroom.id)
    await load()
    toast.success(t('teacher.classes.newKeyDone', { key }))
  } catch (error) {
    report(error)
  }
}

async function revoke(classroom: Classroom): Promise<void> {
  if (
    !(await confirm({ message: t('teacher.classes.revokeConfirm', { name: classroom.name }) }))
  )
    return
  try {
    await revokeClassroom(classroom.id)
    await load()
  } catch (error) {
    report(error)
  }
}

async function remove(classroom: Classroom): Promise<void> {
  if (
    !(await confirm({ message: t('teacher.classes.deleteConfirm', { name: classroom.name }) }))
  )
    return
  try {
    await deleteClassroom(classroom.id)
    await load()
  } catch (error) {
    report(error)
  }
}

/** Clipboard writes fail in some contexts; the key is on screen either way. */
async function copyKey(classroom: Classroom): Promise<void> {
  try {
    await navigator.clipboard.writeText(classroom.key)
    copiedKey.value = classroom.id
    window.setTimeout(() => {
      if (copiedKey.value === classroom.id) copiedKey.value = null
    }, 1500)
  } catch {
    toast.error(t('teacher.live.copyFailed'))
  }
}

function registrationQr(classroom: Classroom): string {
  return registrationLink(baseUrl.value, classroom.key)
}

function courseTitle(courseId: string | null): string {
  if (courseId === null) return ''
  return courses.value.find((course) => course.id === courseId)?.title ?? ''
}

onMounted(() => {
  void load()
  void loadSettings().then(() => {
    baseUrl.value = effectiveBaseUrl()
  })
})
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-on-surface">{{ t('teacher.classes.title') }}</h3>
        <p class="mt-1 text-xs text-on-surface-variant">
          {{ t('teacher.classes.hint') }}
        </p>
      </div>
      <AppButton variant="secondary" size="sm" :aria-label="t('common.refresh')" @click="load">
        <RefreshCw class="size-4" aria-hidden="true" />
      </AppButton>
    </div>

    <!-- Creating a class -->
    <AppCard as="section">
      <form class="space-y-3" @submit.prevent="create">
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="text-xs font-medium text-on-surface-variant" for="new-class-name">
              {{ t('teacher.classes.name') }}
            </label>
            <AppInput
              id="new-class-name"
              v-model="newName"
              :placeholder="t('teacher.classes.namePlaceholder')"
              class="mt-1"
            />
          </div>
          <div>
            <label class="text-xs font-medium text-on-surface-variant" for="new-class-course">
              {{ t('teacher.classes.course') }}
            </label>
            <!-- Optional: a class can enrol its students into a course on arrival. -->
            <select
              id="new-class-course"
              v-model="newCourseId"
              class="mt-1 w-full rounded-lg border border-outline bg-surface px-3 py-2 text-sm text-on-surface focus:border-primary"
            >
              <option value="">{{ t('teacher.classes.courseNone') }}</option>
              <option v-for="course in courses" :key="course.id" :value="course.id">
                {{ course.title }}
              </option>
            </select>
          </div>
        </div>
        <AppButton
          type="submit"
          variant="primary"
          :disabled="creating || newName.trim() === ''"
        >
          <Plus class="size-4" aria-hidden="true" />
          {{ t('teacher.classes.create') }}
        </AppButton>
      </form>
    </AppCard>

    <p
      v-if="errorKey"
      role="alert"
      class="rounded-lg bg-error-container px-3 py-2 text-sm text-on-error-container"
    >
      {{ t(`teacher.errors.${errorKey === 'NETWORK' ? 'network' : 'generic'}`) }}
    </p>

    <SkeletonList v-else-if="loading" :rows="2" />

    <EmptyState
      v-else-if="classrooms.length === 0"
      :icon="Users"
      :title="t('teacher.classes.emptyTitle')"
      :description="t('teacher.classes.emptyHint')"
    />

    <ul v-else class="space-y-3">
      <li v-for="classroom in classrooms" :key="classroom.id">
        <AppCard as="article">
          <!-- Header: name (or inline rename) and status -->
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div v-if="renaming === classroom.id" class="flex items-center gap-2">
                <AppInput
                  v-model="renameDraft"
                  class="flex-1"
                  :aria-label="t('teacher.classes.rename')"
                  @keyup.enter="saveRename(classroom)"
                />
                <AppButton
                  variant="primary"
                  size="sm"
                  @click="saveRename(classroom)"
                >
                  {{ t('common.save') }}
                </AppButton>
                <AppButton
                  variant="ghost"
                  size="sm"
                  @click="renaming = null"
                >
                  {{ t('common.cancel') }}
                </AppButton>
              </div>
              <template v-else>
                <p class="truncate text-sm font-semibold text-on-surface">
                  {{ classroom.name }}
                </p>
                <div class="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    :class="
                      classroom.status === 'active'
                        ? 'bg-success-container text-on-success-container'
                        : 'bg-surface-container-high text-on-surface-variant'
                    "
                  >
                    {{
                      classroom.status === 'active'
                        ? t('teacher.classes.active')
                        : t('teacher.classes.revoked')
                    }}
                  </span>
                  <span
                    v-if="courseTitle(classroom.courseId)"
                    class="rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant"
                  >
                    {{ courseTitle(classroom.courseId) }}
                  </span>
                  <span class="inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
                    <Users class="size-3" aria-hidden="true" />
                    {{ classroom.membersCount }}
                  </span>
                </div>
              </template>
            </div>
          </div>

          <!-- The key itself: the one thing a student needs -->
          <div class="mt-3 flex items-center gap-2">
            <code
              class="flex h-12 flex-1 items-center justify-center rounded-[var(--radius-control)] bg-surface-container font-mono text-xl font-bold tracking-[0.3em] text-on-surface"
            >
              {{ classroom.key }}
            </code>
            <AppButton
              variant="secondaryMuted"
              size="md"
              :disabled="classroom.status === 'revoked'"
              :aria-label="t('teacher.classes.copyKey')"
              @click="copyKey(classroom)"
            >
              <CircleCheck
                v-if="copiedKey === classroom.id"
                class="size-4"
                aria-hidden="true"
              />
              <Copy v-else class="size-4" aria-hidden="true" />
            </AppButton>
          </div>

          <!-- A QR that scans to the sign-up form with the key filled in -->
          <div v-if="showQr === classroom.id" class="mt-3">
            <QrCodeCard
              :text="registrationQr(classroom)"
              :caption="t('teacher.classes.qrCaption')"
            />
            <p
              v-if="!baseReachable"
              class="mt-2 rounded-[var(--radius-control)] bg-warning-container px-3 py-2 text-xs text-on-warning-container"
            >
              {{ t('teacher.live.unreachableHint') }}
              <span class="font-mono break-all">{{ baseUrl }}</span>
            </p>
          </div>

          <!-- Actions -->
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <AppButton
              variant="secondary"
              size="sm"
              :disabled="classroom.status === 'revoked'"
              :aria-pressed="showQr === classroom.id"
              @click="showQr = showQr === classroom.id ? null : classroom.id"
            >
              <QrCode class="size-3.5" aria-hidden="true" />
              {{ showQr === classroom.id ? t('teacher.classes.hideQr') : t('teacher.classes.showQr') }}
            </AppButton>
            <AppButton
              variant="secondaryPlain"
              size="sm"
              :aria-expanded="openDetails === classroom.id"
              @click="toggleDetails(classroom)"
            >
              <Users class="size-3.5" aria-hidden="true" />
              {{ t('teacher.classes.students') }}
            </AppButton>
            <AppButton
              v-if="renaming !== classroom.id"
              variant="ghost"
              size="sm"
              :disabled="classroom.status === 'revoked'"
              @click="startRename(classroom)"
            >
              {{ t('teacher.classes.rename') }}
            </AppButton>
            <AppButton
              v-if="classroom.status === 'active'"
              variant="secondaryPlain"
              size="sm"
              :aria-label="t('teacher.classes.newKey')"
              :title="t('teacher.classes.newKey')"
              @click="newKey(classroom)"
            >
              <KeyRound class="size-3.5" aria-hidden="true" />
            </AppButton>
            <AppButton
              v-if="classroom.status === 'active'"
              variant="ghost"
              size="sm"
              :disabled="classroom.membersCount > 0"
              :aria-label="t('teacher.classes.revoke')"
              :title="
                classroom.membersCount > 0
                  ? t('teacher.classes.revokeBlocked')
                  : t('teacher.classes.revoke')
              "
              @click="revoke(classroom)"
            >
              {{ t('teacher.classes.revoke') }}
            </AppButton>
            <AppButton
              variant="ghostDanger"
              size="sm"
              :aria-label="t('teacher.classes.delete')"
              @click="remove(classroom)"
            >
              <Trash2 class="size-3.5" aria-hidden="true" />
            </AppButton>
          </div>

          <!-- Members -->
          <div v-if="openDetails === classroom.id" class="mt-3 border-t border-outline-variant pt-3">
            <ul v-if="members[classroom.id]?.length" class="space-y-1.5">
              <li
                v-for="member in members[classroom.id]"
                :key="member.userId"
                class="flex items-center justify-between gap-3 text-sm"
              >
                <span class="min-w-0 truncate text-on-surface">{{ member.fullName }}</span>
                <span class="shrink-0 text-xs text-on-surface-variant">{{ member.username }}</span>
              </li>
            </ul>
            <p v-else class="text-xs text-on-surface-variant">
              {{ t('teacher.classes.noStudents') }}
            </p>
          </div>
        </AppCard>
      </li>
    </ul>
  </section>
</template>