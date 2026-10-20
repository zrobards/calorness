"use client";

// Last-resort error screen if the whole app shell fails. It has to bring its
// own <html> and can't rely on the app's styles loading.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#17212b", color: "#eceee8", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <div style={{ padding: 24 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Calorness hit a snag</h1>
          <p style={{ opacity: 0.75 }}>Your data is safe. Reload to keep going.</p>
          <button onClick={reset} style={{ marginTop: 12, padding: "12px 20px", borderRadius: 12, border: 0, background: "#d64545", color: "white", fontSize: 18 }}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
