import { HashRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '../components/ui'
import { AppShell } from './AppShell'
import { routes } from './routes'

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AppShell>
          <Routes>
            {routes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Routes>
        </AppShell>
      </ToastProvider>
    </HashRouter>
  )
}
