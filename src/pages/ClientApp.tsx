import { useState, useEffect, useRef } from 'react';
import {
  ChefHat,
  Utensils,
  Search,
  ShoppingCart,
  CalendarPlus,
  User,
  Clock,
  MapPin,
  Phone,
  Package,
  CircleCheck as CheckCircle2,
  X,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Bike,
  Info,
  CreditCard,
  Wallet,
  Smartphone,
  Navigation,
  Loader as Loader2,
  LocateFixed,
  Banknote,
  Printer,
  ArrowLeft,
  Chrome as Home,
  CalendarDays,
  History,
  Gift,
  Trophy,
  Flame,
  Sparkles,
  Salad,
  Soup,
  IceCream,
  GlassWater,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useDailyMenu, createOrder, fetchOrderByNumber, createReservation, useRestaurantSettings, useWeeklyMenus, useClientOrders, useClientRewards, useActiveChallenges, useClientProgress, claimReward } from '@/lib/hooks';
import {
  DISH_CATEGORY_LABELS,
  DISH_CATEGORY_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_TYPE_LABELS,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STATUS_COLORS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_COLORS,
  formatPrice,
  formatDate,
  formatTime,
  REWARD_STATUS_LABELS,
  REWARD_STATUS_COLORS,
  CHALLENGE_TYPE_LABELS,
  CHALLENGE_TYPE_COLORS,
  formatDateTime,
} from '@/lib/constants';
import type { CartItem, DailyMenu, Dish, DishCategory, Order, PaymentMethod, RestaurantSettings, WeeklyMenu, Challenge, ClientReward, ChallengeProgress } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { EmptyState, LoadingSpinner } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';

const DEFAULT_RESTAURANT_LAT = 14.6928;
const DEFAULT_RESTAURANT_LNG = -17.4467;

type ClientPage = 'home' | 'menu' | 'cart' | 'tracking' | 'reservation' | 'profile' | 'weekly';

const CATEGORY_ICONS: Record<DishCategory | 'all', LucideIcon> = {
  all: Utensils,
  entree: Salad,
  plat: Soup,
  dessert: IceCream,
  boisson: GlassWater,
};

export function ClientApp({ onStaffLogin }: { onStaffLogin?: () => void }) {
  const [page, setPage] = useState<ClientPage>('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const { settings } = useRestaurantSettings();

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.dish_id === item.dish_id);
      if (existing) {
        return prev.map((i) =>
          i.dish_id === item.dish_id ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      }
      return [...prev, item];
    });
    setJustAdded(item.dish_id);
    setTimeout(() => setJustAdded(null), 600);
  };

  const updateQty = (dishId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.dish_id === dishId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (dishId: string) => {
    setCart((prev) => prev.filter((i) => i.dish_id !== dishId));
  };

  const clearCart = () => setCart([]);

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  return (
    <div className="min-h-screen bg-white flex flex-col relative">
      {page !== 'home' && (
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30">
          <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between max-w-6xl mx-auto">
            <button onClick={() => setPage('home')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
              <Home size={18} />
              <span className="text-sm font-medium">Accueil</span>
            </button>
            <div className="flex items-center gap-2">
              {page !== 'menu' && (
                <button onClick={() => setPage('menu')} className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
                  <Utensils size={18} />
                </button>
              )}
              {page !== 'tracking' && (
                <button onClick={() => setPage('tracking')} className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
                  <Search size={18} />
                </button>
              )}
              {page !== 'profile' && (
                <button onClick={() => setPage('profile')} className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
                  <User size={18} />
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      <div className="flex-1 w-full max-w-6xl mx-auto">
        {page === 'home' && <HomePage onNav={setPage} onStaffLogin={onStaffLogin} />}
        {page === 'menu' && <MenuPage onAddToCart={addToCart} cart={cart} onNav={setPage} justAdded={justAdded} />}
        {page === 'cart' && (
          <CartPage
            cart={cart}
            cartTotal={cartTotal}
            onUpdateQty={updateQty}
            onRemove={removeFromCart}
            onClear={clearCart}
            onNav={setPage}
            settings={settings}
          />
        )}
        {page === 'tracking' && <TrackingPage />}
        {page === 'reservation' && <ReservationPage />}
        {page === 'weekly' && <WeeklyMenuPage onAddToCart={addToCart} cart={cart} justAdded={justAdded} />}
        {page === 'profile' && <ProfilePage onNav={setPage} />}
      </div>

      <FloatingBubbles page={page} onNav={setPage} cartCount={cartCount} />
    </div>
  );
}

// ============= FLOATING BUBBLES =============
function FloatingBubbles({
  page,
  onNav,
  cartCount,
}: {
  page: ClientPage;
  onNav: (p: ClientPage) => void;
  cartCount: number;
}) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4 pointer-events-none hidden sm:block">
      <div className="flex items-center justify-center gap-3 pointer-events-auto">
        <button
          onClick={() => onNav('cart')}
          className={cn(
            'w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all relative',
            page === 'cart'
              ? 'bg-green-600 text-white scale-110'
              : 'bg-white/90 backdrop-blur-md text-slate-600 hover:bg-white border border-slate-200'
          )}
          title="Mon panier"
        >
          <ShoppingCart size={20} />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onNav('tracking')}
          className={cn(
            'w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all',
            page === 'tracking'
              ? 'bg-green-600 text-white scale-110'
              : 'bg-white/90 backdrop-blur-md text-slate-600 hover:bg-white border border-slate-200'
          )}
          title="Suivre ma commande"
        >
          <Package size={20} />
        </button>

        <button
          onClick={() => onNav('profile')}
          className={cn(
            'w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all',
            page === 'profile'
              ? 'bg-green-600 text-white scale-110'
              : 'bg-white/90 backdrop-blur-md text-slate-600 hover:bg-white border border-slate-200'
          )}
          title="Mon profil"
        >
          <User size={20} />
        </button>
      </div>
    </div>
  );
}

// ============= HOME PAGE =============
function HomePage({ onNav, onStaffLogin }: { onNav: (p: ClientPage) => void; onStaffLogin?: () => void }) {
  const { menus, loading } = useDailyMenu();
  const { profile } = useAuth();

  const availableMenus = menus.filter((m) => m.quantity_available - m.quantity_sold > 0 && m.dish);
  const featuredDishes = availableMenus.slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero section - clean, no image */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-16 max-w-6xl mx-auto w-full py-16 lg:py-24">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-green-600 text-white flex items-center justify-center shadow-sm">
            <ChefHat size={24} />
          </div>
          <span className="text-slate-900 font-bold text-lg tracking-wide">Le Gourmet</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.1] tracking-tight">
          Cuisine raffinée,<br />
          préparée avec passion
        </h1>
        <p className="text-slate-500 text-base sm:text-lg mt-5 max-w-md leading-relaxed">
          Découvrez notre menu du jour et commandez en quelques clics, ou réservez votre table.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-8 max-w-md">
          <button
            onClick={() => onNav('menu')}
            className="flex-1 bg-green-600 text-white font-semibold py-4 rounded-2xl shadow-sm hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base"
          >
            Commander maintenant <ArrowRight size={18} />
          </button>
          <button
            onClick={() => onNav('reservation')}
            className="flex-1 bg-slate-50 text-slate-700 font-semibold py-4 rounded-2xl border border-slate-200 hover:bg-slate-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base"
          >
            <CalendarPlus size={18} /> Réserver
          </button>
        </div>

        {/* Featured dishes preview on desktop */}
        {featuredDishes.length > 0 && !loading && (
          <div className="hidden lg:flex gap-4 mt-12">
            {featuredDishes.map((m) => (
              <FeaturedDishRow key={m.id} menu={m} onNav={onNav} />
            ))}
          </div>
        )}
      </div>

      {/* Staff login - very discreet */}
      {onStaffLogin && !profile && (
        <button
          onClick={onStaffLogin}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-50 text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition-all flex items-center justify-center z-20"
          title="Espace staff"
        >
          <ChefHat size={16} />
        </button>
      )}
    </div>
  );
}

