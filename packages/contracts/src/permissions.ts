export const Role = {
  Owner: 'owner',
  Admin: 'admin',
  Developer: 'developer',
  Billing: 'billing',
  Viewer: 'viewer',
  Custom: 'custom',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const Permission = {
  ProjectRead: 'project:read',
  ProjectWrite: 'project:write',
  DeploymentRead: 'deployment:read',
  DeploymentWrite: 'deployment:write',
  DomainRead: 'domain:read',
  DomainWrite: 'domain:write',
  EnvironmentRead: 'environment:read',
  EnvironmentWrite: 'environment:write',
  BillingRead: 'billing:read',
  BillingWrite: 'billing:write',
  TeamManage: 'team:manage',
  SettingsWrite: 'settings:write',
  SupportWrite: 'support:write',
  AdminRead: 'admin:read',
  AdminWrite: 'admin:write',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export interface AccessContext {
  subjectId: string;
  organizationId?: string;
  role?: Role;
  permissions?: Permission[];
  tokenId?: string;
}
