import { HttpTransport, type ClientOptions, type RequestOptions } from './transport.js';
import { ActivityResource, AnalyticsResource, ApiTokensResource, ArtifactsResource, AssistantResource, AuditResource, AuthResource, BillingResource, CronResource, DatabaseResource, DatabasesResource, DeploymentProgressResource, DeploymentsResource, DnsGuidanceResource, DnsResource, DomainsResource, EnvironmentResource, LogsResource, MetricsResource, MonitoringResource, NotificationsResource, OrganizationsResource, ProjectsResource, ReadinessResource, RegistrarResource, RepositoriesResource, RuntimeResource, ServicesResource, SslResource, SupportResource, TemplatesResource, UsersResource, WorkflowsResource } from './resources.js';
import { pollDeployment, pollValues, type PollOptions } from './streaming.js';
import { SdkRequestClient } from './compatibility.js';

export class DeployxaClient {
  readonly auth; readonly projects; readonly deployments; readonly environment; readonly domains;
  readonly logs; readonly organizations; readonly billing; readonly artifacts; readonly templates;
  readonly runtime; readonly ssl; readonly databases; readonly users; readonly monitoring; readonly metrics;
  readonly repositories; readonly notifications; readonly audit; readonly workflows;
  readonly activity;
  readonly readiness; readonly assistant; readonly database; readonly dns; readonly dnsGuidance; readonly deploymentProgress;
  readonly compatibility;
  readonly analytics; readonly apiTokens; readonly support; readonly cron; readonly services;
  readonly registrar;
  constructor(options: ClientOptions = {}) {
    const transport = new HttpTransport(options);
    this.auth = new AuthResource(transport); this.projects = new ProjectsResource(transport);
    this.deployments = new DeploymentsResource(transport); this.environment = new EnvironmentResource(transport);
    this.domains = new DomainsResource(transport); this.logs = new LogsResource(transport);
    this.organizations = new OrganizationsResource(transport); this.billing = new BillingResource(transport);
    this.artifacts = new ArtifactsResource(transport); this.templates = new TemplatesResource(transport);
    this.runtime = new RuntimeResource(transport); this.ssl = new SslResource(transport);
    this.databases = new DatabasesResource(transport); this.users = new UsersResource(transport);
    this.monitoring = new MonitoringResource(transport); this.metrics = new MetricsResource(transport);
    this.repositories = new RepositoriesResource(transport); this.notifications = new NotificationsResource(transport);
    this.audit = new AuditResource(transport); this.workflows = new WorkflowsResource(transport);
    this.activity = new ActivityResource(transport);
    this.readiness = new ReadinessResource(transport); this.assistant = new AssistantResource(transport);
    this.database = new DatabaseResource(transport); this.dnsGuidance = new DnsGuidanceResource(transport);
    this.dns = new DnsResource(transport);
    this.deploymentProgress = new DeploymentProgressResource(transport);
    this.analytics = new AnalyticsResource(transport);
    this.apiTokens = new ApiTokensResource(transport);
    this.support = new SupportResource(transport);
    this.cron = new CronResource(transport);
    this.services = new ServicesResource(transport);
    this.registrar = new RegistrarResource(transport);
    this.compatibility = new SdkRequestClient(options);
  }
  streamDeployment(id: string, options?: PollOptions) { return pollDeployment(() => this.deployments.get(id), options); }
  streamDeploymentProgress(id: string, options?: PollOptions) { return pollValues(() => this.deploymentProgress.get(id), options); }
  streamDeploymentLogs(id: string, options?: PollOptions) { return pollValues(() => this.logs.list(id), options); }
  /**
   * Deploy a local source archive without a git repository. Creates a project
   * backed by an `upload:` sentinel repository URL, then streams the archive
   * to the Engine build worker, returning the created deployment.
   */
  async uploadProject(input: { name: string; archive: BodyInit; filename: string; branch?: string }, options?: RequestOptions) {
    const project = await this.projects.create({ name: input.name.trim(), repositoryUrl: `upload:${input.filename}`, branch: input.branch || 'main' }, options);
    const deployment = await this.deployments.upload(project.id, input.archive, input.filename, options);
    return { project, deployment };
  }
}
