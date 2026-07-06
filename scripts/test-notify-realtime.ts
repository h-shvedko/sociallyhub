// Smoke test for the ADR-0010 realtime transport core.
//
// Proves the Redis pub/sub round-trip that both the SSE route and notify.ts
// depend on: a dedicated subscriber on `notify:user:{id}` receives exactly what
// publishToUser publishes. Run against the dev Redis:
//
//   REDIS_URL=redis://localhost:6379 npx tsx scripts/test-notify-realtime.ts
//
// Exits 0 on a verified round-trip, 1 otherwise.

import {
  publishToUser,
  createUserSubscriber,
  userChannel,
  closeRealtime,
} from '../src/lib/notifications/realtime'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const userId = `smoke-${Date.now()}`
  const payload = {
    id: 'ntf_smoke',
    type: 'PUBLISH_SUCCESS',
    title: 'Realtime smoke',
    message: 'round-trip check',
    at: Date.now(),
  }

  const received: string[] = []
  const subscriber = createUserSubscriber(userId, (msg) => received.push(msg))

  // Wait for the SUBSCRIBE ack before publishing (messages only flow after it).
  await sleep(400)

  const publishBeforeSubscribe = received.length // must be 0
  const published = await publishToUser(userId, payload)

  // Give Redis a beat to deliver.
  await sleep(400)

  // A second publish to a DIFFERENT user must NOT arrive on this subscriber.
  await publishToUser(`other-${Date.now()}`, { title: 'should not arrive' })
  await sleep(200)

  const receivedCount = received.length
  let parsedTitle: string | null = null
  try {
    parsedTitle = receivedCount > 0 ? JSON.parse(received[0]).title : null
  } catch {
    parsedTitle = null
  }

  const roundTrip =
    published === true &&
    publishBeforeSubscribe === 0 &&
    receivedCount === 1 &&
    parsedTitle === payload.title

  console.log(
    JSON.stringify(
      {
        channel: userChannel(userId),
        publishReturned: published,
        receivedCount,
        parsedTitle,
        isolatedFromOtherUser: receivedCount === 1,
        roundTrip,
        rawMessage: received[0] ?? null,
      },
      null,
      2
    )
  )

  // Teardown so the process can exit cleanly.
  try {
    await subscriber.unsubscribe(userChannel(userId))
  } catch {
    /* ignore */
  }
  try {
    await subscriber.quit()
  } catch {
    subscriber.disconnect()
  }
  await closeRealtime()

  process.exit(roundTrip ? 0 : 1)
}

main().catch((err) => {
  console.error('[smoke] unexpected failure:', err)
  process.exit(1)
})
