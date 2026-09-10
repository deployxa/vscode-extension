import { z } from 'zod';
import { EXTENSION_ANALYTICS_EVENTS } from './dtos.js';

export const idSchema = z.string().min(1);
export const organizationIdSchema = idSchema;
export const projectIdSchema = idSchema;
export const deploymentIdSchema = idSchema;

// repositoryUrl accepts a real git URL or a direct-upload sentinel such as
// `upload:my-app.zip`. The Engine validates ownership and persistence itself,
// so the shared contract only enforces a non-empty identifier here.
export const isUploadRepository = (value: string) => typeof value === 'string' && value.startsWith('upload:');
export const createProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  repositoryUrl: z.string().trim().min(1).max(2048).refine(value => {
    try { new URL(value); return true; } catch { return isUploadRepository(value); }
  }, 'repositoryUrl must be a valid URL or an upload: sentinel'),
  branch: z.string().trim().min(1).max(255).optional(),
  framework: z.string().trim().min(1).max(100).optional(),
  rootDirectory: z.string().trim().max(500).optional(),
});

export const createDeploymentRequestSchema = z.object({
  projectId: projectIdSchema,
  branch: z.string().trim().min(1).max(255).optional(),
  isPreview: z.boolean().optional(),
  repoFullName: z.string().trim().min(1).max(255).optional(),
  prNumber: z.number().int().positive().optional(),
});

export const setEnvironmentVariableRequestSchema = z.object({
  key: z.string().trim().min(1).max(255),
  value: z.string(),
  branch: z.string().trim().min(1).max(255).optional(),
});

export const createDomainRequestSchema = z.object({
  domain: z.string().trim().min(1).max(253),
});

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export const organizationContextSchema = z.object({
  organizationId: organizationIdSchema.optional(),
});

export const extensionInstallationIdSchema = z.string().uuid();
export const trackExtensionEventRequestSchema = z.object({
  event: z.enum(EXTENSION_ANALYTICS_EVENTS),
  installationId: extensionInstallationIdSchema,
  occurredAt: z.string().datetime({ offset: true }).optional(),
}).strict();
export type TrackExtensionEventRequestInput = z.infer<typeof trackExtensionEventRequestSchema>;

import { ANALYTICS_EVENT_NAMES } from './events.js';

export const trackAnalyticsEventRequestSchema = z.object({
  eventId: z.string().uuid(),
  eventName: z.enum(ANALYTICS_EVENT_NAMES),
  occurredAt: z.string().datetime({ offset: true }).optional(),
  anonymousId: z.string().trim().min(1).max(128).optional(),
  userId: z.string().trim().min(1).max(128).optional(),
  organizationId: z.string().trim().min(1).max(128).optional(),
  sessionId: z.string().trim().min(1).max(128).optional(),
  source: z.string().trim().min(1).max(50),
  properties: z.record(z.string(), z.unknown()).optional(),
  schemaVersion: z.number().int().min(1).max(10).optional(),
});

export const trackAnalyticsBatchRequestSchema = z.object({
  events: z.array(trackAnalyticsEventRequestSchema).min(1).max(100),
});

export const analyticsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  source: z.string().optional(),
  runtime: z.string().optional(),
  organizationId: z.string().optional(),
});

export const analyticsCleanupSchema = z.object({
  retentionDays: z.coerce.number().int().min(7).max(3650).optional(),
});

export type TrackAnalyticsEventRequestInput = z.infer<typeof trackAnalyticsEventRequestSchema>;
export type TrackAnalyticsBatchRequestInput = z.infer<typeof trackAnalyticsBatchRequestSchema>;
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
export type AnalyticsCleanupInput = z.infer<typeof analyticsCleanupSchema>;

export type CreateProjectRequestInput = z.infer<typeof createProjectRequestSchema>;
export type CreateDeploymentRequestInput = z.infer<typeof createDeploymentRequestSchema>;
export type SetEnvironmentVariableRequestInput = z.infer<typeof setEnvironmentVariableRequestSchema>;
export type CreateDomainRequestInput = z.infer<typeof createDomainRequestSchema>;
export type PageQueryInput = z.infer<typeof pageQuerySchema>;

