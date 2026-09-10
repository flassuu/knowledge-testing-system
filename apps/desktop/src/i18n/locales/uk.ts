import type en from './en'

const uk: typeof en = {
  app: {
    name: 'Тестування знань — Викладач',
  },
  home: {
    title: 'Застосунок викладача',
    scaffoldNote:
      'Базовий каркас: цей екран перевіряє зв\'язок Tauri ↔ Rust і підключення до API.',
    rustBridge: {
      label: 'Демо містка Rust',
      description: 'Викликає нативну команду Rust через міст Tauri `invoke`.',
      placeholder: 'Введіть ім\'я…',
      button: 'Привітати',
      result: 'Rust каже: {message}',
    },
    server: {
      label: 'Локальний сервер',
      checking: 'Перевірка…',
      online: 'У мережі',
      offline: 'Недоступний',
    },
    nextPhase:
      'Наступний етап: конструктор тестів, керування сесіями та дошка результатів.',
  },
  sum: {
    title: 'Сума двох чисел',
    description: 'Пробне завдання: обчислити суму двох чисел.',
    first: 'Перше число',
    second: 'Друге число',
    button: 'Тест',
    result: '{a} + {b} = {result}',
  },
  common: {
    language: 'Мова',
  },
}

export default uk