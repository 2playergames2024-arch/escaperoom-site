import RoomDetailPage from "../../../../components/RoomDetailPage";
import { createRoomMetadata } from "../../../../lib/roomMetadata";

export const metadata =
  createRoomMetadata(
    "cherry-hill",
    "laboratory"
  );

export default function Page() {
  return (
    <RoomDetailPage
      locationSlug="cherry-hill"
      roomSlug="laboratory"
    />
  );
}