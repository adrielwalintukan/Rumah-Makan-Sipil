import * as React from "react";
import { cn } from "cn";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full rounded-md border border-line bg-card px-3 py-2 text-base text-ink-900 shadow-xs transition-[color,box-shadow]",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-ink-400 focus-visible:border-green-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-green-100",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger-bg",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
