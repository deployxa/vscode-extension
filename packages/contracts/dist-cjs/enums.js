"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceType = exports.CronType = exports.BackupStatus = exports.OrganizationPlan = exports.SslStatus = exports.BuildStatus = exports.DeploymentStatus = exports.ProjectStatus = void 0;
exports.ProjectStatus = {
    Idle: 'idle',
    Building: 'building',
    Deploying: 'deploying',
    Active: 'active',
    Failed: 'failed',
};
exports.DeploymentStatus = {
    Queued: 'QUEUED',
    Building: 'BUILDING',
    Deploying: 'DEPLOYING',
    Success: 'SUCCESS',
    Failed: 'FAILED',
    Cancelled: 'CANCELLED',
};
exports.BuildStatus = {
    Queued: 'queued',
    Running: 'running',
    Completed: 'completed',
    Failed: 'failed',
};
exports.SslStatus = {
    Pending: 'pending',
    Active: 'active',
    Failed: 'failed',
};
exports.OrganizationPlan = {
    Free: 'free',
    Developer: 'developer',
    Starter: 'starter',
    Pro: 'pro',
    Team: 'team',
    Business: 'business',
    Enterprise: 'enterprise',
};
exports.BackupStatus = {
    Pending: 'PENDING',
    Running: 'RUNNING',
    Completed: 'COMPLETED',
    Failed: 'FAILED',
    Restoring: 'RESTORING',
};
exports.CronType = {
    HttpPost: 'HTTP_POST',
    ContainerExec: 'CONTAINER_EXEC',
};
exports.ServiceType = {
    Web: 'WEB',
    Worker: 'WORKER',
    Cron: 'CRON',
    Database: 'DATABASE',
};
//# sourceMappingURL=enums.js.map