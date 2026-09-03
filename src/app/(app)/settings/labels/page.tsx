import { forbidden } from "next/navigation";
import { Suspense } from "react";
import { requireActor } from "@/features/auth/server/actor";
import { checkLabelNameAvailable, createLabel, deleteLabel, updateLabel } from "@/features/labels/actions";
import { LabelsScreen } from "@/features/labels/components/labels-screen";
import { listLabelsWithUsage } from "@/features/labels/server/queries";
import { ScreenHeader } from "@/features/shell/components/screen-header";

async function LabelsScreenData() {
  const labels = await listLabelsWithUsage();
  return (
    <LabelsScreen
      labels={labels}
      createLabelAction={createLabel}
      updateLabelAction={updateLabel}
      checkNameAvailable={checkLabelNameAvailable}
      deleteLabelAction={deleteLabel}
    />
  );
}

export default async function LabelsPage() {
  const actor = await requireActor();
  if (actor.role !== "admin") {
    forbidden();
  }

  return (
    <>
      <ScreenHeader name="Labels" />
      <Suspense fallback={<p>Loading labels…</p>}>
        <LabelsScreenData />
      </Suspense>
    </>
  );
}