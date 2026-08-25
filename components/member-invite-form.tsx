"use client"
import { useState } from "react"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
export function MemberInviteForm({organizationId}:{organizationId:string}){const[email,setEmail]=useState("");const[pending,setPending]=useState(false);async function invite(){setPending(true);const result=await authClient.organization.inviteMember({email,role:"member",organizationId});setPending(false);if(result.error){toast.error(result.error.message??"Unable to invite member");return}setEmail("");toast.success("Invitation sent")};return <div className="flex gap-2"><Input type="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="teammate@example.com" aria-label="Member email"/><Button onClick={invite} disabled={pending||!email}>{pending?"Sending…":"Invite member"}</Button></div>}
