import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const RECOVERY_COOKIE = 'real-password-recovery'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete(RECOVERY_COOKIE)

  return new NextResponse(null, { status: 204 })
}
