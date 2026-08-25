"use client"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
export function AcceptInvitation(){const query=useSearchParams();const router=useRouter();const [pending,setPending]=useState(false);async function accept(){const invitationId=query.get("id");if(!invitationId)return;setPending(true);const result=await authClient.organization.acceptInvitation({invitationId});setPending(false);if(result.error){toast.error(result.error.message ?? "Unable to accept invitation");return}toast.success("Workspace joined");router.push("/app");router.refresh()}return <Button onClick={accept} disabled={pending}>{pending?"Accepting…":"Accept invitation"}</Button>}