function FeaturedDishRow({ menu, onNav }: { menu: DailyMenu; onNav: (p: ClientPage) => void }) {
  const remaining = menu.quantity_available - menu.quantity_sold;
  if (!menu.dish) return null;

  return (
    <Card className="p-4 w-64 border-slate-100 shadow-sm hover:shadow-md transition-shadow" onClick={() => onNav('menu')}>
      <div className="flex gap-3">
        <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
          <Utensils size={20} className="text-slate-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm text-slate-900 leading-tight">{menu.dish.name}</h3>
            <span className="font-bold text-green-600 text-sm whitespace-nowrap">
              {formatPrice(menu.dish.price)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{menu.dish.description}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge className={DISH_CATEGORY_COLORS[menu.dish.category]}>
              {DISH_CATEGORY_LABELS[menu.dish.category]}
            </Badge>
            <span className={cn(
              'text-xs font-medium',
              remaining <= 3 ? 'text-red-500' : 'text-green-600'
            )}>
              {remaining > 0 ? `${remaining} dispo` : 'Épuisé'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============= MENU PAGE =============
function MenuPage({
  onAddToCart,
  cart,
  onNav,
  justAdded,
}: {
  onAddToCart: (item: CartItem) => void;
  cart: CartItem[];
  onNav: (p: ClientPage) => void;
  justAdded: string | null;
}) {
  const { menus, loading: menusLoading } = useDailyMenu();
  const [category, setCategory] = useState<DishCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  const availableMenus = menus.filter((m) => {
    if (!m.dish) return false;
    return m.quantity_available - m.quantity_sold > 0;
  });

  const featuredMenus = availableMenus.filter((m) => m.is_featured);
  const otherMenus = availableMenus.filter((m) => !m.is_featured);

  const filterFn = (dish: Dish) => {
    if (category !== 'all' && dish.category !== category) return false;
    if (search && !dish.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  };

  const filteredFeatured = featuredMenus.filter((m) => m.dish && filterFn(m.dish));
  const filteredOther = otherMenus.filter((m) => m.dish && filterFn(m.dish));

  const categories: (DishCategory | 'all')[] = ['all', 'entree', 'plat', 'dessert', 'boisson'];

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-4 pb-24 sm:pb-10">
      {/* Search */}
      <div className="relative mb-4 max-w-2xl mx-auto">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un plat..."
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
        />
      </div>

      {/* Category filter - icon based */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:justify-center scrollbar-hide">
        {categories.map((cat) => {
          const Icon = CATEGORY_ICONS[cat];
          const isActive = category === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-all min-w-[72px]',
                isActive
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
              )}
            >
              <Icon size={22} />
              <span className="text-xs font-medium whitespace-nowrap">
                {cat === 'all' ? 'Tout' : DISH_CATEGORY_LABELS[cat]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="max-w-5xl mx-auto">
        {/* Weekly menu link */}
        <button
          onClick={() => onNav('weekly')}
          className="w-full mb-5 flex items-center justify-between px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <CalendarDays size={18} className="text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Voir le menu de la semaine</span>
          </div>
          <ArrowRight size={16} className="text-slate-400" />
        </button>

        {menusLoading ? (
          <div className="py-16"><LoadingSpinner /></div>
        ) : (
          <>
            {filteredFeatured.length > 0 && (
              <>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Menu du jour
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
                  {filteredFeatured.map((m) => (
                    <MenuDishCard
                      key={m.id}
                      dish={m.dish!}
                      remaining={m.quantity_available - m.quantity_sold}
                      onAdd={() =>
                        onAddToCart({
                          dish_id: m.dish_id,
                          dish_name: m.dish?.name || '',
                          unit_price: m.dish?.price || 0,
                          quantity: 1,
                          daily_menu_id: m.id,
                        })
                      }
                      inCart={cart.find((c) => c.dish_id === m.dish_id)?.quantity || 0}
                      justAdded={justAdded === m.dish_id}
                    />
                  ))}
                </div>
              </>
            )}

            {filteredOther.length > 0 && (
              <>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  Autres plats disponibles
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredOther.map((m) => (
                    <MenuDishCard
                      key={m.id}
                      dish={m.dish!}
                      remaining={m.quantity_available - m.quantity_sold}
                      onAdd={() =>
                        onAddToCart({
                          dish_id: m.dish_id,
                          dish_name: m.dish?.name || '',
                          unit_price: m.dish?.price || 0,
                          quantity: 1,
                          daily_menu_id: m.id,
                        })
                      }
                      inCart={cart.find((c) => c.dish_id === m.dish_id)?.quantity || 0}
                      justAdded={justAdded === m.dish_id}
                    />
                  ))}
                </div>
              </>
            )}

            {filteredFeatured.length === 0 && filteredOther.length === 0 && (
              <EmptyState
                icon={<Utensils size={28} />}
                title="Aucun plat trouvé"
                description="Essayez une autre catégorie ou recherche."
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MenuDishCard({
  dish,
  remaining,
  onAdd,
  inCart,
  justAdded,
}: {
  dish: Dish;
  remaining: number;
  onAdd: () => void;
  inCart: number;
  justAdded: boolean;
}) {
  return (
    <Card className="p-4 border-slate-100 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
      {/* Empty image placeholder */}
      <div className="w-full h-28 rounded-xl bg-slate-50 flex items-center justify-center mb-3">
        <Utensils size={24} className="text-slate-200" />
      </div>

      <div className="flex-1 flex flex-col">
        <h3 className="font-semibold text-sm text-slate-900 leading-tight">{dish.name}</h3>
        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{dish.description}</p>

        <div className="flex items-center justify-between mt-auto pt-3">
          <div className="flex flex-col">
            <span className="font-bold text-base text-slate-900">{formatPrice(dish.price)}</span>
            {remaining <= 5 && remaining > 0 && (
              <span className="text-[10px] text-amber-500 font-medium">{remaining} restantes</span>
            )}
          </div>
          <button
            onClick={onAdd}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90',
              justAdded
                ? 'bg-green-100 text-green-600 scale-110'
                : inCart > 0
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            )}
          >
            {justAdded ? (
              <CheckCircle2 size={18} />
            ) : inCart > 0 ? (
              <span className="flex items-center gap-0.5">
                <Plus size={16} />
                <span className="text-xs font-bold">{inCart}</span>
              </span>
            ) : (
              <Plus size={18} />
            )}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ============= WEEKLY MENU PAGE =============
const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function WeeklyMenuPage({
  onAddToCart,
  cart,
  justAdded,
}: {
  onAddToCart: (item: CartItem) => void;
  cart: CartItem[];
  justAdded: string | null;
}) {
  const { weeklyMenus, loading } = useWeeklyMenus();
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

  const byDay = (day: number) => weeklyMenus.filter((m) => m.day_of_week === day && m.dish);
  const currentDayMenus = byDay(selectedDay);

  const days = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="px-4 pt-4 pb-24">
      <div className="mb-5">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
          <CalendarDays size={24} className="text-slate-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Menu de la semaine</h2>
        <p className="text-sm text-slate-400 mt-1">Découvrez nos plats planifiés chaque jour</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-4 px-4 scrollbar-hide">
        {days.map((d) => (
          <button
            key={d}
            onClick={() => setSelectedDay(d)}
            className={cn(
              'px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
              selectedDay === d
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            )}
          >
            {DAY_NAMES[d]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12"><LoadingSpinner /></div>
      ) : currentDayMenus.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title="Aucun plat planifié"
          description={`Aucun plat n'est planifié pour ${DAY_NAMES[selectedDay]}.`}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {currentDayMenus.map((m) => (
            <MenuDishCard
              key={m.id}
              dish={m.dish!}
              remaining={99}
              onAdd={() =>
                onAddToCart({
                  dish_id: m.dish_id,
                  dish_name: m.dish?.name || '',
                  unit_price: m.dish?.price || 0,
                  quantity: 1,
                  daily_menu_id: '',
                })
              }
              inCart={cart.find((c) => c.dish_id === m.dish_id)?.quantity || 0}
              justAdded={justAdded === m.dish_id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============= Haversine distance =============
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeDeliveryFee(km: number, base: number, perKm: number): number {
  return base + Math.round(km) * perKm;
}

// ============= CART PAGE =============
function CartPage({
  cart,
  cartTotal,
  onUpdateQty,
  onRemove,
  onClear,
  onNav,
  settings,
}: {
  cart: CartItem[];
  cartTotal: number;
  onUpdateQty: (dishId: string, delta: number) => void;
  onRemove: (dishId: string) => void;
  onClear: () => void;
  onNav: (p: ClientPage) => void;
  settings: RestaurantSettings | null;
}) {
  const restLat = settings?.latitude ?? DEFAULT_RESTAURANT_LAT;
  const restLng = settings?.longitude ?? DEFAULT_RESTAURANT_LNG;
  const feeBase = settings?.delivery_fee_base ?? 500;
  const feePerKm = settings?.delivery_fee_per_km ?? 300;
  const { profile } = useAuth();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderType, setOrderType] = useState<'sur_place' | 'livraison'>('sur_place');
  const [name, setName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [tableNumber, setTableNumber] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wave');
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [deliveryKm, setDeliveryKm] = useState<number | null>(null);

  const deliveryFee = deliveryKm !== null ? computeDeliveryFee(deliveryKm, feeBase, feePerKm) : 0;
  const grandTotal = cartTotal + (orderType === 'livraison' ? deliveryFee : 0);

  const useMyLocation = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      setError('La géolocalisation n\'est pas supportée sur cet appareil.');
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDeliveryLat(lat);
        setDeliveryLng(lng);
        const km = haversineKm(restLat, restLng, lat, lng);
        setDeliveryKm(km);
        if (!deliveryAddress) {
          setDeliveryAddress(`Position GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
        setLocating(false);
      },
      (err) => {
        setError('Impossible d\'obtenir votre position: ' + err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const estimateDeliveryFromAddress = async () => {
    if (!deliveryAddress.trim()) {
      setDeliveryKm(null);
      setDeliveryLat(null);
      setDeliveryLng(null);
      return;
    }
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(deliveryAddress)}&limit=1`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setDeliveryLat(lat);
        setDeliveryLng(lng);
        const km = haversineKm(restLat, restLng, lat, lng);
        setDeliveryKm(km);
      } else {
        setDeliveryKm(null);
      }
    } catch {
      setDeliveryKm(null);
    }
  };

  useEffect(() => {
    if (orderType === 'livraison' && deliveryAddress.trim() && deliveryLat === null) {
      const timer = setTimeout(() => estimateDeliveryFromAddress(), 1200);
      return () => clearTimeout(timer);
    }
  }, [deliveryAddress, orderType]);

  const handleCheckout = async () => {
    if (!name || !phone) {
      setError('Nom et téléphone sont requis.');
      return;
    }
    if (orderType === 'livraison') {
      if (!deliveryAddress) {
        setError('L\'adresse de livraison est requise.');
        return;
      }
      if (deliveryKm === null) {
        setError('Impossible de calculer l\'itinéraire. Utilisez "Ma position" ou vérifiez l\'adresse.');
        return;
      }
    }
    setSubmitting(true);
    setError(null);

    const { order, error: err } = await createOrder({
      type: orderType,
      customerName: name,
      customerPhone: phone,
      customerEmail: email || undefined,
      customerId: profile?.id,
      tableNumber: orderType === 'sur_place' ? tableNumber || undefined : undefined,
      deliveryAddress: orderType === 'livraison' ? deliveryAddress : undefined,
      deliveryLat: orderType === 'livraison' ? deliveryLat || undefined : undefined,
      deliveryLng: orderType === 'livraison' ? deliveryLng || undefined : undefined,
      deliveryFee: orderType === 'livraison' ? deliveryFee : 0,
      paymentMethod,
      notes: notes || undefined,
      items: cart,
    });

    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    setSuccessOrder(order);
    onClear();
    setCheckoutOpen(false);
  };

  if (successOrder) {
    return (
      <div className="px-4 pt-8 pb-24">
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-4">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Commande confirmée !</h2>
          <p className="text-slate-400 text-sm mt-2">
            Conservez votre numéro de commande pour suivre sa préparation.
          </p>
          <div className="mt-6 w-full max-w-sm">
            <Card className="p-6 text-center border-slate-100">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Votre numéro de commande</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{successOrder.order_number}</p>
              <p className="text-sm text-slate-500 mt-3">
                {ORDER_TYPE_LABELS[successOrder.type]} • {formatPrice(successOrder.total_amount)}
              </p>
              {successOrder.payment_method && (
                <p className="text-xs text-slate-400 mt-1">
                  Paiement: {PAYMENT_METHOD_LABELS[successOrder.payment_method]}
                </p>
              )}
            </Card>
          </div>
          <div className="flex gap-3 mt-6 w-full max-w-sm">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setSuccessOrder(null);
                onNav('home');
              }}
            >
              Retour à l'accueil
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setSuccessOrder(null);
                onNav('tracking');
              }}
            >
              Suivre ma commande
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="px-4 pt-4 pb-24">
        <EmptyState
          icon={<ShoppingCart size={28} />}
          title="Votre panier est vide"
          description="Parcourez notre carte et ajoutez des plats à votre commande."
          action={
            <Button onClick={() => onNav('menu')}>
              <Utensils size={16} className="mr-1" /> Voir la carte
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-slate-900">{cart.length} article(s)</h2>
        <button
          onClick={onClear}
          className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
        >
          <Trash2 size={14} /> Vider
        </button>
      </div>

      <div className="space-y-2.5">
        {cart.map((item) => (
          <Card key={item.dish_id} className="p-4 border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-slate-900">{item.dish_name}</h3>
                <p className="text-xs text-slate-400">{formatPrice(item.unit_price)} / unité</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onUpdateQty(item.dish_id, -1)}
                  className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <Minus size={14} />
                </button>
                <span className="font-semibold text-sm w-6 text-center">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQty(item.dish_id, 1)}
                  className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
              <div className="text-right w-16">
                <p className="font-bold text-sm text-slate-900">
                  {formatPrice(item.unit_price * item.quantity)}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6">
        <Card className="p-5 bg-slate-50 border-slate-100">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900">Total</span>
            <span className="text-2xl font-bold text-slate-900">{formatPrice(cartTotal)}</span>
          </div>
        </Card>
      </div>

      <Button
        className="w-full mt-4"
        size="lg"
        onClick={() => setCheckoutOpen(true)}
      >
        <ArrowRight size={18} className="mr-1" /> Commander
      </Button>

      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title="Finaliser la commande" size="lg">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Type de commande</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOrderType('sur_place')}
                className={cn(
                  'flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 transition-all text-sm font-medium',
                  orderType === 'sur_place'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-200 text-slate-500'
                )}
              >
                <Utensils size={16} /> Sur place
              </button>
              <button
                onClick={() => setOrderType('livraison')}
                className={cn(
                  'flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 transition-all text-sm font-medium',
                  orderType === 'livraison'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-200 text-slate-500'
                )}
              >
                <Bike size={16} /> Livraison
              </button>
            </div>
          </div>

          <Input label="Nom complet" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Input
            label="Email (optionnel)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {orderType === 'sur_place' ? (
            <Input
              label="Numéro de table"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="Ex: Table 5"
            />
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Adresse de livraison</label>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => {
                    setDeliveryAddress(e.target.value);
                    setDeliveryKm(null);
                    setDeliveryLat(null);
                    setDeliveryLng(null);
                  }}
                  placeholder="123 rue de Paris, Dakar"
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
                />
                <button
                  onClick={useMyLocation}
                  disabled={locating}
                  className="px-3 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 transition-all flex items-center gap-1.5 whitespace-nowrap"
                >
                  {locating ? <Loader2 size={16} className="animate-spin" /> : <LocateFixed size={16} />}
                  Ma position
                </button>
              </div>

              <DeliveryMapPreview
                deliveryLat={deliveryLat}
                deliveryLng={deliveryLng}
                deliveryKm={deliveryKm}
                restLat={restLat}
                restLng={restLng}
              />

              {deliveryKm !== null && (
                <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Navigation size={16} className="text-slate-500" />
                    <span className="text-sm text-slate-700 font-medium">
                      Distance: {deliveryKm.toFixed(1)} km
                    </span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">
                    Frais: {formatPrice(deliveryFee)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Mode de paiement</label>
            <div className="grid grid-cols-2 gap-2">
              <PaymentMethodButton
                method="wave"
                selected={paymentMethod === 'wave'}
                onClick={() => setPaymentMethod('wave')}
                icon={<Smartphone size={18} />}
                label="Wave"
              />
              <PaymentMethodButton
                method="orange_money"
                selected={paymentMethod === 'orange_money'}
                onClick={() => setPaymentMethod('orange_money')}
                icon={<Wallet size={18} />}
                label="Orange Money"
              />
              <PaymentMethodButton
                method="carte"
                selected={paymentMethod === 'carte'}
                onClick={() => setPaymentMethod('carte')}
                icon={<CreditCard size={18} />}
                label="Carte bancaire"
              />
              <PaymentMethodButton
                method="especes"
                selected={paymentMethod === 'especes'}
                onClick={() => setPaymentMethod('especes')}
                icon={<Banknote size={18} />}
                label="Espèces"
              />
            </div>
            {paymentMethod === 'carte' && !profile && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <Info size={12} /> Le paiement par carte nécessite un compte client.
              </p>
            )}
          </div>

          <Textarea
            label="Notes (optionnel)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Allergies, préférences..."
            rows={2}
          />

          <Card className="p-4 bg-slate-50 border-slate-100">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Sous-total</span>
                <span className="font-medium text-slate-900">{formatPrice(cartTotal)}</span>
              </div>
              {orderType === 'livraison' && deliveryKm !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Frais de livraison</span>
                  <span className="font-medium text-slate-900">{formatPrice(deliveryFee)}</span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
                <span className="font-semibold text-slate-900">Total à payer</span>
                <span className="text-xl font-bold text-green-600">{formatPrice(grandTotal)}</span>
              </div>
            </div>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={submitting}
          >
            {submitting ? 'Envoi...' : `Confirmer — ${formatPrice(grandTotal)}`}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function PaymentMethodButton({
  method,
  selected,
  onClick,
  icon,
  label,
}: {
  method: PaymentMethod;
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 px-3 py-3.5 rounded-xl border-2 transition-all text-sm font-medium',
        selected
          ? 'border-green-500 bg-green-50 text-green-700'
          : 'border-slate-200 text-slate-500 hover:border-slate-300'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ============= DELIVERY MAP PREVIEW =============
function DeliveryMapPreview({
  deliveryLat,
  deliveryLng,
  deliveryKm,
  restLat,
  restLng,
}: {
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryKm: number | null;
  restLat: number;
  restLng: number;
}) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  useEffect(() => {
    if (deliveryLat === null || deliveryLng === null) {
      setMapUrl(null);
      return;
    }
    const delta = 0.01;
    const bbox = `${restLng - delta},${restLat - delta},${restLng + delta},${restLat + delta}`;
    const markerRest = `${restLng},${restLat}`;
    const markerDest = `${deliveryLng},${deliveryLat}`;
    setMapUrl(
      `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&marker=${markerRest},${markerDest}&layer=mapnik`
    );
  }, [deliveryLat, deliveryLng, restLat, restLng]);

  if (deliveryLat === null || deliveryLng === null) {
    return (
      <div className="w-full h-32 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
        <div className="text-center">
          <MapPin size={24} className="text-slate-300 mx-auto mb-1" />
          <p className="text-xs text-slate-400">
            {deliveryKm === null ? 'Entrez l\'adresse ou utilisez votre position' : 'Calcul de l\'itinéraire...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-40 rounded-xl overflow-hidden border border-slate-200 relative bg-slate-100">
      {mapUrl && (
        <iframe
          title="Delivery map"
          src={mapUrl}
          className="w-full h-full"
          style={{ border: 0 }}
          loading="lazy"
        />
      )}
      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 text-xs font-medium text-slate-700 flex items-center gap-1">
        <Navigation size={12} className="text-slate-500" />
        {deliveryKm !== null ? `${deliveryKm.toFixed(1)} km` : '...'}
      </div>
    </div>
  );
}

// ============= TRACKING PAGE =============
function TrackingPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!orderNumber.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    const { order: o, error: err } = await fetchOrderByNumber(orderNumber);
    setLoading(false);
    if (err) {
      setError(err);
      setOrder(null);
    } else if (!o) {
      setError('Aucune commande trouvée avec ce numéro.');
      setOrder(null);
    } else {
      setOrder(o);
    }
  };

  const statusSteps = order?.type === 'livraison'
    ? ['en_attente', 'en_preparation', 'pret', 'en_livraison', 'livre']
    : ['en_attente', 'en_preparation', 'pret', 'recupere'];
  const currentStep = order ? statusSteps.indexOf(order.status) : -1;

  const printReceipt = () => {
    if (!order) return;
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    const items = order.order_items || [];
    const dateStr = new Date(order.created_at).toLocaleString('fr-FR');
    const methodLabel = order.payment_method ? PAYMENT_METHOD_LABELS[order.payment_method as PaymentMethod] : '—';
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Recu ${order.order_number}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:'Courier New',monospace;}
      body{padding:24px;color:#1e293b;font-size:13px;line-height:1.5;}
      .header{text-align:center;border-bottom:2px solid #1e293b;padding-bottom:12px;margin-bottom:16px;}
      .header h1{font-size:20px;font-weight:bold;}.header p{font-size:11px;color:#64748b;margin-top:2px;}
      .info{margin-bottom:16px;}.info p{font-size:12px;margin:1px 0;}
      .items{width:100%;margin-bottom:16px;border-collapse:collapse;}
      .items th{text-align:left;font-size:11px;color:#64748b;border-bottom:1px solid #cbd5e1;padding:4px 0;}
      .items td{font-size:12px;padding:3px 0;}.items .qty{width:30px;}.items .price{text-align:right;}
      .totals{border-top:2px solid #1e293b;padding-top:8px;margin-top:8px;}
      .totals p{display:flex;justify-content:space-between;font-size:12px;margin:2px 0;}
      .totals .grand{font-size:16px;font-weight:bold;margin-top:6px;border-top:1px solid #cbd5e1;padding-top:6px;}
      .footer{text-align:center;margin-top:24px;font-size:10px;color:#94a3b8;}
      @media print{body{padding:8px;}}
    </style></head><body>
    <div class="header"><h1>Le Gourmet</h1><p>Recu de paiement</p></div>
    <div class="info">
      <p><strong>N° ${order.order_number}</strong></p>
      <p>Date: ${dateStr}</p>
      <p>Client: ${order.customer_name || '—'}</p>
      <p>Telephone: ${order.customer_phone || '—'}</p>
      ${order.table_number ? `<p>Table: ${order.table_number}</p>` : ''}
      ${order.delivery_address ? `<p>Adresse: ${order.delivery_address}</p>` : ''}
    </div>
    <table class="items"><thead><tr><th class="qty">Qt.</th><th>Article</th><th class="price">Prix</th></tr></thead><tbody>
    ${items.map((i: any) => `<tr><td class="qty">${i.quantity}</td><td>${i.dish_name}</td><td class="price">${formatPrice(i.subtotal)}</td></tr>`).join('')}
    </tbody></table>
    <div class="totals">
      ${order.delivery_fee > 0 ? `<p><span>Livraison</span><span>${formatPrice(order.delivery_fee)}</span></p>` : ''}
      <p class="grand"><span>TOTAL</span><span>${formatPrice(order.total_amount)}</span></p>
      <p><span>Reglement</span><span>${methodLabel}</span></p>
      <p><span>Statut</span><span>${order.payment_status === 'paye' ? 'Paye' : 'En attente'}</span></p>
    </div>
    <div class="footer"><p>Merci de votre visite !</p><p>Le Gourmet - Restaurant</p></div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div className="px-4 pt-4 pb-24 max-w-2xl mx-auto">
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="CMD-XXXXXX"
          className="w-full pl-11 pr-24 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
        />
        <Button
          size="sm"
          onClick={handleSearch}
          disabled={loading}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-9"
        >
          {loading ? '...' : 'Suivre'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {!searched && !order && (
        <EmptyState
          icon={<Package size={28} />}
          title="Suivez votre commande"
          description="Entrez votre numéro de commande (ex: CMD-ABC123) pour suivre son statut en temps réel."
        />
      )}

      {order && (
        <div className="space-y-4">
          <Card className="p-5 border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-400">Commande</p>
                <p className="text-lg font-bold text-slate-900">{order.order_number}</p>
              </div>
              <Badge className={ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS]}>
                {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>{ORDER_TYPE_LABELS[order.type as keyof typeof ORDER_TYPE_LABELS]}</span>
              <span>•</span>
              <span>{formatPrice(order.total_amount)}</span>
              <span>•</span>
              <span>{formatDate(order.created_at)}</span>
            </div>
            {order.payment_method && (
              <div className="mt-2">
                <Badge className={PAYMENT_METHOD_COLORS[order.payment_method as PaymentMethod]}>
                  {PAYMENT_METHOD_LABELS[order.payment_method as PaymentMethod]}
                </Badge>
              </div>
            )}
          </Card>

          <Card className="p-5 border-slate-100">
            <h3 className="font-semibold text-sm text-slate-900 mb-4">Suivi de votre commande</h3>
            <div className="space-y-1">
              {statusSteps.map((step, idx) => {
                const isDone = idx <= currentStep;
                const isCurrent = idx === currentStep;
                const label = ORDER_STATUS_LABELS[step as keyof typeof ORDER_STATUS_LABELS];
                const icons: Record<string, React.ReactNode> = {
                  en_attente: <Clock size={16} />,
                  en_preparation: <ChefHat size={16} />,
                  pret: <Package size={16} />,
                  en_livraison: <Bike size={16} />,
                  livre: <CheckCircle2 size={16} />,
                  recupere: <CheckCircle2 size={16} />,
                };
                return (
                  <div key={step} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                          isDone
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-100 text-slate-400',
                          isCurrent && 'ring-4 ring-green-100'
                        )}
                      >
                        {icons[step]}
                      </div>
                      {idx < statusSteps.length - 1 && (
                        <div
                          className={cn(
                            'w-0.5 h-8',
                            idx < currentStep ? 'bg-green-600' : 'bg-slate-200'
                          )}
                        />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isDone ? 'text-slate-900' : 'text-slate-400'
                      )}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 border-slate-100">
            <h3 className="font-semibold text-sm text-slate-900 mb-3">Détails de la commande</h3>
            <div className="space-y-2">
              {order.order_items?.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">
                    {item.quantity}x {item.dish_name}
                  </span>
                  <span className="font-medium text-slate-900">{formatPrice(item.subtotal)}</span>
                </div>
              ))}
            </div>
            {order.delivery_fee > 0 && (
              <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-slate-100">
                <span className="text-slate-500">Frais de livraison</span>
                <span className="font-medium text-slate-900">{formatPrice(order.delivery_fee)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 mt-3 pt-3 flex items-center justify-between">
              <span className="font-semibold text-slate-900">Total</span>
              <span className="font-bold text-green-600">{formatPrice(order.total_amount)}</span>
            </div>
          </Card>

          {order.payment_status === 'paye' && (
            <Button variant="outline" className="w-full" onClick={printReceipt}>
              <Printer size={16} className="mr-2" /> Imprimer le recu
            </Button>
          )}

          {order.type === 'livraison' && order.delivery?.[0] && (
            <Card className="p-5 bg-slate-50 border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Bike size={18} className="text-slate-500" />
                <h3 className="font-semibold text-sm text-slate-900">Informations du livreur</h3>
              </div>
              {order.delivery[0].delivery_person ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User size={16} className="text-slate-400" />
                    <span className="text-slate-700">{order.delivery[0].delivery_person.full_name || 'Non assigné'}</span>
                  </div>
                  {order.delivery[0].delivery_person.phone && (
                    <a
                      href={`tel:${order.delivery[0].delivery_person.phone}`}
                      className="flex items-center gap-2 text-sm text-green-600 font-medium"
                    >
                      <Phone size={16} />
                      {order.delivery[0].delivery_person.phone}
                    </a>
                  )}
                  {order.delivery_address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin size={16} className="text-slate-400 mt-0.5" />
                      <span className="text-slate-600">{order.delivery_address}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Un livreur sera assigné prochainement.</p>
              )}
            </Card>
          )}

          {order.type === 'sur_place' && order.table_number && (
            <Card className="p-5 border-slate-100">
              <div className="flex items-center gap-2 text-sm">
                <Info size={16} className="text-slate-400" />
                <span className="text-slate-600">Table: <strong>{order.table_number}</strong></span>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ============= RESERVATION PAGE =============
function ReservationPage() {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || !date) {
      setError('Veuillez remplir tous les champs requis.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: err } = await createReservation({
      customerName: name,
      customerPhone: phone,
      customerEmail: email || undefined,
      customerId: profile?.id,
      partySize,
      date,
      time,
      notes: notes || undefined,
    });
    setSubmitting(false);
    if (err) {
      setError(err);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="px-4 pt-8 pb-24">
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-4">
            <CheckCircle2 size={40} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Réservation envoyée !</h2>
          <p className="text-slate-400 text-sm mt-2">
            Nous vous contacterons pour confirmer votre réservation.
          </p>
          <Button
            className="mt-6"
            onClick={() => {
              setSuccess(false);
              setName(profile?.full_name || '');
              setPhone(profile?.phone || '');
              setDate('');
              setNotes('');
            }}
          >
            Faire une autre réservation
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-24 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
          <CalendarPlus size={24} className="text-slate-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Réserver une table</h2>
        <p className="text-sm text-slate-400 mt-1">
          Réservez votre table pour une date future. Nous confirmerons votre demande par téléphone.
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nom complet" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Téléphone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <Input
          label="Email (optionnel)"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Nombre de personnes"
            type="number"
            min={1}
            max={20}
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value))}
            required
          />
          <Input
            label="Date"
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <Select label="Heure" value={time} onChange={(e) => setTime(e.target.value)}>
          {['12:00', '12:30', '13:00', '13:30', '14:00', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
        <Textarea
          label="Notes (optionnel)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Occasion spéciale, préférences..."
          rows={2}
        />
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? 'Envoi...' : 'Envoyer la réservation'}
        </Button>
      </form>
    </div>
  );
}

// ============= PROFILE PAGE =============
function ProfilePage({ onNav }: { onNav: (p: ClientPage) => void }) {
  const { profile, signOut } = useAuth();
  const { orders, loading } = useClientOrders(profile?.id);
  const [rewardsModal, setRewardsModal] = useState(false);
  const [challengesModal, setChallengesModal] = useState(false);

  if (!profile) {
    return (
      <div className="px-4 pt-8 pb-24">
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
            <User size={28} className="text-slate-300" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Vous n'êtes pas connecté</h2>
          <p className="text-sm text-slate-400 mt-1">
            Créez un compte pour accéder à vos commandes et réservations.
          </p>
          <p className="text-xs text-slate-400 mt-3">
            Vous pouvez commander sans compte depuis la carte.
          </p>
        </div>
      </div>
    );
  }

  const activeStatuses = ['en_attente', 'en_preparation', 'pret', 'en_livraison'];
  const currentOrders = orders.filter((o) => activeStatuses.includes(o.status));
  const pastOrders = orders.filter((o) => !activeStatuses.includes(o.status));

  return (
    <div className="px-4 pt-4 pb-24 max-w-2xl mx-auto">
      <div className="flex flex-col items-center text-center py-4">
        <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-3">
          <User size={36} className="text-green-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">{profile.full_name || 'Client'}</h2>
        <p className="text-sm text-slate-400">{profile.email}</p>
        {profile.phone && <p className="text-sm text-slate-400">{profile.phone}</p>}
      </div>

      <div className="flex gap-2 mt-4">
        <Card className="p-3 flex-1 border-slate-100" onClick={() => onNav('tracking')}>
          <div className="flex flex-col items-center text-center gap-1">
            <Package size={20} className="text-slate-500" />
            <span className="text-xs font-medium text-slate-700">Suivre</span>
          </div>
        </Card>
        <Card className="p-3 flex-1 border-slate-100" onClick={() => onNav('reservation')}>
          <div className="flex flex-col items-center text-center gap-1">
            <CalendarPlus size={20} className="text-slate-500" />
            <span className="text-xs font-medium text-slate-700">Réserver</span>
          </div>
        </Card>
        <Card className="p-3 flex-1 border-slate-100" onClick={() => setChallengesModal(true)}>
          <div className="flex flex-col items-center text-center gap-1">
            <Trophy size={20} className="text-amber-500" />
            <span className="text-xs font-medium text-slate-700">Défis</span>
          </div>
        </Card>
        <Card className="p-3 flex-1 border-slate-100 relative" onClick={() => setRewardsModal(true)}>
          <div className="flex flex-col items-center text-center gap-1">
            <Gift size={20} className="text-green-600" />
            <span className="text-xs font-medium text-slate-700">Cadeaux</span>
          </div>
        </Card>
      </div>

      {loading ? (
        <div className="py-8"><LoadingSpinner /></div>
      ) : (
        <>
          {currentOrders.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Package size={14} className="text-green-600" />
                Commandes en cours
              </h3>
              <div className="space-y-2">
                {currentOrders.map((o) => (
                  <OrderHistoryCard key={o.id} order={o} active />
                ))}
              </div>
            </div>
          )}

          {pastOrders.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <History size={14} className="text-slate-400" />
                Historique
              </h3>
              <div className="space-y-2">
                {pastOrders.map((o) => (
                  <OrderHistoryCard key={o.id} order={o} />
                ))}
              </div>
            </div>
          )}

          {!loading && currentOrders.length === 0 && pastOrders.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">Aucune commande pour le moment.</p>
            </div>
          )}
        </>
      )}

      <div className="mt-8">
        <Button
          variant="outline"
          className="w-full text-red-600 border-red-200 hover:bg-red-50"
          onClick={() => signOut()}
        >
          Se déconnecter
        </Button>
      </div>

      <RewardsModal open={rewardsModal} onClose={() => setRewardsModal(false)} clientId={profile.id} />
      <ChallengesModal open={challengesModal} onClose={() => setChallengesModal(false)} clientId={profile.id} />
    </div>
  );
}

function RewardsModal({ open, onClose, clientId }: { open: boolean; onClose: () => void; clientId: string }) {
  const { rewards, loading, refetch } = useClientRewards(clientId);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleClaim = async (rewardId: string) => {
    setClaimingId(rewardId);
    await claimReward(rewardId);
    setClaimingId(null);
    refetch();
  };

  const availableRewards = rewards.filter((r) => r.status === 'available');
  const claimedRewards = rewards.filter((r) => r.status === 'claimed');
  const expiredRewards = rewards.filter((r) => r.status === 'expired');

  return (
    <Modal open={open} onClose={onClose} title="Mes cadeaux" size="md">
      {loading ? (
        <div className="py-8"><LoadingSpinner /></div>
      ) : rewards.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
            <Gift size={28} className="text-slate-300" />
          </div>
          <h3 className="font-semibold text-slate-700">Aucun cadeau pour le moment</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-xs">
            Participez aux défis du restaurant pour gagner des récompenses !
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {availableRewards.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                A récupérer ({availableRewards.length})
              </h4>
              <div className="space-y-2">
                {availableRewards.map((reward) => (
                  <RewardCard
                    key={reward.id}
                    reward={reward}
                    onClaim={() => handleClaim(reward.id)}
                    claiming={claimingId === reward.id}
                  />
                ))}
              </div>
            </div>
          )}

          {claimedRewards.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-green-500" />
                Récupérés ({claimedRewards.length})
              </h4>
              <div className="space-y-2">
                {claimedRewards.map((reward) => (
                  <RewardCard key={reward.id} reward={reward} />
                ))}
              </div>
            </div>
          )}

          {expiredRewards.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                Expirés ({expiredRewards.length})
              </h4>
              <div className="space-y-2 opacity-60">
                {expiredRewards.map((reward) => (
                  <RewardCard key={reward.id} reward={reward} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function RewardCard({
  reward,
  onClaim,
  claiming,
}: {
  reward: ClientReward;
  onClaim?: () => void;
  claiming?: boolean;
}) {
  return (
    <div className={cn(
      'p-4 rounded-xl border-2 transition-all',
      reward.status === 'available' ? 'border-amber-200 bg-amber-50' :
      reward.status === 'claimed' ? 'border-green-200 bg-green-50' :
      'border-slate-200 bg-slate-50'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
          reward.status === 'available' ? 'bg-amber-500 text-white' :
          reward.status === 'claimed' ? 'bg-green-500 text-white' :
          'bg-slate-300 text-white'
        )}>
          <Gift size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-sm text-slate-900">{reward.reward_title}</h4>
            <Badge className={REWARD_STATUS_COLORS[reward.status]}>
              {REWARD_STATUS_LABELS[reward.status]}
            </Badge>
          </div>
          {reward.reward_description && (
            <p className="text-xs text-slate-500 mt-1">{reward.reward_description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Clock size={12} /> {formatDate(reward.awarded_at)}
            </span>
            {reward.expires_at && reward.status === 'available' && (
              <span className="text-amber-600 font-medium">
                Expire le {formatDate(reward.expires_at)}
              </span>
            )}
            {reward.claimed_at && (
              <span className="text-green-600 font-medium">
                Récupéré le {formatDate(reward.claimed_at)}
              </span>
            )}
          </div>
          {reward.reward_code && (reward.status === 'claimed' || reward.status === 'available') && (
            <div className="mt-3 p-3 rounded-lg bg-slate-900 text-white flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Votre code</p>
                <p className="font-mono font-bold text-lg tracking-widest">{reward.reward_code}</p>
              </div>
              <div className="text-right">
                {reward.discount_type === 'percentage' && reward.discount_value && (
                  <p className="text-xs text-green-300">-{Number(reward.discount_value)}%</p>
                )}
                {reward.discount_type === 'fixed' && reward.discount_value && (
                  <p className="text-xs text-green-300">-{formatPrice(Number(reward.discount_value))}</p>
                )}
                {reward.discount_type === 'free_order' && (
                  <p className="text-xs text-green-300">Commande gratuite</p>
                )}
              </div>
            </div>
          )}

          {reward.status === 'available' && onClaim && (
            <Button
              size="sm"
              className="mt-3 w-full"
              onClick={onClaim}
              disabled={claiming}
            >
              {claiming ? <LoadingSpinner size={14} /> : <CheckCircle2 size={14} className="mr-1" />}
              {claiming ? 'Récupération...' : 'Récupérer ma récompense'}
            </Button>
          )}

          {reward.status === 'claimed' && reward.reward_code && (
            <p className="text-xs text-slate-400 mt-2">
              Utilisez ce code lors de votre prochaine commande pour profiter de votre réduction.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChallengesModal({ open, onClose, clientId }: { open: boolean; onClose: () => void; clientId: string }) {
  const { challenges, loading: challengesLoading } = useActiveChallenges();
  const { progress, loading: progressLoading } = useClientProgress(clientId);

  const getProgressForChallenge = (challengeId: string): ChallengeProgress | null => {
    return progress.find((p) => p.challenge_id === challengeId) || null;
  };

  const formatValue = (type: string, value: number): string => {
    if (type === 'spending_amount') return formatPrice(value / 100);
    return String(value);
  };

  const formatTarget = (type: string, value: number): string => {
    if (type === 'spending_amount') return formatPrice(value / 100);
    return String(value);
  };

  return (
    <Modal open={open} onClose={onClose} title="Défis en cours" size="md">
      {challengesLoading || progressLoading ? (
        <div className="py-8"><LoadingSpinner /></div>
      ) : challenges.length === 0 ? (
        <div className="flex flex-col items-center text-center py-8">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
            <Trophy size={28} className="text-slate-300" />
          </div>
          <h3 className="font-semibold text-slate-700">Aucun défi actif</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-xs">
            Revenez bientôt pour participer à de nouveaux défis et gagner des récompenses !
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {challenges.map((ch) => {
            const prog = getProgressForChallenge(ch.id);
            const currentVal = prog?.current_value || 0;
            const targetVal = ch.target_value;
            const percent = Math.min(100, Math.round((currentVal / targetVal) * 100));
            const isCompleted = prog?.completed || currentVal >= targetVal;

            return (
              <div key={ch.id} className="p-4 rounded-xl border border-slate-100 bg-white">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                      <Trophy size={18} className="text-amber-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm text-slate-900">{ch.title}</h4>
                      <p className="text-xs text-slate-400">Jusqu'au {formatDate(ch.end_date)}</p>
                    </div>
                  </div>
                  {isCompleted && (
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      <CheckCircle2 size={12} /> Atteint
                    </Badge>
                  )}
                </div>

                {ch.description && (
                  <p className="text-xs text-slate-500 mb-2">{ch.description}</p>
                )}

                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">
                      {CHALLENGE_TYPE_LABELS[ch.challenge_type]}
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatValue(ch.challenge_type, currentVal)} / {formatTarget(ch.challenge_type, targetVal)}
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        isCompleted ? 'bg-green-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {ch.reward_description && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                    <Gift size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-700">Récompense</p>
                      <p className="text-xs text-amber-600">{ch.reward_description}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function OrderHistoryCard({ order, active }: { order: Order; active?: boolean }) {
  return (
    <Card className="p-4 border-slate-100">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">{order.order_number}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {order.order_items?.length || 0} article(s) - {formatPrice(order.total_amount)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {new Date(order.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <Badge className={ORDER_STATUS_COLORS[order.status]}>
          {ORDER_STATUS_LABELS[order.status]}
        </Badge>
      </div>
    </Card>
  );
}
