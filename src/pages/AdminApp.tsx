import { useState, useEffect, useCallback } from 'react';
import { Shield, LayoutDashboard, ClipboardList, Bike, Users, Utensils, ChartBar as FileBarChart, LogOut, Search, Phone, MapPin, TrendingUp, Euro, ShoppingBag, Clock, CircleCheck as CheckCircle2, X, Plus, Trash2, CreditCard as Edit2, Eye, KeyRound, Calendar, UserCheck, UserX, Download, User, Settings, Save, Navigation, Printer, Award, Upload, TriangleAlert as AlertTriangle, Trophy, Flame, Gift, Medal, Crown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { useChallenges, getChallengeLeaderboard, distributeRewards } from '@/lib/hooks';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_COLORS,
  DISH_CATEGORY_LABELS,
  DISH_CATEGORY_COLORS,
  ROLE_LABELS,
  ROLE_COLORS,
  STATUS_LABELS,
  STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_COLORS,
  formatPrice,
  formatDate,
  formatDateTime,
  CHALLENGE_TYPE_LABELS,
  CHALLENGE_TYPE_COLORS,
  CHALLENGE_STATUS_LABELS,
  CHALLENGE_STATUS_COLORS,
  SELECTION_MODE_LABELS,
  DISCOUNT_TYPE_LABELS,
} from '@/lib/constants';
import type { Order, Profile, Dish, RoleCode, Reservation, RestaurantSettings, Challenge, ChallengeType, LeaderboardEntry, SelectionMode, DiscountType } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card, StatCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { EmptyState, LoadingSpinner } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';

type AdminPage = 'dashboard' | 'orders' | 'deliveries' | 'profiles' | 'dishes' | 'reservations' | 'reports' | 'settings' | 'challenges';

export function AdminApp() {
  const [page, setPage] = useState<AdminPage>('dashboard');
  const { profile, signOut } = useAuth();

  const navItems: { id: AdminPage; icon: React.ReactNode; label: string }[] = [
    { id: 'dashboard', icon: <LayoutDashboard size={20} />, label: 'Tableau de bord' },
    { id: 'orders', icon: <ClipboardList size={20} />, label: 'Commandes' },
    { id: 'deliveries', icon: <Bike size={20} />, label: 'Livraisons' },
    { id: 'reservations', icon: <Calendar size={20} />, label: 'Réservations' },
    { id: 'profiles', icon: <Users size={20} />, label: 'Profils' },
    { id: 'dishes', icon: <Utensils size={20} />, label: 'Plats' },
    { id: 'reports', icon: <FileBarChart size={20} />, label: 'Rapports' },
    { id: 'challenges', icon: <Trophy size={20} />, label: 'Défis' },
    { id: 'settings', icon: <Settings size={20} />, label: 'Paramètres' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-64 bg-slate-900 text-white flex flex-col fixed h-full">
        <div className="p-5 flex items-center gap-3 border-b border-slate-700">
          <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
            <Shield size={22} />
          </div>
          <div>
            <p className="font-bold text-sm">Le Gourmet</p>
            <p className="text-xs text-slate-400">Administration</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full',
                page === item.id ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'
              )}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium truncate">{profile?.full_name || 'Admin'}</p>
            <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition-colors w-full"
          >
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64">
        {page === 'dashboard' && <Dashboard />}
        {page === 'orders' && <AdminOrders />}
        {page === 'deliveries' && <AdminDeliveries />}
        {page === 'reservations' && <AdminReservations />}
        {page === 'profiles' && <AdminProfiles />}
        {page === 'dishes' && <AdminDishes />}
        {page === 'reports' && <AdminReports />}
        {page === 'challenges' && <AdminChallenges />}
        {page === 'settings' && <AdminSettings />}
      </main>
    </div>
  );
}

