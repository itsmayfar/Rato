"use client";

import { AlertTriangle } from "lucide-react";
import { buttonClass } from "@/components/ui/primitives";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-accent-strong" />
      <h1 className="text-2xl font-extralight">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        The page could not be loaded. Your saved data is safe. {error.digest ? `Reference: ${error.digest}` : ""}
      </p>
      <button type="button" onClick={reset} className={buttonClass("primary", "md", "mt-6")}>
        Try again
      </button>
    </div>
  );
}
