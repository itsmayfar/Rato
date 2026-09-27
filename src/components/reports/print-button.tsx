"use client";

import { Printer } from "lucide-react";
import { buttonClass } from "@/components/ui/primitives";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClass("outline")}>
      <Printer className="h-4 w-4" /> Print / Save as PDF
    </button>
  );
}
