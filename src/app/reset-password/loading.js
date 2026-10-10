export default function ResetPasswordLoading() {
  return (
    <main className="authPage">
      <section className="authAside" aria-hidden="true" />
      <section className="authMain">
        <div className="authCard">
          <h1>Reset password</h1>
          <p className="authSubtitle">Loading your reset link…</p>
        </div>
      </section>
    </main>
  );
}