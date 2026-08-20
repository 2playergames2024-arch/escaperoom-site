import RoomDetailPage from "../../../../components/RoomDetailPage";
import { createRoomMetadata } from "../../../../lib/roomMetadata";

export const metadata =
  createRoomMetadata(
    "king-of-prussia",
    "billionaires-den"
  );

export default function Page() {
  return (
    <RoomDetailPage
      locationSlug="king-of-prussia"
      roomSlug="billionaires-den"
    />
  );
}