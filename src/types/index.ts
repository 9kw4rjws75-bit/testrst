export type UserRole = 'admin' | 'caisse' | 'client' | 'livreur';
export type UserStatus = 'pending' | 'active' | 'suspended';

export type DishCategory = 'entree' | 'plat' | 'dessert' | 'boisson';

export type OrderType = 'sur_place' | 'livraison';

export type OrderStatus =
  | 'en_attente'
  | 'en_preparation'
  | 'pret'
  | 'en_livraison'
  | 'livre'
  | 'recupere'
  | 'annule';

export type PaymentMethod = 'wave' | 'orange_money' | 'carte' | 'especes';

export type PaymentStatus = 'en_attente' | 'paye';

export type DeliveryStatus = 'assigne' | 'en_cours' | 'livre';

export type ReservationStatus = 'en_attente' | 'confirmee' | 'annulee';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Dish {
  id: string;
  name: string;
  description: string;
  price: number;
  category: DishCategory;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DailyMenu {
  id: string;
  dish_id: string;
  menu_date: string;
  quantity_available: number;
  quantity_sold: number;
  is_featured: boolean;
  created_at: string;
  dish?: Dish;
}

export interface Order {
  id: string;
  order_number: string;
  type: OrderType;
  status: OrderStatus;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_id: string | null;
  table_number: string | null;
  delivery_address: string | null;
  total_amount: number;
  delivery_fee: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  delivery?: Delivery;
}

export interface OrderItem {
  id: string;
  order_id: string;
  dish_id: string | null;
  dish_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface Delivery {
  id: string;
  order_id: string;
  delivery_person_id: string | null;
  status: DeliveryStatus;
  assigned_at: string;
  delivered_at: string | null;
  created_at: string;
  delivery_person?: Profile;
  order?: Order;
}

export interface Reservation {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_id: string | null;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  status: ReservationStatus;
  notes: string | null;
  created_at: string;
}

export interface RoleCode {
  id: string;
  code: string;
  role: 'caisse' | 'livreur';
  used: boolean;
  used_by: string | null;
  created_at: string;
}

export interface WeeklyMenu {
  id: string;
  dish_id: string;
  day_of_week: number;
  is_active: boolean;
  created_at: string;
  dish?: Dish;
}

export interface CartItem {
  dish_id: string;
  dish_name: string;
  unit_price: number;
  quantity: number;
  daily_menu_id: string;
}

export type ChallengeType = 'orders_count' | 'spending_amount' | 'orders_streak';
export type ChallengeStatus = 'active' | 'completed' | 'cancelled';
export type RewardStatus = 'available' | 'claimed' | 'expired';
export type SelectionMode = 'leaderboard' | 'lottery';
export type DiscountType = 'percentage' | 'fixed' | 'free_order';

export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  challenge_type: ChallengeType;
  target_value: number;
  start_date: string;
  end_date: string;
  status: ChallengeStatus;
  reward_description: string | null;
  max_winners: number;
  selection_mode: SelectionMode;
  discount_type: DiscountType | null;
  discount_value: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChallengeProgress {
  id: string;
  challenge_id: string;
  client_id: string;
  current_value: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientReward {
  id: string;
  client_id: string;
  challenge_id: string | null;
  reward_title: string;
  reward_description: string | null;
  status: RewardStatus;
  awarded_at: string;
  claimed_at: string | null;
  expires_at: string | null;
  reward_code: string | null;
  discount_type: DiscountType | null;
  discount_value: number | null;
  used_at: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  client_id: string;
  full_name: string;
  email: string;
  phone: string;
  current_value: number;
  completed: boolean;
  completed_at: string | null;
}

export interface RestaurantSettings {
  id: number;
  restaurant_name: string;
  address: string;
  latitude: number;
  longitude: number;
  delivery_fee_base: number;
  delivery_fee_per_km: number;
  delivery_radius_km: number;
  updated_at: string;
}
