<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CheckCircle2, Search } from '@lucide/vue'
import type { TestSummary } from '../../api/types'

const props = withDefaults(
  defineProps<{
    tests: TestSummary[]
    busy?: boolean
  }>(),
  { busy: false },
)

const emit = defineEmits<{ select: [testId: string] }>()

const { t } = useI18n()
const query = ref('')

const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return props.tests
  return props.tests.filter((test) => test.title.toLowerCase().includes(needle))
})
</script>

<template>
  <div class="mt-3">
    <label class="flex items-center gap-2 rounded-lg border border-outline bg-surface px-3 py-1.5 focus-within:border-primary">
      <Search class="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
      <input
        v-model="query"
        type="search"
        :placeholder="t('teacher.courses.attachSearch')"
        class="w-full bg-transparent text-sm outline-none"
      />
    </label>

    <p
      v-if="tests.length === 0"
      class="mt-2 flex items-center gap-1.5 text-xs text-on-surface-variant"
    >
      <CheckCircle2 class="size-3.5" aria-hidden="true" />
      {{ t('teacher.courses.allTestsAttached') }}
    </p>

    <p
      v-else-if="filtered.length === 0"
      class="mt-2 flex items-center gap-1.5 text-xs text-on-surface-variant"
    >
      <Search class="size-3.5" aria-hidden="true" />
      {{ t('teacher.courses.attachNoMatch') }}
    </p>

    <ul v-else class="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
      <li v-for="test in filtered" :key="test.id">
        <button
          type="button"
          :disabled="busy"
          class="flex w-full items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-left transition-opacity hover:bg-surface-container-highest disabled:opacity-60"
          @click="emit('select', test.id)"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold text-on-surface">
              {{ test.title }}
            </span>
            <span class="block text-xs text-on-surface-variant">
              {{ t('teacher.tests.questionCount', { count: test.questionCount }) }}
              <span v-if="test.timeLimitSec">
                · {{ test.timeLimitSec / 60 }} {{ t('teacher.tests.minutes') }}
              </span>
            </span>
          </span>
          <span
            class="shrink-0 rounded-full bg-primary-container px-2 py-0.5 text-[11px] font-semibold text-on-primary-container"
          >
            {{ t('teacher.courses.attach') }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>