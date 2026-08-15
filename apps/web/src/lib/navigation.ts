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
} from 'lucide-react'

export interface NavigationItem {
  description: string
  href: string
  icon: LucideIcon
  label: string
}

export const beauroiNavigation: readonly NavigationItem[] = [
  { description: 'Portfolio overview', href: '/beauroi', icon: LayoutDashboard, label: 'Overview' },
  {
    description: 'Customer companies and owners',
    href: '/beauroi/customers',
    icon: Building2,
    label: 'Customers',
  },
  {
    description: 'Plans, tasks, training, and documents',
    href: '/beauroi/onboarding',
    icon: ClipboardCheck,
    label: 'Onboarding',
  },
  {
    description: 'Projects and milestones',
    href: '/beauroi/implementation',
    icon: Rocket,
    label: 'Implementation',
  },
  {
    description: 'Tickets, messages, and SLAs',
    href: '/beauroi/support',
    icon: Headphones,
    label: 'Product support',
  },
  {
    description: 'Feedback, bugs, and feature requests',
    href: '/beauroi/feedback',
    icon: MessageSquareText,
    label: 'Feedback',
  },
  {
    description: 'Product updates and maintenance',
    href: '/beauroi/releases',
    icon: PackageOpen,
    label: 'Releases',
  },
  {
    description: 'Health and adoption signals',
    href: '/beauroi/analytics',
    icon: BarChart3,
    label: 'Analytics & success',
  },
  {
    description: 'Customer and internal guidance',
    href: '/beauroi/knowledge-base',
    icon: BookOpen,
    label: 'Knowledge base',
  },
]

export const customerNavigation: readonly NavigationItem[] = [
  {
    description: 'Your current priorities',
    href: '/portal',
    icon: CircleGauge,
    label: 'Dashboard',
  },
  {
    description: 'Assigned plans and actions',
    href: '/portal/onboarding',
    icon: ClipboardCheck,
    label: 'My onboarding',
  },
  {
    description: 'Projects and milestones',
    href: '/portal/implementation',
    icon: Rocket,
    label: 'Implementation status',
  },
  {
    description: 'Tickets and conversations',
    href: '/portal/support',
    icon: Headphones,
    label: 'Support center',
  },
  {
    description: 'Ideas, bugs, and requests',
    href: '/portal/feedback',
    icon: MessageSquareText,
    label: 'Feedback & requests',
  },
  {
    description: 'Updates and maintenance',
    href: '/portal/releases',
    icon: PackageOpen,
    label: 'Product releases',
  },
  {
    description: 'Guides and documentation',
    href: '/portal/knowledge-base',
    icon: BookOpen,
    label: 'Knowledge base',
  },
  {
    description: 'Company details and team',
    href: '/portal/organization',
    icon: UsersRound,
    label: 'Organization',
  },
  {
    description: 'Profile and preferences',
    href: '/portal/settings',
    icon: Settings,
    label: 'Settings',
  },
]

export const sectionTableMap = {
  analytics: 'health_score_history',
  customers: 'organizations',
  feedback: 'feedback',
  implementation: 'implementation_projects',
  'knowledge-base': 'knowledge_base_articles',
  onboarding: 'onboarding_plans',
  organization: 'organization_memberships',
  releases: 'product_releases',
  settings: 'profiles',
  support: 'support_tickets',
} as const

export type ModuleSection = keyof typeof sectionTableMap
