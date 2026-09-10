import type en from './en'

const uk: typeof en = {
  app: {
    name: 'Тестування знань',
    tagline: 'Офлайн-система тестування в аудиторії',
  },
  home: {
    welcome: 'Вітаємо у студентському клієнті',
    scaffoldNote:
      'Це базовий каркас. Екран входу за кодом з\'явиться на наступному етапі.',
    server: 'Статус сервера',
    serverOnline: 'У мережі',
    serverOffline: 'Недоступний',
  },
  common: {
    language: 'Мова',
    loading: 'Завантаження…',
  },
  footer: {
    message: 'Працює повністю в локальній мережі — інтернет не потрібен.',
  },
}

export default uk