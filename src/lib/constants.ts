import type {
  OrderStatus,
  OrderType,
  PaymentStatus,
  PaymentMethod,
  DeliveryStatus,
  ReservationStatus,
  DishCategory,
  UserRole,
  UserStatus,
  ChallengeType,
  ChallengeStatus,
  RewardStatus,
  SelectionMode,
  DiscountType,
} from '@/types';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  en_attente: 'En attente',
  en_preparation: 'En préparation',
  pret: 'Prêt',
  en_livraison: 'En livraison',
  livre: 'Livré',
  recupere: 'Récupéré',
  annule: 'Annulé',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  en_attente: 'bg-amber-100 text-amber-700 border-amber-200',
  en_preparation: 'bg-blue-100 text-blue-700 border-blue-200',
  pret: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  en_livraison: 'bg-purple-100 text-purple-700 border-purple-200',
  livre: 'bg-green-100 text-green-700 border-green-200',
  recupere: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  annule: 'bg-red-100 text-red-700 border-red-200',
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  sur_place: 'Sur place',
  livraison: 'Livraison',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  en_attente: 'En attente',
  paye: 'Payé',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  en_attente: 'bg-amber-100 text-amber-700 border-amber-200',
  paye: 'bg-green-100 text-green-700 border-green-200',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  carte: 'Carte bancaire',
  especes: 'Espèces',
};

export const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  wave: 'bg-blue-100 text-blue-700 border-blue-200',
  orange_money: 'bg-orange-100 text-orange-700 border-orange-200',
  carte: 'bg-slate-100 text-slate-700 border-slate-200',
  especes: 'bg-green-100 text-green-700 border-green-200',
};

export const DELIVERY_FEE_BASE = 500;
export const DELIVERY_FEE_PER_KM = 300;

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  assigne: 'Assigné',
  en_cours: 'En cours',
  livre: 'Livré',
};

export const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, string> = {
  assigne: 'bg-amber-100 text-amber-700 border-amber-200',
  en_cours: 'bg-blue-100 text-blue-700 border-blue-200',
  livre: 'bg-green-100 text-green-700 border-green-200',
};

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  en_attente: 'En attente',
  confirmee: 'Confirmée',
  annulee: 'Annulée',
};

export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  en_attente: 'bg-amber-100 text-amber-700 border-amber-200',
  confirmee: 'bg-green-100 text-green-700 border-green-200',
  annulee: 'bg-red-100 text-red-700 border-red-200',
};

export const DISH_CATEGORY_LABELS: Record<DishCategory, string> = {
  entree: 'Entrée',
  plat: 'Plat',
  dessert: 'Dessert',
  boisson: 'Boisson',
};

export const DISH_CATEGORY_COLORS: Record<DishCategory, string> = {
  entree: 'bg-teal-100 text-teal-700 border-teal-200',
  plat: 'bg-orange-100 text-orange-700 border-orange-200',
  dessert: 'bg-pink-100 text-pink-700 border-pink-200',
  boisson: 'bg-sky-100 text-sky-700 border-sky-200',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  caisse: 'Caissier',
  client: 'Client',
  livreur: 'Livreur',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-slate-800 text-white',
  caisse: 'bg-blue-600 text-white',
  client: 'bg-teal-600 text-white',
  livreur: 'bg-orange-600 text-white',
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  pending: 'En attente',
  active: 'Actif',
  suspended: 'Suspendu',
};

export const STATUS_COLORS: Record<UserStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  active: 'bg-green-100 text-green-700 border-green-200',
  suspended: 'bg-red-100 text-red-700 border-red-200',
};

export const ORDER_STATUS_FLOW_DELIVERY: OrderStatus[] = [
  'en_attente',
  'en_preparation',
  'pret',
  'en_livraison',
  'livre',
];

export const ORDER_STATUS_FLOW_ONSITE: OrderStatus[] = [
  'en_attente',
  'en_preparation',
  'pret',
  'recupere',
];

export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(price);
};

export const formatDate = (date: string): string => {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
};

export const formatDateTime = (date: string): string => {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

export const formatTime = (time: string): string => {
  return time.substring(0, 5);
};

export const CHALLENGE_TYPE_LABELS: Record<ChallengeType, string> = {
  orders_count: 'Nombre de commandes',
  spending_amount: 'Montant dépensé',
  orders_streak: 'Série de commandes',
};

export const CHALLENGE_TYPE_COLORS: Record<ChallengeType, string> = {
  orders_count: 'bg-blue-100 text-blue-700 border-blue-200',
  spending_amount: 'bg-green-100 text-green-700 border-green-200',
  orders_streak: 'bg-orange-100 text-orange-700 border-orange-200',
};

export const CHALLENGE_TYPE_ICONS: Record<ChallengeType, string> = {
  orders_count: 'ShoppingBag',
  spending_amount: 'Euro',
  orders_streak: 'Flame',
};

export const CHALLENGE_STATUS_LABELS: Record<ChallengeStatus, string> = {
  active: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

export const CHALLENGE_STATUS_COLORS: Record<ChallengeStatus, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-blue-100 text-blue-700 border-blue-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export const REWARD_STATUS_LABELS: Record<RewardStatus, string> = {
  available: 'Disponible',
  claimed: 'Récupéré',
  expired: 'Expiré',
};

export const REWARD_STATUS_COLORS: Record<RewardStatus, string> = {
  available: 'bg-amber-100 text-amber-700 border-amber-200',
  claimed: 'bg-green-100 text-green-700 border-green-200',
  expired: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const SELECTION_MODE_LABELS: Record<SelectionMode, string> = {
  leaderboard: 'Classement (top N)',
  lottery: 'Tirage au sort',
};

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percentage: 'Pourcentage',
  fixed: 'Montant fixe',
  free_order: 'Commande gratuite',
};
