import { createHashRouter, RouterProvider } from 'react-router-dom'
import Layout from './components/Layout'
import Budgets from './pages/Budgets'
import Dashboard from './pages/Dashboard'
import Insights from './pages/Insights'
import NotFound from './pages/NotFound'
import Settings from './pages/Settings'
import Transactions from './pages/Transactions'
import { BackendGate } from './state/BackendGate'
import { DataProvider } from './state/DataProvider'
import { PrefsProvider } from './state/PrefsProvider'

// Hash routing keeps deep links working on static hosting (GitHub Pages has no SPA fallback).
const router = createHashRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'transactions', element: <Transactions /> },
      { path: 'budgets', element: <Budgets /> },
      { path: 'insights', element: <Insights /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

export default function App() {
  return (
    <PrefsProvider>
      <BackendGate>
        {(repository, userId) => (
          <DataProvider key={userId ?? 'local'} repository={repository}>
            <RouterProvider router={router} />
          </DataProvider>
        )}
      </BackendGate>
    </PrefsProvider>
  )
}
