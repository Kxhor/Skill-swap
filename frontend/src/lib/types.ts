export interface User {
  id: string
  name: string
  email?: string
  location?: string
  photo_url?: string
  bio?: string
  is_banned: boolean
  created_at: string
  skills_offered?: UserSkill[]
  skills_wanted?: UserSkill[]
  availability?: Availability[]
  average_rating?: number | null
}

export interface UserSkill {
  id: string
  skill_id: string
  skill_name: string
  type: 'offered' | 'wanted'
  proficiency: 'beginner' | 'intermediate' | 'expert'
  verified_badge?: VerifiedBadgeData | null
  skill_category?: string
}

export interface SwapRequest {
  id: string
  sender_id: string
  receiver_id: string
  sender: User
  receiver: User
  offered_skill: UserSkill
  wanted_skill: UserSkill
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  scheduled_session?: ScheduledSession | null
}

export interface ChatMessage {
  id: string
  swap_id: string
  sender_id: string | null
  content: string
  type: 'user' | 'system'
  created_at: string
}

export interface Feedback {
  id: string
  swap_id: string
  rater_id: string
  rated_id: string
  rating: number
  comment?: string
  created_at: string
}

export interface Availability {
  id: string
  user_id: string
  day_of_week: string
  start_time: string
  end_time: string
}

export interface AdminStats {
  total_users: number
  active_users: number
  banned_users: number
  total_swaps: number
  pending_swaps: number
  accepted_swaps: number
  completed_swaps: number
  total_skills: number
  pending_skills: number
  approved_skills: number
  new_users_week: number
  new_swaps_week: number
}

export interface MatchScore {
  score: number
  reason: string
  cached: boolean
}

export interface VerifiedBadgeData {
  id: string
  user_skill_id: string
  verified_at: string
  verification_count: number
}

export interface ScheduledSession {
  id: string
  swap_id: string
  proposer_id: string
  scheduled_at: string
  calendar_link?: string
  status: 'proposed' | 'confirmed' | 'completed'
}
