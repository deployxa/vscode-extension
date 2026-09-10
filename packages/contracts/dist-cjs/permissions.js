"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permission = exports.Role = void 0;
exports.Role = {
    Owner: 'owner',
    Admin: 'admin',
    Developer: 'developer',
    Billing: 'billing',
    Viewer: 'viewer',
    Custom: 'custom',
};
exports.Permission = {
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
};
//# sourceMappingURL=permissions.js.map