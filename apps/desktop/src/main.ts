import { createApp } from 'vue'
import App from './App.vue'
import i18n from './i18n'
import './main.css'
import { applyTheme } from './composables/theme'
import { restoreWindowState, watchWindowState } from './composables/desktop'

applyTheme()

createApp(App).use(i18n).mount('#app')

// Desktop only: put the window back where it was, then keep track of it.
void restoreWindowState().then(() => watchWindowState())