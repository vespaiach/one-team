import { ForbiddenNotice } from "@/features/shell/components/forbidden-notice";
import { ScreenHeader } from "@/features/shell/components/screen-header";

export default function Forbidden() {
  return (
    <>
      <ScreenHeader name="Forbidden" />
      <ForbiddenNotice />
    </>
  );
}