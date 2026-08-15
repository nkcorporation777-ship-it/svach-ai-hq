import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { QueryProvider } from "./providers/QueryProvider"
import { AuthProvider } from "./providers/AuthProvider"
import { routes } from "./routes"

const router = createBrowserRouter(routes)

export function App() {
  return (
    <QueryProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryProvider>
  )
}
