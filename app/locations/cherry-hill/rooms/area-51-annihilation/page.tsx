import RoomDetailPage from "../../../../components/RoomDetailPage";
import { createRoomMetadata } from "../../../../lib/roomMetadata";

export const metadata =
  createRoomMetadata(
    "cherry-hill",
    "area-51"
  );

export default function Page() {
  return (
    <RoomDetailPage
      locationSlug="cherry-hill"
      roomSlug="area-51"
    />
  );
}