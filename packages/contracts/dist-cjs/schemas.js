"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsCleanupSchema = exports.analyticsQuerySchema = exports.trackAnalyticsBatchRequestSchema = exports.trackAnalyticsEventRequestSchema = exports.trackExtensionEventRequestSchema = exports.extensionInstallationIdSchema = exports.organizationContextSchema = exports.pageQuerySchema = exports.createDomainRequestSchema = exports.setEnvironmentVariableRequestSchema = exports.createDeploymentRequestSchema = exports.createProjectRequestSchema = exports.isUploadRepository = exports.deploymentIdSchema = exports.projectIdSchema = exports.organizationIdSchema = exports.idSchema = void 0;
const zod_1 = require("zod");
const dtos_js_1 = require("./dtos.js");
exports.idSchema = zod_1.z.string().min(1);
exports.organizationIdSchema = exports.idSchema;
exports.projectIdSchema = exports.idSchema;
exports.deploymentIdSchema = exports.idSchema;
// repositoryUrl accepts a real git URL or a direct-upload sentinel such as
// `upload:my-app.zip`. The Engine validates ownership and persistence itself,
// so the shared contract only enforces a non-empty identifier here.
const isUploadRepository = (value) => typeof value === 'string' && value.startsWith('upload:');
exports.isUploadRepository = isUploadRepository;
exports.createProjectRequestSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(200),
    repositoryUrl: zod_1.z.string().trim().min(1).max(2048).refine(value => {
        try {
            new URL(value);
            return true;
        }
        catch {
            return (0, exports.isUploadRepository)(value);
        }
    }, 'repositoryUrl must be a valid URL or an upload: sentinel'),
    branch: zod_1.z.string().trim().min(1).max(255).optional(),
    framework: zod_1.z.string().trim().min(1).max(100).optional(),
    rootDirectory: zod_1.z.string().trim().max(500).optional(),
});
exports.createDeploymentRequestSchema = zod_1.z.object({
    projectId: exports.projectIdSchema,
    branch: zod_1.z.string().trim().min(1).max(255).optional(),
    isPreview: zod_1.z.boolean().optional(),
    repoFullName: zod_1.z.string().trim().min(1).max(255).optional(),
    prNumber: zod_1.z.number().int().positive().optional(),
});
exports.setEnvironmentVariableRequestSchema = zod_1.z.object({
    key: zod_1.z.string().trim().min(1).max(255),
    value: zod_1.z.string(),
    branch: zod_1.z.string().trim().min(1).max(255).optional(),
});
exports.createDomainRequestSchema = zod_1.z.object({
    domain: zod_1.z.string().trim().min(1).max(253),
});
exports.pageQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().optional(),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).optional(),
});
exports.organizationContextSchema = zod_1.z.object({
    organizationId: exports.organizationIdSchema.optional(),
});
exports.extensionInstallationIdSchema = zod_1.z.string().uuid();
exports.trackExtensionEventRequestSchema = zod_1.z.object({
    event: zod_1.z.enum(dtos_js_1.EXTENSION_ANALYTICS_EVENTS),
    installationId: exports.extensionInstallationIdSchema,
    occurredAt: zod_1.z.string().datetime({ offset: true }).optional(),
}).strict();
const events_js_1 = require("./events.js");
exports.trackAnalyticsEventRequestSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    eventName: zod_1.z.enum(events_js_1.ANALYTICS_EVENT_NAMES),
    occurredAt: zod_1.z.string().datetime({ offset: true }).optional(),
    anonymousId: zod_1.z.string().trim().min(1).max(128).optional(),
    userId: zod_1.z.string().trim().min(1).max(128).optional(),
    organizationId: zod_1.z.string().trim().min(1).max(128).optional(),
    sessionId: zod_1.z.string().trim().min(1).max(128).optional(),
    source: zod_1.z.string().trim().min(1).max(50),
    properties: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    schemaVersion: zod_1.z.number().int().min(1).max(10).optional(),
});
exports.trackAnalyticsBatchRequestSchema = zod_1.z.object({
    events: zod_1.z.array(exports.trackAnalyticsEventRequestSchema).min(1).max(100),
});
exports.analyticsQuerySchema = zod_1.z.object({
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
    source: zod_1.z.string().optional(),
    runtime: zod_1.z.string().optional(),
    organizationId: zod_1.z.string().optional(),
});
exports.analyticsCleanupSchema = zod_1.z.object({
    retentionDays: zod_1.z.coerce.number().int().min(7).max(3650).optional(),
});
//# sourceMappingURL=schemas.js.map