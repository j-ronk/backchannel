import { Duration, RemovalPolicy, Stack, StackProps, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { HttpApi, HttpMethod, CfnStage, DomainName, ApiMapping } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import * as events from "aws-cdk-lib/aws-events";
import * as eventsTargets from "aws-cdk-lib/aws-events-targets";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";
import { fileURLToPath } from "url";

// __dirname is dist/lib at runtime; resolve back to repo root then into src/handlers
const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

export class BackchannelStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const idleSeconds = String(this.node.tryGetContext("idleSeconds") ?? 7200);
    const maxLifeSeconds = String(this.node.tryGetContext("maxLifeSeconds") ?? 86400);

    // ── DynamoDB table ────────────────────────────────────────────────────────
    const table = new dynamodb.Table(this, "Backchannel", {
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      removalPolicy: RemovalPolicy.DESTROY,
    });

    table.addGlobalSecondaryIndex({
      indexName: "byStatus",
      partitionKey: { name: "status", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "lastActivityAt", type: dynamodb.AttributeType.STRING },
    });

    // ── Shared Lambda config ──────────────────────────────────────────────────
    const commonEnv: Record<string, string> = {
      TABLE: table.tableName,
      MAX_LIFE_SECONDS: maxLifeSeconds,
      IDLE_SECONDS: idleSeconds,
    };

    const handlerDir = path.resolve(repoRoot, "src/handlers");

    // Cost/blast-radius guards for a personal account:
    //  - short log retention so CloudWatch Logs don't accrue storage indefinitely
    // NOTE: per-function reservedConcurrentExecutions was removed. This account's Lambda
    // concurrency quota is only 10, so reserving any amount drops the unreserved pool
    // below AWS's required floor and fails the deploy. The account-wide limit (10) plus
    // the API Gateway throttle already bound runaway invocations; re-add reserved caps
    // only if the account concurrency quota is later raised.
    const LOG_RETENTION = logs.RetentionDays.TWO_WEEKS;

    const makeFn = (name: string, entry: string) =>
      new NodejsFunction(this, name, {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(handlerDir, entry),
        handler: "handler",
        environment: commonEnv,
        logGroup: new logs.LogGroup(this, `${name}Logs`, {
          retention: LOG_RETENTION,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      });

    // ── Lambdas ───────────────────────────────────────────────────────────────
    const createRoomFn = makeFn("CreateRoom", "createRoom.ts");
    const postEventFn = makeFn("PostEvent", "postEvent.ts");
    const readSinceFn = makeFn("ReadSince", "readSince.ts");
    const closeRoomFn = makeFn("CloseRoom", "closeRoom.ts");
    const sweeperFn = makeFn("Sweeper", "sweeper.ts");
    const landingFn = makeFn("Landing", "landing.ts");

    for (const fn of [createRoomFn, postEventFn, readSinceFn, closeRoomFn, sweeperFn]) {
      table.grantReadWriteData(fn);
    }

    // ── HTTP API ──────────────────────────────────────────────────────────────
    const httpApi = new HttpApi(this, "BackchannelApi", {
      apiName: "backchannel-api",
    });

    httpApi.addRoutes({
      path: "/rooms",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("CreateRoomIntegration", createRoomFn),
    });

    httpApi.addRoutes({
      path: "/rooms/{roomId}/events",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("PostEventIntegration", postEventFn),
    });

    httpApi.addRoutes({
      path: "/rooms/{roomId}/events",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("ReadSinceIntegration", readSinceFn),
    });

    httpApi.addRoutes({
      path: "/rooms/{roomId}/close",
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration("CloseRoomIntegration", closeRoomFn),
    });

    httpApi.addRoutes({
      path: "/r/{roomId}",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("LandingIntegration", landingFn),
    });

    // Generic "what is backchannel" page at the domain root (no roomId).
    httpApi.addRoutes({
      path: "/",
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration("RootLandingIntegration", landingFn),
    });

    // ── Default-route throttling ──────────────────────────────────────────────
    // Tight rate cap = the denial-of-wallet defence for this public, unauthenticated,
    // pay-per-use API. Excess requests get a 429 AT THE GATEWAY (no Lambda/DynamoDB invoked),
    // so a flood can't run up the bill: worst-case cost scales with this rate. Legit usage is
    // tiny (each session polls ~once per turn), so 5 rps steady / 10 burst is ample headroom
    // yet caps a sustained flood to well under $1/day (vs ~$5-7/day at the old 50 rps). The $5
    // budget alarm remains the backstop; raise these if real usage ever needs more.
    const defaultStage = httpApi.defaultStage?.node.defaultChild as CfnStage | undefined;
    if (defaultStage) {
      defaultStage.defaultRouteSettings = {
        throttlingRateLimit: 5,
        throttlingBurstLimit: 10,
      };
    }

    // ── API URL output ────────────────────────────────────────────────────────
    new CfnOutput(this, "ApiUrl", {
      value: httpApi.apiEndpoint,
    });

    // ── Optional custom domain ────────────────────────────────────────────────
    // Enable with:  cdk deploy -c domain=relay.example.com -c certArn=<ACM cert ARN in this region>
    // Gives a stable URL that survives redeploys. Omit both for the raw execute-api endpoint.
    // The ACM cert must be validated (DNS) beforehand; point your DNS (DNS-only, not proxied)
    // at the CustomDomainTarget output below.
    const domain = this.node.tryGetContext("domain");
    const certArn = this.node.tryGetContext("certArn");
    if (domain && certArn) {
      const dn = new DomainName(this, "RelayDomain", {
        domainName: domain,
        certificate: Certificate.fromCertificateArn(this, "RelayCert", certArn),
      });
      new ApiMapping(this, "RelayApiMapping", { api: httpApi, domainName: dn });
      new CfnOutput(this, "CustomDomainTarget", { value: dn.regionalDomainName });
      new CfnOutput(this, "CustomDomainUrl", { value: `https://${domain}` });
    }

    // ── EventBridge cron → sweeper ────────────────────────────────────────────
    new events.Rule(this, "SweeperCron", {
      schedule: events.Schedule.rate(Duration.minutes(5)),
      targets: [new eventsTargets.LambdaFunction(sweeperFn)],
    });
  }
}
