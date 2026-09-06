"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Which icon shows is decided by CSS, not by a mounted flag, so the button renders
 * correctly on the server and never causes a hydration mismatch.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="החלפת מצב תצוגה"
    >
      <Moon className="size-5 dark:hidden" aria-hidden />
      <Sun className="hidden size-5 dark:block" aria-hidden />
    </Button>
  );
}
