# Splunk Enterprise REST API Complete Reference (v10.0)

## Table of Contents

1. [API Conventions and Usage](#api-conventions-and-usage)
2. [Access Control Endpoints](#1-access-control-endpoints)
3. [Application Endpoints](#2-application-endpoints)
4. [Cluster Endpoints](#3-cluster-endpoints)
5. [Configuration Endpoints](#4-configuration-endpoints)
6. [Deployment Endpoints](#5-deployment-endpoints)
7. [Federated Search Endpoints](#6-federated-search-endpoints)
8. [Input Endpoints](#7-input-endpoints)
9. [Introspection Endpoints](#8-introspection-endpoints)
10. [Knowledge Endpoints](#9-knowledge-endpoints)
11. [KV Store Endpoints](#10-kv-store-endpoints)
12. [License Endpoints](#11-license-endpoints)
13. [Metrics Catalog Endpoints](#12-metrics-catalog-endpoints)
14. [Output Endpoints](#13-output-endpoints)
15. [Search Endpoints](#14-search-endpoints)
16. [System Endpoints](#15-system-endpoints)
17. [Workload Management Endpoints](#16-workload-management-endpoints)

---

## API Conventions and Usage

### Base URL Format

```
https://<host>:<managementPort>/services/<endpoint>
https://<host>:<managementPort>/servicesNS/{owner}/{app}/<endpoint>
```

- Default management port: **8089**
- `servicesNS` provides namespace-scoped access by user and app context
- Use `-` as wildcard for owner/app: `/servicesNS/-/-/saved/searches`

### Authentication

All endpoints require authentication. Methods supported:
- **Basic Auth**: Username/password via HTTP Basic Authentication
- **Session Tokens**: Obtain via `POST /services/auth/login`, then pass as `Authorization: Splunk <token>` header
- **Bearer Tokens**: Long-lived tokens via `authorization/tokens` endpoints

### HTTP Methods

| Method | Purpose |
|--------|---------|
| **GET** | Retrieve/list resources |
| **POST** | Create new resources OR update existing resources |
| **DELETE** | Remove resources |

**Note**: PUT is NOT supported. Use POST for both creation and updates.

### Standard Query Parameters (All GET Endpoints)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `count` | Maximum number of entries returned | 30 |
| `offset` | Starting index for pagination | 0 |
| `search` | Response field filtering expression | - |
| `sort_key` | Field name to sort by | name |
| `sort_dir` | Sort direction: `asc` or `desc` | asc |
| `sort_mode` | Collation: `auto`, `alpha`, `alpha_case`, `num` | auto |
| `f` | Named value filtering (supports wildcards) | - |
| `summarize` | Reduce response detail level (`true`/`false`) | false |
| `output_mode` | Response format: `xml`, `json`, `csv` | xml |

### Response Format

Default responses are XML (Atom feed). JSON and CSV also supported via `output_mode` parameter.

**Error Response Structure:**
```xml
<response>
  <messages>
    <msg type="ERROR">Error description here</msg>
  </messages>
</response>
```

### EAI (Extensible Administration Interface) Elements

- **eai:acl** - Access Control List: ownership, permissions, sharing scope, read/write permissions, removability
- **eai:attributes** - Field metadata: `requiredFields`, `optionalFields`, `wildcardFields`

### ACL Inspection

Append `/_acl` to any endpoint path to inspect its Access Control List properties.

### v2 API Migration Note

As of Splunk Enterprise 9.0.1, v1 search endpoints are deprecated. Use v2 equivalents:
- `search/v2/jobs/export`
- `search/v2/jobs/{search_id}/events`
- `search/v2/jobs/{search_id}/results`
- `search/v2/jobs/{search_id}/results_preview`
- `search/v2/parser`

---

## 1. Access Control Endpoints

Manage user authentication, authorization, roles, capabilities, and multi-factor authentication.

### Authentication

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `auth/login` | POST | Authenticate user, returns session token |
| `authentication/current-context` | GET | List current user contexts |
| `authentication/current-context/{name}` | GET | Access specific user context |
| `authentication/httpauth-tokens` | GET, POST | List or create session tokens |
| `authentication/httpauth-tokens/{name}` | GET, DELETE | Access or delete specific session token |
| `authentication/users` | GET, POST | List or create user accounts |
| `authentication/users/{name}` | GET, POST, DELETE | Access, update, or delete specific user account |

### Authorization

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `authorization/capabilities` | GET | List all available capabilities |
| `authorization/grantable_capabilities` | GET | List capabilities the current user can grant |
| `authorization/roles` | GET, POST | List or create user roles |
| `authorization/roles/{name}` | GET, POST, DELETE | Access, update, or delete specific role |
| `authorization/tokens` | GET, POST, DELETE | Manage authentication tokens (bearer tokens) |
| `authorization/tokens/{user}` | GET, POST, DELETE | Manage tokens for a specific user |

### LDAP Authentication

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `admin/LDAP-groups` | GET, POST | Manage LDAP group mappings |
| `authentication/LDAP-auth` | GET, POST, DELETE | Create and manage LDAP authentication strategies |

### SAML Authentication

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `admin/SAML-groups` | GET, POST, DELETE | Map external IdP groups to internal Splunk roles |
| `admin/SAML-idp-metadata` | GET | Access IdP SAML metadata attributes |
| `admin/SAML-sp-metadata` | GET | Access service provider SAML metadata attributes |
| `admin/SAML-user-role-map` | GET, POST, DELETE | Manage SAML user-role mappings |
| `admin/SAML-user-role-map/{name}` | GET | Access specific SAML user-role mapping |
| `admin/replicate-SAML-certs` | POST | Replicate SAML certificates across cluster |
| `authentication/providers/SAML` | GET, POST | Access and create SAML configurations |
| `authentication/providers/SAML/{stanza_name}` | GET, POST | Access and update specific SAML configuration |

### ProxySSO Authentication

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `admin/ProxySSO-auth` | GET, POST, DELETE | Manage ProxySSO mappings and configurations |

### Duo Multifactor Authentication

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `admin/Duo-MFA` | GET, POST | List or create Duo MFA configurations |
| `admin/Duo-MFA/{name}` | GET, POST, DELETE | Manage specific Duo MFA configuration |

**Duo MFA Parameters:**
- `integrationKey` - Duo integration credential
- `secretKey` - Shared secret between Splunk and Duo
- `apiHostname` - Duo REST API endpoint
- `appSecretKey` - Application-specific secret (40+ hex chars)
- `failOpen` - Boolean: bypass if Duo service unavailable
- `timeout` - Connection timeout in seconds
- `sslVerifyServerCert` - Certificate verification toggle

### RSA Multifactor Authentication

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `admin/Rsa-MFA` | GET, POST | List or configure RSA Authentication Manager |
| `admin/Rsa-MFA/{name}` | GET, POST, DELETE | Manage specific RSA MFA configuration |
| `admin/Rsa-MFA-config-verify/{rsa-stanza-name}` | POST | Verify RSA MFA configuration (params: `username`, `passcode`) |

**RSA MFA Parameters:**
- `authManagerUrl` - RSA manager REST endpoint
- `accessKey` - Authentication credential
- `clientId` - Agent name on RSA system
- `failOpen` - Bypass on unavailability
- `enableMfaAuthRest` - Enable REST call authentication
- `replicateCertificates` - Cluster replication flag

---

## 2. Application Endpoints

Manage Splunk applications: install, configure, update, and remove apps.

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `apps/appinstall` | POST | Install app from URL or local file path (deprecated v6.6.0+) |
| `apps/apptemplates` | GET | List available app templates |
| `apps/apptemplates/{name}` | GET | Access specific app template descriptor |
| `apps/local` | GET, POST | List installed apps or create a new app |
| `apps/local/{name}` | GET, POST, DELETE | Access, update, or delete specific app |
| `apps/local/{name}/package` | GET | Archive (package) an app for distribution |
| `apps/local/{name}/setup` | GET | Access setup information for an app |
| `apps/local/{name}/update` | GET | Check for available updates for an app |
| `apps/local/{name}/enable` | POST | Enable a disabled app |
| `apps/local/{name}/disable` | POST | Disable an app |

**Create App Parameters (POST `apps/local`):**
- `name` (required) - App name or file path
- `author` - Author information
- `configured` - Boolean: setup complete status
- `description` - App description
- `explicit_appname` - Custom app name override
- `filename` - Boolean: whether `name` is a file path
- `label` - Display name (5-80 characters)
- `template` - `barebones` or `sample_app`
- `version` - App version string
- `visible` - Boolean: visibility in Splunk Web
- `session` / `auth` - Splunkbase authentication tokens
- `update` - Boolean: file-based update indicator

**Response Fields:** `author`, `check_for_updates`, `configured`, `description`, `details`, `disabled`, `label`, `state_change_requires_restart`, `version`, `visible`

---

## 3. Cluster Endpoints

Manage indexer clusters: manager node, peer nodes, search head cluster, buckets, and cluster operations.

### Cluster Configuration

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `cluster/config` | GET | List cluster node configuration |
| `cluster/config/config` | GET, POST | Retrieve or modify cluster configuration |

**Configuration Parameters:** `cxn_timeout`, `heartbeat_period`, `manager_uri`, `mode`, `replication_factor`, `search_factor`, `secret`, `site`, `multisite`

### Manager Node - Buckets

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `cluster/manager/buckets` | GET | List all cluster bucket configurations |
| `cluster/manager/buckets/{name}` | GET | Access specific bucket configuration |
| `cluster/manager/buckets/{bucket_id}/fix` | POST | Add bucket to the fix list |
| `cluster/manager/buckets/{bucket_id}/fix_corrupt_bucket` | POST | Trigger corruption fixup for non-SmartStore buckets |
| `cluster/manager/buckets/{bucket_id}/freeze` | POST | Set bucket state to frozen |
| `cluster/manager/buckets/{bucket_id}/remove_all` | POST | Delete all copies of specified bucket (irreversible) |
| `cluster/manager/buckets/{bucket_id}/remove_from_peer` | POST | Delete bucket copy from specified peer (param: `peer` GUID) |

**Bucket Filters:** `index`, `status`, `search_state`, `replication_count`, `bucket_size`, `frozen`, `has_primary`, `origin_site`, `multisite_bucket`, `standalone`

### Manager Node - Control Operations

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `cluster/manager/control/control/prune_index` | POST | Clean up excess bucket copies across an index |
| `cluster/manager/control/control/rebalance_primaries` | POST | Rebalance primary buckets across all peers |
| `cluster/manager/control/control/remove_peers` | POST | Remove disabled peer nodes (param: `peers` comma-separated GUIDs) |
| `cluster/manager/control/control/resync_bucket_from_peer` | POST | Reset bucket state based on peer's current state |
| `cluster/manager/control/control/roll-hot-buckets` | POST | Force bucket transition from hot to warm |
| `cluster/manager/control/control/rolling_upgrade_finalize` | POST | Finalize indexer cluster rolling upgrade |
| `cluster/manager/control/control/rolling_upgrade_init` | POST | Initialize indexer cluster rolling upgrade |

### Manager Node - Information

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `cluster/manager/generation` | GET, POST | Access current generation information |
| `cluster/manager/generation/{name}` | GET, POST | Access specific generation information |
| `cluster/manager/indexes` | GET | List cluster index information |
| `cluster/manager/indexes/{name}` | GET | Access specific cluster index information |
| `cluster/manager/info` | GET | Access cluster manager node information |
| `cluster/manager/health` | GET | Perform cluster health checks |
| `cluster/manager/peers` | GET | List all peer information on manager node |
| `cluster/manager/peers/{name}` | GET | Access specific peer information |
| `cluster/manager/redundancy` | GET, POST | Display or switch cluster manager HA state |
| `cluster/manager/sites` | GET | List cluster site information |
| `cluster/manager/sites/{name}` | GET | Access specific cluster site information |
| `cluster/manager/status` | GET | Get status of rolling restart |

### Peer Node

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `cluster/peer/buckets` | GET | List peer bucket configuration information |
| `cluster/peer/buckets/{name}` | GET, POST | Access specific peer bucket configuration |
| `cluster/peer/control/control/decommission` | POST | Decommission indexer cluster peer node |
| `cluster/peer/control/control/set_manual_detention` | GET, POST | Configure indexer detention mode |
| `cluster/peer/info` | GET | Access peer node information |
| `cluster/peer/info/{name}` | GET | Access information about specific peer |

### Search Head (Cluster Context)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `cluster/searchhead/generation` | GET | Access search head peer generation info |
| `cluster/searchhead/generation/{name}` | GET | Access specific search head peer generation |
| `cluster/searchhead/searchheadconfig` | GET, POST | Access cluster config for search head |
| `cluster/searchhead/searchheadconfig/{name}` | GET, POST, DELETE | Manage specific search head cluster node |

### Search Head Cluster (SHC) - KV Store Migration (Deprecated 9.4+)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `shcluster/captain/kvmigrate/start` | POST | Start KV store storage engine migration |
| `shcluster/captain/kvmigrate/status` | GET | Check migration status |
| `shcluster/captain/kvmigrate/stop` | POST | Stop in-progress KV store migration |

---

## 4. Configuration Endpoints

Raw access to Splunk `.conf` configuration files.

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `configs/conf-{file}` | GET, POST | List stanzas in `{file}.conf` or add new stanzas |
| `configs/conf-{file}/{stanza}` | GET, POST, DELETE | Access, update, or delete specific stanza |
| `properties` | GET, POST | List all system/app configuration files or create new ones |
| `properties/{file}` | GET, POST | List stanzas in a config file or add new stanzas |
| `properties/{file}/{stanza}` | GET, POST | List or update key/value pairs in a stanza |
| `properties/{file}/{stanza}/{key}` | GET, POST | Retrieve or update individual key value |

**Notes:**
- `{file}` is the conf file name without the `.conf` extension (e.g., `inputs`, `outputs`, `transforms`)
- Namespace context determines which config layer is accessed
- Requires `admin_all_objects` capability for write operations
- Not generally available in Splunk Cloud Platform

---

## 5. Deployment Endpoints

Manage deployment server, deployment clients, and app distribution to forwarders.

### Deployment Client

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `deployment/client` | GET | List deployment client configuration and status |
| `deployment/client/config` | GET | Access client enabled status, server class, host/port |
| `deployment/client/config/listIsDisabled` | GET | Retrieve client disabled status |
| `deployment/client/config/reload` | POST | Reload deployment client configuration |
| `deployment/client/{name}/reload` | POST | Restart and reload specific deployment client |

### Deployment Server

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `deployment/server/applications` | GET | List distributed apps with distribution state info |
| `deployment/server/applications/{name}` | GET, POST | Access or update app distribution information |
| `deployment/server/clients` | GET | List clients connected to deployment server |
| `deployment/server/clients/countClients_by_machineType` | GET | Get client count grouped by machine type |
| `deployment/server/clients/countRecentDownloads` | GET | Get download count during specified time period |
| `deployment/server/clients/{name}` | GET, DELETE | Access client info or remove client from registry |

### Deployment Server Classes

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `deployment/serverclass` | GET, POST | List or create server classes |
| `deployment/serverclass/{name}` | GET, POST, DELETE | Manage specific server class configuration |

**Client Information Fields:** `ip`, `hostname`, `build`, `averagePhoneHomeInterval`, `lastPhoneHomeTime`, `utsname`

**Application Configuration Fields:** `serverclass`, `stateOnClient`, `restartSplunkWeb`, `restartSplunkd`, `whitelist`/`blacklist` filters, `repositoryLocation`, `targetRepositoryLocation`

---

## 6. Federated Search Endpoints

Manage federated search providers for cross-deployment searching.

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/federated/settings/general` | GET, POST | Retrieve or update general federated search settings |
| `data/federated/provider` | GET, POST | List federated providers or create new provider definitions |

**General Settings:** transparent mode, verbose mode, heartbeat monitoring, control commands, event download retry parameters

**Provider Types:**
- `splunk` - Federated search to other Splunk Enterprise deployments
- `aws_s3` - Federated search to Amazon S3 (Splunk Cloud Platform only)

**Required Capabilities:** `admin_all_objects`, `edit_indexes`

---

## 7. Input Endpoints

Configure data inputs: file monitoring, network inputs (TCP/UDP), HTTP Event Collector, scripted inputs, and more.

### File Monitoring

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/inputs/monitor` | GET, POST | List or create file/directory monitor inputs |
| `data/inputs/monitor/{name}` | GET, POST, DELETE | Manage specific monitor input |
| `data/inputs/monitor/{name}/members` | GET | List files for a specific monitor input |

### One-Shot Inputs

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/inputs/oneshot` | GET, POST | List or create one-shot (one-time) file inputs |
| `data/inputs/oneshot/{name}` | GET | Access specific one-shot input information |

### TCP Inputs (Cooked/Forwarder)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/inputs/tcp/cooked` | GET, POST | List or create forwarder (cooked) TCP inputs |
| `data/inputs/tcp/cooked/{name}` | GET, POST, DELETE | Manage specific cooked TCP input |
| `data/inputs/tcp/cooked/{name}/connections` | GET | List connections for specific cooked TCP port |

### TCP Inputs (Raw)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/inputs/tcp/raw` | GET, POST | List or create raw TCP inputs |
| `data/inputs/tcp/raw/{name}` | GET, POST, DELETE | Manage specific raw TCP input |
| `data/inputs/tcp/raw/{name}/connections` | GET | List connections for specific raw TCP port |

### TCP Receiver Tokens

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/inputs/tcp/splunktcptoken` | GET, POST | Manage receiver access using tokens |
| `data/inputs/tcp/splunktcptoken/{name}` | GET, POST, DELETE | Manage existing receiver tokens |

### TCP SSL

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/inputs/tcp/ssl` | GET | Access SSL configuration information |
| `data/inputs/tcp/ssl/{name}` | GET, POST | Access or update SSL config for specific host |

### UDP Inputs

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/inputs/udp` | GET, POST | List or create UDP inputs |
| `data/inputs/udp/{name}` | GET, POST, DELETE | Manage specific UDP input |
| `data/inputs/udp/{name}/connections` | GET | List connections for specific UDP input |

### HTTP Event Collector (HEC)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/inputs/http` | GET, POST | Configure HTTP Event Collector globally |
| `data/inputs/http/{name}` | GET, POST, DELETE | Configure specific HEC token |
| `data/inputs/token/http` | GET, POST | Access HTTP input tokens |
| `data/inputs/token/http/{name}` | GET, POST, DELETE | Manage specific HTTP input token |
| `data/inputs/token/http/{name}/enable` | POST | Enable specific HEC token |
| `data/inputs/token/http/{name}/disable` | POST | Disable specific HEC token |

### Scripted Inputs

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/inputs/script` | GET, POST | List or create scripted input configurations |
| `data/inputs/script/{name}` | GET, POST, DELETE | Manage specific scripted input |
| `data/inputs/script/restart` | POST | Restart a scripted input |

### Windows-Specific Inputs

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/inputs/ad` | GET, POST | Access Active Directory monitoring inputs |
| `data/inputs/ad/{name}` | GET, POST, DELETE | Manage specific AD monitoring stanza |
| `data/inputs/registry` | GET, POST | Access Windows registry monitor inputs |
| `data/inputs/registry/{name}` | GET, POST, DELETE | Manage specific Windows registry monitor stanza |
| `data/inputs/win-event-log-collections` | GET, POST | List configured Windows event log collections |
| `data/inputs/win-event-log-collections/{name}` | GET, POST, DELETE | Manage specific event log collection |
| `data/inputs/win-perfmon` | GET, POST | Access Windows performance monitor inputs |
| `data/inputs/win-perfmon/{name}` | GET, POST, DELETE | Manage specific performance monitor configuration |
| `data/inputs/win-wmi-collections` | GET, POST | Access configured WMI collections |
| `data/inputs/win-wmi-collections/{name}` | GET, POST, DELETE | Manage specific WMI collection |

### All Inputs / Modular Inputs

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/inputs/all` | GET | List all inputs, including modular inputs |
| `data/inputs/all/{name}` | GET | Access specific input |
| `data/modular-inputs` | GET | List defined modular inputs |
| `data/modular-inputs/{name}` | GET | Access specific modular input |

### Ingest Actions (S3 Destinations)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/ingest/rfsdestinations` | GET, POST, DELETE | Create/configure, list, or delete S3 destinations for ingest actions |
| `data/ingest/rulesets` | GET, POST | List or create ingest action rulesets |
| `data/ingest/rulesets/{name}` | GET, POST | Access or update specific ruleset |
| `data/ingest/rulesets/publish` | POST | Publish ruleset changes on indexer cluster manager |

### Metrics Reload

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `admin/metrics-reload/_metrics` | POST | Reload metrics processor after updating metrics-related configuration |

---

## 8. Introspection Endpoints

Access index information, volume data, and disk usage statistics.

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/index-volumes` | GET | List Splunk deployment volumes and logical drive information |
| `data/index-volumes/{name}` | GET | Access information for a specific logical drive |
| `data/indexes` | GET, POST | List recognized indexes or create new indexes |
| `data/indexes/{name}` | GET, POST, DELETE | Access, update, or delete a specific data index |
| `data/indexes-extended` | GET | Access index bucket-level information |
| `data/indexes-extended/{name}` | GET | Access bucket-level info for specific index |
| `data/summaries` | GET | Get disk usage information about all summaries |
| `data/summaries/{summary_name}` | GET | Get disk usage for a specific summary |

**Notes:**
- Volume info collection period defaults to 10 minutes (`collectionPeriodInSecs`)
- Not applicable to managed Splunk Cloud deployments

---

## 9. Knowledge Endpoints

Manage knowledge objects: field extractions, lookups, transforms, calculated fields, event types, tags, saved searches, views, and panels.

### Saved Searches

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `saved/searches` | GET, POST | List or create saved search configurations |
| `saved/searches/{name}` | GET, POST, DELETE | Access, update, or delete specific saved search |
| `saved/searches/{name}/acl` | POST | Modify access permissions for a saved search |
| `saved/searches/{name}/move` | POST | Relocate saved search to different app context |
| `saved/searches/{name}/dispatch` | POST | Execute (dispatch) a saved search |
| `saved/searches/{name}/history` | GET | Access execution history for a saved search |
| `saved/searches/{name}/scheduled_times` | GET | List scheduled execution times |
| `saved/searches/{name}/suppress` | GET, POST | Access or manage alert suppression |

### Event Types

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `saved/eventtypes` | GET, POST | List or create event type definitions |
| `saved/eventtypes/{name}` | GET, POST, DELETE | Access, update, or delete specific event type |

### Tags

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `search/tags` | GET, POST | List or create search tags |
| `search/tags/{name}` | GET, POST, DELETE | Manage specific tag |

### Fields

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `search/fields` | GET | List all search fields |
| `search/fields/{name}` | GET, POST | Access or configure specific field definition |

### Field Extractions

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/props/extractions` | GET, POST | List or create field extraction rules |
| `data/props/extractions/{name}` | GET, POST, DELETE | Manage specific field extraction |

### Field Aliases

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/props/fieldaliases` | GET, POST | List or create field aliases |
| `data/props/fieldaliases/{name}` | GET, POST, DELETE | Manage specific field alias |

### Calculated Fields

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/props/calcfields` | GET, POST | List or create calculated fields (eval expressions in props.conf) |
| `data/props/calcfields/{name}` | GET, POST, DELETE | Manage specific calculated field |

**Calculated Fields Parameters (POST):** `name`, `stanza`, `value` (all required)

### Automatic Lookups

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/props/lookups` | GET, POST | List or create automatic lookup configurations |
| `data/props/lookups/{name}` | GET, POST, DELETE | Manage specific automatic lookup |

### Sourcetype Rename

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/props/sourcetype-rename` | GET, POST | List or create sourcetype renames |
| `data/props/sourcetype-rename/{name}` | GET, POST, DELETE | Manage specific sourcetype rename |

### Lookup Table Files

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/lookup-table-files` | GET, POST | List or upload lookup table files |
| `data/lookup-table-files/{name}` | GET, POST, DELETE | Manage specific lookup table file |

**Lookup File Parameters:** `eai:data` (required for POST - file content), `name` (required)

### Transforms (Field Extractions / Lookups)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/transforms/extractions` | GET, POST | List or create transform extraction rules |
| `data/transforms/extractions/{name}` | GET, POST, DELETE | Manage specific transform extraction |
| `data/transforms/lookups` | GET, POST | List or create transform lookup definitions |
| `data/transforms/lookups/{name}` | GET, POST, DELETE | Manage specific transform lookup |

### Data Model Summarization

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `admin/summarization` | GET | Get aggregated details about all accelerated data model summaries |
| `admin/summarization/tstats:DM_{app}_{data_model_ID}` | GET | Access specific data model summary information |

### Data Models

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `datamodel/model` | GET, POST | List or create data model objects |
| `datamodel/model/{name}` | GET, POST, DELETE | Manage specific data model |

### Views and Panels (UI)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/ui/views` | GET, POST | List or create dashboard views |
| `data/ui/views/{name}` | GET, POST, DELETE | Manage specific dashboard view |
| `data/ui/panels` | GET, POST | List or create reusable panel components |
| `data/ui/panels/{name}` | GET, POST, DELETE | Manage specific panel |

### Navigation

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/ui/nav` | GET, POST | List or create navigation configurations |
| `data/ui/nav/{name}` | GET, POST, DELETE | Manage specific navigation element |

### Search Commands

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/commands` | GET | List available search commands |
| `data/commands/{name}` | GET | Access specific search command info |

### Search Macros and Transactions (via configs)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `configs/conf-macros` | GET, POST | List or create search macros |
| `configs/conf-macros/{name}` | GET, POST, DELETE | Manage specific macro |
| `configs/conf-macros/{name}/acl` | POST | Adjust macro permissions |
| `configs/conf-transactiontypes` | GET, POST | List or create transaction type definitions |
| `configs/conf-transactiontypes/{name}` | GET, POST, DELETE | Manage specific transaction type |

**Note:** Search macros and transaction types do not have dedicated REST handlers; use the `configs/conf-*` endpoints above.

---

## 10. KV Store Endpoints

Manage application key-value store collections: CRUD operations, querying, batch operations, backup/restore, and indexing.

### Collection Configuration

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `storage/collections/config` | GET, POST | List all collections or create a new collection |
| `storage/collections/config/{collection}` | GET, POST, DELETE | Access, update, or delete a specific collection |

**Create Collection Parameters:**
- `name` (required) - Collection name
- `profilingEnabled` - Boolean: enable profiling (default: false)
- `profilingThresholdMs` - Slow operation threshold in ms (default: 100)

**Collection Config Fields:**
- `field.<fieldName>` - Type: `array`, `number`, `bool`, `string`, `cidr`, `time`
- `accelerated_fields.<field_name>` - JSON field acceleration definition
- `enforceTypes` - Enforce field type validation
- `replication` - Replication configuration

### Collection Data Operations

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `storage/collections/data/{collection}` | GET, POST, DELETE | Query, insert, or delete items in a collection |
| `storage/collections/data/{collection}/{key}` | GET, POST, DELETE | Access, update, or delete a specific item by key |
| `storage/collections/data/{collection}/batch_find` | POST | Batch query multiple items |
| `storage/collections/data/{collection}/batch_save` | POST | Batch insert/update multiple items |

**Query Parameters (GET `storage/collections/data/{collection}`):**
- `fields` - Comma-separated include/exclude field list
- `shared` - Boolean: include records owned by `nobody`
- `limit` - Maximum items returned
- `skip` - Items to skip (pagination)
- `sort` - Sort order with direction (`1` ascending, `-1` descending)
- `query` - JSON query using MongoDB-style operators

**Supported Query Operators:** `$gt`, `$gte`, `$lt`, `$lte`, `$ne`, `$and`, `$or`, `$not`

**Constraints:**
- Maximum 16MB per record
- Maximum 1KB per accelerated field
- Splunk Cloud Platform restricted to search tier only

### KV Store Backup and Restore

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `kvstore/backup/create` | POST | Create a KV store backup archive file |
| `kvstore/backup/restore` | POST | Extract and restore from a KV store backup archive |

**Backup Parameters:**
- `archiveName` - Backup filename
- `appName` - Target app (not with `pointInTime=true`)
- `collectionName` - Target collection
- `pointInTime` - Boolean: create consistent backup (default: false)
- `cancel` - Boolean: cancel in-progress backup
- `parallelCollections` - Number of parallel collections (default: 1)

**Restore Parameters:**
- `archiveName` (required) - Backup filename
- `appName` - Target app
- `collectionName` - Target collection
- `pointInTime` - Boolean: restore from consistent backup
- `cancel` - Boolean: cancel in-progress restore
- `parallelCollections` - Parallel restoration count
- `insertionsWorkersPerCollection` - Workers per collection

### KV Store Status and Maintenance

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `kvstore/status` | GET | Access KV store status (standalone or SHC deployments) |
| `kvstore/control/maintenance` | POST | Toggle maintenance mode (standalone only, param: `mode` boolean) |

**Status Response Fields:** `backupRestoreStatus`, `replicationStatus`, oplog timestamps, member information, cluster state

---

## 11. License Endpoints

Manage Splunk licensing: groups, pools, individual licenses, and license status.

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `licenser/groups` | GET | List all licenser groups |
| `licenser/groups/{name}` | GET, POST | Retrieve specific group details or activate a licenser group |
| `licenser/licenses` | GET, POST | List all added licenses or add new license entitlements |
| `licenser/licenses/{name}` | GET, DELETE | Access individual license details or remove by hash |
| `licenser/localpeer` | GET | Get license state information for this Splunk instance |
| `licenser/messages` | GET | List all license-related messages/alerts/warnings |
| `licenser/messages/{name}` | GET | Retrieve specific license message by ID |
| `licenser/pools` | GET, POST | List licenser pool configurations or create new pools |
| `licenser/pools/{name}` | GET, POST, DELETE | Manage individual pool: access, update, or delete |

**Notes:**
- Only one licenser group is active at any given time
- A licenser group contains one or more licenser stacks
- License endpoints generally not accessible in Splunk Cloud Platform

---

## 12. Metrics Catalog Endpoints

Enumerate metrics, dimensions, and manage rollup policies.

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `catalog/metricstore/metrics` | GET | List metric names |
| `catalog/metricstore/dimensions` | GET | List dimension names for a given metric |
| `catalog/metricstore/dimensions/{dimension-name}/values` | GET | List values for a specific dimension |
| `catalog/metricstore/rollup` | GET, POST | List rollup summaries and metric indexes, or create rollup policies |
| `catalog/metricstore/rollup/{index}` | GET, POST, DELETE | Manage rollup summaries and policies for a specific index |

**Common Parameters:**
- `_earliest_` / `_latest_` - Time range strings
- `_filter_` - Filtering expression
- `_list_indexes` - Boolean (for `/metrics`)

**Rollup Policy Parameters (POST):**
- `name` - Policy name
- `summaries` - Summary definitions
- `default_agg` - Default aggregation method
- `metric_list` - Metrics to include
- `dimension_list` - Dimensions to include
- `metric_overrides` - Per-metric aggregation overrides

**Required Capabilities:**
- `list_metrics_catalog` - Read operations
- `edit_metrics_rollup` - Create/update/delete operations

---

## 13. Output Endpoints

Configure data forwarding: TCP outputs, target groups, syslog forwarding.

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `data/outputs/tcp/default` | GET, POST | Access or configure global TCP output (`tcpout`) properties |
| `data/outputs/tcp/default/{name}` | GET, POST, DELETE | Manage specific named forwarder settings |
| `data/outputs/tcp/group` | GET, POST | List or create data forwarding target groups |
| `data/outputs/tcp/group/{name}` | GET, POST, DELETE | Manage specific forwarding target group |
| `data/outputs/tcp/server` | GET, POST | List or create data forwarding server configurations |
| `data/outputs/tcp/server/{name}` | GET, POST, DELETE | Manage specific forwarding server configuration |
| `data/outputs/tcp/server/{name}/allconnections` | GET | List all active connections to a specific forwarded server |
| `data/outputs/tcp/syslog` | GET, POST | List or create syslog output configurations |
| `data/outputs/tcp/syslog/{name}` | GET, POST, DELETE | Manage specific syslog forwarding configuration |

---

## 14. Search Endpoints

Manage search jobs, search results, alerts, saved searches, time parsing, and search-related operations.

### Search Jobs

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `search/jobs` | GET, POST | List search jobs or create a new search job (returns SID) |
| `search/jobs/{search_id}` | GET, POST, DELETE | Access, update, or cancel a specific search job |
| `search/jobs/{search_id}/control` | POST | Execute job control commands (pause, unpause, setpriority, finalize, cancel, touch, setttl, enablepreview, disablepreview) |
| `search/jobs/{search_id}/results` | GET | Return transformed results (available when search completes) |
| `search/jobs/{search_id}/results_preview` | GET | Return preview of results while search is still running |
| `search/jobs/{search_id}/events` | GET | Return untransformed events (accessible during execution) |
| `search/jobs/{search_id}/summary` | GET | Return summary information for fields of the search |
| `search/jobs/{search_id}/timeline` | GET | Return event distribution over time |
| `search/jobs/export` | GET | Stream search results as they become available (no persistent SID) |

**Create Search Job Parameters (POST `search/jobs`):**
- `search` (required) - The SPL search query string
- `earliest_time` - Start of time range
- `latest_time` - End of time range
- `max_count` - Maximum result count (default: 10000)
- `max_time` - Maximum search execution time in seconds
- `status_buckets` - Number of status buckets for timeline (default: 0)
- `rf` - Required fields to include
- `output_mode` - Format: `json`, `csv`, `xml`
- `exec_mode` - Execution mode: `normal`, `blocking`, `oneshot`
- `auto_cancel` - Seconds of inactivity before auto-cancel
- `auto_finalize_ec` - Event count to auto-finalize
- `auto_pause` - Seconds of inactivity before auto-pause
- `enable_lookups` - Boolean: enable lookup field actions
- `force_bundle_replication` - Boolean: force bundle replication
- `id` - Specify custom SID
- `namespace` - App namespace for the search
- `now` - Override current time
- `reduce_freq` - Reduce frequency in seconds
- `reload_macros` - Boolean: reload macro definitions
- `remote_server_list` - Comma-separated list of remote servers
- `reuse_max_seconds_ago` - Maximum age for search reuse
- `spawn_process` - Boolean: spawn separate search process
- `timeout` - Seconds before search auto-cancels

**Search Job Status (`dispatchState` values):**
`QUEUED`, `PARSING`, `RUNNING`, `FINALIZING`, `DONE`, `PAUSE`, `INTERNAL_CANCEL`, `USER_CANCEL`, `BAD_INPUT_CANCEL`, `QUIT`, `FAILED`

**Job Control Commands:**
- `pause` - Pause the search
- `unpause` - Resume the search
- `finalize` - Stop the search and finalize results
- `cancel` - Cancel and delete the search
- `touch` - Reset the search TTL
- `setttl` - Set specific TTL value
- `setpriority` - Change search priority
- `enablepreview` - Enable results preview
- `disablepreview` - Disable results preview

### v2 Search Endpoints (Preferred)

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `search/v2/jobs/export` | GET | Stream search results (v2) |
| `search/v2/jobs/{search_id}/events` | GET | Return untransformed events (v2) |
| `search/v2/jobs/{search_id}/results` | GET | Return transformed results (v2) |
| `search/v2/jobs/{search_id}/results_preview` | GET | Return results preview (v2) |
| `search/v2/parser` | GET | Parse and validate SPL query (v2) |

### Alert Actions and Fired Alerts

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `alerts/alert_actions` | GET | List all configured alert actions |
| `alerts/alert_actions/{name}` | GET, POST | Access or update specific alert action |
| `alerts/fired_alerts` | GET | List all fired (triggered) alert summaries |
| `alerts/fired_alerts/{name}` | GET, POST | List unexpired triggered instances of specific alert |

**Fired Alert Response Fields:** `actions`, `alert_type`, `digest_mode`, `expiration_time_rendered`, `savedsearch_name`, `severity`, `sid`, `trigger_time`, `trigger_time_rendered`, `triggered_alerts`

### Time Parser

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `search/timeparser` | GET | Parse time expressions into epoch time |

### Search Parser

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `search/parser` | GET | Parse SPL and return syntax validation |

### Directory Service

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `directory` | GET | List all knowledge objects visible to the current user |
| `directory/{name}` | GET, POST | Access or manage specific knowledge object navigation entry |

---

## 15. System Endpoints

Manage server configuration, control, logging, messaging, roles, security, and proxy settings.

### Server Information

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `server/info` | GET | Access system information (version, OS, build, GUID, etc.) |
| `server/roles` | GET | List applicable server roles |
| `server/settings` | GET, POST | Access or update server configuration settings |

**Server Roles:** `indexer`, `universal_forwarder`, `heavyweight_forwarder`, `lightweight_forwarder`, `license_master`, `license_slave`, `cluster_master`, `cluster_slave`, `cluster_search_head`, `deployment_server`, `deployment_client`, `search_head`, `search_peer`, `shc_captain`, `shc_deployer`, `shc_member`

**Server Settings Fields:** `SPLUNK_DB`, `SPLUNK_HOME`, `enableSplunkWebSSL`, `host`, `httpport`, `mgmtHostPort`, `minFreeSpace`, `pass4SymmKey`, `serverName`, `sessionTimeout`, `startwebserver`, `trustedIP`

### Server Control

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `server/control` | GET | List available control actions |
| `server/control/restart` | POST | Restart splunkd server daemon and Splunk Web |
| `server/control/restart_webui` | POST | Restart Splunk Web interface only |

### Logging

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `server/logger` | GET | Enumerate all splunkd logging categories |
| `server/logger/{name}` | GET, POST | Access or set logging level for specific category |

**Logging Levels:** `FATAL`, `WARN`, `INFO`, `DEBUG`

### Messages

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `messages` | GET, POST | List system-wide messages or create persistent messages |
| `messages/{name}` | GET, DELETE | Access or delete a specific system message |

**Create Message Parameters:**
- `name` (required) - Message identifier
- `value` (required) - Message text
- `severity` - `info`, `warn`, or `error`
- `capability` - Required user capabilities to view
- `role` - Required user roles to view (comma-separated)

**Response Fields:** `message`, `severity`, `timeCreated_epochSecs`, `timeCreated_iso`, `server`

### Security

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `server/security/rotate-splunk-secret` | POST | Rotate the splunk.secret file on standalone instance |

### HTTP Proxy Settings

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `server/httpsettings/proxysettings` | POST | Create HTTP proxy configuration (param: `name` = "proxyConfig") |
| `server/httpsettings/proxysettings/proxyConfig` | GET, POST, DELETE | Access, update, or delete proxy configuration |

**Proxy Parameters:**
- `http_proxy` - HTTP proxy server definition
- `https_proxy` - HTTPS proxy server definition
- `no_proxy` - Proxy bypass rules (default: `localhost, 127.0.0.1, ::1`)

**Required Capability:** `edit_server`

---

## 16. Workload Management Endpoints

Manage resource allocation pools, workload categories, and workload rules for search and indexing operations.

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `workloads/categories` | GET, POST | List or edit workload categories (search, ingest, misc) |
| `workloads/pools` | GET, POST, DELETE | Manage CPU/memory resource pools for search and indexing |
| `workloads/rules` | GET, POST, DELETE | Configure workload rules and admission rules with predicates |
| `workloads/config/enable` | POST | Activate workload management |
| `workloads/config/disable` | POST | Deactivate workload management |
| `workloads/config/get-base-dirname` | GET | Get the name of the Splunk parent cgroup |
| `workloads/config/preflight-checks` | GET | Run system validation before enabling workload management |

**Workload Rule Predicates:** `role`, `app`, `user`, `index`, `runtime`

**Required Capabilities:**
- `list_workload_pools` - View pools and categories
- `edit_workload_pools` - Create/modify/delete pools and categories
- `list_workload_rules` - View workload rules
- `edit_workload_rules` - Create/modify/delete rules

---

## Quick Reference: All Endpoint Categories

| # | Category | Base Path Prefix | Endpoint Count (approx.) |
|---|----------|------------------|--------------------------|
| 1 | Access Control | `auth/`, `authentication/`, `authorization/`, `admin/` | ~30 |
| 2 | Applications | `apps/` | ~10 |
| 3 | Cluster | `cluster/`, `shcluster/` | ~35 |
| 4 | Configuration | `configs/`, `properties/` | ~6 |
| 5 | Deployment | `deployment/` | ~12 |
| 6 | Federated Search | `data/federated/` | ~2 |
| 7 | Inputs | `data/inputs/`, `data/ingest/` | ~45 |
| 8 | Introspection | `data/index-volumes/`, `data/indexes/`, `data/summaries/` | ~8 |
| 9 | Knowledge | `saved/`, `search/tags`, `search/fields`, `data/props/`, `data/transforms/`, `data/ui/`, `data/commands/`, `datamodel/` | ~40 |
| 10 | KV Store | `storage/collections/`, `kvstore/` | ~15 |
| 11 | License | `licenser/` | ~9 |
| 12 | Metrics Catalog | `catalog/metricstore/` | ~5 |
| 13 | Outputs | `data/outputs/` | ~9 |
| 14 | Search | `search/jobs`, `search/v2/`, `alerts/`, `search/timeparser`, `search/parser`, `directory/` | ~20 |
| 15 | System | `server/`, `messages/` | ~12 |
| 16 | Workload Management | `workloads/` | ~7 |

**Total: ~265 documented endpoints**

---

## Sources

- [Using the REST API reference (v10.0)](https://help.splunk.com/en/splunk-enterprise/rest-api-reference/10.0/introduction/using-the-rest-api-reference)
- [Endpoints reference list (v10.0)](https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-reference/10.0/introduction/endpoints-reference-list)
- [Endpoints reference list (v9.4)](https://help.splunk.com/en/splunk-enterprise/rest-api-reference/9.4/introduction/endpoints-reference-list)
- [Creating searches using the REST API](https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-tutorials/10.0/rest-api-tutorials/creating-searches-using-the-rest-api)
- [Managing knowledge objects](https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-tutorials/10.0/rest-api-tutorials/managing-knowledge-objects)
- [License endpoint descriptions](https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-reference/10.0/license-endpoints/license-endpoint-descriptions)
- [REST API Reference 10.0 - Main](https://help.splunk.com/en/splunk-enterprise/rest-api-reference/10.0)
- [REST API Reference 10.2](https://help.splunk.com/en/splunk-enterprise/leverage-rest-apis/rest-api-reference/10.2/introduction/using-the-rest-api-reference)
