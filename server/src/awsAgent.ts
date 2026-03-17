// AWS-Specific DevOps Agent for handling AWS queries & failure recovery

export interface SuggestedAction {
  label: string;
  action: string;
  icon?: string;
}

export interface AWSResponse {
  text: string;
  type?: 'status' | 'error' | 'success' | 'info' | 'table';
  data?: any;
  action?: string;
  suggestedActions?: SuggestedAction[];
}

// Mock AWS EC2 Instances
const mockEC2Instances = [
  { id: 'i-0abc123', name: 'web-server-1', state: 'running', type: 't2.medium', ip: '54.123.45.67' },
  { id: 'i-0def456', name: 'api-server', state: 'running', type: 't2.large', ip: '54.123.45.68' },
  { id: 'i-0ghi789', name: 'db-backup', state: 'stopped', type: 't2.micro', ip: 'N/A' },
  { id: 'i-0jkl012', name: 'chat-agent-prod', state: 'running', type: 't3.medium', ip: '54.123.45.69' },
];

// Mock AWS Lambda Functions
const mockLambdaFunctions = [
  { name: 'process-messages', runtime: 'nodejs18.x', memory: 512, lastModified: '2024-03-12', status: 'Active' },
  { name: 'generate-reports', runtime: 'python3.11', memory: 1024, lastModified: '2024-03-10', status: 'Active' },
  { name: 'cleanup-logs', runtime: 'nodejs18.x', memory: 256, lastModified: '2024-02-28', status: 'Active' },
];

// Mock Job Listings
const mockJobs = [
  { id: 1, title: 'AWS Solutions Architect', location: 'Remote', salary: '$150k-$200k', posted: '2 days ago' },
  { id: 2, title: 'DevOps Engineer (AWS)', location: 'San Francisco, CA', salary: '$130k-$180k', posted: '5 days ago' },
  { id: 3, title: 'Cloud Security Specialist', location: 'New York, NY', salary: '$140k-$190k', posted: '1 week ago' },
  { id: 4, title: 'Full Stack Developer (AWS)', location: 'Austin, TX', salary: '$110k-$160k', posted: '3 days ago' },
  { id: 5, title: 'Database Administrator (AWS)', location: 'Seattle, WA', salary: '$120k-$170k', posted: '4 days ago' },
];

// Detect if user is reporting a failure/error
function detectFailureScenario(message: string): { isFailure: boolean; failureType: string } {
  const lower = message.toLowerCase();
  
  if (lower.includes('fail') || lower.includes('error') || lower.includes('broken') || lower.includes('down')) {
    if (lower.includes('load') || lower.includes('deploy') || lower.includes('push')) {
      return { isFailure: true, failureType: 'deployment_failed' };
    }
    if (lower.includes('pipeline') || lower.includes('job')) {
      return { isFailure: true, failureType: 'pipeline_failed' };
    }
    if (lower.includes('instance') || lower.includes('ec2') || lower.includes('server')) {
      return { isFailure: true, failureType: 'instance_failed' };
    }
    if (lower.includes('database') || lower.includes('rds')) {
      return { isFailure: true, failureType: 'database_failed' };
    }
    return { isFailure: true, failureType: 'generic_error' };
  }
  
  return { isFailure: false, failureType: '' };
}

// Generate contextual recovery suggestions
function getRecoverySuggestions(failureType: string): SuggestedAction[] {
  const suggestions: { [key: string]: SuggestedAction[] } = {
    deployment_failed: [
      { label: '♻️ Restart the load', action: 'Restart deployment immediately' },
      { label: '📋 Check deployment logs', action: 'Show deployment logs' },
      { label: '🔙 Rollback to previous version', action: 'Rollback deployment' },
      { label: '⚙️ View deployment configuration', action: 'Show deployment config' },
    ],
    pipeline_failed: [
      { label: '▶️ Retry pipeline', action: 'Retry the failed pipeline' },
      { label: '📊 View pipeline logs', action: 'Show me the pipeline error logs' },
      { label: '🔎 Analyze failure', action: 'Analyze the pipeline failure' },
      { label: '⚡ Check resource usage', action: 'Check resource usage during failure' },
    ],
    instance_failed: [
      { label: '🔄 Restart instance', action: 'Restart the failed instance' },
      { label: '📋 Check instance status', action: 'Show instance details' },
      { label: '🔍 View system logs', action: 'Show system logs for this instance' },
      { label: '⚠️ Check health checks', action: 'Run health check' },
    ],
    database_failed: [
      { label: '💾 Start database', action: 'Start the database' },
      { label: '🔌 Check connections', action: 'Check database connections' },
      { label: '📊 View database metrics', action: 'Show database performance metrics' },
      { label: '🔒 Check authentication', action: 'Verify database credentials' },
    ],
    generic_error: [
      { label: '🔄 Retry operation', action: 'Retry this operation' },
      { label: '📋 Check logs', action: 'Show error logs' },
      { label: '🆘 Get help', action: 'help' },
      { label: '⚙️ Troubleshoot', action: 'Troubleshooting steps' },
    ],
  };
  
  return suggestions[failureType] || suggestions.generic_error;
}

