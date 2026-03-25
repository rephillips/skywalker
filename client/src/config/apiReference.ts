export interface Endpoint {
  path: string;
  methods: string;
  description: string;
  example?: {
    request: string;
    response?: string;
    notes?: string;
  };
}

export interface SubSection {
  name: string;
  endpoints: Endpoint[];
}

export interface ApiCategory {
  id: string;
  name: string;
  description: string;
  subSections: SubSection[];
}

export const apiConventions = {
  baseUrl: [
    "https://<host>:8089/services/<endpoint>",
    "https://<host>:8089/servicesNS/{owner}/{app}/<endpoint>",
  ],
  authMethods: [
    { method: "Basic Auth", detail: "Username/password via HTTP Basic Authentication" },
    { method: "Session Tokens", detail: "POST /services/auth/login → Authorization: Splunk <token>" },
    { method: "Bearer Tokens", detail: "Long-lived tokens via authorization/tokens endpoints" },
  ],
  httpMethods: [
    { method: "GET", purpose: "Retrieve/list resources" },
    { method: "POST", purpose: "Create or update resources (PUT is NOT supported)" },
    { method: "DELETE", purpose: "Remove resources" },
  ],
  queryParams: [
    { param: "count", description: "Max entries returned", default: "30" },
    { param: "offset", description: "Starting index for pagination", default: "0" },
    { param: "search", description: "Response field filtering", default: "—" },
    { param: "sort_key", description: "Field name to sort by", default: "name" },
    { param: "sort_dir", description: "Sort direction: asc or desc", default: "asc" },
    { param: "output_mode", description: "Response format: xml, json, csv", default: "xml" },
  ],
};

