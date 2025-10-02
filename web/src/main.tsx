import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import Today from './pages/Today'
import Log from './pages/Log'
import ScanDetail from './pages/ScanDetail'

const router = createBrowserRouter([
  { path: '/', element: <Today /> },
  { path: '/log', element: <Log /> },
  { path: '/log/:scanId', element: <ScanDetail /> }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
