import { InviteClient } from "./invite-client"

export default async function InvitePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params
  return <InviteClient eventId={eventId} />
}
