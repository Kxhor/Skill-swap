import { BadgeCheck } from 'lucide-react'

interface Props {
  verifiedAt?: string
  verificationCount?: number
}

export function VerifiedBadge({ verifiedAt, verificationCount }: Props) {
  if (!verifiedAt) return null

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-accent bg-accent/10"
      title={`Verified at ${new Date(verifiedAt).toLocaleDateString()}${verificationCount ? ` · ${verificationCount} verifications` : ''}`}
    >
      <BadgeCheck className="w-3 h-3" />
      Verified
    </span>
  )
}
