import { Suspense } from "react";
import { requireActor } from "@/features/auth/server/actor";
import { ProfileScreen } from "@/features/profile/components/profile-screen";
import { ProfileSkeleton } from "@/features/profile/components/profile-skeleton";
import { getOwnProfile } from "@/features/profile/server/queries";
import { ScreenHeader } from "@/features/shell/components/screen-header";

async function ProfileScreenData({ userId }: { userId: string }) {
  const record = await getOwnProfile(userId);
  if (!record) {
    return null;
  }
  return <ProfileScreen record={record} />;
}

export default async function ProfilePage() {
  const actor = await requireActor();

  return (
    <>
      <ScreenHeader name="Profile" />
      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileScreenData userId={actor.id} />
      </Suspense>
    </>
  );
}