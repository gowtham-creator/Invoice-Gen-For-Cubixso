"use client"

/**
 * The sign-in screen, after the 21st.dev "Grid auth" component: the same
 * zinc surfaces, gradient button, sweeping-fill secondary button, grid corner
 * and fade-up entrance.
 *
 * Adapted for an app with exactly one user:
 * - No social buttons, "Create one." link or OR divider. There is one way in,
 *   and no one else is meant to sign up.
 * - The two extra modes an Identity email link opens: setting a password
 *   from an invite, and choosing a new one after "Forgot?".
 * - `motion/react` in place of `framer-motion` (the same library under its
 *   current name, already used across the app), and the corner fade is drawn
 *   with `dark:` classes instead of `next-themes`, so it follows the device
 *   from the first frame with no theme state to wait for.
 *
 * Presentational only: the Identity calls live in components/sign-in.tsx.
 */

import * as React from "react"
import { ChevronLeft, LoaderCircle } from "lucide-react"
import { motion } from "motion/react"
import { GradientBars } from "@/components/ui/gradient-bars-background"

export type AuthMode = "sign-in" | "set-password" | "reset-password"

export interface AuthFormProps {
  mode: AuthMode
  /** Waiting on Identity: the fields stay editable, the button does not. */
  busy?: boolean
  /** The first check of an existing session, before anything is typed. */
  checking?: boolean
  error?: string | null
  notice?: string | null
  onSignIn: (email: string, password: string) => void
  onSetPassword: (password: string) => void
  onForgot: (email: string) => void
}

const COPY: Record<AuthMode, { title: string; sub: string; action: string; working: string }> = {
  "sign-in": {
    title: "Sign in to Invoices",
    sub: "CUBIXSO Solutions · owner access only",
    action: "Sign in",
    working: "Signing in…",
  },
  "set-password": {
    title: "Set your password",
    sub: "Finish accepting your invite, and you are in.",
    action: "Set password and continue",
    working: "Saving…",
  },
  "reset-password": {
    title: "Choose a new password",
    sub: "Then it is straight back to your invoices.",
    action: "Save password and continue",
    working: "Saving…",
  },
}

const AuthForm: React.FC<AuthFormProps> = (props) => {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-white py-10 text-zinc-800 selection:bg-zinc-300 sm:py-20 dark:bg-zinc-950 dark:text-zinc-200 dark:selection:bg-zinc-600">
      <div className="relative z-10 mx-auto w-full max-w-xl px-4">
        <BackButton />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.25, ease: "easeInOut" }}
        className="relative z-10 mx-auto w-full max-w-xl p-4"
      >
        <div className="rounded-2xl border border-zinc-200/80 bg-white/75 p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_60px_-20px_rgba(16,24,40,0.28)] backdrop-blur-xl sm:p-8 dark:border-white/10 dark:bg-zinc-900/55 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_28px_70px_-24px_rgba(0,0,0,0.85)]">
          <Logo />
          <Header mode={props.mode} />
          <Messages error={props.error} notice={props.notice} />
          <LoginForm {...props} />
          <Footnote />
        </div>
      </motion.div>
      <BackgroundDecoration />
    </div>
  )
}

const BackButton: React.FC = () => (
  <SocialButton href="https://cubixso.com" icon={<ChevronLeft size={16} />}>
    cubixso.com
  </SocialButton>
)

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string
}

const Button: React.FC<ButtonProps> = ({ children, className, ...props }) => (
  <button
    className={`rounded-md bg-gradient-to-br from-blue-400 to-blue-700 px-4 py-2 text-lg text-zinc-50
    ring-2 ring-blue-500/50 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950
    transition-all hover:scale-[1.02] hover:ring-transparent active:scale-[0.98] active:ring-blue-500/70
    disabled:pointer-events-none disabled:opacity-70 ${className}`}
    {...props}
  >
    {children}
  </button>
)