// ============= DASHBOARD =============
function Dashboard() {
  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayOrders: 0,
    activeDeliveries: 0,
    totalClients: 0,
    monthRevenue: 0,
    yearRevenue: 0,
    pendingReservations: 0,
    activeUsers: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekData, setWeekData] = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [topDishes, setTopDishes] = useState<{ name: string; quantity: number; revenue: number }[]>([]);
  const [deliveryStats, setDeliveryStats] = useState<{ name: string; deliveries: number; revenue: number }[]>([]);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const weekStart = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [todayRes, monthRes, yearRes, todayOrdersRes, deliveriesRes, clientsRes, reservationsRes, activeUsersRes, recentRes, weekRes, deliveryRes] = await Promise.all([
        supabase.from('orders').select('total_amount').gte('created_at', today).eq('payment_status', 'paye').neq('status', 'annule'),
        supabase.from('orders').select('total_amount').gte('created_at', monthStart).eq('payment_status', 'paye').neq('status', 'annule'),
        supabase.from('orders').select('total_amount').gte('created_at', yearStart).eq('payment_status', 'paye').neq('status', 'annule'),
        supabase.from('orders').select('*').gte('created_at', today),
        supabase.from('deliveries').select('*').in('status', ['assigne', 'en_cours']),
        supabase.from('profiles').select('*').eq('role', 'client'),
        supabase.from('reservations').select('*').eq('status', 'en_attente'),
        supabase.from('profiles').select('*').eq('status', 'active').in('role', ['caisse', 'livreur']),
        supabase.from('orders').select('*, order_items:order_items(*)').order('created_at', { ascending: false }).limit(5),
        supabase.from('orders').select('total_amount, created_at, status, payment_status').gte('created_at', weekStart).neq('status', 'annule'),
        supabase.from('deliveries').select('*, delivery_person:profiles!deliveries_delivery_person_id_fkey(*), order:orders(*)').eq('status', 'livre'),
      ]);

      const sumRevenue = (data: any[] | null) => (data || []).reduce((s, o) => s + Number(o.total_amount), 0);

      setStats({
        todayRevenue: sumRevenue(todayRes.data),
        todayOrders: todayOrdersRes.data?.length || 0,
        activeDeliveries: deliveriesRes.data?.length || 0,
        totalClients: clientsRes.data?.length || 0,
        monthRevenue: sumRevenue(monthRes.data),
        yearRevenue: sumRevenue(yearRes.data),
        pendingReservations: reservationsRes.data?.length || 0,
        activeUsers: activeUsersRes.data?.length || 0,
      });
      setRecentOrders((recentRes.data as Order[]) || []);

      // Build week comparison data
      const weekOrders = (weekRes.data as any[]) || [];
      const dayMap = new Map<string, { revenue: number; orders: number }>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        dayMap.set(d, { revenue: 0, orders: 0 });
      }
      weekOrders.forEach((o) => {
        const day = o.created_at.split('T')[0];
        const existing = dayMap.get(day);
        if (existing) {
          if (o.payment_status === 'paye') existing.revenue += Number(o.total_amount);
          existing.orders += 1;
        }
      });
      setWeekData(Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v })));

      // Top dishes from recent orders
      const dishMap = new Map<string, { quantity: number; revenue: number }>();
      (recentRes.data as any[] || []).forEach((o) => {
        o.order_items?.forEach((item: any) => {
          const existing = dishMap.get(item.dish_name) || { quantity: 0, revenue: 0 };
          existing.quantity += item.quantity;
          existing.revenue += Number(item.subtotal);
          dishMap.set(item.dish_name, existing);
        });
      });
      setTopDishes(Array.from(dishMap.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.quantity - a.quantity).slice(0, 5));

      // Delivery person stats
      const delivData = (deliveryRes.data as any[]) || [];
      const driverMap = new Map<string, { name: string; deliveries: number; revenue: number }>();
      delivData.forEach((d) => {
        const name = d.delivery_person?.full_name || 'Non assigné';
        const key = d.delivery_person_id || 'none';
        const existing = driverMap.get(key) || { name, deliveries: 0, revenue: 0 };
        existing.deliveries += 1;
        existing.revenue += Number(d.order?.total_amount || 0);
        driverMap.set(key, existing);
      });
      setDeliveryStats(Array.from(driverMap.values()).sort((a, b) => b.deliveries - a.deliveries).slice(0, 5));

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="py-16"><LoadingSpinner size={32} /></div>;
  }

  const maxWeekRevenue = Math.max(...weekData.map((d) => d.revenue), 1);
  const maxDishQty = Math.max(...topDishes.map((d) => d.quantity), 1);
  const maxDriverDeliv = Math.max(...deliveryStats.map((d) => d.deliveries), 1);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Tableau de bord</h1>
      <p className="text-sm text-slate-500 mb-6">Vue d'ensemble de l'activité du restaurant</p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Revenu du jour" value={formatPrice(stats.todayRevenue)} icon={<Euro size={22} />} color="green" />
        <StatCard label="Commandes du jour" value={stats.todayOrders} icon={<ShoppingBag size={22} />} color="blue" />
        <StatCard label="Livraisons actives" value={stats.activeDeliveries} icon={<Bike size={22} />} color="orange" />
        <StatCard label="Clients inscrits" value={stats.totalClients} icon={<Users size={22} />} color="teal" />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Revenu mensuel" value={formatPrice(stats.monthRevenue)} icon={<TrendingUp size={22} />} color="purple" />
        <StatCard label="Revenu annuel" value={formatPrice(stats.yearRevenue)} icon={<Euro size={22} />} color="green" />
        <StatCard label="Réservations en attente" value={stats.pendingReservations} icon={<Calendar size={22} />} color="orange" />
      </div>

      {/* Week comparison chart */}
      <Card className="p-5 mb-6">
        <h2 className="font-bold text-slate-900 mb-4">Comparatif des 7 derniers jours</h2>
        <div className="flex items-end gap-2 h-48">
          {weekData.map((day) => {
            const dayName = new Date(day.date).toLocaleDateString('fr-FR', { weekday: 'short' });
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center group">
                <div className="text-xs font-semibold text-slate-700 mb-1">{formatPrice(day.revenue)}</div>
                <div
                  className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg hover:from-blue-700 hover:to-blue-500 transition-all relative"
                  style={{ height: `${(day.revenue / maxWeekRevenue) * 100}%`, minHeight: '4px' }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-2 text-center">
                  <div className="text-xs text-slate-500 capitalize">{dayName}</div>
                  <div className="text-[10px] text-slate-400">{day.orders} cmd</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Top dishes chart */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} className="text-orange-500" />
            <h2 className="font-bold text-slate-900">Plats les plus commandés</h2>
          </div>
          {topDishes.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {topDishes.map((dish, idx) => (
                <div key={dish.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{idx + 1}</span>
                      {dish.name}
                    </span>
                    <span className="font-semibold text-slate-900">{dish.quantity}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all"
                      style={{ width: `${(dish.quantity / maxDishQty) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Delivery person performance */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bike size={18} className="text-blue-500" />
            <h2 className="font-bold text-slate-900">Performance des livreurs</h2>
          </div>
          {deliveryStats.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Aucune livraison terminée</p>
          ) : (
            <div className="space-y-3">
              {deliveryStats.map((driver, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{idx + 1}</span>
                      {driver.name}
                    </span>
                    <div className="text-right">
                      <span className="font-semibold text-slate-900">{driver.deliveries}</span>
                      <span className="text-xs text-slate-400 ml-2">{formatPrice(driver.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all"
                      style={{ width: `${(driver.deliveries / maxDriverDeliv) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-bold text-slate-900 mb-4">Commandes récentes</h2>
        {recentOrders.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">Aucune commande récente</p>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-slate-900">{order.order_number}</span>
                  <span className="text-sm text-slate-500">{order.customer_name || 'Client'}</span>
                  <Badge className={ORDER_STATUS_COLORS[order.status]}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{formatDateTime(order.created_at)}</span>
                  <span className="font-semibold text-slate-900">{formatPrice(order.total_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============= ADMIN ORDERS =============
function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('*, order_items:order_items(*), delivery:deliveries(*, delivery_person:profiles!deliveries_delivery_person_id_fkey(*))')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') query = query.eq('status', statusFilter);

    const { data } = await query;
    let result = (data as Order[]) || [];
    if (search) {
      const q = search.toUpperCase();
      result = result.filter(
        (o) => o.order_number.includes(q) || o.customer_name.toUpperCase().includes(search.toUpperCase())
      );
    }
    setOrders(result);
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Toutes les commandes</h1>
      <p className="text-sm text-slate-500 mb-6">Vue globale et suivi des commandes</p>

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
            <option value="all">Tous les statuts</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="py-16"><LoadingSpinner size={32} /></div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<ClipboardList size={28} />} title="Aucune commande" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">N°</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Montant</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Statut</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Paiement</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-semibold">{order.order_number}</td>
                  <td className="px-4 py-3">{order.customer_name || 'Client'}</td>
                  <td className="px-4 py-3">{ORDER_TYPE_LABELS[order.type]}</td>
                  <td className="px-4 py-3 font-semibold">{formatPrice(order.total_amount)}</td>
                  <td className="px-4 py-3">
                    <Badge className={ORDER_STATUS_COLORS[order.status]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={PAYMENT_STATUS_COLORS[order.payment_status]}>
                      {PAYMENT_STATUS_LABELS[order.payment_status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(order.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => { setSelectedOrder(order); setDetailOpen(true); }}>
                      <Eye size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={`Commande ${selectedOrder?.order_number || ''}`} size="lg">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400">Client</p>
                <p className="font-semibold">{selectedOrder.customer_name}</p>
                <p className="text-sm text-slate-500">{selectedOrder.customer_phone}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Type</p>
                <p className="font-semibold">{ORDER_TYPE_LABELS[selectedOrder.type]}</p>
                {selectedOrder.delivery_address && <p className="text-sm text-slate-500">{selectedOrder.delivery_address}</p>}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              {selectedOrder.order_items?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between text-sm py-1">
                  <span>{item.quantity}x {item.dish_name}</span>
                  <span className="font-medium">{formatPrice(item.subtotal)}</span>
                </div>
              ))}
              <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>{formatPrice(selectedOrder.total_amount)}</span>
              </div>
            </div>
            {(selectedOrder as any).delivery?.[0]?.delivery_person && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-medium text-blue-700">Livreur</p>
                <p className="text-sm text-blue-800">
                  {(selectedOrder as any).delivery[0].delivery_person.full_name} - {(selectedOrder as any).delivery[0].delivery_person.phone}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============= ADMIN DELIVERIES =============
function AdminDeliveries() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('deliveries')
      .select('*, order:orders(*), delivery_person:profiles!deliveries_delivery_person_id_fkey(*)')
      .order('created_at', { ascending: false });
    setDeliveries(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDeliveries();
    const interval = setInterval(fetchDeliveries, 10000);
    return () => clearInterval(interval);
  }, [fetchDeliveries]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Suivi des livraisons</h1>
      <p className="text-sm text-slate-500 mb-6">Toutes les livraisons en cours et terminées</p>

      {loading ? (
        <div className="py-16"><LoadingSpinner size={32} /></div>
      ) : deliveries.length === 0 ? (
        <EmptyState icon={<Bike size={28} />} title="Aucune livraison" />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {deliveries.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono font-semibold text-sm">{d.order?.order_number}</span>
                <Badge className={(DELIVERY_STATUS_COLORS as any)[d.status]}>
                  {(DELIVERY_STATUS_LABELS as any)[d.status]}
                </Badge>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <User size={14} className="text-slate-400" />
                  <span className="text-slate-700">{d.order?.customer_name || 'Client'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-slate-400" />
                  <span className="text-slate-600">{d.order?.customer_phone}</span>
                </div>
                {d.order?.delivery_address && (
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-slate-400 mt-0.5" />
                    <span className="text-slate-600 text-xs">{d.order.delivery_address}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <Bike size={14} className="text-slate-400" />
                  <span className="text-slate-700 text-xs">
                    {d.delivery_person?.full_name || 'Non assigné'}
                  </span>
                </div>
                {d.delivered_at && (
                  <p className="text-xs text-slate-400">Livré le {formatDateTime(d.delivered_at)}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============= ADMIN RESERVATIONS =============
function AdminReservations() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .order('reservation_date', { ascending: false });
    setReservations((data as Reservation[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('reservations').update({ status }).eq('id', id);
    fetch();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Réservations</h1>
      <p className="text-sm text-slate-500 mb-6">Gérez les réservations de tables</p>

      {loading ? (
        <div className="py-16"><LoadingSpinner size={32} /></div>
      ) : reservations.length === 0 ? (
        <EmptyState icon={<Calendar size={28} />} title="Aucune réservation" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Téléphone</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Personnes</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Date</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Heure</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Statut</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reservations.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{r.customer_name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.customer_phone}</td>
                  <td className="px-4 py-3">{r.party_size}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(r.reservation_date)}</td>
                  <td className="px-4 py-3 text-slate-600">{r.reservation_time.substring(0, 5)}</td>
                  <td className="px-4 py-3">
                    <Badge className={RESERVATION_STATUS_COLORS[r.status]}>
                      {RESERVATION_STATUS_LABELS[r.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'en_attente' && (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="success" onClick={() => updateStatus(r.id, 'confirmee')}>
                          <CheckCircle2 size={14} />
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => updateStatus(r.id, 'annulee')}>
                          <X size={14} />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============= ADMIN PROFILES =============
function AdminProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [codes, setCodes] = useState<RoleCode[]>([]);
  const [codeModal, setCodeModal] = useState(false);
  const [newCodeRole, setNewCodeRole] = useState<'caisse' | 'livreur'>('caisse');
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editModal, setEditModal] = useState(false);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (roleFilter !== 'all') query = query.eq('role', roleFilter);
    const { data } = await query;
    let result = (data as Profile[]) || [];
    if (search) {
      result = result.filter(
        (p) =>
          p.full_name.toLowerCase().includes(search.toLowerCase()) ||
          p.email.toLowerCase().includes(search.toLowerCase())
      );
    }
    setProfiles(result);
    setLoading(false);
  }, [roleFilter, search]);

  const fetchCodes = useCallback(async () => {
    const { data } = await supabase.from('role_codes').select('*').order('created_at', { ascending: false });
    setCodes((data as RoleCode[]) || []);
  }, []);

  useEffect(() => {
    fetchProfiles();
    fetchCodes();
  }, [fetchProfiles, fetchCodes]);

  const updateProfileStatus = async (id: string, status: string) => {
    await supabase.from('profiles').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    fetchProfiles();
  };

  const updateProfile = async (id: string, updates: Partial<Profile>) => {
    await supabase.from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    fetchProfiles();
    setEditModal(false);
  };

  const generateCode = async () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    await supabase.from('role_codes').insert({ code, role: newCodeRole });
    setCodeModal(false);
    fetchCodes();
  };

  const deleteCode = async (id: string) => {
    await supabase.from('role_codes').delete().eq('id', id);
    fetchCodes();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion des profils</h1>
          <p className="text-sm text-slate-500 mt-1">Validez et gérez les comptes utilisateurs</p>
        </div>
        <Button onClick={() => setCodeModal(true)}>
          <KeyRound size={16} className="mr-1" /> Générer un code
        </Button>
      </div>

      {codes.length > 0 && (
        <Card className="p-4 mb-4">
          <h3 className="font-semibold text-sm text-slate-900 mb-3">Codes de validation actifs</h3>
          <div className="grid grid-cols-3 gap-3">
            {codes.filter((c) => !c.used).map((code) => (
              <div key={code.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-mono font-bold text-slate-900">{code.code}</p>
                  <p className="text-xs text-slate-400">{ROLE_LABELS[code.role]}</p>
                </div>
                <button onClick={() => deleteCode(code.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="w-auto">
            <option value="all">Tous les rôles</option>
            {Object.entries(ROLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="py-16"><LoadingSpinner size={32} /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Nom</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Téléphone</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Rôle</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Statut</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{p.full_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.email}</td>
                  <td className="px-4 py-3 text-slate-600">{p.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge className={ROLE_COLORS[p.role]}>{ROLE_LABELS[p.role]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={STATUS_COLORS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {p.status === 'pending' && (
                        <Button size="sm" variant="success" onClick={() => updateProfileStatus(p.id, 'active')}>
                          <UserCheck size={14} />
                        </Button>
                      )}
                      {p.status === 'active' && p.role !== 'admin' && (
                        <Button size="sm" variant="outline" onClick={() => updateProfileStatus(p.id, 'suspended')}>
                          <UserX size={14} />
                        </Button>
                      )}
                      {p.status === 'suspended' && (
                        <Button size="sm" variant="success" onClick={() => updateProfileStatus(p.id, 'active')}>
                          <UserCheck size={14} />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setEditProfile(p); setEditModal(true); }}>
                        <Edit2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={codeModal} onClose={() => setCodeModal(false)} title="Générer un code de validation" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Ce code permettra à un nouvel utilisateur de créer un compte caissier ou livreur. L'admin doit communiquer ce code manuellement.
          </p>
          <Select label="Rôle" value={newCodeRole} onChange={(e) => setNewCodeRole(e.target.value as 'caisse' | 'livreur')}>
            <option value="caisse">Caissier</option>
            <option value="livreur">Livreur</option>
          </Select>
          <Button className="w-full" onClick={generateCode}>
            <KeyRound size={16} className="mr-1" /> Générer
          </Button>
        </div>
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Modifier le profil" size="sm">
        {editProfile && (
          <div className="space-y-4">
            <Input
              label="Nom complet"
              value={editProfile.full_name}
              onChange={(e) => setEditProfile({ ...editProfile, full_name: e.target.value })}
            />
            <Input
              label="Téléphone"
              value={editProfile.phone}
              onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })}
            />
            <Select
              label="Rôle"
              value={editProfile.role}
              onChange={(e) => setEditProfile({ ...editProfile, role: e.target.value as Profile['role'] })}
            >
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
            <Button className="w-full" onClick={() => updateProfile(editProfile.id, editProfile)}>
              Enregistrer
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============= ADMIN DISHES =============
function AdminDishes() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Dish | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'plat' as Dish['category'],
    image_url: '',
    is_active: true,
  });

  const [deleteTarget, setDeleteTarget] = useState<Dish | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');

  const fetchDishes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('dishes').select('*').order('category, name');
    setDishes((data as Dish[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDishes();
  }, [fetchDishes]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: 0, category: 'plat', image_url: '', is_active: true });
    setImagePreview('');
    setModal(true);
  };

  const openEdit = (dish: Dish) => {
    setEditing(dish);
    setForm({
      name: dish.name,
      description: dish.description,
      price: dish.price,
      category: dish.category,
      image_url: dish.image_url || '',
      is_active: dish.is_active,
    });
    setImagePreview(dish.image_url || '');
    setModal(true);
  };

  const save = async () => {
    if (!form.name) return;
    if (editing) {
      await supabase.from('dishes').update(form).eq('id', editing.id);
    } else {
      await supabase.from('dishes').insert(form);
    }
    setModal(false);
    fetchDishes();
  };

  const toggleActive = async (dish: Dish) => {
    await supabase.from('dishes').update({ is_active: !dish.is_active }).eq('id', dish.id);
    fetchDishes();
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const { error } = await supabase.storage.from('dish-images').upload(fileName, file);
    if (error) {
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('dish-images').getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;
    setForm((prev) => ({ ...prev, image_url: publicUrl }));
    setImagePreview(publicUrl);
    setUploading(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.image_url) {
      const path = deleteTarget.image_url.split('/dish-images/').pop();
      if (path) await supabase.storage.from('dish-images').remove([path]);
    }
    await supabase.from('dishes').delete().eq('id', deleteTarget.id);
    setDeleteTarget(null);
    fetchDishes();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Catalogue des plats</h1>
          <p className="text-sm text-slate-500 mt-1">Gérez les plats du restaurant</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} className="mr-1" /> Ajouter un plat
        </Button>
      </div>

      {loading ? (
        <div className="py-16"><LoadingSpinner size={32} /></div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {dishes.map((dish) => (
            <Card key={dish.id} className={cn('p-4', !dish.is_active && 'opacity-50')}>
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center flex-shrink-0">
                  {dish.image_url ? (
                    <img src={dish.image_url} alt={dish.name} className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    <Utensils size={24} className="text-orange-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-slate-900">{dish.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{dish.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={DISH_CATEGORY_COLORS[dish.category]}>
                      {DISH_CATEGORY_LABELS[dish.category]}
                    </Badge>
                    <span className="font-bold text-sm text-orange-600">{formatPrice(dish.price)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                <Button size="sm" variant="ghost" onClick={() => openEdit(dish)}>
                  <Edit2 size={14} /> Modifier
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(dish)}>
                  {dish.is_active ? 'Désactiver' : 'Activer'}
                </Button>
                <button
                  onClick={() => setDeleteTarget(dish)}
                  className="ml-auto w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier le plat' : 'Nouveau plat'} size="md">
        <div className="space-y-4">
          <Input label="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prix (€)" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
            <Select label="Catégorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Dish['category'] })}>
              {Object.entries(DISH_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Image du plat</label>
            <div className="flex items-center gap-3">
              <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                {imagePreview ? (
                  <img src={imagePreview} alt="Aperçu" className="w-full h-full object-cover" />
                ) : (
                  <Utensils size={24} className="text-slate-300" />
                )}
              </div>
              <label className="flex-1 cursor-pointer">
                <div className="flex flex-col items-center justify-center gap-1 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all">
                  {uploading ? (
                    <LoadingSpinner size={20} />
                  ) : (
                    <Upload size={20} className="text-slate-400" />
                  )}
                  <span className="text-xs text-slate-500 font-medium">
                    {uploading ? 'Téléversement...' : 'Choisir une image'}
                  </span>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                />
              </label>
            </div>
          </div>
          <Button className="w-full" onClick={save}>{editing ? 'Enregistrer' : 'Créer'}</Button>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Supprimer le plat" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Supprimer « {deleteTarget?.name} » ?</p>
              <p className="text-xs text-slate-500 mt-0.5">Cette action est irréversible.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={confirmDelete}>
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ============= ADMIN REPORTS =============
type ReportPeriod = 'day' | 'week' | 'month' | 'year' | 'custom';

function AdminReports() {
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [report, setReport] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    deliveryOrders: 0,
    onSiteOrders: 0,
    paidOrders: 0,
    pendingOrders: 0,
    topDishes: [] as { name: string; quantity: number; revenue: number }[],
    ordersByDay: [] as { date: string; count: number; revenue: number }[],
  });
  const [loading, setLoading] = useState(true);

  const getStartDate = (): string => {
    const now = new Date();
    if (period === 'day') return now.toISOString().split('T')[0];
    if (period === 'week') return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    if (period === 'year') return new Date(now.getFullYear(), 0, 1).toISOString();
    return customStart ? new Date(customStart).toISOString() : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  };

  const getEndDate = (): string | null => {
    if (period === 'custom' && customEnd) {
      return new Date(customEnd + 'T23:59:59').toISOString();
    }
    return null;
  };

  useEffect(() => {
    if (period === 'custom' && (!customStart || !customEnd)) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const startDate = getStartDate();
      const endDate = getEndDate();

      let query = supabase
        .from('orders')
        .select('*, order_items:order_items(*)')
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (endDate) query = query.lte('created_at', endDate);

      const { data: orders } = await query;

      const allOrders = ((orders as Order[]) || []).filter((o) => o.status !== 'annule');
      const paidOrders = allOrders.filter((o) => o.payment_status === 'paye');
      const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total_amount), 0);
      const deliveryOrders = allOrders.filter((o) => o.type === 'livraison').length;
      const onSiteOrders = allOrders.filter((o) => o.type === 'sur_place').length;

      const dishMap = new Map<string, { quantity: number; revenue: number }>();
      allOrders.forEach((o) => {
        o.order_items?.forEach((item: any) => {
          const existing = dishMap.get(item.dish_name) || { quantity: 0, revenue: 0 };
          existing.quantity += item.quantity;
          existing.revenue += Number(item.subtotal);
          dishMap.set(item.dish_name, existing);
        });
      });
      const topDishes = Array.from(dishMap.entries())
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      const dayMap = new Map<string, { count: number; revenue: number }>();
      allOrders.forEach((o) => {
        const day = o.created_at.split('T')[0];
        const existing = dayMap.get(day) || { count: 0, revenue: 0 };
        existing.count += 1;
        existing.revenue += Number(o.total_amount);
        dayMap.set(day, existing);
      });
      const ordersByDay = Array.from(dayMap.entries())
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      setReport({
        totalRevenue,
        totalOrders: allOrders.length,
        avgOrderValue: allOrders.length > 0 ? totalRevenue / allOrders.length : 0,
        deliveryOrders,
        onSiteOrders,
        paidOrders: paidOrders.length,
        pendingOrders: allOrders.filter((o) => o.payment_status === 'en_attente').length,
        topDishes,
        ordersByDay,
      });
      setLoading(false);
    })();
  }, [period, customStart, customEnd]);

  const exportCSV = () => {
    const csv = [
      ['Métrique', 'Valeur'],
      ['Revenu total', report.totalRevenue.toFixed(2)],
      ['Nombre de commandes', report.totalOrders.toString()],
      ['Valeur moyenne', report.avgOrderValue.toFixed(2)],
      ['Commandes sur place', report.onSiteOrders.toString()],
      ['Commandes livraison', report.deliveryOrders.toString()],
      ['Commandes payées', report.paidOrders.toString()],
      ['Commandes en attente', report.pendingOrders.toString()],
      [],
      ['Top plats', 'Quantité', 'Revenu'],
      ...report.topDishes.map((d) => [d.name, d.quantity.toString(), d.revenue.toFixed(2)]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const rows: string[][] = [];
    rows.push(['Métrique', 'Valeur']);
    rows.push(['Revenu total', report.totalRevenue.toFixed(2)]);
    rows.push(['Nombre de commandes', report.totalOrders.toString()]);
    rows.push(['Valeur moyenne', report.avgOrderValue.toFixed(2)]);
    rows.push(['Commandes sur place', report.onSiteOrders.toString()]);
    rows.push(['Commandes livraison', report.deliveryOrders.toString()]);
    rows.push(['Commandes payées', report.paidOrders.toString()]);
    rows.push(['Commandes en attente', report.pendingOrders.toString()]);
    rows.push([]);
    rows.push(['Top plats', 'Quantité', 'Revenu']);
    report.topDishes.forEach((d) => rows.push([d.name, d.quantity.toString(), d.revenue.toFixed(2)]));
    rows.push([]);
    rows.push(['Évolution journalière', 'Commandes', 'Revenu']);
    report.ordersByDay.forEach((d) => rows.push([d.date, d.count.toString(), d.revenue.toFixed(2)]));

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body><table>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></body></html>`;

    const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport_${period}_${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    const periodLabel = period === 'day' ? "Aujourd'hui" : period === 'week' ? 'Cette semaine' : period === 'month' ? 'Ce mois' : period === 'year' ? 'Cette année' : `${customStart} - ${customEnd}`;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapport - Le Gourmet</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:Arial,sans-serif;}
      body{padding:32px;color:#1e293b;}
      h1{font-size:24px;margin-bottom:4px;}h2{font-size:16px;margin:20px 0 10px;color:#334155;}
      .period{color:#64748b;font-size:14px;margin-bottom:20px;}
      .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
      .stat{border:1px solid #e2e8f0;border-radius:8px;padding:12px;}.stat .label{font-size:11px;color:#64748b;}.stat .value{font-size:20px;font-weight:bold;margin-top:4px;}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;}th{text-align:left;font-size:12px;color:#64748b;border-bottom:2px solid #e2e8f0;padding:8px 4px;}td{font-size:13px;padding:6px 4px;border-bottom:1px solid #f1f5f9;}
      .footer{margin-top:32px;text-align:center;font-size:11px;color:#94a3b8;}
      @media print{body{padding:16px;}}
    </style></head><body>
    <h1>Le Gourmet - Rapport de performance</h1>
    <p class="period">Période: ${periodLabel}</p>
    <div class="stats">
      <div class="stat"><div class="label">Revenu total</div><div class="value">${formatPrice(report.totalRevenue)}</div></div>
      <div class="stat"><div class="label">Commandes</div><div class="value">${report.totalOrders}</div></div>
      <div class="stat"><div class="label">Valeur moyenne</div><div class="value">${formatPrice(report.avgOrderValue)}</div></div>
      <div class="stat"><div class="label">Payées</div><div class="value">${report.paidOrders}</div></div>
    </div>
    <h2>Top 10 des plats</h2><table><thead><tr><th>#</th><th>Plat</th><th>Quantité</th><th>Revenu</th></tr></thead><tbody>
    ${report.topDishes.map((d, i) => `<tr><td>${i + 1}</td><td>${d.name}</td><td>${d.quantity}</td><td>${formatPrice(d.revenue)}</td></tr>`).join('')}
    </tbody></table>
    <h2>Évolution journalière</h2><table><thead><tr><th>Date</th><th>Commandes</th><th>Revenu</th></tr></thead><tbody>
    ${report.ordersByDay.map((d) => `<tr><td>${d.date}</td><td>${d.count}</td><td>${formatPrice(d.revenue)}</td></tr>`).join('')}
    </tbody></table>
    <div class="footer"><p>Le Gourmet - Restaurant | Généré le ${new Date().toLocaleString('fr-FR')}</p></div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  if (loading) {
    return <div className="py-16"><LoadingSpinner size={32} /></div>;
  }

  const maxDayRevenue = Math.max(...report.ordersByDay.map((d) => d.revenue), 1);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rapports de performance</h1>
          <p className="text-sm text-slate-500 mt-1">Statistiques et analyse de l'activité</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={period} onChange={(e) => setPeriod(e.target.value as ReportPeriod)} className="w-auto">
            <option value="day">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="year">Cette année</option>
            <option value="custom">Période personnalisée</option>
          </Select>
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-400 text-sm">à</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={printReport}>
              <Printer size={16} className="mr-1" /> Imprimer
            </Button>
            <Button variant="outline" onClick={exportExcel}>
              <Download size={16} className="mr-1" /> Excel
            </Button>
            <Button variant="outline" onClick={exportCSV}>
              <Download size={16} className="mr-1" /> CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Revenu total" value={formatPrice(report.totalRevenue)} icon={<Euro size={22} />} color="green" />
        <StatCard label="Commandes" value={report.totalOrders} icon={<ShoppingBag size={22} />} color="blue" />
        <StatCard label="Valeur moyenne" value={formatPrice(report.avgOrderValue)} icon={<TrendingUp size={22} />} color="purple" />
        <StatCard label="Payées" value={report.paidOrders} icon={<CheckCircle2 size={22} />} color="teal" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Répartition par type</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Sur place</span>
                <span className="font-semibold">{report.onSiteOrders}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${report.totalOrders > 0 ? (report.onSiteOrders / report.totalOrders) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Livraison</span>
                <span className="font-semibold">{report.deliveryOrders}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full"
                  style={{ width: `${report.totalOrders > 0 ? (report.deliveryOrders / report.totalOrders) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Paiements</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">Payées</span>
                <span className="font-semibold text-green-600">{report.paidOrders}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${report.totalOrders > 0 ? (report.paidOrders / report.totalOrders) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600">En attente</span>
                <span className="font-semibold text-amber-600">{report.pendingOrders}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${report.totalOrders > 0 ? (report.pendingOrders / report.totalOrders) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <h3 className="font-semibold text-slate-900 mb-4">Évolution des commandes</h3>
        {report.ordersByDay.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">Pas de données pour cette période</p>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {report.ordersByDay.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center group relative">
                <div
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                  style={{ height: `${(day.revenue / maxDayRevenue) * 100}%`, minHeight: '4px' }}
                  title={`${formatDate(day.date)}: ${formatPrice(day.revenue)}`}
                />
                <span className="text-[8px] text-slate-400 mt-1 hidden lg:inline">
                  {day.date.substring(5)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Top 10 des plats</h3>
        {report.topDishes.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">Aucune donnée</p>
        ) : (
          <div className="space-y-2">
            {report.topDishes.map((dish, idx) => (
              <div key={dish.name} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <span className="w-6 text-center font-bold text-slate-400">{idx + 1}</span>
                <div className="flex-1">
                  <p className="font-medium text-sm text-slate-900">{dish.name}</p>
                  <p className="text-xs text-slate-500">{dish.quantity} vendus</p>
                </div>
                <span className="font-semibold text-slate-900">{formatPrice(dish.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============= ADMIN SETTINGS =============
function AdminSettings() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    restaurant_name: '',
    address: '',
    latitude: 0,
    longitude: 0,
    delivery_fee_base: 0,
    delivery_fee_per_km: 0,
    delivery_radius_km: 0,
  });
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (data) {
        setSettings(data as RestaurantSettings);
        setForm({
          restaurant_name: data.restaurant_name,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          delivery_fee_base: data.delivery_fee_base,
          delivery_fee_per_km: data.delivery_fee_per_km,
          delivery_radius_km: data.delivery_radius_km,
        });
      }
      setLoading(false);
    })();
  }, []);

  const geocodeAddress = async () => {
    if (!form.address.trim()) {
      setError('Veuillez saisir une adresse.');
      return;
    }
    setLocating(true);
    setError(null);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(form.address)}&limit=1`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data && data[0]) {
        setForm((prev) => ({
          ...prev,
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        }));
      } else {
        setError('Adresse introuvable. Essayez une adresse plus précise.');
      }
    } catch {
      setError("Erreur lors de la recherche de l'adresse.");
    }
    setLocating(false);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('La géolocalisation n\'est pas supportée.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        setLocating(false);
      },
      () => {
        setError('Impossible d\'obtenir votre position.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const { error: updateError } = await supabase
      .from('restaurant_settings')
      .update({
        restaurant_name: form.restaurant_name,
        address: form.address,
        latitude: form.latitude,
        longitude: form.longitude,
        delivery_fee_base: form.delivery_fee_base,
        delivery_fee_per_km: form.delivery_fee_per_km,
        delivery_radius_km: form.delivery_radius_km,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  if (loading) {
    return <div className="py-16"><LoadingSpinner size={32} /></div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white">
            <Settings size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
            <p className="text-sm text-slate-500">Configuration du restaurant et des livraisons</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 size={16} /> Paramètres enregistrés avec succès.
        </div>
      )}

      {/* Restaurant identity */}
      <Card className="p-5 mb-4">
        <h2 className="font-bold text-slate-900 mb-4">Identité du restaurant</h2>
        <div className="space-y-4">
          <Input
            label="Nom du restaurant"
            value={form.restaurant_name}
            onChange={(e) => setForm({ ...form, restaurant_name: e.target.value })}
            placeholder="Le Gourmet"
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Adresse du restaurant</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 rue de Paris, Dakar"
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              />
              <Button variant="outline" onClick={geocodeAddress} disabled={locating}>
                {locating ? <LoadingSpinner size={16} /> : <Search size={16} className="mr-1" />}
                Rechercher
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              L'adresse est utilisée comme point de départ pour le calcul des frais de livraison.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitude"
              type="number"
              step="0.000001"
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })}
            />
            <Input
              label="Longitude"
              type="number"
              step="0.000001"
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })}
            />
          </div>
          <Button variant="outline" onClick={useMyLocation} disabled={locating}>
            <Navigation size={16} className="mr-1" /> Utiliser ma position actuelle
          </Button>
        </div>
      </Card>

      {/* Delivery fee configuration */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Bike size={18} className="text-orange-500" />
          <h2 className="font-bold text-slate-900">Configuration des frais de livraison</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Frais de base (€)"
              type="number"
              step="0.01"
              value={form.delivery_fee_base}
              onChange={(e) => setForm({ ...form, delivery_fee_base: Number(e.target.value) })}
            />
            <Input
              label="Frais par kilomètre (€)"
              type="number"
              step="0.01"
              value={form.delivery_fee_per_km}
              onChange={(e) => setForm({ ...form, delivery_fee_per_km: Number(e.target.value) })}
            />
          </div>
          <Input
            label="Rayon de livraison maximum (km, 0 = illimité)"
            type="number"
            step="0.1"
            value={form.delivery_radius_km}
            onChange={(e) => setForm({ ...form, delivery_radius_km: Number(e.target.value) })}
          />
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-medium mb-2">Formule de calcul</p>
            <div className="bg-white rounded-lg px-4 py-3 font-mono text-sm text-slate-700">
              Frais = Base + (km × Prix/km)
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Exemple: {formatPrice(form.delivery_fee_base)} + (5 km × {formatPrice(form.delivery_fee_per_km)}) = {formatPrice(form.delivery_fee_base + 5 * form.delivery_fee_per_km)}
            </p>
          </div>
        </div>
      </Card>

      <Button size="lg" onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <LoadingSpinner size={18} /> : <Save size={18} className="mr-1" />}
        {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
      </Button>
    </div>
  );
}

// ============= ADMIN CHALLENGES =============
function AdminChallenges() {
  const { challenges, loading, refetch } = useChallenges();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    challenge_type: 'orders_count' as ChallengeType,
    target_value: 5,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    reward_description: '',
    max_winners: 3,
    selection_mode: 'leaderboard' as SelectionMode,
    discount_type: 'percentage' as DiscountType,
    discount_value: 10,
  });
  const [leaderboardModal, setLeaderboardModal] = useState<Challenge | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [distributeModal, setDistributeModal] = useState(false);
  const [distributeForm, setDistributeForm] = useState({ rewardTitle: '', rewardDesc: '', numWinners: 3, expiresDays: 30 });
  const [distributing, setDistributing] = useState(false);
  const [distributeError, setDistributeError] = useState<string | null>(null);
  const [distributeSuccess, setDistributeSuccess] = useState<{ full_name: string; reward_code: string }[] | null>(null);

  const openAdd = () => {
    setEditing(null);
    setForm({
      title: '',
      description: '',
      challenge_type: 'orders_count',
      target_value: 5,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      reward_description: '',
      max_winners: 3,
      selection_mode: 'leaderboard',
      discount_type: 'percentage',
      discount_value: 10,
    });
    setModal(true);
  };

  const openEdit = (ch: Challenge) => {
    setEditing(ch);
    setForm({
      title: ch.title,
      description: ch.description || '',
      challenge_type: ch.challenge_type,
      target_value: ch.target_value,
      start_date: ch.start_date.split('T')[0],
      end_date: ch.end_date.split('T')[0],
      reward_description: ch.reward_description || '',
      max_winners: ch.max_winners,
      selection_mode: ch.selection_mode || 'leaderboard',
      discount_type: ch.discount_type || 'percentage',
      discount_value: ch.discount_value || 10,
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.title) return;
    const payload = {
      title: form.title,
      description: form.description || null,
      challenge_type: form.challenge_type,
      target_value: form.target_value,
      start_date: new Date(form.start_date).toISOString(),
      end_date: new Date(form.end_date + 'T23:59:59').toISOString(),
      reward_description: form.reward_description || null,
      max_winners: form.max_winners,
      selection_mode: form.selection_mode,
      discount_type: form.discount_type,
      discount_value: form.discount_type === 'free_order' ? null : form.discount_value,
    };
    if (editing) {
      await supabase.from('challenges').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await supabase.from('challenges').insert(payload);
    }
    setModal(false);
    refetch();
  };

  const cancelChallenge = async (id: string) => {
    await supabase.from('challenges').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
    refetch();
  };

  const openLeaderboard = async (ch: Challenge) => {
    setLeaderboardModal(ch);
    setLeaderboardLoading(true);
    setLeaderboard([]);
    const { leaderboard: lb, error } = await getChallengeLeaderboard(ch.id);
    if (!error && lb) setLeaderboard(lb);
    setLeaderboardLoading(false);
  };

  const openDistribute = (ch: Challenge) => {
    setLeaderboardModal(ch);
    setDistributeModal(true);
    setDistributeSuccess(null);
    setDistributeForm({
      rewardTitle: ch.reward_description || `Récompense: ${ch.title}`,
      rewardDesc: '',
      numWinners: ch.max_winners,
      expiresDays: 30,
    });
    setDistributeError(null);
  };

  const confirmDistribute = async () => {
    if (!leaderboardModal) return;
    setDistributing(true);
    setDistributeError(null);
    const { error, winners } = await distributeRewards({
      challengeId: leaderboardModal.id,
      rewardTitle: distributeForm.rewardTitle,
      rewardDescription: distributeForm.rewardDesc || undefined,
      numWinners: distributeForm.numWinners,
      expiresDays: distributeForm.expiresDays || undefined,
      selectionMode: leaderboardModal.selection_mode || 'leaderboard',
      discountType: leaderboardModal.discount_type,
      discountValue: leaderboardModal.discount_value,
    });
    setDistributing(false);
    if (error) {
      setDistributeError(error);
    } else {
      setDistributeSuccess(winners as any || []);
      refetch();
    }
  };

  const formatProgressValue = (type: ChallengeType, value: number) => {
    if (type === 'spending_amount') return formatPrice(value / 100);
    return String(value);
  };

  if (loading) {
    return <div className="py-16"><LoadingSpinner size={32} /></div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Défis & Concours</h1>
          <p className="text-sm text-slate-500 mt-1">Créez des challenges pour récompenser les clients fidèles</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} className="mr-1" /> Nouveau défi
        </Button>
      </div>

      {challenges.length === 0 ? (
        <EmptyState
          icon={<Trophy size={28} />}
          title="Aucun défi créé"
          description="Lancez un concours pour motiver vos clients et récompenser leur fidélité."
          action={<Button onClick={openAdd}><Plus size={16} className="mr-1" /> Créer un défi</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {challenges.map((ch) => (
            <Card key={ch.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Trophy size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{ch.title}</h3>
                    <p className="text-xs text-slate-400">{formatDate(ch.start_date)} → {formatDate(ch.end_date)}</p>
                  </div>
                </div>
                <Badge className={CHALLENGE_STATUS_COLORS[ch.status]}>
                  {CHALLENGE_STATUS_LABELS[ch.status]}
                </Badge>
              </div>

              {ch.description && <p className="text-sm text-slate-500 mb-3 line-clamp-2">{ch.description}</p>}

              <div className="flex flex-wrap gap-2 mb-3">
                <Badge className={CHALLENGE_TYPE_COLORS[ch.challenge_type]}>
                  {CHALLENGE_TYPE_LABELS[ch.challenge_type]}
                </Badge>
                <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                  Objectif: {ch.challenge_type === 'spending_amount' ? formatPrice(ch.target_value / 100) : ch.target_value}
                </Badge>
                <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                  <Medal size={12} /> {ch.max_winners} gagnant(s)
                </Badge>
              </div>

              {ch.reward_description && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 mb-3">
                  <Gift size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">{ch.reward_description}</p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <Button size="sm" variant="ghost" onClick={() => openLeaderboard(ch)}>
                  <Crown size={14} /> Classement
                </Button>
                {ch.status === 'active' && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(ch)}>
                      <Edit2 size={14} /> Modifier
                    </Button>
                    <Button size="sm" variant="ghost" className="text-green-600" onClick={() => openDistribute(ch)}>
                      <Gift size={14} /> Distribuer
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-500 ml-auto" onClick={() => cancelChallenge(ch.id)}>
                      <X size={14} />
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Modifier le défi' : 'Nouveau défi'} size="md">
        <div className="space-y-4">
          <Input label="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Défi du mois" />
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Expliquez le défi aux clients" />
          <Select label="Type de défi" value={form.challenge_type} onChange={(e) => setForm({ ...form, challenge_type: e.target.value as ChallengeType })}>
            <option value="orders_count">Nombre de commandes</option>
            <option value="spending_amount">Montant dépensé (€)</option>
            <option value="orders_streak">Série de commandes</option>
          </Select>
          <Input
            label={form.challenge_type === 'spending_amount' ? 'Montant cible (€)' : 'Objectif (nombre)'}
            type="number"
            min={1}
            value={form.target_value}
            onChange={(e) => setForm({ ...form, target_value: Number(e.target.value) })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date de début" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            <Input label="Date de fin" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
          <Input
            label="Nombre de gagnants"
            type="number"
            min={1}
            max={50}
            value={form.max_winners}
            onChange={(e) => setForm({ ...form, max_winners: Number(e.target.value) })}
          />
          <Textarea label="Récompense" value={form.reward_description} onChange={(e) => setForm({ ...form, reward_description: e.target.value })} rows={2} placeholder="Ex: Repas gratuit pour 2 personnes" />
          <Select label="Mode de sélection des gagnants" value={form.selection_mode} onChange={(e) => setForm({ ...form, selection_mode: e.target.value as SelectionMode })}>
            <option value="leaderboard">Classement (top N)</option>
            <option value="lottery">Tirage au sort</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type de réduction" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as DiscountType, discount_value: e.target.value === 'free_order' ? 0 : form.discount_value })}>
              <option value="percentage">Pourcentage (%)</option>
              <option value="fixed">Montant fixe (€)</option>
              <option value="free_order">Commande gratuite</option>
            </Select>
            {form.discount_type !== 'free_order' && (
              <Input
                label={form.discount_type === 'percentage' ? 'Valeur (%)' : 'Montant (€)'}
                type="number"
                min={0}
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
              />
            )}
          </div>
          <Button className="w-full" onClick={save}>{editing ? 'Enregistrer' : 'Créer le défi'}</Button>
        </div>
      </Modal>

      {/* Leaderboard modal */}
      <Modal open={!!leaderboardModal && !distributeModal} onClose={() => setLeaderboardModal(null)} title={`Classement — ${leaderboardModal?.title || ''}`} size="lg">
        {leaderboardLoading ? (
          <div className="py-8"><LoadingSpinner /></div>
        ) : leaderboard.length === 0 ? (
          <EmptyState icon={<Trophy size={28} />} title="Aucun participant" description="Aucun client n'a encore participé à ce défi." />
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry) => (
              <div key={entry.client_id} className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                entry.rank === 1 ? 'bg-amber-50 border-amber-200' : entry.rank <= 3 ? 'bg-slate-50 border-slate-200' : 'border-slate-100'
              )}>
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                  entry.rank === 1 ? 'bg-amber-500 text-white' : entry.rank === 2 ? 'bg-slate-400 text-white' : entry.rank === 3 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-500'
                )}>
                  {entry.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-slate-900 truncate">{entry.full_name}</p>
                  <p className="text-xs text-slate-400">{entry.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm text-slate-900">
                    {formatProgressValue(leaderboardModal?.challenge_type || 'orders_count', entry.current_value)}
                  </p>
                  {entry.completed && <p className="text-xs text-green-600">Objectif atteint</p>}
                </div>
              </div>
            ))}
            {leaderboardModal?.status === 'active' && (
              <div className="pt-4">
                <Button className="w-full" onClick={() => openDistribute(leaderboardModal!)}>
                  <Gift size={16} className="mr-1" /> Distribuer les récompenses
                </Button>
                <p className="text-xs text-slate-400 text-center mt-2">
                  Cela terminera le défi et attribuera les récompenses aux {leaderboardModal?.max_winners} meilleurs.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Distribute rewards modal */}
      <Modal open={distributeModal} onClose={() => { setDistributeModal(false); setDistributeSuccess(null); setDistributeError(null); }} title={distributeSuccess ? 'Récompenses distribuées' : 'Distribuer les récompenses'} size="md">
        {distributeSuccess ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-700 font-medium">
                {distributeSuccess.length} récompense(s) attribuée(s) avec succès. Les codes ont été générés automatiquement.
              </p>
            </div>
            <div className="space-y-2">
              {distributeSuccess.map((w, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center font-bold text-sm text-amber-700">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">{w.full_name}</p>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-mono font-bold text-sm tracking-wider">
                    {w.reward_code}
                  </div>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={() => { setDistributeModal(false); setDistributeSuccess(null); setLeaderboardModal(null); }}>
              Fermer
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {distributeError && (
              <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {distributeError}
              </div>
            )}
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                Vous allez attribuer des récompenses aux {distributeForm.numWinners} {leaderboardModal?.selection_mode === 'lottery' ? 'participants tirés au sort' : 'meilleurs participants'} du défi « {leaderboardModal?.title} ». Le défi sera marqué comme terminé.
              </p>
            </div>
            <Input
              label="Titre de la récompense"
              value={distributeForm.rewardTitle}
              onChange={(e) => setDistributeForm({ ...distributeForm, rewardTitle: e.target.value })}
            />
            <Textarea
              label="Description (optionnel)"
              value={distributeForm.rewardDesc}
              onChange={(e) => setDistributeForm({ ...distributeForm, rewardDesc: e.target.value })}
              rows={2}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Nombre de gagnants"
                type="number"
                min={1}
                max={50}
                value={distributeForm.numWinners}
                onChange={(e) => setDistributeForm({ ...distributeForm, numWinners: Number(e.target.value) })}
              />
              <Input
                label="Expiration (jours)"
                type="number"
                min={1}
                value={distributeForm.expiresDays}
                onChange={(e) => setDistributeForm({ ...distributeForm, expiresDays: Number(e.target.value) })}
              />
            </div>
            <Button className="w-full" onClick={confirmDistribute} disabled={distributing}>
              {distributing ? <LoadingSpinner size={16} /> : <Gift size={16} className="mr-1" />}
              {distributing ? 'Distribution...' : 'Confirmer la distribution'}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
