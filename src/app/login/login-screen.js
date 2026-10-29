"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, LockKeyhole, TriangleAlert } from "lucide-react";
import {
  AUTH_SESSION_LOADING,
  clearAuthFlash,
  getAuthFlashSnapshot,
  getAuthSessionSnapshot,
  getDashboardPath,
  getServerAuthFlashSnapshot,
  getServerAuthSnapshot,
  forgotPassword,
  login,
  subscribeToAuthFlash,
  subscribeToAuthSession,
} from "../../lib/auth";

const styles = {
  loginPage: "loginPage", brandPanel: "brandPanel", brand: "loginBrand",
  brandMark: "loginBrandMark", brandCopy: "loginBrandCopy", pitch: "pitch",
  desktopBreak: "desktopBreak", securityList: "securityList",
  roleList: "roleList", copyright: "copyright", formPanel: "formPanel",
  formWrap: "formWrap", mobileBrand: "mobileBrand", intro: "intro",
  loginForm: "loginForm", errorAlert: "errorAlert", successAlert: "successAlert",
  formOptions: "formOptions", remember: "remember", demoNote: "demoNote",
  protected: "protected", newHere: "newHere", registerActions: "registerActions",
  mobileFooter: "mobileFooter", forgotLink: "forgotLink", backToLogin: "backToLogin",
  demoPanel: "demoPanel", demoPanelTitle: "demoPanelTitle", demoList: "demoList",
  demoItem: "demoItem", demoRole: "demoRole", demoCreds: "demoCreds",
};

const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "admin@hrsolution.prod", password: "12345" },
  { role: "Admin", email: "admin@hrsolution.local", password: "Demo@12345" },
  { role: "Accounts", email: "accounts@hrsolution.local", password: "Demo@12345" },
  { role: "HR", email: "hr@hrsolution.local", password: "Demo@12345" },
  { role: "Operator", email: "ops@hrsolution.local", password: "Demo@12345" },
  { role: "Supervisor", email: "supervisor@hrsolution.local", password: "Demo@12345" },
  { role: "Client", email: "client@gmail.com", password: "Demo@12345" },
  { role: "Worker", email: "worker@gmail.com", password: "Demo@12345" },
  { role: "Job Seeker", email: "sumit@gmail.com", password: "Sumit@123" },
];