const Logo: React.FC = () => (
  <div className="mb-6 flex items-center justify-center">
    {/* The real mark from public/, inverted on dark as it is in the app header. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/cubixso-logo.png" alt="" width={32} height={32} className="h-8 w-8 dark:invert" />
    <span className="ml-2 text-xl font-bold tracking-[0.18em]">CUBIXSO</span>
  </div>
)

const Header: React.FC<{ mode: AuthMode }> = ({ mode }) => (
  <div className="mb-6 text-center">
    <h1 className="text-2xl font-semibold">{COPY[mode].title}</h1>
    <p className="mt-2 text-zinc-500 dark:text-zinc-400">{COPY[mode].sub}</p>
  </div>
)

const Messages: React.FC<{ error?: string | null; notice?: string | null }> = ({ error, notice }) => (
  <>
    {error && (
      <p
        role="alert"
        className="mb-4 rounded-md border border-red-300/70 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
      >
        {error}
      </p>
    )}
    {notice && !error && (
      <p
        role="status"
        className="mb-4 rounded-md border border-blue-300/70 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200"
      >
        {notice}
      </p>
    )}
  </>
)

const SocialButton: React.FC<{
  icon?: React.ReactNode
  href?: string
  children?: React.ReactNode
}> = ({ icon, href, children }) => {
  const className = `relative z-0 inline-flex items-center justify-center gap-2 overflow-hidden rounded-md
    border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800
    px-4 py-2 font-semibold text-zinc-800 dark:text-zinc-200 transition-all duration-500
    before:absolute before:inset-0 before:-z-10 before:translate-x-[150%] before:translate-y-[150%] before:scale-[2.5]
    before:rounded-[100%] before:bg-zinc-800 dark:before:bg-zinc-200 before:transition-transform before:duration-1000 before:content-[""]
    hover:scale-105 hover:text-zinc-100 dark:hover:text-zinc-900 hover:before:translate-x-[0%] hover:before:translate-y-[0%] active:scale-95`
  return href ? (
    <a href={href} className={className}>
      {icon}
      <span>{children}</span>
    </a>
  ) : (
    <button type="button" className={className}>
      {icon}
      <span>{children}</span>
    </button>
  )
}

const inputClass = `w-full rounded-md border border-zinc-300 dark:border-zinc-700
  bg-white dark:bg-zinc-900 px-3 py-2 text-zinc-800 dark:text-zinc-200
  placeholder-zinc-400 dark:placeholder-zinc-500
  ring-1 ring-transparent transition-shadow focus:outline-0 focus:ring-blue-700`

const LoginForm: React.FC<AuthFormProps> = ({ mode, busy, checking, onSignIn, onSetPassword, onForgot }) => {
  const [mismatch, setMismatch] = React.useState(false)
  const emailRef = React.useRef<HTMLInputElement>(null)
  const locked = busy || checking

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (locked) return
    const data = new FormData(e.currentTarget)
    const password = String(data.get("password") ?? "")
    if (mode === "sign-in") {
      onSignIn(String(data.get("email") ?? "").trim(), password)
      return
    }
    if (password !== String(data.get("confirm") ?? "")) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    onSetPassword(password)
  }

  const forgot = () => {
    const email = emailRef.current?.value.trim() ?? ""
    if (!email) {
      emailRef.current?.focus()
      emailRef.current?.setCustomValidity("Enter your email first, then press Forgot?")
      emailRef.current?.reportValidity()
      return
    }
    onForgot(email)
  }

  return (
    <form onSubmit={handleSubmit}>
      {mode === "sign-in" ? (
        <>
          <div className="mb-3">
            <label htmlFor="email-input" className="mb-1.5 block text-zinc-500 dark:text-zinc-400">
              Email
            </label>
            <input
              ref={emailRef}
              id="email-input"
              name="email"
              type="email"
              required
              autoComplete="username"
              inputMode="email"
              placeholder="you@cubixso.com"
              onInput={(e) => e.currentTarget.setCustomValidity("")}
              className={inputClass}
            />
          </div>
          <div className="mb-6">
            <div className="mb-1.5 flex items-end justify-between">
              <label htmlFor="password-input" className="block text-zinc-500 dark:text-zinc-400">
                Password
              </label>
              <button
                type="button"
                onClick={forgot}
                disabled={locked}
                className="text-sm text-blue-600 hover:underline disabled:opacity-60 dark:text-blue-400"
              >
                Forgot?
              </button>
            </div>
            <input
              id="password-input"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••••••"
              className={inputClass}
            />
          </div>
        </>
      ) : (
        <>
          <div className="mb-3">
            <label htmlFor="new-password-input" className="mb-1.5 block text-zinc-500 dark:text-zinc-400">
              New password
            </label>
            <input
              id="new-password-input"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className={inputClass}
            />
          </div>
          <div className="mb-6">
            <label htmlFor="confirm-password-input" className="mb-1.5 block text-zinc-500 dark:text-zinc-400">
              Confirm password
            </label>
            <input
              id="confirm-password-input"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="Type it once more"
              aria-invalid={mismatch || undefined}
              aria-describedby={mismatch ? "mismatch-note" : undefined}
              onInput={() => setMismatch(false)}
              className={inputClass}
            />
            {mismatch && (
              <p id="mismatch-note" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                The two passwords do not match.
              </p>
            )}
          </div>
        </>
      )}
      <Button type="submit" className="flex w-full items-center justify-center gap-2" disabled={locked}>
        {busy && <LoaderCircle size={18} className="animate-spin" aria-hidden />}
        {checking ? "Checking your session…" : busy ? COPY[mode].working : COPY[mode].action}
      </Button>
    </form>
  )
}

const Footnote: React.FC = () => (
  <p className="mt-9 text-xs text-zinc-500 dark:text-zinc-400">
    A private workspace. Only the owner&apos;s account opens the invoicer; every other visit stops at
    this page.
  </p>
)

/**
 * The background: the gradient bars rising from the floor of the page, the
 * grid corner of the original over them, and the page colour held around the
 * form so every label stays readable. All drawn with `dark:` classes and CSS
 * variables rather than theme state, so it is right on the first frame.
 */
const BackgroundDecoration: React.FC = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
    <GradientBars
      numBars={15}
      gradientFrom="var(--auth-bar-from)"
      gradientTo="transparent"
      animationDuration={2.4}
      className="opacity-90"
    />

    {/* A second, wider set behind the first: the bars read as one field of
        colour rather than a row of stripes. */}
    <GradientBars
      numBars={7}
      gradientFrom="var(--auth-bar-mid)"
      gradientTo="transparent"
      animationDuration={3.6}
      className="blur-2xl"
    />

    {/* The corner grid of the original, over the colour. */}
    <div
      className="absolute right-0 top-0 size-[60vw] opacity-70 dark:opacity-50"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke-width='2' stroke='rgb(30 58 138 / 0.5)'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e")`,
        maskImage: "radial-gradient(100% 100% at 100% 0%, #000, transparent 70%)",
        WebkitMaskImage: "radial-gradient(100% 100% at 100% 0%, #000, transparent 70%)",
      }}
    />

    {/* Keeps the colour off the form itself. */}
    <div className="absolute inset-0 bg-[radial-gradient(90%_62%_at_50%_38%,rgba(255,255,255,0.92)_35%,transparent_75%)] dark:bg-[radial-gradient(90%_62%_at_50%_38%,rgba(9,9,11,0.9)_35%,transparent_75%)]" />
  </div>
)

export default AuthForm
