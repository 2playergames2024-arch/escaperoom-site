import RoomDetailPage from "../../../../components/RoomDetailPage";
import { createRoomMetadata } from "../../../../lib/roomMetadata";

export const metadata =
  createRoomMetadata(
    "king-of-prussia",
    "area-51"
  );

export default function Page() {
  return (
    <RoomDetailPage
      locationSlug="king-of-prussia"
      roomSlug="area-51"
    />
  );
}