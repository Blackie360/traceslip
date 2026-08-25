import { redirect } from "next/navigation"
import { AuthShell } from "@/components/auth/auth-shell"
import { OnboardingForm } from "@/components/onboarding-form"
import { requireSession } from "@/lib/authorization"
export default async function OnboardingPage(){const session=await requireSession();if(!session.user.emailVerified)redirect("/sign-in");return <AuthShell eyebrow="Workspace setup" title="Name your record room" copy="Every workspace starts with you as owner and one project for organizing receipts."><OnboardingForm/></AuthShell>}
