/**
 * Shape-compatible with `supabase gen types typescript`.
 *
 * Regenerate after any migration:
 *   npx supabase gen types typescript --project-id <ref> --schema public \
 *     > src/lib/supabase/database.types.ts
 *
 * It is written by hand here so the project typechecks before you have a
 * Supabase project. The definitions mirror /supabase/*.sql exactly.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type DonationCategory = 'veg' | 'non_veg' | 'vegan';
export type FoodType = 'cooked' | 'packaged';
export type FulfilmentMode = 'pickup' | 'delivery' | 'both';
export type RequestMode = 'pickup' | 'delivery';
export type DonationStatus = 'available' | 'partially_claimed' | 'completed' | 'expired' | 'cancelled';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
export type NotificationType =
  | 'request_created'
  | 'request_accepted'
  | 'request_rejected'
  | 'request_cancelled'
  | 'request_auto_rejected'
  | 'order_completed'
  | 'order_timed_out'
  | 'rating_received';

type ProfileRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  usual_donation_times: string | null;
  bio: string | null;
  onboarded_at: string | null;
  created_at: string;
}

type DonationRow = {
  id: string;
  donor_id: string;
  food_name: string;
  description: string | null;
  category: DonationCategory;
  food_type: FoodType;
  allergens: string | null;
  image_path: string | null;
  total_servings: number;
  servings_remaining: number;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string | null;
  fulfilment_mode: FulfilmentMode;
  delivery_radius_km: number | null;
  expires_at: string;
  status: DonationStatus;
  created_at: string;
}

type RequestRow = {
  id: string;
  donation_id: string;
  receiver_id: string;
  servings_requested: number;
  fulfilment_mode: RequestMode;
  status: RequestStatus;
  cancel_reason: string | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
}

type DeliveryDetailsRow = {
  request_id: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string | null;
}

type RatingRow = {
  id: string;
  request_id: string;
  rater_id: string;
  ratee_id: string;
  stars: number;
  comment: string | null;
  created_at: string;
}

type LiveLocationRow = {
  request_id: string;
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
}

type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: Json;
  read: boolean;
  created_at: string;
}

type ReportRow = {
  id: string;
  reporter_id: string;
  reported_id: string;
  request_id: string | null;
  reason: string;
  created_at: string;
}

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

/** Row shape returned by get_available_donations() and get_donation(). */
export type AvailableDonation = {
  id: string;
  donor_id: string;
  donor_name: string;
  donor_avatar_url: string | null;
  donor_avg_rating: number | null;
  donor_ratings_count: number | null;
  food_name: string;
  description: string | null;
  category: DonationCategory;
  food_type: FoodType;
  allergens: string | null;
  image_path: string | null;
  total_servings: number;
  servings_remaining: number;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string | null;
  fulfilment_mode: FulfilmentMode;
  delivery_radius_km: number | null;
  expires_at: string;
  created_at: string;
  distance_km: number | null;
  delivery_available: boolean;
}

export type IncomingRequest = {
  request_id: string;
  donation_id: string;
  food_name: string;
  servings_requested: number;
  fulfilment_mode: RequestMode;
  status: RequestStatus;
  created_at: string;
  servings_remaining: number;
  expires_at: string;
  receiver_id: string;
  receiver_name: string;
  receiver_avatar_url: string | null;
  receiver_avg_rating: number | null;
  receiver_ratings_count: number | null;
}

export type MyRequest = {
  request_id: string;
  donation_id: string;
  food_name: string;
  servings_requested: number;
  fulfilment_mode: RequestMode;
  status: RequestStatus;
  created_at: string;
  expires_at: string;
  pickup_lat: number;
  pickup_lng: number;
  donor_id: string;
  donor_name: string;
  donor_avatar_url: string | null;
}

