// Login layout - bypasses parent admin layout
// Middleware handles auth, so this just needs to render the login page
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Return children directly - middleware handles auth redirects
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}

