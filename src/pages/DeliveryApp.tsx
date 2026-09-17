import { useState, useEffect, useCallback } from 'react';
import {
  Bike,
  Package,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  LogOut,
  Clock,
  Navigation,
  Home,
  ListChecks,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_COLORS,
  formatPrice,
  formatDateTime,
} from '@/lib/constants';
import type { Order } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingSpinner } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';

type DeliveryPage = 'active' | 'history';

export function DeliveryApp() {
  const [page, setPage] = useState<DeliveryPage>('active');
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto">
      <header className="bg-orange-600 text-white sticky top-0 z-30">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Bike size={20} />
            </div>
            <div>
              <p className="font-bold text-sm">Livreur</p>
              <p className="text-xs text-orange-100">{profile?.full_name}</p>
            </div>
          </div>
          <button onClick={() => signOut()} className="text-sm text-orange-100 hover:text-white">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 pb-20">
        {page === 'active' && <ActiveDeliveries />}
        {page === 'history' && <DeliveryHistory />}
      </div>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-200 z-30">
        <div className="flex items-center justify-around py-2">
          <NavTab
            active={page === 'active'}
            onClick={() => setPage('active')}
            icon={<Navigation size={22} />}
            label="En cours"
          />
          <NavTab
            active={page === 'history'}
            onClick={() => setPage('history')}
            icon={<ListChecks size={22} />}
            label="Historique"
          />
        </div>
      </nav>
    </div>
  );
}

function NavTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1 px-6 py-1.5 rounded-lg transition-colors',
        active ? 'text-orange-600' : 'text-slate-400'
      )}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function ActiveDeliveries() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, order_items:order_items(*), delivery:deliveries!inner(*)')
      .eq('delivery.delivery_person_id', profile.id)
      .in('delivery.status', ['assigne', 'en_cours'])
      .order('created_at', { ascending: false });
    setOrders((data as Order[]) || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, [fetch]);

  const markDelivered = async (orderId: string, deliveryId: string) => {
    await supabase
      .from('deliveries')
      .update({ status: 'livre', delivered_at: new Date().toISOString() })
      .eq('id', deliveryId);
    await supabase
      .from('orders')
      .update({ status: 'livre', updated_at: new Date().toISOString() })
      .eq('id', orderId);
    fetch();
  };

  const startDelivery = async (deliveryId: string) => {
    await supabase.from('deliveries').update({ status: 'en_cours' }).eq('id', deliveryId);
    fetch();
  };

  if (loading) {
    return <div className="py-16"><LoadingSpinner /></div>;
  }

  if (orders.length === 0) {
    return (
      <div className="px-4 pt-4">
        <EmptyState
          icon={<Package size={28} />}
          title="Aucune livraison assignée"
          description="Les commandes à livrer vous seront assignées par la caisse."
        />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 space-y-3">
      <h2 className="text-lg font-bold text-slate-900">Livraisons à effectuer</h2>
      {orders.map((order) => {
        const delivery = (order as any).delivery?.[0];
        return (
          <Card key={order.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-mono font-bold text-slate-900 text-sm">{order.order_number}</p>
                <p className="text-xs text-slate-400">{formatDateTime(order.created_at)}</p>
              </div>
              <Badge className={ORDER_STATUS_COLORS[order.status]}>
                {ORDER_STATUS_LABELS[order.status]}
              </Badge>
            </div>

            <div className="space-y-2 bg-slate-50 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <User size={16} className="text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{order.customer_name || 'Client'}</p>
                  <a href={`tel:${order.customer_phone}`} className="text-sm text-blue-600 flex items-center gap-1">
                    <Phone size={12} /> {order.customer_phone}
                  </a>
                </div>
              </div>
              {order.delivery_address && (
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-slate-400 mt-0.5" />
                  <p className="text-sm text-slate-600">{order.delivery_address}</p>
                </div>
              )}
            </div>

            <div className="mt-3">
              <p className="text-xs font-medium text-slate-500 mb-1">Articles</p>
              <div className="space-y-1">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700">{item.quantity}x {item.dish_name}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span className="text-sm font-medium text-slate-600">Total</span>
                <span className="font-bold text-slate-900">{formatPrice(order.total_amount)}</span>
              </div>
            </div>

            {delivery && (
              <div className="mt-3 flex gap-2">
                <Badge className={DELIVERY_STATUS_COLORS[delivery.status as keyof typeof DELIVERY_STATUS_COLORS]}>
                  {DELIVERY_STATUS_LABELS[delivery.status as keyof typeof DELIVERY_STATUS_LABELS]}
                </Badge>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              {delivery?.status === 'assigne' && (
                <Button
                  className="flex-1"
                  onClick={() => startDelivery(delivery.id)}
                >
                  <Navigation size={16} className="mr-1" /> Démarrer
                </Button>
              )}
              {delivery?.status === 'en_cours' && (
                <Button
                  variant="success"
                  className="flex-1"
                  onClick={() => markDelivered(order.id, delivery.id)}
                >
                  <CheckCircle2 size={16} className="mr-1" /> Marquer livré
                </Button>
              )}
              <a href={`tel:${order.customer_phone}`}>
                <Button variant="outline" className="h-10 px-3">
                  <Phone size={16} />
                </Button>
              </a>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function DeliveryHistory() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('*, delivery:deliveries!inner(*)')
        .eq('delivery.delivery_person_id', profile.id)
        .eq('delivery.status', 'livre')
        .order('created_at', { ascending: false })
        .limit(50);
      setOrders((data as Order[]) || []);
      setLoading(false);
    })();
  }, [profile]);

  if (loading) {
    return <div className="py-16"><LoadingSpinner /></div>;
  }

  if (orders.length === 0) {
    return (
      <div className="px-4 pt-4">
        <EmptyState
          icon={<ListChecks size={28} />}
          title="Aucune livraison terminée"
          description="Vos livraisons complétées apparaîtront ici."
        />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 space-y-3">
      <h2 className="text-lg font-bold text-slate-900">Historique des livraisons</h2>
      {orders.map((order) => {
        const delivery = (order as any).delivery?.[0];
        return (
          <Card key={order.id} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono font-bold text-slate-900 text-sm">{order.order_number}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(order.created_at)}</p>
                {order.customer_name && <p className="text-sm text-slate-600 mt-1">{order.customer_name}</p>}
              </div>
              <div className="text-right">
                <Badge className={DELIVERY_STATUS_COLORS.livre}>
                  <CheckCircle2 size={12} /> Livré
                </Badge>
                <p className="font-bold text-sm text-slate-900 mt-1">{formatPrice(order.total_amount)}</p>
                {delivery?.delivered_at && (
                  <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(delivery.delivered_at)}</p>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
