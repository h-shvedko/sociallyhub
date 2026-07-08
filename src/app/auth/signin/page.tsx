import { getPublicDemoConfig } from "@/lib/config/demo"
import SignInForm from "./signin-form"

// SERVER component (no "use client"): DEMO_MODE is a server-only flag, so we
// read it here via getPublicDemoConfig() and hand the flag + credentials hint
// down to the client form as props. This is the ADR-0025 D1 server→client
// handoff — no NEXT_PUBLIC_* mirror that could drift from the real gate.
export default function SignInPage() {
  const { demoMode, credentialsHint } = getPublicDemoConfig()
  return <SignInForm demoMode={demoMode} credentialsHint={credentialsHint} />
}
