import "server-only"
import { notFound } from "next/navigation"
import { getRequestSession } from "@/lib/authorization"
export async function requirePlatformAdmin(){const session=await getRequestSession();if(!session||(session.user as {role?:string}).role!=="platform_admin")notFound();return session}
