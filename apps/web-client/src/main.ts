import './main.css'
import { createApp } from 'vue'
import App from './App.vue'
import i18n from './i18n'
import { applyTheme } from './composables/theme'
import { vTip } from './directives/tooltip'

applyTheme()

createApp(App).use(i18n).directive('tip', vTip).mount('#app')