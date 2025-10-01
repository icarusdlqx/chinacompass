import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import Today from './pages/Today'
import Log from './pages/Log'

const router = createBrowserRouter([
  { path: '/', element: <Today /> },
  { path: '/log', element: <Log /> }
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
