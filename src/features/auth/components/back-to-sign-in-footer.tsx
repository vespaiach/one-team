import { CardFooterNote } from "./card-footer-note";
import { ArrowLeftIcon } from "./icons";

export function BackToSignInFooter() {
  return (
    <CardFooterNote>
      <a
        href="/signin"
        className="inline-flex items-center gap-[7px]">
        <ArrowLeftIcon size={16} />
        Back to sign in
      </a>
    </CardFooterNote>
  );
}