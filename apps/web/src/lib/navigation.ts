export const navigationIconIds = [
  'analytics',
  'customers',
  'dashboard',
  'feedback',
  'implementation',
  'knowledge-base',
  'onboarding',
  'organization',
  'overview',
  'releases',
  'settings',
  'support',
] as const

export type NavigationIconId = (typeof navigationIconIds)[number]

export interface NavigationItem {
  description: string
  href: string
  icon: NavigationIconId
  label: string
}

export const beauroiNavigation: readonly NavigationItem[] = [
  { description: 'Portfolio overview', href: '/beauroi', icon: 'overview', label: 'Overview' },
  {
    description: 'Customer companies and owners',
    href: '/beauroi/customers',
    icon: 'customers',
    label: 'Customers',
  },
  {
    description: 'Plans, tasks, training, and documents',
    href: '/beauroi/onboarding',
    icon: 'onboarding',
    label: 'Onboarding',
  },
  {
    description: 'Projects and milestones',
    href: '/beauroi/implementation',
    icon: 'implementation',
    label: 'Implementation',
  },
  {
    description: 'Tickets, messages, and SLAs',
    href: '/beauroi/support',
    icon: 'support',
    label: 'Product support',
  },
  {
    description: 'Feedback, bugs, and feature requests',
    href: '/beauroi/feedback',
    icon: 'feedback',
    label: 'Feedback',
  },
  {
    description: 'Product updates and maintenance',
    href: '/beauroi/releases',
    icon: 'releases',
    label: 'Releases',
  },
  {
    description: 'Health and adoption signals',
    href: '/beauroi/analytics',
    icon: 'analytics',
    label: 'Analytics & success',
  },
  {
    description: 'Customer and internal guidance',
    href: '/beauroi/knowledge-base',
    icon: 'knowledge-base',
    label: 'Knowledge base',
  },
]

export const customerNavigation: readonly NavigationItem[] = [
  {
    description: 'Your current priorities',
    href: '/portal',
    icon: 'dashboard',
    label: 'Dashboard',
  },
  {
    description: 'Assigned plans and actions',
    href: '/portal/onboarding',
    icon: 'onboarding',
    label: 'My onboarding',
  },
  {
    description: 'Projects and milestones',
    href: '/portal/implementation',
    icon: 'implementation',
    label: 'Implementation status',
  },
  {
    description: 'Tickets and conversations',
    href: '/portal/support',
    icon: 'support',
    label: 'Support center',
  },
  {
    description: 'Ideas, bugs, and requests',
    href: '/portal/feedback',
    icon: 'feedback',
    label: 'Feedback & requests',
  },
  {
    description: 'Updates and maintenance',
    href: '/portal/releases',
    icon: 'releases',
    label: 'Product releases',
  },
  {
    description: 'Guides and documentation',
    href: '/portal/knowledge-base',
    icon: 'knowledge-base',
    label: 'Knowledge base',
  },
  {
    description: 'Company details and team',
    href: '/portal/organization',
    icon: 'organization',
    label: 'Organization',
  },
  {
    description: 'Profile and preferences',
    href: '/portal/settings',
    icon: 'settings',
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
