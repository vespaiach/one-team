import { CardFooterNote } from "./card-footer-note";
import { ArrowLeftIcon } from "./icons";

export function BackToSignInFooter() {
  return (
    <CardFooterNote>
      <a
        href="/signin"
        className="inline-flex items-center gap-1">
        <ArrowLeftIcon size={16} />
        Back to sign in
      </a>
    </CardFooterNote>
  );
}