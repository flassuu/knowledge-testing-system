<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { listUsers, setUserStatus, createUser } from '../../api/users'
import { ApiError } from '../../api/client'
import type { PublicUser, UserRole, UserStatus } from '../../api/types'

const { t } = useI18n()

const users = ref<PublicUser[]>([])
const loading = ref(false)
const errorKey = ref('')
const query = ref('')
const roleFilter = ref<'all' | UserRole>('all')
const statusFilter = ref<'all' | UserStatus>('all')
const busyId = ref('')
const showCreateForm = ref(false)
const creating = ref(false)
const formError = ref('')
const form = ref({ username: '', password: '', fullName: '' })

const roleBadgeClass: Record<UserRole, string> = {
  admin: 'bg-violet-100 text-violet-700',
  teacher: 'bg-sky-100 text-sky-700',
  student: 'bg-amber-100 text-amber-700',
}

const statusBadgeClass: Record<UserStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  blocked: 'bg-rose-50 text-rose-700',
}

async function load() {
  loading.value = true
  errorKey.value = ''
  try {
    users.value = await listUsers({
      role: roleFilter.value === 'all' ? undefined : roleFilter.value,
      status: statusFilter.value === 'all' ? undefined : statusFilter.value,
      q: query.value.trim() || undefined,
    })
  } catch (error) {
    errorKey.value = error instanceof ApiError ? error.code : ''
  } finally {
    loading.value = false
  }
}

async function changeStatus(user: PublicUser, status: UserStatus) {
  busyId.value = user.id
  try {
    await setUserStatus(user.id, status)
    await load()
  } finally {
    busyId.value = ''
  }
}

async function createTeacher() {
  formError.value = ''
  const username = form.value.username.trim()
  const fullName = form.value.fullName.trim()
  if (!fullName) {
    formError.value = t('auth.form.fullNameRequired')
    return
  }
  if (username.length < 3) {
    formError.value = t('auth.form.usernameTooShort')
    return
  }
  if (form.value.password.length < 8) {
    formError.value = t('auth.form.passwordMin')
    return
  }
  creating.value = true
  try {
    await createUser({ username, password: form.value.password, fullName })
    showCreateForm.value = false
    form.value = { username: '', password: '', fullName: '' }
    await load()
  } catch (error) {
    if (error instanceof ApiError) {
      formError.value =
        error.code === 'CONFLICT'
          ? t('auth.errors.usernameTaken')
          : error.code === 'NETWORK'
            ? t('auth.errors.network')
            : t('auth.errors.generic')
    } else {
      formError.value = t('auth.errors.generic')
    }
  } finally {
    creating.value = false
  }
}

onMounted(load)
watch([query, roleFilter, statusFilter], () => void load())
</script>

<template>
  <section>
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        v-model="query"
        type="search"
        :placeholder="t('admin.searchPlaceholder')"
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 sm:max-w-56"
      />
      <select
        v-model="roleFilter"
        class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
      >
        <option value="all">{{ t('admin.anyRole') }}</option>
        <option value="student">{{ t('role.student') }}</option>
        <option value="teacher">{{ t('role.teacher') }}</option>
        <option value="admin">{{ t('role.admin') }}</option>
      </select>
      <select
        v-model="statusFilter"
        class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
      >
        <option value="all">{{ t('admin.anyStatus') }}</option>
        <option value="pending">{{ t('admin.status.pending') }}</option>
        <option value="approved">{{ t('admin.status.approved') }}</option>
        <option value="blocked">{{ t('admin.status.blocked') }}</option>
      </select>
      <button
        type="button"
        @click="load"
        class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
      >
        {{ t('admin.refresh') }}
      </button>
      <button
        type="button"
        @click="showCreateForm = !showCreateForm"
        class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        {{ t('admin.newTeacher') }}
      </button>
    </div>

    <form
      v-if="showCreateForm"
      class="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      @submit.prevent="createTeacher"
    >
      <h3 class="text-sm font-semibold text-slate-700">
        {{ t('admin.teacherForm.title') }}
      </h3>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          v-model="form.fullName"
          type="text"
          required
          :placeholder="t('admin.teacherForm.fullName')"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <input
          v-model="form.username"
          type="text"
          required
          autocomplete="username"
          :placeholder="t('admin.teacherForm.username')"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
        <input
          v-model="form.password"
          type="password"
          required
          autocomplete="new-password"
          :placeholder="t('admin.teacherForm.password')"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 sm:col-span-2"
        />
      </div>
      <p v-if="formError" role="alert" class="mt-3 text-sm text-rose-700">
        {{ formError }}
      </p>
      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          @click="showCreateForm = false; formError = ''"
          class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          {{ t('admin.cancel') }}
        </button>
        <button
          type="submit"
          :disabled="creating"
          class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
        >
          {{ t('admin.teacherForm.create') }}
        </button>
      </div>
    </form>

    <p
      v-if="errorKey"
      role="alert"
      class="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
    >
      {{ errorKey === 'NETWORK' ? t('auth.errors.network') : t('auth.errors.generic') }}
    </p>

    <p v-else-if="loading" class="mt-6 text-center text-sm text-slate-400">
      {{ t('common.loading') }}
    </p>

    <div v-else-if="users.length === 0" class="mt-6 text-center text-sm text-slate-400">
      {{ t('admin.empty') }}
    </div>

    <ul v-else class="mt-4 space-y-2">
      <li
        v-for="user in users"
        :key="user.id"
        class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="truncate text-sm font-semibold text-slate-800">
              {{ user.fullName }}
            </p>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="roleBadgeClass[user.role]"
            >
              {{ t(`role.${user.role}`) }}
            </span>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              :class="statusBadgeClass[user.status]"
            >
              {{ t(`admin.status.${user.status}`) }}
            </span>
          </div>
          <p class="mt-0.5 text-xs text-slate-400">@{{ user.username }}</p>
        </div>

        <div
          v-if="user.role !== 'admin'"
          class="flex shrink-0 items-center gap-2"
        >
          <button
            v-if="user.status !== 'approved'"
            type="button"
            :disabled="busyId === user.id"
            @click="changeStatus(user, 'approved')"
            class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-60"
          >
            {{ t('admin.approve') }}
          </button>
          <button
            v-if="user.status !== 'blocked'"
            type="button"
            :disabled="busyId === user.id"
            @click="changeStatus(user, 'blocked')"
            class="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
          >
            {{ t('admin.block') }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>