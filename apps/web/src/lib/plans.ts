export const PLAN_LIMITS = {
  free: { messagesPerMonth: 50 },
  pro: { messagesPerMonth: 2_000 },
  enterprise: { messagesPerMonth: Infinity },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

export function getMonthlyMessageLimit(plan: string): number {
  const key = plan as PlanName;
  return PLAN_LIMITS[key]?.messagesPerMonth ?? PLAN_LIMITS.free.messagesPerMonth;
}
