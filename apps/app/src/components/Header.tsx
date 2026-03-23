import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { LogOut, User } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { siteTheme } from '../lib/site-theme'
import { useSession, signIn, signUp, signOut } from '../lib/auth-client'

type AuthMode = 'sign-in' | 'sign-up'

export default function Header() {
  const { data: session } = useSession()
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const loginTitleId = useId()
  const loginDescriptionId = useId()
  const menuRef = useRef<HTMLDivElement>(null)

  const isLoggedIn = !!session?.user
  const isAdmin = (session?.user as Record<string, unknown> | undefined)?.role === 'admin'

  useEffect(() => {
    document.body.classList.toggle('modal-open', isLoginModalOpen)
    if (!isLoginModalOpen) {
      return () => {
        document.body.classList.remove('modal-open')
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsLoginModalOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
      document.body.classList.remove('modal-open')
    }
  }, [isLoginModalOpen])

  useEffect(() => {
    if (!isUserMenuOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isUserMenuOpen])

  function openModal(mode: AuthMode = 'sign-in') {
    setAuthMode(mode)
    setError('')
    setEmail('')
    setPassword('')
    setName('')
    setIsLoginModalOpen(true)
  }

  function closeModal() {
    setIsLoginModalOpen(false)
    setError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (authMode === 'sign-up') {
        const { error: authError } = await signUp.email({
          email,
          password,
          name: name || email.split('@')[0] || 'User',
        })
        if (authError) {
          setError(authError.message || 'Failed to create account')
          return
        }
      } else {
        const { error: authError } = await signIn.email({ email, password })
        if (authError) {
          setError(authError.message || 'Invalid email or password')
          return
        }
      }
      closeModal()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    setIsUserMenuOpen(false)
    await signOut()
  }

  const userInitial =
    session?.user?.name?.[0]?.toUpperCase() ||
    session?.user?.email?.[0]?.toUpperCase() ||
    '?'

  return (
    <>
      <header className="site-header">
        <div className="utility-strip">
          <div className="page-wrap utility-strip-inner">
            <Link to="/" className="brand-mark utility-brand no-underline">
              <span className="brand-badge">{siteTheme.brand.mark}</span>
              <span className="brand-name">{siteTheme.brand.name}</span>
            </Link>

            <nav className="flex flex-wrap items-center gap-4 text-sm">
              {siteTheme.nav.map((item) => (
                <Link key={item.href} to={item.href} className="text-slate-700 hover:text-slate-900">
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="header-actions">
              {isLoggedIn ? (
                <div className="user-menu-anchor" ref={menuRef}>
                  <button
                    type="button"
                    className="header-user-badge"
                    onClick={() => setIsUserMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={isUserMenuOpen}
                  >
                    {userInitial}
                  </button>
                  {isUserMenuOpen && (
                    <div className="user-menu" role="menu">
                      <div className="user-menu-header">
                        <span className="user-menu-name">{session.user.name || 'User'}</span>
                        <span className="user-menu-email">{session.user.email}</span>
                        {isAdmin && <span className="user-menu-role">Admin</span>}
                      </div>
                      <div className="user-menu-divider" />
                      <button
                        type="button"
                        className="user-menu-item user-menu-item--danger"
                        role="menuitem"
                        onClick={handleSignOut}
                      >
                        <LogOut size={14} aria-hidden="true" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="header-action"
                  onClick={() => openModal('sign-in')}
                  aria-haspopup="dialog"
                >
                  <User aria-hidden="true" size={17} />
                  <span className="sr-only">Account</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {isLoginModalOpen ? (
        <div className="login-modal-backdrop" onClick={closeModal} role="presentation">
          <div
            className="login-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={loginTitleId}
            aria-describedby={loginDescriptionId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={loginTitleId} className="login-modal-title">
              {authMode === 'sign-in' ? 'Sign in' : 'Create account'}
            </h2>
            <p id={loginDescriptionId} className="login-modal-copy">
              {authMode === 'sign-in'
                ? 'Use your email and password.'
                : 'Register with email and password.'}
            </p>
            <form className="login-modal-form" onSubmit={handleSubmit}>
              {error && (
                <div className="login-error" role="alert">
                  {error}
                </div>
              )}
              {authMode === 'sign-up' && (
                <label className="login-field">
                  <span className="login-field-label">Name</span>
                  <input
                    type="text"
                    className="login-field-input"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
              <label className="login-field">
                <span className="login-field-label">Email</span>
                <input
                  type="email"
                  className="login-field-input"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="login-field">
                <span className="login-field-label">Password</span>
                <input
                  type="password"
                  className="login-field-input"
                  required
                  minLength={8}
                  autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? 'Please wait…' : authMode === 'sign-in' ? 'Sign in' : 'Sign up'}
              </button>
              <button
                type="button"
                className="login-provider-button"
                onClick={() => {
                  setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in')
                  setError('')
                }}
              >
                {authMode === 'sign-in' ? 'Need an account?' : 'Have an account?'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
