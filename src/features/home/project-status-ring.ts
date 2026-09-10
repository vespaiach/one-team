import type { ProjectStatusRing } from "@/components/ui/status-ring";

export function projectStatusRing(counts: { done: number; counted: number }): ProjectStatusRing {
  if (counts.done === 0) {
    return "todo";
  }
  if (counts.done >= counts.counted) {
    return "done";
  }
  return "progress";
}