function Brand() {
  return (
    <Link href="/" className={styles.brand} aria-label="Shakti Manpower home">
      <span className={styles.brandMark}>S</span>
      <span className={styles.brandCopy}>
        <strong>Shakti Manpower</strong>
        <small>HR SOLUTIONS PORTAL</small>
      </span>
    </Link>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const [view, setView] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const sessionState = useSyncExternalStore(
    subscribeToAuthSession,
    getAuthSessionSnapshot,
    getServerAuthSnapshot,
  );
  const notice = useSyncExternalStore(
    subscribeToAuthFlash,
    getAuthFlashSnapshot,
    getServerAuthFlashSnapshot,
  );

  useEffect(() => {
    if (sessionState && typeof sessionState === "object" && sessionState.accessToken) {
      router.replace(getDashboardPath(sessionState));
    }
  }, [router, sessionState]);

  async function handleSubmit(event) {
    event.preventDefault();
    clearAuthFlash();
    setError("");
    setErrorStatus(0);
    setIsSubmitting(true);
    try {
      const session = await login(email.trim().toLowerCase(), password, rememberMe);
      router.replace(getDashboardPath(session));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Sign in failed. Please try again.");
      setErrorStatus(loginError && typeof loginError.status === "number" ? loginError.status : 0);
    } finally {
      setIsSubmitting(false);
    }
  }

  function fillDemoAccount(account) {
    setEmail(account.email);
    setPassword(account.password);
    setError("");
    setErrorStatus(0);
  }

  function showForgotPassword() {
    setView("forgot");
    clearAuthFlash();
    setError("");
    setErrorStatus(0);
    setForgotError("");
    setForgotSuccess("");
  }

  function showLogin() {
    setView("login");
    clearAuthFlash();
    setError("");
    setErrorStatus(0);
    setForgotError("");
    setForgotSuccess("");
    setForgotEmail("");
  }

  async function handleForgotSubmit(event) {
    event.preventDefault();
    setForgotError("");
    setForgotSuccess("");

    const normalizedEmail = forgotEmail.trim();
    if (!normalizedEmail) {
      setForgotError("Enter your registered email address.");
      return;
    }

    setIsSendingReset(true);
    try {
      const result = await forgotPassword(normalizedEmail);
      setForgotSuccess(result.message);
      setForgotEmail("");
    } catch (resetError) {
      setForgotError(
        resetError instanceof Error ? resetError.message : "Could not request a password reset. Please try again.",
      );
    } finally {
      setIsSendingReset(false);
    }
  }

  if (sessionState === AUTH_SESSION_LOADING) {
    return (
      <main className={styles.loginPage}>
        <section className={styles.brandPanel}><Brand /></section>
        <section className={styles.formPanel}>
          <div className={styles.formWrap}>
            <div className={styles.mobileBrand}><Brand /></div>
            <h2>Checking session</h2>
            <p className={styles.intro}>Please wait while we check your sign-in status…</p>
            <div className={styles.loginForm} aria-busy="true"><button type="button" disabled>Checking…</button></div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.brandPanel}>
        <Brand />
        <div className={styles.pitch}>
          <h1>One login for your<br className={styles.desktopBreak} /> entire workforce.</h1>
          <p>Requisitions, deployment, attendance, payroll and GST invoices — every role sees exactly what they need.</p>
          <ul className={styles.securityList}>
            <li><Check size={14} />Designed for secure sessions and device management</li>
            <li><Check size={14} />Role-based portal UI for 9 user types</li>
            <li><Check size={14} />Workforce and payroll information, organised by role</li>
          </ul>
          <div className={styles.roleList} aria-label="Portal user roles">
            {["Admin", "HR", "Operations", "Accounts", "Client", "Worker", "Candidate", "Supervisor"].map((role) => <span key={role}>{role}</span>)}
          </div>
        </div>
        <small className={styles.copyright}>© 2026 Shakti Manpower Services Pvt. Ltd.</small>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.formWrap}>
          <div className={styles.mobileBrand}><Brand /></div>
          {view === "login" ? (
            <>
              <h2>Welcome back</h2>
              <p className={styles.intro}>Log in to manage your workforce, payslips or applications.</p>
              <form className={styles.loginForm} onSubmit={handleSubmit}>
                {notice && <div className={styles.successAlert} role="status"><Check size={16} />{notice}</div>}
                {error && <div className={styles.errorAlert} role="alert"><TriangleAlert size={16} />{error}</div>}
                {errorStatus === 403 && /verif|confirm your email/i.test(error) && (
                  <Link className={styles.remember} href="/resend-verification">Resend email verification</Link>
                )}
                <label htmlFor="login-email">Email address</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <div className={styles.formOptions}>
                  <label className={styles.remember}><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />Remember me for 30 days</label>
                  <button type="button" className={styles.forgotLink} onClick={showForgotPassword}>Forgot password?</button>
                </div>
                <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Log in"}</button>
              </form>
              <div className={styles.demoPanel}>
                <p className={styles.demoPanelTitle}>Demo login accounts</p>
                <div className={styles.demoList}>
                  {DEMO_ACCOUNTS.map((account) => (
                    <button
                      key={account.email}
                      type="button"
                      className={styles.demoItem}
                      onClick={() => fillDemoAccount(account)}
                      title="Click to auto-fill email and password"
                    >
                      <span className={styles.demoRole}>{account.role}</span>
                      <span className={styles.demoCreds}>
                        <span>{account.email}</span>
                        <span>{account.password}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <h2>Forgot password</h2>
              <p className={styles.intro}>Enter the email registered with your account and we will send you a password reset link. The link expires after 30 minutes and can only be used once.</p>
              <form className={styles.loginForm} onSubmit={handleForgotSubmit}>
                {forgotError && <div className={styles.errorAlert} role="alert"><TriangleAlert size={16} />{forgotError}</div>}
                {forgotSuccess && <div className={styles.successAlert} role="status"><Check size={16} />{forgotSuccess}</div>}
                <label htmlFor="forgot-email">Email address</label>
                <input
                  id="forgot-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@company.com"
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  disabled={Boolean(forgotSuccess)}
                  required
                />
                <button type="submit" disabled={isSendingReset || Boolean(forgotSuccess)}>
                  {isSendingReset ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <button type="button" className={styles.backToLogin} onClick={showLogin}>← Back to login</button>
            </>
          )}
          <div className={styles.protected}><LockKeyhole size={14} />Secure sign-in · Sessions rotate automatically</div>
          <div className={styles.newHere}><span />New here?<span /></div>
          <div className={styles.registerActions}>
            <Link href="/register/candidate">Register as Job Seeker</Link>
            <Link href="/register/client">Register as Company</Link>
          </div>
          <div className={styles.mobileFooter}>© 2026 Shakti Manpower Services Pvt. Ltd.</div>
        </div>
      </section>
    </main>
  );
}
