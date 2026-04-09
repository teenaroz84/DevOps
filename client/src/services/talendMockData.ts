export const MOCK_TALEND_SUMMARY = {
  statusBreakdown: [
    { status: 'EXECUTION_SUCCESS', count: 142, color: '#2e7d32' },
    { status: 'EXECUTION_FAILED',  count: 27,  color: '#d32f2f' },
    { status: 'EXECUTION_RUNNING', count: 8,   color: '#f57c00' },
  ],
  workspaces: [
    { name: 'wrkspc_eda',      count: 112 },
    { name: 'wrkspc_analytics',count: 55  },
    { name: 'wrkspc_ingestion', count: 10  },
  ],
  engines: [
    { name: 'dev-vtldapp09-ing', count: 98  },
    { name: 'dev-vtldapp10-ing', count: 69  },
    { name: 'dev-vtldapp11-ing', count: 10  },
  ],
}

export const MOCK_TALEND_LEVEL_COUNTS = [
  { level: 'INFO',  count: 1240, color: '#1565c0' },
  { level: 'WARN',  count:  182, color: '#f57c00' },
  { level: 'ERROR', count:   64, color: '#e53935' },
  { level: 'FATAL', count:   12, color: '#c62828' },
  { level: 'DEBUG', count:  530, color: '#78909c' },
]

export const MOCK_TALEND_RECENT_TASKS = [
  { task_execution_id: '66c01a11102c6003096ad126', task_name: 'JB_EDL_Base_Load_To_SF',    execution_status: 'EXECUTION_FAILED',  workspace_name: 'wrkspc_eda',      environment_name: 'dev',  remote_engine_name: 'dev-vtldapp09-ing', artifact_name: 'reclstr_onprem_dmf_ing', artifact_version: '0.1.5.20261203101140', run_type: 'STANDARD', count_of_attempts: 1, execution_timestamp: '2026-03-18T08:36:02.131Z' },
  { task_execution_id: '66c01a11102c6003096ad127', task_name: 'JB_EDL_Load_Customer_DW',   execution_status: 'EXECUTION_SUCCESS', workspace_name: 'wrkspc_eda',      environment_name: 'dev',  remote_engine_name: 'dev-vtldapp09-ing', artifact_name: 'customer_pipeline',      artifact_version: '1.0.2.20260101000000', run_type: 'STANDARD', count_of_attempts: 1, execution_timestamp: '2026-03-18T07:15:00.000Z' },
  { task_execution_id: '66c01a11102c6003096ad128', task_name: 'JB_Analytics_Aggregation',  execution_status: 'EXECUTION_SUCCESS', workspace_name: 'wrkspc_analytics', environment_name: 'prod', remote_engine_name: 'dev-vtldapp10-ing', artifact_name: 'analytics_agg',         artifact_version: '2.0.0.20260201000000', run_type: 'TRIGGERED', count_of_attempts: 1, execution_timestamp: '2026-03-18T06:00:00.000Z' },
  { task_execution_id: '66c01a11102c6003096ad129', task_name: 'JB_Inventory_Refresh',      execution_status: 'EXECUTION_RUNNING', workspace_name: 'wrkspc_eda',      environment_name: 'dev',  remote_engine_name: 'dev-vtldapp09-ing', artifact_name: 'inventory_refresh',     artifact_version: '0.9.1.20260115000000', run_type: 'SCHEDULED', count_of_attempts: 1, execution_timestamp: '2026-03-18T09:00:00.000Z' },
  { task_execution_id: '66c01a11102c6003096ad130', task_name: 'JB_Orders_ETL_Pipeline',    execution_status: 'EXECUTION_SUCCESS', workspace_name: 'wrkspc_analytics', environment_name: 'prod', remote_engine_name: 'dev-vtldapp10-ing', artifact_name: 'orders_etl',            artifact_version: '3.1.0.20260220000000', run_type: 'SCHEDULED', count_of_attempts: 2, execution_timestamp: '2026-03-18T05:30:00.000Z' },
  { task_execution_id: '66c01a11102c6003096ad131', task_name: 'JB_Snowflake_Sync',         execution_status: 'EXECUTION_FAILED',  workspace_name: 'wrkspc_ingestion',environment_name: 'dev',  remote_engine_name: 'dev-vtldapp11-ing', artifact_name: 'sf_sync',               artifact_version: '1.2.3.20260301000000', run_type: 'MANUAL',   count_of_attempts: 3, execution_timestamp: '2026-03-18T04:45:00.000Z' },
]

export const MOCK_TALEND_RECENT_ERRORS = [
  { execution_timestamp: '2026-03-18T08:36:02.131Z', task_name: 'JB_EDL_Base_Load_To_SF',  level_text: 'FATAL', workspace_name: 'wrkspc_eda',      remote_engine_name: 'dev-vtldapp09-ing', artifact_name: 'reclstr_onprem_dmf_ing', err_message_desc: 'Cannot invoke "String.replace(java.lang.CharSequence, java.lang.CharSequence)" because "curation" is null while parsing the payload for customer segment enrichment. Input row id: 4509211, workspace: wrkspc_eda, execution trace: tMap_3 -> tJavaRow_2 -> tLogCatcher_1.', message_text: 'Cannot invoke "String.replace(java.lang.CharSequence, java.lang.CharSequence)" because "curation" is null', class_text: 'JB_EDL_Base_Load_To_SF', thread: 'RxCachedThreadScheduler-2' },
  { execution_timestamp: '2026-03-18T07:12:15.000Z', task_name: 'JB_Snowflake_Sync',       level_text: 'ERROR', workspace_name: 'wrkspc_ingestion', remote_engine_name: 'dev-vtldapp11-ing', artifact_name: 'sf_sync',               err_message_desc: 'Connection timeout after 30000ms. Unable to reach Snowflake endpoint. Retry 3/3 exhausted. The connector failed during token refresh after the network handshake stalled for region us-east-1.', message_text: 'Connection timeout after 30000ms. Unable to reach Snowflake endpoint. Retry 3/3 exhausted.', class_text: 'SnowflakeConnector', thread: 'pool-1-thread-4' },
  { execution_timestamp: '2026-03-18T06:55:00.000Z', task_name: 'JB_EDL_Base_Load_To_SF',  level_text: 'ERROR', workspace_name: 'wrkspc_eda',      remote_engine_name: 'dev-vtldapp09-ing', artifact_name: 'reclstr_onprem_dmf_ing', err_message_desc: 'NullPointerException in enrichment step: field "source_system_id" is null for record batch 450-460. Failing source rows were emitted by the upstream curation job without fallback defaults.', message_text: 'NullPointerException in enrichment step: field "source_system_id" is null for record batch 450-460', class_text: 'EnrichmentStep', thread: 'RxCachedThreadScheduler-1' },
  { execution_timestamp: '2026-03-18T05:30:00.000Z', task_name: 'JB_Orders_ETL_Pipeline',  level_text: 'WARN',  workspace_name: 'wrkspc_analytics', remote_engine_name: 'dev-vtldapp10-ing', artifact_name: 'orders_etl',            err_message_desc: 'Retry 2/3 for batch 12 due to transient DB lock on orders_staging table', message_text: 'Retry 2/3 for batch 12 due to transient DB lock on orders_staging table', class_text: 'RetryHandler', thread: 'main' },
]
