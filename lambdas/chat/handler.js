/**
 * Chat Lambda — handles POST /api/chat
 *
 * Mirrors the chat endpoint from server/src/index.ts.
 * Uses a simplified version of the awsAgent logic.
 *
 * For production, you can integrate Amazon Bedrock, OpenAI,
 * or any LLM provider here.
 */
const { success, badRequest, serverError, corsPreFlight } = require('../shared/response');

// Simple keyword-based response (mirrors server/src/awsAgent.ts logic)
function generateResponse(message) {
  const lower = message.toLowerCase();

  if (lower.includes('ec2') || lower.includes('instance')) {
    return {
      text: 'Here are your current EC2 instances:\n\n• **web-server-1** (i-0abc123) — running, t2.medium\n• **api-server** (i-0def456) — running, t2.large\n• **db-backup** (i-0ghi789) — stopped, t2.micro\n• **chat-agent-prod** (i-0jkl012) — running, t3.medium',
      type: 'info',
    };
  }

  if (lower.includes('lambda') || lower.includes('function')) {
    return {
      text: 'Your Lambda functions:\n\n• **process-messages** — nodejs18.x, 512MB, Active\n• **generate-reports** — python3.11, 1024MB, Active\n• **cleanup-logs** — nodejs18.x, 256MB, Active',
      type: 'info',
    };
  }

  if (lower.includes('pipeline') || lower.includes('status')) {
    return {
      text: 'Pipeline Summary:\n\n• Finance D+1 ETL — **at risk** (72% success)\n• Customer 360 Sync — **healthy** (99%)\n• Inventory Refresh — **critical** (45%)\n• Sales Feed Aggregation — **healthy** (97%)\n• HR Data Warehouse Load — **at risk** (81%)',
      type: 'status',
    };
  }

  if (lower.includes('error') || lower.includes('fail')) {
    return {
      text: 'Current active errors:\n\n• **CRITICAL** — inventory-db-03: Connection refused (47 occurrences)\n• **HIGH** — talend-job-runner: Source feed timeout (12 occurrences)\n• **MEDIUM** — hr-etl-worker: Memory limit exceeded (2 occurrences)',
      type: 'error',
    };
  }

  if (lower.includes('cost') || lower.includes('budget') || lower.includes('spend')) {
    return {
      text: 'Cost Summary: **$284K** total vs **$258K** budget (+$26K overage)\n\nTop spenders: Snowflake Compute ($92K, +15%), PostgreSQL RDS ($48K, -4%), CloudWatch Logs ($31K, +11%)',
      type: 'info',
    };
  }

  if (lower.includes('help')) {
    return {
      text: 'I can help you with:\n\n• **EC2 instances** — "show me EC2 instances"\n• **Lambda functions** — "list lambda functions"\n• **Pipeline status** — "pipeline status"\n• **Errors** — "show errors"\n• **Costs** — "what is the current spend?"',
      type: 'info',
    };
  }

  return {
    text: `I received your message: "${message}". Try asking about EC2 instances, Lambda functions, pipeline status, errors, or costs.`,
    type: 'info',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return corsPreFlight();

  try {
    const body = JSON.parse(event.body || '{}');
    const { message } = body;

    if (!message) {
      return badRequest('Message is required');
    }

    const response = generateResponse(message);
    return success(response);
  } catch (err) {
    console.error('Chat Lambda error:', err);
    return serverError(err.message);
  }
};
