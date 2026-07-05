import { App } from "aws-cdk-lib";
import { BackchannelStack } from "../lib/backchannel-stack.js";

const app = new App();
// Deploys to your own account/region: set AWS_REGION / CDK_DEFAULT_REGION (or a profile),
// falling back to ap-southeast-2. Account comes from your credentials, never hardcoded.
new BackchannelStack(app, "BackchannelStack", {
  env: { region: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || "ap-southeast-2" },
});
