export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  profile_picture_url?: string | null;
  role: string;
  initials: string;
  created_at: string;
  updated_at: string;
}
