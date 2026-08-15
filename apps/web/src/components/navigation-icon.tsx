'use client'

import {
  BarChart3,
  BookOpen,
  Building2,
  CircleGauge,
  ClipboardCheck,
  Headphones,
  LayoutDashboard,
  MessageSquareText,
  PackageOpen,
  Rocket,
  Settings,
  UsersRound,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'

import type { NavigationIconId } from '@/lib/navigation'

const navigationIcons: Record<NavigationIconId, LucideIcon> = {
  analytics: BarChart3,
  customers: Building2,
  dashboard: CircleGauge,
  feedback: MessageSquareText,
  implementation: Rocket,
  'knowledge-base': BookOpen,
  onboarding: ClipboardCheck,
  organization: UsersRound,
  overview: LayoutDashboard,
  releases: PackageOpen,
  settings: Settings,
  support: Headphones,
}

interface NavigationIconProps extends LucideProps {
  icon: NavigationIconId
}

export function NavigationIcon({ icon, ...props }: NavigationIconProps) {
  const Icon = navigationIcons[icon]
  return <Icon {...props} />
}