export function generateAWSResponse(userMessage: string): AWSResponse {
  const lower = userMessage.toLowerCase();
  
  // Detect failure scenarios first
  const { isFailure, failureType } = detectFailureScenario(userMessage);
  
  if (isFailure) {
    let errorMsg = '';
    let suggestions: SuggestedAction[] = [];
    
    switch(failureType) {
      case 'deployment_failed':
        errorMsg = '❌ Deployment failed! The load operation encountered an error and did not complete successfully. Would you like me to help you recover?';
        suggestions = getRecoverySuggestions(failureType);
        break;
      case 'pipeline_failed':
        errorMsg = '❌ Pipeline execution failed! One or more steps in the pipeline did not complete successfully. What would you like to do?';
        suggestions = getRecoverySuggestions(failureType);
        break;
      case 'instance_failed':
        errorMsg = '❌ Instance failure detected! The server instance is not responding properly. Let me help you recover.';
        suggestions = getRecoverySuggestions(failureType);
        break;
      case 'database_failed':
        errorMsg = '❌ Database connection failed! Unable to reach the database service. Here are your options:';
        suggestions = getRecoverySuggestions(failureType);
        break;
      default:
        errorMsg = '❌ An error occurred! How would you like to proceed?';
        suggestions = getRecoverySuggestions(failureType);
    }
    
    return {
      text: errorMsg,
      type: 'error',
      suggestedActions: suggestions
    };
  }

  // EC2 Instance queries
  if (lower.includes('instance') || lower.includes('ec2') || lower.includes('servers')) {
    if (lower.includes('status') || lower.includes('running')) {
      return {
        text: `I found ${mockEC2Instances.length} EC2 instances. Here's the current status:`,
        type: 'table',
        data: mockEC2Instances,
        action: 'show_instances',
        suggestedActions: [
          { label: '🔄 Restart stopped instances', action: 'Restart stopped instances' },
          { label: '📊 Show monitoring data', action: 'Show EC2 monitoring' },
        ]
      };
    }
    if (lower.includes('running')) {
      const running = mockEC2Instances.filter(i => i.state === 'running');
      return {
        text: `You have ${running.length} instances currently running:`,
        type: 'table',
        data: running,
        suggestedActions: [
          { label: '⏹️ Stop instances', action: 'Stop running instances' },
          { label: '📊 View logs', action: 'Show instance logs' },
        ]
      };
    }
    if (lower.includes('stop') || lower.includes('stopped')) {
      const stopped = mockEC2Instances.filter(i => i.state === 'stopped');
      return {
        text: `You have ${stopped.length} stopped instances:`,
        type: 'table',
        data: stopped,
        suggestedActions: [
          { label: '▶️ Start instances', action: 'Start stopped instances' },
          { label: '🗑️ Terminate instances', action: 'Terminate stopped instances' },
        ]
      };
    }
  }

  // Retry/restart commands
  if (lower.includes('restart') || (lower.includes('retry') && !isFailure)) {
    return {
      text: '⚡ Initiating restart sequence...\n✓ Operation queued\n✓ Services will be restarted in 30 seconds\n✓ Estimated downtime: 2-3 minutes\n\nWould you like me to monitor the restart process?',
      type: 'success',
      suggestedActions: [
        { label: '👁️ Monitor restart', action: 'Monitor restart progress' },
        { label: '⏸️ Cancel restart', action: 'Cancel restart' },
        { label: '📈 Check system health', action: 'Check system health' },
      ]
    };
  }

  // Lambda function queries
  if (lower.includes('lambda') || lower.includes('function')) {
    return {
      text: 'Here are your active Lambda functions:',
      type: 'table',
      data: mockLambdaFunctions,
      action: 'show_lambda',
      suggestedActions: [
        { label: '📊 View invocations', action: 'Show Lambda invocation metrics' },
        { label: '⚙️ Update function', action: 'Update function configuration' },
        { label: '🧪 Test function', action: 'Test Lambda function' },
      ]
    };
  }

  // Job search queries
  if (lower.includes('job') || lower.includes('position') || lower.includes('hiring') || lower.includes('career')) {
    let jobs = mockJobs;
    
    if (lower.includes('aws')) {
      jobs = mockJobs.filter(j => j.title.toLowerCase().includes('aws'));
    }
    if (lower.includes('developer') || lower.includes('engineer')) {
      jobs = jobs.filter(j => j.title.toLowerCase().includes('engineer') || j.title.toLowerCase().includes('developer'));
    }
    
    return {
      text: `Found ${jobs.length} job opportunities matching your criteria:`,
      type: 'table',
      data: jobs,
      action: 'show_jobs',
      suggestedActions: [
        { label: '💼 Remote jobs only', action: 'Show remote job positions' },
        { label: '🎯 Filter by salary', action: 'Show highest paying jobs' },
      ]
    };
  }

  // S3 queries
  if (lower.includes('s3') || lower.includes('bucket')) {
    return {
      text: 'Your S3 buckets:\n• chat-agent-backups (2.4 GB)\n• logs-archive (156 GB)\n• media-storage (89 GB)\n\nTotal storage: 247.4 GB',
      type: 'info',
      suggestedActions: [
        { label: '📊 Analyze storage', action: 'Analyze S3 storage usage' },
        { label: '💾 Create new bucket', action: 'Create S3 bucket' },
        { label: '🔐 Check security', action: 'Check bucket permissions' },
      ]
    };
  }



  // RDS queries
  if (lower.includes('rds') || lower.includes('database')) {
    return {
      text: 'Your RDS Databases:\n• mysql-prod (db.t3.large, Multi-AZ: Yes, Status: Available)\n• postgres-backup (db.t3.micro, Multi-AZ: No, Status: Available)\n• aurora-cluster (db.r5.xlarge, Multi-AZ: Yes, Status: Available)',
      type: 'table',
      suggestedActions: [
        { label: '🔍 Check backups', action: 'Show database backups' },
        { label: '⚙️ Modify settings', action: 'Modify database settings' },
        { label: '🔒 Manage access', action: 'Manage database access' },
      ]
    };
  }

  // CloudWatch queries
  if (lower.includes('cloudwatch') || lower.includes('monitor') || lower.includes('log')) {
    return {
      text: 'CloudWatch Monitoring:\n✅ All systems normal\n📈 CPU average: 28%\n🔄 Network In: 450 GB/day\n🔻 Network Out: 230 GB/day\n⚠️ 2 alarms: Check database performance',
      type: 'status',
      suggestedActions: [
        { label: '🔔 Check alarms', action: 'Show active alarms' },
        { label: '📊 View metrics', action: 'Show detailed metrics' },
        { label: '⚠️ Create alert', action: 'Create new CloudWatch alert' },
      ]
    };
  }

  // IAM queries
  if (lower.includes('iam') || lower.includes('user') || lower.includes('permission')) {
    return {
      text: 'IAM Users & Roles:\n👤 Users: 8 active\n🔑 Access Keys: 12 active\n📋 Roles: 5 custom roles\n⚠️ Warning: 3 users without MFA enabled',
      type: 'info',
      suggestedActions: [
        { label: '🔐 Enable MFA', action: 'Enable MFA for all users' },
        { label: '👤 Add user', action: 'Create new IAM user' },
        { label: '🔑 Rotate keys', action: 'Rotate access keys' },
      ]
    };
  }

  // Auto Scaling queries
  if (lower.includes('scaling') || lower.includes('autoscale')) {
    return {
      text: 'Auto Scaling Groups:\n1. web-servers (Min: 2, Max: 10, Current: 4)\n2. api-servers (Min: 1, Max: 5, Current: 2)\n3. worker-nodes (Min: 3, Max: 20, Current: 5)\n\n📊 All groups are healthy and operating within limits.',
      type: 'status',
      suggestedActions: [
        { label: '📊 View scaling metrics', action: 'Show scaling group metrics' },
        { label: '⚙️ Update policies', action: 'Modify scaling policies' },
        { label: '🔄 Manual scale', action: 'Manually scale groups' },
      ]
    };
  }

  // ========== EXECUTIVE DASHBOARD QUERIES ==========
  
  // KPI Summary
  if (lower.includes('kpi') || lower.includes('metrics')) {
    return {
      text: '📊 Current KPI Summary - Last 7 Days',
      type: 'table',
      data: [
        { Metric: 'Success Rate', Value: '98%', Trend: '↑ +2%', Status: '✓ Excellent', Target: '≥95%' },
        { Metric: 'SLA Breaches', Value: '5', Trend: '↑ +3', Status: '⚠ Monitor', Target: '<3' },
        { Metric: 'MTTR (Mean Time to Recovery)', Value: '1.4 hrs', Trend: '↓ -0.3', Status: '✓ Good', Target: '<2 hrs' },
        { Metric: 'Auto-Resolved %', Value: '75%', Trend: '↑ +8%', Status: '✓ Strong', Target: '≥70%' },
        { Metric: 'Cost vs Budget', Value: '110%', Trend: '↑ +5%', Status: '🔴 Over', Target: '≤100%' },
      ],
      suggestedActions: [
        { label: 'Investigate SLA Breaches', action: 'Detail analysis of the 5 SLA breaches' },
        { label: 'Review Cost Overruns', action: 'Analyze why we are at 110% of budget' },
        { label: 'Optimize Auto-Recovery', action: 'Improve auto-recovery rate from 75% to 85%' },
        { label: 'View Historical Trends', action: 'Show KPI trends over the last 30 days' },
      ]
    };
  }

  // Pipeline Health
  if (lower.includes('pipeline') && lower.includes('health')) {
    return {
      text: '🏥 Pipeline Health Overview',
      type: 'table',
      data: [
        { Pipeline: 'Finance ETL', Status: '✓ Healthy', Health: '95%', LastRun: '2 hrs ago', Records: '2.5M', AvgTime: '45 min' },
        { Pipeline: 'Customer 360', Status: '✓ Healthy', Health: '92%', LastRun: '1 hr ago', Records: '1.8M', AvgTime: '38 min' },
        { Pipeline: 'Inventory Sync', Status: '⚠ At-Risk', Health: '68%', LastRun: '4 hrs ago', Records: '523K', AvgTime: '72 min' },
        { Pipeline: 'Sales Feed', Status: '✓ Healthy', Health: '89%', LastRun: '30 min ago', Records: '3.2M', AvgTime: '52 min' },
        { Pipeline: 'HR Data', Status: '✓ Healthy', Health: '91%', LastRun: '3 hrs ago', Records: '456K', AvgTime: '28 min' },
      ],
      suggestedActions: [
        { label: 'Address Inventory Sync Issues', action: 'Detailed diagnostics for Inventory Sync pipeline' },
        { label: 'Optimize Slow Pipelines', action: 'Show optimization recommendations' },
        { label: 'Schedule Maintenance', action: 'Plan maintenance windows' },
      ]
    };
  }

  // At-Risk Pipelines
  if (lower.includes('at-risk') || (lower.includes('risk') && lower.includes('pipeline'))) {
    return {
      text: '⚠️ Pipelines at Risk - Immediate Action Required',
      type: 'table',
      data: [
        { Pipeline: 'Inventory Sync', RiskLevel: 'HIGH', Issue: 'Upstream Talend retry storm', Impact: 'Delayed inventory updates', Resolution: 'Escalate to Talend team' },
        { Pipeline: 'Finance D+1 Feed', RiskLevel: 'CRITICAL', Issue: 'Data quality checks failing', Impact: 'Critical finance reporting delay', Resolution: 'Investigate data source' },
        { Pipeline: 'Customer 360', RiskLevel: 'MEDIUM', Issue: 'Occasional timeouts', Impact: 'Slow customer 360 enrichment', Resolution: 'Increase timeout limits' },
      ],
      suggestedActions: [
        { label: 'Escalate Finance D+1', action: 'Create critical incident for Finance D+1' },
        { label: 'Contact Talend Support', action: 'Open support ticket for retry storm' },
        { label: 'View Detailed Logs', action: 'Show detailed error logs and traces' },
        { label: 'Auto-remediate', action: 'Trigger auto-remediation for at-risk pipelines' },
      ]
    };
  }

  // Cost Analysis
  if (lower.includes('cost') || lower.includes('budget') || lower.includes('spending')) {
    return {
      text: '💰 Cost Analysis & Budget Report',
      type: 'table',
      data: [
        { Category: 'Compute Costs', Current: '$28,500', Budget: '$25,000', Variance: '+14%', Trend: 'Increasing' },
        { Category: 'Storage Costs', Current: '$12,300', Budget: '$12,000', Variance: '+2.5%', Trend: 'Stable' },
        { Category: 'Data Transfer', Current: '$8,700', Budget: '$8,000', Variance: '+8.75%', Trend: 'Increasing' },
        { Category: 'Licensing', Current: '$15,000', Budget: '$15,000', Variance: '0%', Trend: 'Stable' },
        { Category: 'TOTAL', Current: '$64,500', Budget: '$60,000', Variance: '+7.5%', Trend: 'Increasing' },
      ],
      suggestedActions: [
        { label: 'Optimize Compute Usage', action: 'Identify idle resources and cost optimization opportunities' },
        { label: 'Review Data Transfer', action: 'Analyze data transfer patterns and CDN usage' },
        { label: 'Set Budget Alerts', action: 'Configure automated alerts for budget thresholds' },
        { label: 'Cost Forecast', action: 'Predict end-of-month costs based on current trends' },
      ]
    };
  }

  // Auto-Recovery Trends
  if (lower.includes('recovery') || lower.includes('trend')) {
    return {
      text: '📈 Failures vs Auto-Recovery Trend (Last 6 Months)',
      type: 'table',
      data: [
        { Month: 'January', Failures: '80', AutoRecovered: '40', FailureRate: '50%', MTTR: '3.2 hrs' },
        { Month: 'February', Failures: '120', AutoRecovered: '70', FailureRate: '58%', MTTR: '2.8 hrs' },
        { Month: 'March', Failures: '150', AutoRecovered: '95', FailureRate: '63%', MTTR: '2.4 hrs' },
        { Month: 'April', Failures: '180', AutoRecovered: '125', FailureRate: '69%', MTTR: '2.1 hrs' },
        { Month: 'May', Failures: '210', AutoRecovered: '155', FailureRate: '74%', MTTR: '1.8 hrs' },
        { Month: 'June (Current)', Failures: '240', AutoRecovered: '190', FailureRate: '79%', MTTR: '1.4 hrs' },
      ],
      suggestedActions: [
        { label: 'Boost Auto-Recovery to 85%', action: 'Analyze remaining 50 failures for automation patterns' },
        { label: 'Additional Recovery Strategies', action: 'Implement intelligent retry mechanisms' },
        { label: 'View Recovery Metrics', action: 'Detailed breakdown by pipeline type' },
      ]
    };
  }

  // Business Impact
  if (lower.includes('business impact') || lower.includes('affected')) {
    return {
      text: '📊 Business Impact Analysis - Affected Data Products',
      type: 'table',
      data: [
        { DataProduct: 'Affected Data Products', Count: '85', Impact: 'HIGH', Status: 'At-Risk' },
        { DataProduct: 'Retail Sales & Failure', Count: '45', Impact: 'CRITICAL', Status: 'Delayed' },
        { DataProduct: 'Frontier Wireless Drops', Count: '25', Impact: 'MEDIUM', Status: 'Degraded' },
        { DataProduct: 'Customer Churn Prediction', Count: '12', Impact: 'LOW', Status: 'Delayed' },
        { DataProduct: 'Finance Reporting', Count: '8', Impact: 'CRITICAL', Status: 'Blocked' },
      ],
      suggestedActions: [
        { label: 'Prioritize Critical Products', action: 'Focus on Retail Sales and Finance Reporting issues' },
        { label: 'Notify Stakeholders', action: 'Send updates to affected business unit leads' },
        { label: 'Recovery Timeline', action: 'Show estimated recovery timeline for each product' },
        { label: 'Workaround Options', action: 'Provide interim data sources until full recovery' },
      ]
    };
  }

  // SLA Compliance
  if (lower.includes('sla')) {
    return {
      text: '⚖️ SLA Compliance & Breaches',
      type: 'table',
      data: [
        { Pipeline: 'Finance ETL', SLA: '4 hrs', ActualTime: '3.5 hrs', Status: '✓ Met', Breaches: '0' },
        { Pipeline: 'Inventory Sync', SLA: '6 hrs', ActualTime: '7.2 hrs', Status: '✗ Breach', Breaches: '2' },
        { Pipeline: 'Sales Feed', SLA: '2 hrs', ActualTime: '1.8 hrs', Status: '✓ Met', Breaches: '0' },
        { Pipeline: 'Customer 360', SLA: '3 hrs', ActualTime: '3.8 hrs', Status: '✗ Breach', Breaches: '2' },
        { Pipeline: 'HR Data', SLA: '8 hrs', ActualTime: '6.5 hrs', Status: '✓ Met', Breaches: '1' },
      ],
      suggestedActions: [
        { label: 'Urgent: Fix Inventory Sync', action: 'Address root cause of Inventory Sync breaches' },
        { label: 'Optimize Customer 360', action: 'Improve performance to meet 3-hour SLA' },
        { label: 'Review SLA Terms', action: 'Evaluate if SLAs are realistic' },
        { label: 'Alert Configuration', action: 'Set up proactive alerts for SLA violations' },
      ]
    };
  }

  // Monitor restart progress
  if (lower.includes('monitor') && lower.includes('restart')) {
    return {
      text: '👁️ Monitoring restart progress...\n\n🔄 Phase 1: Graceful shutdown [████████░░] 80%\n   - Waiting for requests to complete\n   - Closing connections\n\n⏳ Phase 2: Service restart [██░░░░░░░░] 20%\n   - Services starting up\n   - Health checks pending\n\nEstimated time: 45 seconds remaining',
      type: 'status',
      suggestedActions: [
        { label: '⏭️ Skip to next phase', action: 'Force next restart phase' },
        { label: '📋 View detailed logs', action: 'Show restart logs' },
      ]
    };
  }

  // General AWS help
  if (lower.includes('help') || lower.includes('command') || lower.includes('what can')) {
    return {
      text: 'AWS Chat Agent Commands:\n\n📦 Infrastructure:\n• "Show EC2 instances" - View instance status\n• "Lambda functions" - List Lambda functions\n• "RDS databases" - Database status\n\n💼 Jobs:\n• "Find AWS jobs" - Search job listings\n• "Developer positions" - Filter by role\n\n� Monitoring:\n• "CloudWatch status" - System monitoring\n• "Auto scaling groups" - Scaling status\n\n🔐 Security:\n• "IAM users" - User management\n• "S3 buckets" - Storage overview\n\n🆘 Troubleshooting:\n• "Deployment failed" - Get recovery options\n• "Pipeline failed" - Diagnose pipeline issues',
      type: 'info',
      suggestedActions: [
        { label: '📦 Infrastructure', action: 'Show EC2 instances' },
        { label: '📊 Monitoring', action: 'CloudWatch status' },
        { label: '🔐 Security', action: 'IAM users' },
      ]
    };
  }

  // AWS account info
  if (lower.includes('account') || lower.includes('profile')) {
    return {
      text: 'AWS Account Information:\n👤 Account ID: 123456789012\n🌍 Primary Region: us-east-1\n📝 Account Status: Active\n🛡️ Security: Enhanced monitoring enabled\n💳 Payment Method: Visa ending in 4242',
      type: 'info',
      suggestedActions: [
        { label: '🔒 Security review', action: 'Perform security review' },
        { label: '🌍 Change region', action: 'Switch primary region' },
      ]
    };
  }

  // Default response
  return {
    text: 'I can help you with AWS queries! Try asking about:\n• EC2 instances & status\n• Lambda functions\n• Job opportunities\n• Databases (RDS)\n• Monitoring (CloudWatch)\n\nType "help" for more commands.',
    type: 'info',
    suggestedActions: [
      { label: '📦 View instances', action: 'Show EC2 instances' },
      { label: '📊 Billing', action: 'Show billing info' },
      { label: '🆘 Help', action: 'help' },
    ]
  };
}