export const apiCategories: ApiCategory[] = [
  {
    id: "access-control",
    name: "Access Control",
    description: "Manage user authentication, authorization, roles, capabilities, and MFA.",
    subSections: [
      {
        name: "Authentication",
        endpoints: [
          {
            path: "auth/login",
            methods: "POST",
            description: "Authenticate user, returns session token",
            example: {
              request: `curl -k https://localhost:8089/services/auth/login -d username=admin -d password=changeme -d output_mode=json`,
              response: `{
  "sessionKey": "192fd3e46a31246da7ea7f109e7f95fd",
  "message": "Successfully authenticated"
}`,
              notes: "Use the returned sessionKey as 'Authorization: Splunk <token>' header for subsequent requests.",
            },
          },
          { path: "authentication/current-context", methods: "GET", description: "List current user contexts" },
          { path: "authentication/httpauth-tokens", methods: "GET, POST", description: "List or create session tokens" },
          {
            path: "authentication/users",
            methods: "GET, POST",
            description: "List or create user accounts",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/authentication/users?output_mode=json&count=5`,
              response: `{
  "entry": [
    { "name": "admin", "content": { "roles": ["admin"], "email": "" } },
    { "name": "power_user", "content": { "roles": ["power"], "email": "user@example.com" } }
  ]
}`,
            },
          },
          { path: "authentication/users/{name}", methods: "GET, POST, DELETE", description: "Access, update, or delete user" },
        ],
      },
      {
        name: "Authorization",
        endpoints: [
          { path: "authorization/capabilities", methods: "GET", description: "List all available capabilities" },
          {
            path: "authorization/roles",
            methods: "GET, POST",
            description: "List or create user roles",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/authorization/roles?output_mode=json&count=5`,
              response: `{
  "entry": [
    { "name": "admin", "content": { "imported_roles": ["power"], "capabilities": ["admin_all_objects"] } },
    { "name": "user", "content": { "imported_roles": [], "capabilities": ["change_own_password"] } }
  ]
}`,
            },
          },
          { path: "authorization/roles/{name}", methods: "GET, POST, DELETE", description: "Access, update, or delete role" },
          { path: "authorization/tokens", methods: "GET, POST, DELETE", description: "Manage bearer tokens" },
        ],
      },
      {
        name: "SAML / LDAP / SSO",
        endpoints: [
          { path: "admin/LDAP-groups", methods: "GET, POST", description: "Manage LDAP group mappings" },
          { path: "admin/SAML-groups", methods: "GET, POST, DELETE", description: "Map IdP groups to Splunk roles" },
          { path: "authentication/providers/SAML", methods: "GET, POST", description: "SAML configurations" },
          { path: "admin/proxySSO", methods: "GET, POST", description: "ProxySSO configuration" },
        ],
      },
    ],
  },
  {
    id: "applications",
    name: "Applications",
    description: "Install, list, create, update, and delete Splunk apps.",
    subSections: [
      {
        name: "Apps",
        endpoints: [
          {
            path: "apps/local",
            methods: "GET, POST",
            description: "List or install apps",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/apps/local?output_mode=json&count=5`,
              response: `{
  "entry": [
    { "name": "search", "content": { "label": "Search & Reporting", "version": "9.1.0", "visible": true } },
    { "name": "SplunkForwarder", "content": { "label": "SplunkForwarder", "version": "9.1.0" } }
  ]
}`,
            },
          },
          {
            path: "apps/local/{name}",
            methods: "GET, POST, DELETE",
            description: "Access, update, or delete app",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/apps/local/search?output_mode=json`,
              response: `{
  "entry": [
    { "name": "search", "content": { "label": "Search & Reporting", "version": "9.1.0", "configured": true } }
  ]
}`,
            },
          },
          { path: "apps/local/{name}/package", methods: "GET", description: "Package app into archive" },
          { path: "apps/local/{name}/setup", methods: "GET, POST", description: "App setup configuration" },
          { path: "apps/local/{name}/update", methods: "GET, POST", description: "Check or update app" },
          { path: "apps/apptemplates", methods: "GET", description: "List app creation templates" },
        ],
      },
    ],
  },
  {
    id: "cluster",
    name: "Cluster",
    description: "Manage indexer cluster and search head cluster operations.",
    subSections: [
      {
        name: "Manager Node",
        endpoints: [
          { path: "cluster/manager/buckets", methods: "GET", description: "List cluster buckets" },
          { path: "cluster/manager/generation", methods: "GET", description: "Cluster generation data" },
          {
            path: "cluster/manager/info",
            methods: "GET",
            description: "Cluster manager node info",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/cluster/manager/info?output_mode=json`,
              response: `{
  "entry": [
    { "name": "master", "content": { "active_bundle": {}, "replication_factor": 3, "search_factor": 2, "multisite": false } }
  ]
}`,
            },
          },
          {
            path: "cluster/manager/peers",
            methods: "GET",
            description: "List cluster peers",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/cluster/manager/peers?output_mode=json`,
              response: `{
  "entry": [
    { "name": "GUID-1234", "content": { "label": "idx1", "status": "Up", "replication_port": 9887 } }
  ]
}`,
            },
          },
          { path: "cluster/manager/sites", methods: "GET", description: "List cluster sites" },
          { path: "cluster/manager/control/control/rolling-restart", methods: "POST", description: "Initiate rolling restart" },
        ],
      },
      {
        name: "Peer Nodes",
        endpoints: [
          { path: "cluster/peer/buckets", methods: "GET", description: "List local buckets" },
          { path: "cluster/peer/info", methods: "GET", description: "Peer node info" },
          { path: "cluster/peer/control/control/decommission", methods: "POST", description: "Decommission peer" },
        ],
      },
      {
        name: "Search Head Cluster",
        endpoints: [
          {
            path: "shcluster/captain/info",
            methods: "GET",
            description: "Captain info",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/shcluster/captain/info?output_mode=json`,
              response: `{
  "entry": [
    { "name": "captain", "content": { "label": "sh1", "rolling_restart_flag": false, "service_ready_flag": true } }
  ]
}`,
            },
          },
          { path: "shcluster/captain/members", methods: "GET", description: "List cluster members" },
          { path: "shcluster/member/info", methods: "GET", description: "Member info" },
          { path: "shcluster/member/control/control/restart", methods: "POST", description: "Restart member" },
        ],
      },
    ],
  },
  {
    id: "configuration",
    name: "Configuration",
    description: "Direct access to .conf configuration files.",
    subSections: [
      {
        name: "Config Files",
        endpoints: [
          {
            path: "configs/conf-{file}",
            methods: "GET, POST",
            description: "List or create stanzas in a conf file",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/configs/conf-inputs?output_mode=json&count=5`,
              response: `{
  "entry": [
    { "name": "monitor:///var/log/syslog", "content": { "disabled": false, "index": "main" } },
    { "name": "default", "content": { "host": "myhost" } }
  ]
}`,
              notes: "Replace {file} with the conf file name without the .conf extension (e.g., inputs, props, transforms).",
            },
          },
          {
            path: "configs/conf-{file}/{stanza}",
            methods: "GET, POST, DELETE",
            description: "Access, update, or delete stanza",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/configs/conf-inputs/monitor%3A%2F%2F%2Fvar%2Flog%2Fsyslog?output_mode=json`,
              response: `{
  "entry": [
    { "name": "monitor:///var/log/syslog", "content": { "disabled": false, "index": "main", "sourcetype": "syslog" } }
  ]
}`,
              notes: "URL-encode the stanza name (e.g., monitor:///var/log becomes monitor%3A%2F%2F%2Fvar%2Flog).",
            },
          },
          { path: "properties/{file_name}", methods: "GET", description: "List stanzas via legacy endpoint" },
          { path: "properties/{file_name}/{stanza_name}", methods: "GET", description: "List key/value pairs in stanza" },
          { path: "properties/{file_name}/{stanza_name}/{key_name}", methods: "GET, POST", description: "Get or set specific key" },
        ],
      },
    ],
  },
  {
    id: "deployment",
    name: "Deployment",
    description: "Manage deployment server, clients, and server classes.",
    subSections: [
      {
        name: "Deployment Server",
        endpoints: [
          {
            path: "deployment/server/applications",
            methods: "GET",
            description: "List deployment apps",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/deployment/server/applications?output_mode=json&count=5`,
              response: `{
  "entry": [
    { "name": "my_app", "content": { "serverclasses": ["web_servers"], "restartSplunkd": false } }
  ]
}`,
            },
          },
          { path: "deployment/server/applications/{name}", methods: "GET, POST", description: "Access or update deployment app" },
          {
            path: "deployment/server/clients",
            methods: "GET",
            description: "List deployment clients",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/deployment/server/clients?output_mode=json&count=5`,
              response: `{
  "entry": [
    { "name": "client1", "content": { "ip": "10.0.1.5", "hostname": "fwd01", "lastPhoneHomeTime": "2025-12-01T10:00:00" } }
  ]
}`,
            },
          },
          { path: "deployment/server/clients/{name}", methods: "GET", description: "Specific client info" },
          {
            path: "deployment/server/serverclasses",
            methods: "GET, POST",
            description: "List or create server classes",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/deployment/server/serverclasses?output_mode=json`,
              response: `{
  "entry": [
    { "name": "web_servers", "content": { "filterType": "whitelist", "restartSplunkd": false } }
  ]
}`,
            },
          },
          { path: "deployment/server/serverclasses/{name}", methods: "GET, POST, DELETE", description: "Manage server class" },
        ],
      },
      {
        name: "Deployment Client",
        endpoints: [
          { path: "deployment/client/config", methods: "GET", description: "Client configuration" },
          { path: "deployment/client/applications", methods: "GET", description: "Apps deployed to this client" },
        ],
      },
    ],
  },
  {
    id: "inputs",
    name: "Inputs",
    description: "Configure data inputs: file monitoring, TCP/UDP, HEC, scripted, and modular inputs.",
    subSections: [
      {
        name: "File & Directory",
        endpoints: [
          {
            path: "data/inputs/monitor",
            methods: "GET, POST",
            description: "List or create file/directory monitors",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/data/inputs/monitor?output_mode=json&count=5`,
              response: `{
  "entry": [
    { "name": "/var/log/syslog", "content": { "disabled": false, "index": "main", "sourcetype": "syslog" } }
  ]
}`,
            },
          },
          { path: "data/inputs/monitor/{name}", methods: "GET, POST, DELETE", description: "Manage specific monitor" },
          { path: "data/inputs/oneshot", methods: "GET, POST", description: "One-time file indexing" },
        ],
      },
      {
        name: "Network",
        endpoints: [
          { path: "data/inputs/tcp/cooked", methods: "GET, POST", description: "Cooked TCP inputs (from forwarders)" },
          { path: "data/inputs/tcp/raw", methods: "GET, POST", description: "Raw TCP data inputs" },
          { path: "data/inputs/tcp/ssl", methods: "GET, POST", description: "TCP SSL configuration" },
          { path: "data/inputs/udp", methods: "GET, POST", description: "UDP data inputs" },
        ],
      },
      {
        name: "HTTP Event Collector",
        endpoints: [
          {
            path: "data/inputs/http",
            methods: "GET, POST",
            description: "Global HEC settings and tokens",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/data/inputs/http?output_mode=json`,
              response: `{
  "entry": [
    { "name": "http", "content": { "disabled": false, "port": 8088, "enableSSL": true } }
  ]
}`,
              notes: "Global HEC settings. Individual tokens are managed via data/inputs/http/{name}.",
            },
          },
          {
            path: "data/inputs/http/{name}",
            methods: "GET, POST, DELETE",
            description: "Manage specific HEC token",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/data/inputs/http/my_token?output_mode=json`,
              response: `{
  "entry": [
    { "name": "my_token", "content": { "token": "abcd-1234-efgh-5678", "index": "main", "disabled": false } }
  ]
}`,
            },
          },
        ],
      },
      {
        name: "Scripted & Modular",
        endpoints: [
          { path: "data/inputs/script", methods: "GET, POST", description: "Scripted inputs" },
          { path: "data/inputs/script/{name}", methods: "GET, POST, DELETE", description: "Manage scripted input" },
          { path: "data/modular-inputs/{scheme}", methods: "GET", description: "List modular input instances" },
        ],
      },
      {
        name: "Ingest Actions",
        endpoints: [
          { path: "data/ingest/rfsdestinations", methods: "GET, POST", description: "Ingest action destinations" },
          { path: "data/ingest/rfsrules", methods: "GET, POST", description: "Ingest action routing rules" },
        ],
      },
    ],
  },
  {
    id: "introspection",
    name: "Introspection",
    description: "Inspect index volumes, disk usage, and index metadata.",
    subSections: [
      {
        name: "Indexes & Volumes",
        endpoints: [
          { path: "data/index-volumes", methods: "GET", description: "List all index volumes" },
          { path: "data/index-volumes/{name}", methods: "GET", description: "Specific volume info" },
          {
            path: "data/indexes",
            methods: "GET, POST",
            description: "List or create indexes",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/data/indexes?output_mode=json&count=5`,
              response: `{
  "entry": [
    { "name": "main", "content": { "totalEventCount": "1523400", "currentDBSizeMB": "512", "maxTotalDataSizeMB": "500000" } },
    { "name": "_internal", "content": { "totalEventCount": "890000", "currentDBSizeMB": "256" } }
  ]
}`,
            },
          },
          {
            path: "data/indexes/{name}",
            methods: "GET, POST, DELETE",
            description: "Manage specific index",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/data/indexes/main?output_mode=json`,
              response: `{
  "entry": [
    { "name": "main", "content": { "totalEventCount": "1523400", "currentDBSizeMB": "512", "frozenTimePeriodInSecs": "188697600" } }
  ]
}`,
            },
          },
          { path: "data/summaries", methods: "GET", description: "Disk usage summaries" },
        ],
      },
    ],
  },
  {
    id: "knowledge",
    name: "Knowledge",
    description: "Manage saved searches, event types, tags, fields, lookups, data models, and more.",
    subSections: [
      {
        name: "Saved Searches",
        endpoints: [
          {
            path: "saved/searches",
            methods: "GET, POST",
            description: "List or create saved searches",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/saved/searches?output_mode=json&count=5`,
              response: `{
  "entry": [
    { "name": "Errors in last 24h", "content": { "search": "index=main level=ERROR", "cron_schedule": "0 */6 * * *", "is_scheduled": true } }
  ]
}`,
            },
          },
          {
            path: "saved/searches/{name}",
            methods: "GET, POST, DELETE",
            description: "Manage saved search",
            example: {
              request: `curl -k -u admin:changeme "https://localhost:8089/services/saved/searches/Errors%20in%20last%2024h?output_mode=json"`,
              response: `{
  "entry": [
    { "name": "Errors in last 24h", "content": { "search": "index=main level=ERROR", "disabled": false, "alert_type": "number of events" } }
  ]
}`,
            },
          },
          {
            path: "saved/searches/{name}/dispatch",
            methods: "POST",
            description: "Dispatch saved search",
            example: {
              request: `curl -k -u admin:changeme -X POST "https://localhost:8089/services/saved/searches/Errors%20in%20last%2024h/dispatch?output_mode=json"`,
              response: `{
  "sid": "1234567890.12345"
}`,
              notes: "Returns a search ID (sid) that can be used with the search/v2/jobs endpoints to retrieve results.",
            },
          },
          { path: "saved/searches/{name}/history", methods: "GET", description: "Search dispatch history" },
          { path: "saved/searches/{name}/scheduled_times", methods: "GET", description: "Scheduled run times" },
          { path: "saved/searches/{name}/suppress", methods: "GET, POST", description: "Alert suppression" },
        ],
      },
      {
        name: "Event Types & Tags",
        endpoints: [
          { path: "saved/eventtypes", methods: "GET, POST", description: "List or create event types" },
          { path: "saved/eventtypes/{name}", methods: "GET, POST, DELETE", description: "Manage event type" },
          {
            path: "search/tags",
            methods: "GET",
            description: "List all tags",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/search/tags?output_mode=json&count=5`,
              response: `{
  "entry": [
    { "name": "host::webserver01", "content": { "tags": ["web", "production"] } }
  ]
}`,
            },
          },
          { path: "search/tags/{name}", methods: "GET, POST, DELETE", description: "Manage specific tag" },
        ],
      },
      {
        name: "Fields & Extractions",
        endpoints: [
          { path: "search/fields", methods: "GET", description: "List all fields" },
          { path: "search/fields/{name}", methods: "GET, POST", description: "Manage specific field" },
          {
            path: "data/props/extractions",
            methods: "GET, POST",
            description: "Field extractions",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/data/props/extractions?output_mode=json&count=5`,
              response: `{
  "entry": [
    { "name": "access_combined : EXTRACT-clientip", "content": { "value": "^(?P<clientip>\\d+\\.\\d+\\.\\d+\\.\\d+)" } }
  ]
}`,
            },
          },
          { path: "data/props/fieldaliases", methods: "GET, POST", description: "Field aliases" },
          { path: "data/transforms/extractions", methods: "GET, POST", description: "Transform-based extractions" },
          { path: "data/transforms/lookups", methods: "GET, POST", description: "Lookup definitions" },
        ],
      },
      {
        name: "Data Models & Views",
        endpoints: [
          {
            path: "datamodel/model",
            methods: "GET, POST",
            description: "List or create data models",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/datamodel/model?output_mode=json&count=5`,
              response: `{
  "entry": [
    { "name": "Network_Traffic", "content": { "acceleration": "{ \\"enabled\\": true }", "description": "Network traffic data model" } }
  ]
}`,
            },
          },
          { path: "datamodel/model/{name}", methods: "GET, POST, DELETE", description: "Manage data model" },
          { path: "data/ui/views", methods: "GET, POST", description: "Dashboard/view definitions" },
          { path: "data/ui/views/{name}", methods: "GET, POST, DELETE", description: "Manage specific view" },
          { path: "data/ui/nav", methods: "GET, POST", description: "App navigation configuration" },
        ],
      },
      {
        name: "Macros & Transactions",
        endpoints: [
          { path: "configs/conf-macros", methods: "GET, POST", description: "Search macros" },
          { path: "configs/conf-transactiontypes", methods: "GET, POST", description: "Transaction type definitions" },
        ],
      },
    ],
  },
  {
    id: "kvstore",
    name: "KV Store",
    description: "App key-value store: collection config, CRUD, batch ops, backup/restore.",
    subSections: [
      {
        name: "Collections",
        endpoints: [
          {
            path: "storage/collections/config",
            methods: "GET, POST",
            description: "List or create collections",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/servicesNS/nobody/search/storage/collections/config?output_mode=json`,
              response: `{
  "entry": [
    { "name": "my_collection", "content": { "field.name": "string", "field.value": "number" } }
  ]
}`,
              notes: "KV Store endpoints typically use the /servicesNS/{owner}/{app}/ prefix.",
            },
          },
          { path: "storage/collections/config/{name}", methods: "GET, POST, DELETE", description: "Manage collection config" },
          {
            path: "storage/collections/data/{collection}",
            methods: "GET, POST, DELETE",
            description: "CRUD on collection data",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/servicesNS/nobody/search/storage/collections/data/my_collection?output_mode=json`,
              response: `[
  { "_key": "abc123", "_user": "nobody", "name": "item1", "value": 42 },
  { "_key": "def456", "_user": "nobody", "name": "item2", "value": 99 }
]`,
              notes: "KV Store data endpoints return raw JSON arrays, not the standard Splunk envelope.",
            },
          },
          { path: "storage/collections/data/{collection}/{id}", methods: "GET, POST, DELETE", description: "Manage specific record" },
          { path: "storage/collections/data/{collection}/batch_save", methods: "POST", description: "Batch upsert records" },
          { path: "storage/collections/data/{collection}/batch_find", methods: "GET", description: "Batch find records" },
        ],
      },
      {
        name: "Admin",
        endpoints: [
          {
            path: "kvstore/status",
            methods: "GET",
            description: "KV store status",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/kvstore/status?output_mode=json`,
              response: `{
  "entry": [
    { "name": "kvstore-status", "content": { "current": { "status": "ready" }, "disabled": false } }
  ]
}`,
            },
          },
          { path: "kvstore/backup", methods: "POST", description: "Trigger backup" },
          { path: "kvstore/restore", methods: "POST", description: "Trigger restore" },
        ],
      },
    ],
  },
  {
    id: "license",
    name: "License",
    description: "Manage license groups, pools, and license status.",
    subSections: [
      {
        name: "License Management",
        endpoints: [
          { path: "licenser/groups", methods: "GET", description: "List license groups" },
          {
            path: "licenser/licenses",
            methods: "GET, POST",
            description: "List or add licenses",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/licenser/licenses?output_mode=json`,
              response: `{
  "entry": [
    { "name": "ABCD-1234-EFGH-5678", "content": { "type": "enterprise", "quota": "536870912000", "expiration_time": "2026-12-31" } }
  ]
}`,
            },
          },
          { path: "licenser/licenses/{name}", methods: "GET, DELETE", description: "Manage specific license" },
          { path: "licenser/pools", methods: "GET, POST", description: "List or create license pools" },
          { path: "licenser/pools/{name}", methods: "GET, POST, DELETE", description: "Manage license pool" },
          {
            path: "licenser/messages",
            methods: "GET",
            description: "License-related messages",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/licenser/messages?output_mode=json`,
              response: `{
  "entry": [
    { "name": "msg1", "content": { "severity": "WARN", "description": "License usage approaching daily quota" } }
  ]
}`,
            },
          },
        ],
      },
    ],
  },
  {
    id: "metrics",
    name: "Metrics Catalog",
    description: "Query metric names, dimensions, and rollup policies.",
    subSections: [
      {
        name: "Metrics",
        endpoints: [
          {
            path: "catalog/metricstore/dimensions",
            methods: "GET",
            description: "List metric dimensions",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/catalog/metricstore/dimensions?output_mode=json&filter=index%3Dem_metrics`,
              response: `{
  "entry": [
    { "name": "host", "content": { "type": "dimension" } },
    { "name": "source", "content": { "type": "dimension" } }
  ]
}`,
            },
          },
          { path: "catalog/metricstore/dimensions/{name}/values", methods: "GET", description: "Dimension values" },
          {
            path: "catalog/metricstore/metrics",
            methods: "GET",
            description: "List metric names",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/catalog/metricstore/metrics?output_mode=json&filter=index%3Dem_metrics`,
              response: `{
  "entry": [
    { "name": "cpu.idle", "content": { "type": "metric" } },
    { "name": "mem.used", "content": { "type": "metric" } }
  ]
}`,
            },
          },
          { path: "catalog/metricstore/rollup-policy", methods: "GET, POST", description: "Rollup policies" },
        ],
      },
    ],
  },
  {
    id: "outputs",
    name: "Outputs",
    description: "Configure TCP forwarding and syslog outputs.",
    subSections: [
      {
        name: "TCP Forwarding",
        endpoints: [
          {
            path: "data/outputs/tcp/default",
            methods: "GET, POST",
            description: "Default forwarding settings",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/data/outputs/tcp/default?output_mode=json`,
              response: `{
  "entry": [
    { "name": "tcpout", "content": { "defaultGroup": "my_indexers", "indexAndForward": false } }
  ]
}`,
            },
          },
          {
            path: "data/outputs/tcp/group",
            methods: "GET, POST",
            description: "Target groups",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/data/outputs/tcp/group?output_mode=json`,
              response: `{
  "entry": [
    { "name": "my_indexers", "content": { "servers": "10.0.1.10:9997,10.0.1.11:9997", "method": "autobalance" } }
  ]
}`,
            },
          },
          { path: "data/outputs/tcp/group/{name}", methods: "GET, POST, DELETE", description: "Manage target group" },
          { path: "data/outputs/tcp/server", methods: "GET, POST", description: "Individual forwarding targets" },
          { path: "data/outputs/tcp/server/{name}", methods: "GET, POST, DELETE", description: "Manage target server" },
          { path: "data/outputs/tcp/syslog", methods: "GET, POST", description: "Syslog output targets" },
        ],
      },
    ],
  },
  {
    id: "search",
    name: "Search",
    description: "Create and manage search jobs, retrieve results, and parse SPL.",
    subSections: [
      {
        name: "Search Jobs (v2)",
        endpoints: [
          {
            path: "search/v2/jobs",
            methods: "GET, POST",
            description: "List or create search jobs",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/search/v2/jobs -d search="search index=_internal | head 10" -d output_mode=json`,
              response: `{
  "sid": "1234567890.12345"
}`,
              notes: "POST creates a new search job. The returned sid is used with all other job endpoints. Prefix your SPL with 'search' for raw searches.",
            },
          },
          {
            path: "search/v2/jobs/{search_id}",
            methods: "GET, POST, DELETE",
            description: "Manage search job",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/search/v2/jobs/1234567890.12345?output_mode=json`,
              response: `{
  "entry": [
    { "name": "1234567890.12345", "content": { "dispatchState": "DONE", "eventCount": 10, "resultCount": 10, "runDuration": 0.45 } }
  ]
}`,
              notes: "Poll this endpoint to check job status. Key states: QUEUED, PARSING, RUNNING, FINALIZING, DONE, FAILED.",
            },
          },
          {
            path: "search/v2/jobs/{search_id}/results",
            methods: "GET",
            description: "Get search results",
            example: {
              request: `curl -k -u admin:changeme "https://localhost:8089/services/search/v2/jobs/1234567890.12345/results?output_mode=json&count=5"`,
              response: `{
  "results": [
    { "_time": "2025-12-01T10:00:00", "host": "web01", "source": "splunkd.log", "_raw": "12-01 10:00:00 INFO ..." },
    { "_time": "2025-12-01T09:59:58", "host": "web01", "source": "splunkd.log", "_raw": "12-01 09:59:58 WARN ..." }
  ]
}`,
              notes: "Only available after job reaches DONE state. Use count and offset for pagination.",
            },
          },
          {
            path: "search/v2/jobs/{search_id}/results_preview",
            methods: "GET",
            description: "Preview incomplete results",
            example: {
              request: `curl -k -u admin:changeme "https://localhost:8089/services/search/v2/jobs/1234567890.12345/results_preview?output_mode=json&count=5"`,
              response: `{
  "results": [
    { "_time": "2025-12-01T10:00:00", "host": "web01", "_raw": "12-01 10:00:00 INFO ..." }
  ]
}`,
              notes: "Available while the job is still RUNNING. Useful for long-running searches.",
            },
          },
          {
            path: "search/v2/jobs/{search_id}/events",
            methods: "GET",
            description: "Get raw events",
            example: {
              request: `curl -k -u admin:changeme "https://localhost:8089/services/search/v2/jobs/1234567890.12345/events?output_mode=json&count=5"`,
              response: `{
  "results": [
    { "_time": "2025-12-01T10:00:00", "_raw": "Dec  1 10:00:00 web01 syslogd: ...", "host": "web01", "index": "main" }
  ]
}`,
              notes: "Returns untransformed events (before any transforming commands in the SPL pipeline).",
            },
          },
          {
            path: "search/v2/jobs/{search_id}/summary",
            methods: "GET",
            description: "Field summary statistics",
            example: {
              request: `curl -k -u admin:changeme "https://localhost:8089/services/search/v2/jobs/1234567890.12345/summary?output_mode=json"`,
              response: `{
  "fields": {
    "host": { "count": 10, "distinct_count": 3, "is_exact": true, "modes": [{ "value": "web01", "count": 5 }] },
    "source": { "count": 10, "distinct_count": 2, "is_exact": true }
  }
}`,
            },
          },
          {
            path: "search/v2/jobs/{search_id}/timeline",
            methods: "GET",
            description: "Event timeline buckets",
            example: {
              request: `curl -k -u admin:changeme "https://localhost:8089/services/search/v2/jobs/1234567890.12345/timeline?output_mode=json"`,
              response: `{
  "buckets": [
    { "earliest_time": 1733040000, "duration": 3600, "available_count": 42, "is_finalized": true },
    { "earliest_time": 1733043600, "duration": 3600, "available_count": 38, "is_finalized": true }
  ]
}`,
            },
          },
          {
            path: "search/v2/jobs/export",
            methods: "GET",
            description: "Stream results (no job creation)",
            example: {
              request: `curl -k -u admin:changeme "https://localhost:8089/services/search/v2/jobs/export?output_mode=json&search=search%20index%3D_internal%20%7C%20head%205"`,
              response: `{"result":{"_time":"2025-12-01T10:00:00","host":"web01","_raw":"..."}}
{"result":{"_time":"2025-12-01T09:59:58","host":"web01","_raw":"..."}}`,
              notes: "Streams results as newline-delimited JSON. No job is created server-side. Best for one-shot exports.",
            },
          },
        ],
      },
      {
        name: "Search Control",
        endpoints: [
          {
            path: "search/v2/jobs/{search_id}/control",
            methods: "POST",
            description: "Pause, unpause, finalize, cancel, touch, setttl, setpriority",
            example: {
              request: `curl -k -u admin:changeme -X POST https://localhost:8089/services/search/v2/jobs/1234567890.12345/control -d action=cancel -d output_mode=json`,
              response: `{
  "messages": [{ "type": "INFO", "text": "Search job cancelled." }]
}`,
              notes: "Valid actions: pause, unpause, finalize, cancel, touch, setttl (with ttl param), setpriority (with priority param).",
            },
          },
        ],
      },
      {
        name: "Alerts",
        endpoints: [
          {
            path: "alerts/fired_alerts",
            methods: "GET",
            description: "List all fired alerts",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/alerts/fired_alerts?output_mode=json&count=5`,
              response: `{
  "entry": [
    { "name": "High CPU Alert", "content": { "triggered_alerts": 3, "severity": 5 } }
  ]
}`,
            },
          },
          {
            path: "alerts/fired_alerts/{name}",
            methods: "GET, DELETE",
            description: "Access or delete fired alerts",
            example: {
              request: `curl -k -u admin:changeme "https://localhost:8089/services/alerts/fired_alerts/High%20CPU%20Alert?output_mode=json"`,
              response: `{
  "entry": [
    { "name": "High CPU Alert", "content": { "trigger_time": 1733040000, "severity": 5, "savedsearch_name": "High CPU Alert" } }
  ]
}`,
            },
          },
        ],
      },
      {
        name: "Utilities",
        endpoints: [
          {
            path: "search/v2/parser",
            methods: "GET",
            description: "Parse and validate SPL",
            example: {
              request: `curl -k -u admin:changeme "https://localhost:8089/services/search/v2/parser?q=search%20index%3Dmain%20%7C%20stats%20count%20by%20host&output_mode=json"`,
              response: `{
  "commands": [
    { "command": "search", "args": "index=main" },
    { "command": "stats", "args": "count by host" }
  ]
}`,
              notes: "Validates SPL syntax without executing. Useful for checking queries before submitting jobs.",
            },
          },
          {
            path: "search/timeparser",
            methods: "GET",
            description: "Convert time strings to epoch",
            example: {
              request: `curl -k -u admin:changeme "https://localhost:8089/services/search/timeparser?time=-24h&output_mode=json"`,
              response: `{
  "-24h": "2025-11-30T10:00:00.000-05:00"
}`,
              notes: "Accepts Splunk relative time notation (e.g., -24h, -7d@d, @w0) and returns ISO timestamps.",
            },
          },
          {
            path: "search/typeahead",
            methods: "GET",
            description: "Search term suggestions",
            example: {
              request: `curl -k -u admin:changeme "https://localhost:8089/services/search/typeahead?prefix=index%3D&count=5&output_mode=json"`,
              response: `{
  "results": [
    { "content": "index=main", "count": 5200 },
    { "content": "index=_internal", "count": 3100 }
  ]
}`,
            },
          },
        ],
      },
    ],
  },
  {
    id: "system",
    name: "System",
    description: "Server info, control, logging, messages, and proxy settings.",
    subSections: [
      {
        name: "Server",
        endpoints: [
          {
            path: "server/info",
            methods: "GET",
            description: "Server name, version, OS, license info",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/server/info?output_mode=json`,
              response: `{
  "entry": [
    { "name": "server-info", "content": { "serverName": "splunk-sh01", "version": "9.2.0", "os_name": "Linux", "licenseState": "OK" } }
  ]
}`,
            },
          },
          {
            path: "server/settings",
            methods: "GET, POST",
            description: "Server configuration settings",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/server/settings?output_mode=json`,
              response: `{
  "entry": [
    { "name": "settings", "content": { "SPLUNK_HOME": "/opt/splunk", "httpport": 8000, "mgmtHostPort": "0.0.0.0:8089" } }
  ]
}`,
            },
          },
          { path: "server/control/restart", methods: "POST", description: "Restart Splunk" },
          { path: "server/logger", methods: "GET", description: "List logging categories" },
          { path: "server/logger/{name}", methods: "GET, POST", description: "Get or set log level" },
          { path: "server/roles", methods: "GET", description: "List server roles" },
        ],
      },
      {
        name: "Messages",
        endpoints: [
          {
            path: "messages",
            methods: "GET, POST",
            description: "System messages",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/messages?output_mode=json`,
              response: `{
  "entry": [
    { "name": "license_warning", "content": { "severity": "warn", "message": "License usage nearing daily limit" } }
  ]
}`,
            },
          },
          { path: "messages/{name}", methods: "GET, DELETE", description: "Manage specific message" },
        ],
      },
    ],
  },
  {
    id: "workload",
    name: "Workload Management",
    description: "Manage resource pools, categories, and workload rules.",
    subSections: [
      {
        name: "Workloads",
        endpoints: [
          {
            path: "workloads/pools",
            methods: "GET, POST",
            description: "List or create resource pools",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/workloads/pools?output_mode=json`,
              response: `{
  "entry": [
    { "name": "default_pool", "content": { "cpu_weight": 100, "mem_weight": 100, "category": "default" } }
  ]
}`,
            },
          },
          { path: "workloads/pools/{name}", methods: "GET, POST, DELETE", description: "Manage resource pool" },
          { path: "workloads/categories", methods: "GET, POST", description: "List or create categories" },
          { path: "workloads/rules", methods: "GET, POST", description: "List or create workload rules" },
          { path: "workloads/rules/{name}", methods: "GET, POST, DELETE", description: "Manage workload rule" },
          {
            path: "workloads/status",
            methods: "GET",
            description: "Workload management status",
            example: {
              request: `curl -k -u admin:changeme https://localhost:8089/services/workloads/status?output_mode=json`,
              response: `{
  "entry": [
    { "name": "status", "content": { "isEnabled": true, "isValid": true } }
  ]
}`,
            },
          },
        ],
      },
    ],
  },
];
