import { createApp } from 'vue'
import App from './App.vue'
import i18n from './i18n'
import './main.css'
import { applyTheme } from './composables/theme'

applyTheme()

createApp(App).use(i18n).mount('#app')