export type ProfileStats = {
  user_id: string;
  donor_servings_total: number;
  donor_donations_count: number;
  donor_avg_rating: number | null;
  donor_ratings_count: number;
  receiver_servings_total: number;
  receiver_receipts_count: number;
  receiver_avg_rating: number | null;
  receiver_ratings_count: number;
  usual_donation_times: string | null;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<Omit<ProfileRow, 'id'>> & { id: string };
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      donations: {
        Row: DonationRow;
        Insert: Omit<DonationRow, 'id' | 'created_at' | 'status'> &
          Partial<Pick<DonationRow, 'id' | 'created_at' | 'status'>>;
        Update: Partial<DonationRow>;
        Relationships: [];
      };
      requests: {
        Row: RequestRow;
        Insert: Omit<RequestRow, 'id' | 'created_at' | 'status' | 'accepted_at' | 'completed_at' | 'cancel_reason'> &
          Partial<RequestRow>;
        Update: Partial<RequestRow>;
        Relationships: [];
      };
      delivery_details: {
        Row: DeliveryDetailsRow;
        Insert: DeliveryDetailsRow;
        Update: Partial<DeliveryDetailsRow>;
        Relationships: [];
      };
      ratings: {
        Row: RatingRow;
        Insert: Omit<RatingRow, 'id' | 'created_at'> & Partial<Pick<RatingRow, 'id' | 'created_at'>>;
        Update: Partial<RatingRow>;
        Relationships: [];
      };
      live_locations: {
        Row: LiveLocationRow;
        Insert: Omit<LiveLocationRow, 'updated_at'> & Partial<Pick<LiveLocationRow, 'updated_at'>>;
        Update: Partial<LiveLocationRow>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Omit<NotificationRow, 'id' | 'created_at' | 'read'> & Partial<NotificationRow>;
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      reports: {
        Row: ReportRow;
        Insert: Omit<ReportRow, 'id' | 'created_at'> & Partial<Pick<ReportRow, 'id' | 'created_at'>>;
        Update: Partial<ReportRow>;
        Relationships: [];
      };
      blocks: {
        Row: BlockRow;
        Insert: Omit<BlockRow, 'created_at'> & Partial<Pick<BlockRow, 'created_at'>>;
        Update: Partial<BlockRow>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: Omit<PushSubscriptionRow, 'id' | 'created_at'> &
          Partial<Pick<PushSubscriptionRow, 'id' | 'created_at'>>;
        Update: Partial<PushSubscriptionRow>;
        Relationships: [];
      };
      app_config: {
        Row: { key: string; value: Json };
        Insert: { key: string; value: Json };
        Update: Partial<{ key: string; value: Json }>;
        Relationships: [];
      };
      storage_gc: {
        Row: {
          id: number;
          bucket: string;
          path: string;
          enqueued_at: string;
          deleted_at: string | null;
          attempts: number;
          last_error: string | null;
        };
        Insert: { bucket: string; path: string };
        Update: Partial<{ deleted_at: string | null; attempts: number; last_error: string | null }>;
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: Pick<ProfileRow, 'id' | 'full_name' | 'avatar_url' | 'usual_donation_times' | 'bio' | 'created_at'>;
        Relationships: [];
      };
      profile_stats: {
        Row: ProfileStats;
        Relationships: [];
      };
    };
    Functions: {
      get_available_donations: {
        Args: {
          p_center_lat: number;
          p_center_lng: number;
          p_radius_km?: number;
          p_categories?: DonationCategory[] | null;
          p_food_types?: FoodType[] | null;
          p_min_servings?: number;
          p_mode?: RequestMode | null;
          p_limit?: number;
        };
        Returns: AvailableDonation[];
      };
      get_donation: {
        Args: { p_donation_id: string; p_center_lat?: number | null; p_center_lng?: number | null };
        Returns: AvailableDonation[];
      };
      create_request: {
        Args: {
          p_donation_id: string;
          p_servings: number;
          p_mode: RequestMode;
          p_dropoff_lat?: number | null;
          p_dropoff_lng?: number | null;
          p_dropoff_address?: string | null;
        };
        Returns: string;
      };
      accept_request: { Args: { p_request_id: string }; Returns: Json };
      reject_request: { Args: { p_request_id: string }; Returns: Json };
      cancel_request: { Args: { p_request_id: string; p_reason?: string | null }; Returns: Json };
      complete_request: { Args: { p_request_id: string }; Returns: Json };
      get_order_details: { Args: { p_request_id: string }; Returns: Json };
      get_incoming_requests: { Args: Record<string, never>; Returns: IncomingRequest[] };
      get_my_requests: { Args: Record<string, never>; Returns: MyRequest[] };
    };
    Enums: {
      donation_category: DonationCategory;
      food_type: FoodType;
      fulfilment_mode: FulfilmentMode;
      request_mode: RequestMode;
      donation_status: DonationStatus;
      request_status: RequestStatus;
      notification_type: NotificationType;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
