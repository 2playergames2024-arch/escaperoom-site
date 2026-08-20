import RoomDetailPage from "../../../../components/RoomDetailPage";
import { createRoomMetadata } from "../../../../lib/roomMetadata";

export const metadata =
  createRoomMetadata(
    "king-of-prussia",
    "revolution-spies"
  );

export default function Page() {
  return (
    <RoomDetailPage
      locationSlug="king-of-prussia"
      roomSlug="revolution-spies"
    />
  );
}