import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { I18nProvider } from './i18n'
import { ThemeProvider } from './lib/theme'
import { StoreProvider } from './data/store'
import { ConfirmProvider, ToastProvider } from './components/ui'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <StoreProvider>
          <ToastProvider>
            <ConfirmProvider>
              <HashRouter>
                <App />
              </HashRouter>
            </ConfirmProvider>
          </ToastProvider>
        </StoreProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
)
