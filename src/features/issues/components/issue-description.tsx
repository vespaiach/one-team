import { Markdown } from "@/components/shared/markdown/markdown";

export function IssueDescription({ description }: { description: string | null }) {
  if (!description) {
    return null;
  }

  return <Markdown source={description} />;
}