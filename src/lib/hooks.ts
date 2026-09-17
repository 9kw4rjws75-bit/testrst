import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { DailyMenu, Dish, Order, OrderItem, CartItem, Reservation, PaymentMethod, RestaurantSettings, WeeklyMenu, Challenge, ChallengeProgress, ClientReward, LeaderboardEntry, SelectionMode, DiscountType } from '@/types';

export function useDailyMenu(date?: string) {
  const [menus, setMenus] = useState<DailyMenu[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const targetDate = date || new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('daily_menus')
      .select('*, dish:dishes(*)')
      .eq('menu_date', targetDate)
      .order('created_at');
    setMenus((data as DailyMenu[]) || []);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { menus, loading, refetch: fetch };
}

export function useDishes() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('dishes')
      .select('*')
      .eq('is_active', true)
      .order('category, name');
    setDishes(data as Dish[] || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { dishes, loading, refetch: fetch };
}

export async function createOrder(params: {
  type: 'sur_place' | 'livraison';
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerId?: string;
  tableNumber?: string;
  deliveryAddress?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  deliveryFee?: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
  items: CartItem[];
}): Promise<{ order: Order | null; error: string | null }> {
  const { data: orderNumber } = await supabase.rpc('generate_order_number');
  if (!orderNumber) return { order: null, error: 'Erreur génération numéro commande' };

  const subtotal = params.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const deliveryFee = params.deliveryFee || 0;
  const total = subtotal + deliveryFee;

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      type: params.type,
      status: 'en_attente',
      customer_name: params.customerName,
      customer_phone: params.customerPhone,
      customer_email: params.customerEmail || null,
      customer_id: params.customerId || null,
      table_number: params.tableNumber || null,
      delivery_address: params.deliveryAddress || null,
      delivery_lat: params.deliveryLat || null,
      delivery_lng: params.deliveryLng || null,
      delivery_fee: deliveryFee,
      total_amount: total,
      payment_status: 'en_attente',
      payment_method: params.paymentMethod || null,
      notes: params.notes || null,
    })
    .select()
    .single();

  if (orderError) return { order: null, error: orderError.message };
  const order = orderData as Order;

  const orderItems = params.items.map((item) => ({
    order_id: order.id,
    dish_id: item.dish_id,
    dish_name: item.dish_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.unit_price * item.quantity,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) return { order: null, error: itemsError.message };

  for (const item of params.items) {
    const { data: menu } = await supabase
      .from('daily_menus')
      .select('quantity_sold')
      .eq('id', item.daily_menu_id)
      .maybeSingle();
    if (menu) {
      await supabase
        .from('daily_menus')
        .update({ quantity_sold: (menu as any).quantity_sold + item.quantity })
        .eq('id', item.daily_menu_id);
    }
  }

  return { order, error: null };
}

export async function fetchOrderByNumber(orderNumber: string): Promise<{
  order: (Order & { order_items?: OrderItem[]; delivery?: any }) | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items:order_items(*), delivery:deliveries(*, delivery_person:profiles!deliveries_delivery_person_id_fkey(*))')
    .eq('order_number', orderNumber.toUpperCase())
    .maybeSingle();

  if (error) return { order: null, error: error.message };
  return { order: data as any, error: null };
}

export async function createReservation(params: {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerId?: string;
  partySize: number;
  date: string;
  time: string;
  notes?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('reservations').insert({
    customer_name: params.customerName,
    customer_phone: params.customerPhone,
    customer_email: params.customerEmail || null,
    customer_id: params.customerId || null,
    party_size: params.partySize,
    reservation_date: params.date,
    reservation_time: params.time,
    notes: params.notes || null,
  });
  return { error: error?.message ?? null };
}

export function useRestaurantSettings() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('restaurant_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    setSettings(data as RestaurantSettings | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { settings, loading, refetch: fetch };
}

export function useReservations(customerId?: string) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!customerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .eq('customer_id', customerId)
      .order('reservation_date', { ascending: false });
    setReservations((data as Reservation[]) || []);
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { reservations, loading, refetch: fetch };
}

export function useWeeklyMenus() {
  const [weeklyMenus, setWeeklyMenus] = useState<WeeklyMenu[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('weekly_menus')
      .select('*, dish:dishes(*)')
      .eq('is_active', true)
      .order('day_of_week');
    setWeeklyMenus((data as WeeklyMenu[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { weeklyMenus, loading, refetch: fetch };
}

export function useClientOrders(customerId?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!customerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, order_items:order_items(*)')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    setOrders((data as Order[]) || []);
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { orders, loading, refetch: fetch };
}

export async function decrementDailyMenuQuantity(dailyMenuId: string, quantity: number): Promise<void> {
  const { data: menu } = await supabase
    .from('daily_menus')
    .select('quantity_sold')
    .eq('id', dailyMenuId)
    .maybeSingle();
  if (menu) {
    await supabase
      .from('daily_menus')
      .update({ quantity_sold: (menu as any).quantity_sold + quantity })
      .eq('id', dailyMenuId);
  }
}

// ============= CHALLENGES & REWARDS =============

export function useChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .order('created_at', { ascending: false });
    setChallenges((data as Challenge[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { challenges, loading, refetch: fetch };
}

export function useActiveChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .eq('status', 'active')
      .lte('start_date', now)
      .gte('end_date', now)
      .order('created_at', { ascending: false });
    setChallenges((data as Challenge[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { challenges, loading, refetch: fetch };
}

export function useClientProgress(clientId?: string) {
  const [progress, setProgress] = useState<ChallengeProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('challenge_progress')
      .select('*')
      .eq('client_id', clientId);
    setProgress((data as ChallengeProgress[]) || []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { progress, loading, refetch: fetch };
}

export function useClientRewards(clientId?: string) {
  const [rewards, setRewards] = useState<ClientReward[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('client_rewards')
      .select('*')
      .eq('client_id', clientId)
      .order('awarded_at', { ascending: false });
    setRewards((data as ClientReward[]) || []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { rewards, loading, refetch: fetch };
}

export async function getChallengeLeaderboard(challengeId: string): Promise<{
  leaderboard: LeaderboardEntry[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('get_challenge_leaderboard', {
    challenge_uuid: challengeId,
  });
  if (error) return { leaderboard: null, error: error.message };
  return { leaderboard: data as LeaderboardEntry[], error: null };
}

export async function distributeRewards(params: {
  challengeId: string;
  rewardTitle: string;
  rewardDescription?: string;
  numWinners?: number;
  expiresDays?: number;
  selectionMode?: SelectionMode;
  discountType?: DiscountType | null;
  discountValue?: number | null;
}): Promise<{ error: string | null; winners?: { client_id: string; full_name: string; rank_pos: number; reward_code: string }[] }> {
  const { data, error } = await supabase.rpc('distribute_challenge_rewards', {
    challenge_uuid: params.challengeId,
    reward_title: params.rewardTitle,
    reward_desc: params.rewardDescription || null,
    num_winners: params.numWinners || 3,
    expires_days: params.expiresDays || null,
    selection_mode_arg: params.selectionMode || 'leaderboard',
    discount_type_arg: params.discountType || null,
    discount_value_arg: params.discountValue ?? null,
  });
  if (error) return { error: error.message };
  return { error: null, winners: data as any };
}

export async function claimReward(rewardId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('client_rewards')
    .update({ status: 'claimed', claimed_at: new Date().toISOString() })
    .eq('id', rewardId);
  return { error: error?.message ?? null };
}

export async function validateRewardCode(code: string, orderTotal: number): Promise<{
  valid: boolean;
  discountAmount: number;
  discountType: string | null;
  rewardTitle: string | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc('validate_reward_code', {
    code_input: code.toUpperCase(),
    order_total: orderTotal,
  });
  if (error) return { valid: false, discountAmount: 0, discountType: null, rewardTitle: null, error: error.message };
  const result = data as any;
  if (!result || !result[0] || !result[0].valid) {
    return { valid: false, discountAmount: 0, discountType: null, rewardTitle: null, error: 'Code invalide ou déjà utilisé.' };
  }
  const row = result[0];
  return {
    valid: true,
    discountAmount: Number(row.discount_amount) || 0,
    discountType: row.discount_type,
    rewardTitle: row.reward_title,
    error: null,
  };
}
