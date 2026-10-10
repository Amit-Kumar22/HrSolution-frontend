import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="container not-found-inner">
        <span className="eyebrow">404</span>
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist or is no longer available.</p>
        <Link className="button button-primary" href="/">
          Back to home
        </Link>
      </div>
    </main>
  );
}
