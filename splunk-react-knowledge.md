# Splunk React Ecosystem: Comprehensive Reference

This document covers the full Splunk React package ecosystem, Dashboard Framework, UI Toolkit, JavaScript SDK integration, custom visualizations, and community patterns for building Splunk dashboards with React.

---

## Table of Contents

1. [Package Ecosystem Overview](#1-package-ecosystem-overview)
2. [@splunk/create - Project Scaffolding](#2-splunkcreate---project-scaffolding)
3. [@splunk/react-ui - UI Component Library](#3-splunkreact-ui---ui-component-library)
4. [@splunk/themes - Theming System](#4-splunkthemes---theming-system)
5. [@splunk/react-page - Page Layout](#5-splunkreact-page---page-layout)
6. [Splunk Dashboard Framework](#6-splunk-dashboard-framework)
7. [@splunk/visualizations - Visualization Library](#7-splunkvisualizations---visualization-library)
8. [@splunk/search-job and @splunk/splunk-utils - Data Fetching](#8-splunksearch-job-and-splunksplunk-utils---data-fetching)
9. [Splunk JavaScript SDK (splunk-sdk)](#9-splunk-javascript-sdk-splunk-sdk)
10. [Custom Visualizations in React](#10-custom-visualizations-in-react)
11. [Dashboard JSON Definition Schema](#11-dashboard-json-definition-schema)
12. [Architecture Patterns and Best Practices](#12-architecture-patterns-and-best-practices)
13. [Community Resources and Tutorials](#13-community-resources-and-tutorials)
14. [Complete Package Reference Table](#14-complete-package-reference-table)

---

## 1. Package Ecosystem Overview

Splunk provides a comprehensive suite of npm packages under the `@splunk` scope for building React-based applications that integrate with Splunk Enterprise and Splunk Cloud Platform. The packages fall into several categories:

### Core UI Packages
| Package | Purpose |
|---------|---------|
| `@splunk/react-ui` | UI component library implementing Splunk design language |
| `@splunk/themes` | Theme variables, mixins, and SplunkThemeProvider |
| `@splunk/react-page` | Page layout integration with Splunk Enterprise chrome |
| `@splunk/react-toast-notifications` | Toast notification components |
| `@splunk/react-icons` | Icon library |

### Dashboard Framework Packages
| Package | Purpose |
|---------|---------|
| `@splunk/dashboard-core` | Core dashboard rendering engine (controlled component) |
| `@splunk/dashboard-presets` | Pre-built presets (EnterprisePreset, CloudViewOnlyPreset) |
| `@splunk/dashboard-context` | Context providers for dashboard features (registries, etc.) |
| `@splunk/dashboard-ui` | Common UI components for dashboard framework |
| `@splunk/visualization-context` | Context for visualization rendering |

### Visualization Packages
| Package | Purpose |
|---------|---------|
| `@splunk/visualizations` | Current visualization library (20+ viz types) |
| `@splunk/dashboard-visualizations` | Older viz package (deprecated, migrate to @splunk/visualizations) |
| `@splunk/react-visualizations` | Older React viz wrapper (deprecated, migrate to @splunk/visualizations) |

### Data & Utility Packages
| Package | Purpose |
|---------|---------|
| `@splunk/search-job` | Observable-based search job management |
| `@splunk/splunk-utils` | Utilities for interacting with Splunk Enterprise/Cloud |
| `@splunk/react-search` | React hooks/components for search |
| `splunk-sdk` | Full JavaScript SDK for Splunk (server & client) |

### Scaffolding
| Package | Purpose |
|---------|---------|
| `@splunk/create` | CLI generator for new Splunk React apps |

**Official Documentation Hub:** https://splunkui.splunk.com/Packages

---

## 2. @splunk/create - Project Scaffolding

### Overview
`@splunk/create` generates code and scaffolding for a new Splunk application built with React via CLI. It is analogous to `create-react-app` but tailored specifically for Splunk app development.

### Installation & Usage

```bash
# Create a new project directory
mkdir my-splunk-app
cd my-splunk-app

# Run the generator
npx @splunk/create

# Alternative command
npx splunk-create
```

### What It Generates

After running the generator, the project structure includes:

```
my-splunk-app/
  packages/
    my-page/          # React page component
      src/
        MyPage.jsx    # Main React component
        index.jsx     # Entry point
    my-app/           # Splunk app configuration
      default/
        app.conf
      appserver/
        static/
  package.json        # Root package.json (monorepo with yarn workspaces)
```

### Generated Configuration
- Pre-configured Webpack setup for Splunk app bundling
- Yarn workspaces for monorepo management
- Automatic dependency linking between the React page and Splunk app
- Development server configuration (port 8080 for local dev)
- Quality management tools (ESLint, Prettier, etc.)

### Development Workflow

```bash
# Link app to local Splunk instance
yarn link:app

# Restart Splunk Enterprise
$SPLUNK_HOME/bin/splunk restart

# Start development server
yarn start

# Access locally:
# - Splunk Web: https://localhost:8000 (look for your app in the menu)
# - Local dev server: http://localhost:8080
```

### Pre-installed Packages
The generator sets up the project with:
- `@splunk/react-ui`
- `@splunk/themes`
- `@splunk/react-page`
- `@splunk/dashboard-core` (if dashboard template selected)
- `@splunk/visualizations`
- Webpack, Babel, and related build tooling

**npm:** https://www.npmjs.com/package/@splunk/create
**Blog Post:** https://www.splunk.com/en_us/blog/platform/kickstart-your-splunk-app-with-splunk-create.html

---

## 3. @splunk/react-ui - UI Component Library

### Overview
`@splunk/react-ui` is Splunk's toolkit for creating enterprise UI at scale. It is a library of React components implementing the Splunk design language and is the same component library used internally in Splunk products.

### Installation

```bash
npm install @splunk/react-ui
# or
yarn add @splunk/react-ui
```

### Peer Dependencies
- `react@^18`
- `react-dom@^18`
- `styled-components@^5`
- `@splunk/themes`

### Complete Component List

The library provides the following components (each importable individually):

#### Layout & Structure
- **Accordion** - Collapsible content panels
- **Card** / **CardLayout** - Card-based content containers
- **ColumnLayout** - Multi-column responsive layouts
- **ControlGroup** - Form control grouping with labels
- **Definition** / **DefinitionList** - Key-value definition displays
- **TabBar** - Tab navigation bar
- **TabLayout** - Tabbed content layout
- **StepBar** - Step indicator / wizard progress
- **CollapsiblePanel** - Expandable/collapsible panel

#### Data Display
- **Table** - Full-featured data table with sorting, row expansion, custom cell renderers
- **StaticContent** - Static text/content display
- **Heading** - Semantic heading component (h1-h6)
- **Typography** - Text styling component
- **Paragraph** - Paragraph text
- **Code** - Code display
- **Link** - Hyperlink component
- **Message** - Alert/info/warning/error messages
- **Tooltip** - Hover tooltips
- **Badge** - Badge/tag indicators

#### Form Controls
- **Button** - Action buttons (primary, secondary, destructive, etc.)
- **Select** - Dropdown selection
- **Multiselect** - Multi-value selection
- **Text** - Text input
- **TextArea** - Multi-line text input
- **Number** - Numeric input
- **Switch** - Toggle switch
- **RadioBar** / **Radio** - Radio button groups
- **Checkbox** - Checkbox input
- **Date** - Date picker
- **File** - File upload input
- **ComboBox** - Combobox (select + text input)
- **Color** - Color picker

#### Navigation & Menus
- **Menu** - Dropdown menus
- **Dropdown** - Generic dropdown container
- **Pagination** - Page navigation controls
- **Breadcrumb** - Breadcrumb navigation

#### Feedback
- **WaitSpinner** - Loading spinner
- **Modal** - Modal dialog
- **SidePanel** - Slide-out side panel
- **Popover** - Popup content

### Import Pattern

Each component is importable from its own subpath to enable tree-shaking:

```jsx
import Button from '@splunk/react-ui/Button';
import Table from '@splunk/react-ui/Table';
import Select from '@splunk/react-ui/Select';
import Modal from '@splunk/react-ui/Modal';
import Switch from '@splunk/react-ui/Switch';
import Heading from '@splunk/react-ui/Heading';
import WaitSpinner from '@splunk/react-ui/WaitSpinner';
import Message from '@splunk/react-ui/Message';
import Card from '@splunk/react-ui/Card';
import CardLayout from '@splunk/react-ui/CardLayout';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import TabBar from '@splunk/react-ui/TabBar';
import Menu from '@splunk/react-ui/Menu';
import Number from '@splunk/react-ui/Number';
import Text from '@splunk/react-ui/Text';
import Multiselect from '@splunk/react-ui/Multiselect';
```

### Usage Examples

#### Button
```jsx
import Button from '@splunk/react-ui/Button';

function MyComponent() {
    return (
        <div>
            <Button label="Primary" appearance="primary" onClick={() => {}} />
            <Button label="Default" onClick={() => {}} />
            <Button label="Destructive" appearance="destructive" onClick={() => {}} />
            <Button label="Pill" appearance="pill" onClick={() => {}} />
            <Button label="Toggle" appearance="toggle" selected onClick={() => {}} />
        </div>
    );
}
```

#### Table
```jsx
import Table from '@splunk/react-ui/Table';

function MyTable({ data }) {
    return (
        <Table stripeRows>
            <Table.Head>
                <Table.HeadCell>Name</Table.HeadCell>
                <Table.HeadCell>Status</Table.HeadCell>
                <Table.HeadCell>Count</Table.HeadCell>
            </Table.Head>
            <Table.Body>
                {data.map((row) => (
                    <Table.Row key={row.id}>
                        <Table.Cell>{row.name}</Table.Cell>
                        <Table.Cell>{row.status}</Table.Cell>
                        <Table.Cell>{row.count}</Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    );
}
```

#### Table with Row Expansion
```jsx
import Table from '@splunk/react-ui/Table';

function ExpandableTable({ data }) {
    const [expandedRowId, setExpandedRowId] = useState(null);

    const handleToggle = (e, { rowId }) => {
        setExpandedRowId(rowId === expandedRowId ? null : rowId);
    };

    return (
        <Table
            stripeRows
            rowExpansion="single"
            onRowExpansionChange={handleToggle}
        >
            <Table.Head>
                <Table.HeadCell>Name</Table.HeadCell>
                <Table.HeadCell>Value</Table.HeadCell>
            </Table.Head>
            <Table.Body>
                {data.map((row) => (
                    <Table.Row
                        key={row.id}
                        expansionRow={
                            <Table.Row>
                                <Table.Cell colSpan={2}>
                                    Detailed content for {row.name}
                                </Table.Cell>
                            </Table.Row>
                        }
                        expanded={row.id === expandedRowId}
                    >
                        <Table.Cell>{row.name}</Table.Cell>
                        <Table.Cell>{row.value}</Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    );
}
```

#### Select
```jsx
import Select from '@splunk/react-ui/Select';

function MySelect() {
    const [value, setValue] = useState('option1');

    return (
        <Select value={value} onChange={(e, { value }) => setValue(value)}>
            <Select.Option label="Option 1" value="option1" />
            <Select.Option label="Option 2" value="option2" />
            <Select.Option label="Option 3" value="option3" />
        </Select>
    );
}
```

#### Modal
```jsx
import Modal from '@splunk/react-ui/Modal';
import Button from '@splunk/react-ui/Button';

function MyModal() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button onClick={() => setOpen(true)} label="Open Modal" />
            <Modal open={open} onRequestClose={() => setOpen(false)}>
                <Modal.Header title="My Modal" onRequestClose={() => setOpen(false)} />
                <Modal.Body>
                    <p>Modal content goes here.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        appearance="primary"
                        label="Submit"
                        onClick={() => setOpen(false)}
                    />
                </Modal.Footer>
            </Modal>
        </>
    );
}
```

### Styling Guidelines

- **DO** pass `style` prop to control layout, margins, or positioning
- **DO** use the `inline` prop to switch between inline-block/inline-flex and block/flex display
- **DO NOT** use `className` prop
- **DO NOT** override Splunk stylesheets
- **IMPORTANT**: Include only ONE instance of `@splunk/react-ui` in your application bundle; multiple instances on the same page is discouraged

### Fonts
The component library does NOT include fonts. You must define and load fonts via `@font-face` declarations:
- Default font: **"Splunk Platform Sans"** (alias of "Proxima Nova")
- Default mono font: **"Splunk Platform Mono"** (alias of "Inconsolata")

**npm:** https://www.npmjs.com/package/@splunk/react-ui
**Docs:** https://splunkui.splunk.com/Packages/react-ui/
**CodeSandbox Examples:** https://codesandbox.io/examples/package/@splunk/react-ui

---

## 4. @splunk/themes - Theming System

### Overview
`@splunk/themes` provides theme variables and mixins for the Splunk design language. It includes `SplunkThemeProvider`, which creates a theme context at the root of your application.

### Installation

```bash
npm install @splunk/themes
# or
yarn add @splunk/themes
```

### Peer Dependencies
- `react@^18`
- `styled-components@^5`

### SplunkThemeProvider

The `SplunkThemeProvider` component wraps your application and provides theme context to all Splunk UI components.

```jsx
import SplunkThemeProvider from '@splunk/themes/SplunkThemeProvider';

function App() {
    return (
        <SplunkThemeProvider family="prisma" colorScheme="light" density="comfortable">
            <YourApp />
        </SplunkThemeProvider>
    );
}
```

#### Props

| Prop | Values | Description |
|------|--------|-------------|
| `family` | `"enterprise"`, `"prisma"` | Theme family (Prisma is the newer design) |
| `colorScheme` | `"light"`, `"dark"` | Light or dark mode |
| `density` | `"comfortable"`, `"compact"` | Spacing density |

### Theme Variables and Mixins

```jsx
import { pick, variables, mixins } from '@splunk/themes';
import styled from 'styled-components';

const StyledWrapper = styled.div`
    ${mixins.reset()};
    color: ${pick({
        enterprise: variables.textColor,
        prisma: variables.contentColorDefault,
    })};
    background-color: ${pick({
        enterprise: variables.backgroundColor,
        prisma: variables.backgroundColorPage,
    })};
    font-family: ${variables.fontFamily};
    font-size: ${variables.fontSize};
`;
```

### Common Theme Variables

```javascript
// Typography
variables.fontFamily        // Default font family
variables.fontFamilyMono    // Monospace font family
variables.fontSize          // Base font size
variables.fontSizeLarge     // Large text
variables.fontSizeSmall     // Small text
variables.fontWeightBold    // Bold weight
variables.lineHeight        // Base line height

// Colors (vary by theme family)
variables.textColor                // Primary text color
variables.contentColorDefault      // Default content color (Prisma)
variables.backgroundColor          // Background color
variables.backgroundColorPage      // Page background (Prisma)
variables.brandColor              // Brand/accent color
variables.accentColor             // Accent color
variables.errorColor              // Error state color
variables.warningColor            // Warning state color
variables.successColor            // Success state color
variables.infoColor               // Info state color

// Spacing
variables.spacing                 // Base spacing unit
variables.spacingHalf             // Half spacing
variables.spacingQuarter          // Quarter spacing
variables.spacingDouble           // Double spacing

// Borders
variables.borderColor             // Default border color
variables.borderRadius            // Default border radius
```

### Using `pick()` for Theme-Aware Styles

The `pick()` function allows you to provide different values for different theme families:

```jsx
const StyledCard = styled.div`
    border: 1px solid ${pick({
        enterprise: variables.borderColor,
        prisma: variables.borderColorLight,
    })};
    padding: ${pick({
        enterprise: '16px',
        prisma: '20px',
    })};
`;
```

### Using `getTheme()`

For programmatic access to theme values (does NOT require React or styled-components):

```javascript
import { getTheme } from '@splunk/themes';

const theme = getTheme({ family: 'prisma', colorScheme: 'dark', density: 'comfortable' });
console.log(theme.textColor);
```

**npm:** https://www.npmjs.com/package/@splunk/themes
**Docs:** https://splunkui.splunk.com/Packages/react-ui/Theming

---

## 5. @splunk/react-page - Page Layout

### Overview
`@splunk/react-page` loads a React component into the Splunk Enterprise layout, including the Splunk bar, app bar, and footer around your page content. It dynamically loads the Layout API from the correct location on the Splunk Enterprise server.

### Installation

```bash
npm install @splunk/react-page
# or
yarn add @splunk/react-page
```

### Requirements
- Requires splunkd partials to be loaded on the page (i.e., must run within a Splunk Enterprise context)

### Basic Usage (Entry Point)

```jsx
// index.jsx - Entry point for a Splunk React page
import layout from '@splunk/react-page';
import MyPage from './MyPage';

layout(<MyPage />, {
    pageTitle: 'My Dashboard',
    hideFooter: true,
    layout: 'fixed',
});
```

### React 18 Support

```jsx
// Use the /18 import for React 18 createRoot functionality
import layout from '@splunk/react-page/18';
import MyPage from './MyPage';

layout(<MyPage />, {
    pageTitle: 'My Dashboard',
    hideFooter: true,
    layout: 'fixed',
});
```

### Layout Options

| Option | Type | Description |
|--------|------|-------------|
| `pageTitle` | `string` | Title displayed in the browser tab |
| `hideFooter` | `boolean` | Whether to hide the Splunk footer |
| `layout` | `string` | Layout mode: `"fixed"` or `"fluid"` |

### Typical Page Component with Theme

```jsx
// MyPage.jsx
import React from 'react';
import SplunkThemeProvider from '@splunk/themes/SplunkThemeProvider';
import Heading from '@splunk/react-ui/Heading';

function MyPage() {
    return (
        <SplunkThemeProvider family="prisma" colorScheme="light" density="comfortable">
            <div style={{ padding: '20px' }}>
                <Heading level={1}>My Splunk Dashboard</Heading>
                {/* Your dashboard content */}
            </div>
        </SplunkThemeProvider>
    );
}

export default MyPage;
```

**npm:** https://www.npmjs.com/package/@splunk/react-page

---

## 6. Splunk Dashboard Framework

### Overview
The Splunk Dashboard Framework is a collection of packages designed to render Splunk Dashboards directly in a ReactJS app. When developing with the Dashboard Framework and `@splunk/create`, you create a ReactJS app and import tools that allow you to render dashboard and visualization components.

The Dashboard Framework powers products like **Dashboard Studio**, **ITSI**, and **Splunk Enterprise Security**, meaning your custom apps use the same rendering engine as Splunk's own products.

### Core Packages

#### @splunk/dashboard-core
The main controlled component that renders the dashboard canvas and all components on it. Used by itself, it provides a view-only interface to a dashboard.

```bash
npm install @splunk/dashboard-core
```

**npm:** https://www.npmjs.com/package/@splunk/dashboard-core

#### @splunk/dashboard-presets
Contains all visualizations, inputs, interactions, datasources, and layout components pre-bundled for convenience. Provides preset configurations such as:

- **`EnterprisePreset`** - For Splunk Enterprise environments
- **`CloudViewOnlyPreset`** - For Splunk Cloud read-only dashboards
- **`EnterpriseViewOnlyPreset`** - For Splunk Enterprise read-only dashboards

```bash
npm install @splunk/dashboard-presets
```

**npm:** https://www.npmjs.com/package/@splunk/dashboard-presets

#### @splunk/dashboard-context
Contains additional components (context providers, registries) that assist in rendering a dashboard. Provides:
- `DashboardContextProvider` - wraps DashboardCore to provide necessary data
- **Icon Registry** - upload, list, retrieve, and remove icon assets
- **Image Registry** - manage image assets
- **Geo Registry** - manage geographic data for map visualizations
- Default localStorage-based reference provider (applications should implement their own)

```bash
npm install @splunk/dashboard-context
```

**npm:** https://www.npmjs.com/package/@splunk/dashboard-context

#### @splunk/visualization-context
Context provider for visualization rendering within the dashboard.

```bash
npm install @splunk/visualization-context
```

**npm:** https://www.npmjs.com/package/@splunk/visualization-context

#### @splunk/dashboard-ui
Common UI components used throughout the dashboard framework UI layer.

```bash
npm install @splunk/dashboard-ui
```

**npm:** https://www.npmjs.com/package/@splunk/dashboard-ui

### Full Installation

```bash
yarn add @splunk/dashboard-core @splunk/dashboard-presets @splunk/dashboard-context @splunk/visualization-context
```

### Basic Dashboard Example (View-Only with CloudViewOnlyPreset)

```jsx
import React from 'react';
import DashboardCore from '@splunk/dashboard-core';
import CloudViewOnlyPreset from '@splunk/dashboard-presets/CloudViewOnlyPreset';

const definition = {
    dataSources: {
        search1: {
            options: {
                data: {
                    columns: [['168']],
                    fields: [{ name: 'count' }],
                },
                meta: {},
            },
            type: 'ds.test',
        },
    },
    visualizations: {
        single1: {
            type: 'viz.singlevalue',
            options: {},
            dataSources: {
                primary: 'search1',
            },
        },
    },
    layout: {
        type: 'absolute',
        options: {
            width: 1000,
            height: 400,
        },
        structure: [
            {
                item: 'single1',
                position: { x: 0, y: 100, w: 200, h: 200 },
            },
        ],
    },
};

function MyDashboard() {
    return (
        <DashboardCore
            width="100%"
            height={450}
            preset={CloudViewOnlyPreset}
            definition={definition}
        />
    );
}

export default MyDashboard;
```

### Enterprise Preset Example with Theming

```jsx
import React from 'react';
import DashboardCore, {
    themes as dashboardCoreThemes,
} from '@splunk/dashboard-core';
import EnterprisePreset, {
    themes as presetThemes,
} from '@splunk/dashboard-presets/EnterprisePreset';
import { DashboardContextProvider } from '@splunk/dashboard-context';
import SplunkThemeProvider from '@splunk/themes/SplunkThemeProvider';

const definition = {
    dataSources: {
        search1: {
            type: 'ds.search',
            options: {
                query: 'index=_internal | stats count by sourcetype',
                queryParameters: {
                    earliest: '-24h@h',
                    latest: 'now',
                },
            },
        },
    },
    visualizations: {
        pie1: {
            type: 'splunk.pie',
            options: {},
            dataSources: {
                primary: 'search1',
            },
        },
    },
    layout: {
        type: 'absolute',
        options: {
            width: 1440,
            height: 900,
        },
        structure: [
            {
                item: 'pie1',
                position: { x: 20, y: 20, w: 600, h: 400 },
            },
        ],
    },
};

function EnterpriseDashboard() {
    return (
        <SplunkThemeProvider family="enterprise" colorScheme="light">
            <DashboardContextProvider>
                <DashboardCore
                    width="100%"
                    height="calc(100vh - 78px)"
                    definition={definition}
                    preset={EnterprisePreset}
                />
            </DashboardContextProvider>
        </SplunkThemeProvider>
    );
}

export default EnterpriseDashboard;
```

### DashboardCore Props

| Prop | Type | Description |
|------|------|-------------|
| `definition` | `object` | Dashboard JSON definition |
| `preset` | `object` | Preset configuration (EnterprisePreset, CloudViewOnlyPreset, etc.) |
| `width` | `string \| number` | Dashboard width |
| `height` | `string \| number` | Dashboard height |
| `mode` | `string` | `"view"`, `"edit"`, or `"source"` |
| `onDefinitionChange` | `function` | Callback when definition changes (edit mode) |
| `dataSourceContext` | `object` | Context for data source authentication |

---

## 7. @splunk/visualizations - Visualization Library

### Overview
`@splunk/visualizations` is the current-generation visualization library for Splunk React applications. It provides 20+ visualization types as React components built on top of Highcharts and D3.js. These are the same visualizations used in Dashboard Studio.

### Installation

```bash
# Install peer dependencies first
npm install react@^18 react-dom@^18 styled-components@5 @splunk/visualization-context

# Install the package
npm install @splunk/visualizations
```

### Complete Visualization Type Reference

These are the visualization types available both as React components and as dashboard definition types:

| Dashboard Type | Description |
|---------------|-------------|
| `splunk.area` | Area chart |
| `splunk.bar` | Horizontal bar chart |
| `splunk.bubble` | Bubble chart |
| `splunk.choropleth.svg` | Choropleth SVG map |
| `splunk.column` | Vertical column chart |
| `splunk.ellipse` | Ellipse shape |
| `splunk.events` | Events viewer |
| `splunk.fillergauge` | Filler gauge |
| `splunk.image` | Image display |
| `splunk.line` | Line chart |
| `splunk.linkgraph` | Link/network graph |
| `splunk.map` | Geographic map |
| `splunk.markdown` | Markdown text renderer |
| `splunk.markergauge` | Marker gauge |
| `splunk.parallelcoordinates` | Parallel coordinates chart |
| `splunk.pie` | Pie chart |
| `splunk.punchcard` | Punchcard chart |
| `splunk.rectangle` | Rectangle shape |
| `splunk.sankey` | Sankey diagram |
| `splunk.scatter` | Scatter plot |
| `splunk.singlevalue` | Single value display |
| `splunk.singlevalueicon` | Single value with icon |
| `splunk.singlevalueradial` | Single value with radial gauge |
| `splunk.table` | Data table |

### Using Visualizations as Standalone React Components

```jsx
import { Line } from '@splunk/visualizations';

function MyLineChart() {
    return (
        <Line
            width={800}
            height={400}
            dataSources={{
                primary: {
                    data: {
                        fields: [
                            { name: '_time' },
                            { name: 'count' },
                        ],
                        columns: [
                            ['2024-01-01', '2024-01-02', '2024-01-03'],
                            [10, 25, 15],
                        ],
                    },
                },
            }}
        />
    );
}
```

```jsx
import { SingleValue } from '@splunk/visualizations';

function MySingleValue() {
    return (
        <SingleValue
            width={300}
            height={200}
            dataSources={{
                primary: {
                    data: {
                        fields: [{ name: 'count' }],
                        columns: [['42']],
                    },
                },
            }}
            options={{
                majorColor: '#53a051',
                trendDisplay: 'percent',
                sparklineDisplay: 'below',
            }}
        />
    );
}
```

### Migration Notice
If you are currently using `@splunk/react-visualizations` or `@splunk/dashboard-visualizations`, you should migrate to `@splunk/visualizations`. Splunk has stopped publishing bugfixes and features for the older packages.

**npm:** https://www.npmjs.com/package/@splunk/visualizations
**Docs:** https://splunkui.splunk.com/Packages/

---

## 8. @splunk/search-job and @splunk/splunk-utils - Data Fetching

### @splunk/search-job

#### Overview
A class that simplifies creating and accessing Splunk search jobs. The API is based on **Observables** -- each method returns an Observable that can be subscribed to and will emit data over the lifecycle of the search job.

#### Installation

```bash
npm install @splunk/search-job
```

#### Usage

```jsx
import SearchJob from '@splunk/search-job';

// Create a search job
const mySearch = SearchJob.create({
    search: 'index=_internal | stats count by sourcetype',
    earliest_time: '-24h@h',
    latest_time: 'now',
});

// Subscribe to results
const subscription = mySearch.getResults({ count: 10 }).subscribe({
    next: (results) => {
        console.log('Results:', results);
    },
    error: (err) => {
        console.error('Search error:', err);
    },
    complete: () => {
        console.log('Search complete');
    },
});

// Cancel the subscription when done
subscription.unsubscribe();
```

#### Using with React (Hook Pattern)

```jsx
import { useState, useEffect } from 'react';
import SearchJob from '@splunk/search-job';

function useSplunkSearch(query, earliest = '-24h@h', latest = 'now') {
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        const searchJob = SearchJob.create({
            search: query,
            earliest_time: earliest,
            latest_time: latest,
        });

        const subscription = searchJob.getResults().subscribe({
            next: (data) => {
                setResults(data);
                setLoading(false);
            },
            error: (err) => {
                setError(err);
                setLoading(false);
            },
        });

        return () => subscription.unsubscribe();
    }, [query, earliest, latest]);

    return { results, loading, error };
}
```

### @splunk/splunk-utils

#### Overview
Utility package that assists with interacting with Splunk Enterprise and Splunk Cloud Platform. Helps manage search operations and provides utility functions for common Splunk REST API interactions.

#### Installation

```bash
npm install @splunk/splunk-utils
```

#### Common Utilities

```jsx
import { createRESTURL } from '@splunk/splunk-utils/url';
import { defaultFetchInit } from '@splunk/splunk-utils/fetch';

// Create a REST URL for a Splunk endpoint
const url = createRESTURL('search/jobs', {
    app: 'search',
    owner: 'admin',
});

// Make a fetch request with Splunk authentication
const response = await fetch(url, {
    ...defaultFetchInit,
    method: 'POST',
    body: JSON.stringify({
        search: 'index=_internal | head 10',
    }),
});
```

### @splunk/react-search

A React-specific package providing hooks and components for search integration.

```bash
npm install @splunk/react-search
```

**npm (@splunk/search-job):** https://www.npmjs.com/package/@splunk/search-job
**npm (@splunk/splunk-utils):** https://www.npmjs.com/package/@splunk/splunk-utils
**Example Repo:** https://github.com/splunk/react_search_example

---

## 9. Splunk JavaScript SDK (splunk-sdk)

### Overview
The Splunk Enterprise SDK for JavaScript contains library code and examples for building applications using the Splunk platform with JavaScript. It supports both server-side (Node.js) and client-side JavaScript.

The SDK is divided into two parts:
- **Data SDK**: Interact with Splunk for managing indexes, input data, and search data
- **UI SDK**: Popular Splunk UI components for web applications

### Installation

```bash
npm install splunk-sdk
```

### Version History
- **v2.x+**: Methods return Promises, enabling async/await usage
- **v1.x**: Callback-based API

### Basic Connection and Authentication

```javascript
const splunkjs = require('splunk-sdk');

const service = new splunkjs.Service({
    username: 'admin',
    password: 'changeme',
    scheme: 'https',
    host: 'localhost',
    port: '8089',
    version: '9.0',
});

// Login (v2.x with Promises)
await service.login();
```

### Running Searches

#### Oneshot Search (No persistent job)

```javascript
const results = await service.oneshotSearch(
    'search index=_internal | stats count by sourcetype | head 5',
    { earliest_time: '-1h', latest_time: 'now' }
);

console.log('Fields:', results.fields);
console.log('Rows:', results.rows);
```

#### Normal Search (Creates a job)

```javascript
const job = await service.search(
    'search index=_internal | stats count by sourcetype',
    { exec_mode: 'normal' }
);

// Wait for the job to complete
while (true) {
    const jobProps = await job.fetch();
    if (jobProps.properties().isDone) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
}

// Get results
const results = await job.results({ count: 0 });
console.log(results);
```

#### Export Search (Streaming results)

```javascript
const searchQuery = 'search index=_internal | head 100';
const exportStream = await service.search(searchQuery, { exec_mode: 'oneshot' });
```

### Using with React: Architecture Patterns

**Important**: The Splunk JavaScript SDK cannot be used directly from a browser-based React app due to CORS restrictions when communicating with splunkd (port 8089). There are two recommended approaches:

#### Pattern 1: Node.js Proxy Backend

```
React App (frontend) <---> Node.js Express Server <---> Splunk REST API (splunkd)
     port 3000                    port 5000                    port 8089
```

```javascript
// server.js (Express backend)
const express = require('express');
const splunkjs = require('splunk-sdk');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const service = new splunkjs.Service({
    username: 'admin',
    password: 'changeme',
    scheme: 'https',
    host: 'localhost',
    port: '8089',
});

app.post('/api/search', async (req, res) => {
    try {
        await service.login();
        const results = await service.oneshotSearch(req.body.query, {
            earliest_time: req.body.earliest || '-24h',
            latest_time: req.body.latest || 'now',
            output_mode: 'json',
        });
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(5000);
```

```jsx
// React component
function SplunkSearch({ query }) {
    const [results, setResults] = useState(null);

    useEffect(() => {
        fetch('http://localhost:5000/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
        })
            .then(res => res.json())
            .then(data => setResults(data));
    }, [query]);

    return <div>{/* render results */}</div>;
}
```

#### Pattern 2: Within Splunk Web (using splunkjs/mvc)

When building a React app that runs inside Splunk Web, you can use the SplunkJS MVC framework:

```javascript
// Pass splunkjs/mvc/searchmanager to your React application
require(['splunkjs/mvc/searchmanager'], function(SearchManager) {
    const searchManager = new SearchManager({
        id: 'my-search',
        search: 'index=_internal | stats count by sourcetype',
        earliest_time: '-24h@h',
        latest_time: 'now',
    });

    searchManager.data('results').on('data', function(results) {
        // Pass results to your React component
        const data = results.data();
        // Update React state
    });
});
```

**npm:** https://www.npmjs.com/package/splunk-sdk
**GitHub:** https://github.com/splunk/splunk-sdk-javascript
**Docs:** https://dev.splunk.com/view/javascript-sdk/SP-CAAAECM

---

## 10. Custom Visualizations in React

### Approach 1: Custom Visualization Component for Dashboard Framework

You can create custom React components that integrate with the Splunk Dashboard Framework. The `@splunk/create` CLI can scaffold a new visualization component.

#### Creating a Custom Table Component (from official tutorial)

```jsx
// CustomTable.jsx
import React from 'react';
import Table from '@splunk/react-ui/Table';
import { useDashboardApi } from '@splunk/dashboard-context';

function CustomTable({ dataSources, options }) {
    const data = dataSources?.primary?.data;

    if (!data) {
        return <div>No data available</div>;
    }

    const { fields, columns } = data;
    const rows = columns[0].map((_, rowIndex) =>
        fields.reduce((row, field, colIndex) => {
            row[field.name] = columns[colIndex][rowIndex];
            return row;
        }, {})
    );

    return (
        <Table stripeRows>
            <Table.Head>
                {fields.map((field) => (
                    <Table.HeadCell key={field.name}>
                        {field.name}
                    </Table.HeadCell>
                ))}
            </Table.Head>
            <Table.Body>
                {rows.map((row, i) => (
                    <Table.Row key={i}>
                        {fields.map((field) => (
                            <Table.Cell key={field.name}>
                                {row[field.name]}
                            </Table.Cell>
                        ))}
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    );
}

export default CustomTable;
```

#### Registering a Custom Visualization in a Preset

```jsx
import DashboardCore from '@splunk/dashboard-core';
import EnterprisePreset from '@splunk/dashboard-presets/EnterprisePreset';
import CustomTable from './CustomTable';

// Override or add custom visualizations to a preset
const customPreset = {
    ...EnterprisePreset,
    visualizations: {
        ...EnterprisePreset.visualizations,
        'viz.custom-table': {
            component: CustomTable,
            config: {
                // default options
            },
        },
    },
};

// Use in dashboard definition
const definition = {
    visualizations: {
        myTable: {
            type: 'viz.custom-table',
            dataSources: { primary: 'search1' },
            options: {},
        },
    },
    // ... rest of definition
};

function Dashboard() {
    return (
        <DashboardCore
            width="100%"
            height="100vh"
            preset={customPreset}
            definition={definition}
        />
    );
}
```

### Approach 2: Third-Party React Components in Dashboard

The Splunk dashboard framework supports embedding any React component. Example from the official Google Maps tutorial:

```jsx
// GoogleMapViz.jsx
import React from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

function GoogleMapViz({ dataSources, options }) {
    const data = dataSources?.primary?.data;
    const center = { lat: options.centerLat || 0, lng: options.centerLng || 0 };

    return (
        <LoadScript googleMapsApiKey={options.apiKey}>
            <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={center}
                zoom={options.zoom || 10}
            >
                {/* Render markers from Splunk data */}
                {data?.columns[0]?.map((lat, i) => (
                    <Marker
                        key={i}
                        position={{
                            lat: parseFloat(lat),
                            lng: parseFloat(data.columns[1][i]),
                        }}
                    />
                ))}
            </GoogleMap>
        </LoadScript>
    );
}

export default GoogleMapViz;
```

### Approach 3: Traditional Custom Visualization (SplunkVisualizationBase)

For non-React custom visualizations that extend `SplunkVisualizationBase`:

Key methods to override:
- **`formatData(data, config)`** - Transforms raw search data into a format suitable for rendering
- **`updateView(data, config)`** - Handles rendering when search results update or format changes
- **`getInitialDataParams()`** - Specifies data output format and max result count

**Tutorial Repositories:**
- https://github.com/splunk/dashboardTutorial1 (Simple Table Component)
- https://github.com/splunk/dashboard-react-google-maps (Google Maps Integration)
- https://github.com/splunk/dashboard-interactivity-modal (Modal Interactivity)

---

## 11. Dashboard JSON Definition Schema

### Overview
Splunk Dashboard Framework uses JSON definitions to declaratively describe dashboard content. The JSON schema contains the following top-level sections:

### Complete Schema Structure

```json
{
    "title": "My Dashboard",
    "description": "Dashboard description",
    "dataSources": {},
    "visualizations": {},
    "inputs": {},
    "defaults": {},
    "layout": {},
    "applicationProperties": {}
}
```

### Data Sources

Data sources define where visualization data comes from.

#### Search Data Source (ds.search)
```json
{
    "dataSources": {
        "mySearch": {
            "type": "ds.search",
            "options": {
                "query": "index=_internal | stats count by sourcetype",
                "queryParameters": {
                    "earliest": "-24h@h",
                    "latest": "now"
                }
            }
        }
    }
}
```

#### Test Data Source (ds.test) - For static/mock data
```json
{
    "dataSources": {
        "testData": {
            "type": "ds.test",
            "options": {
                "data": {
                    "fields": [
                        { "name": "category" },
                        { "name": "count" }
                    ],
                    "columns": [
                        ["Web", "API", "Database"],
                        [150, 230, 90]
                    ]
                },
                "meta": {}
            }
        }
    }
}
```

#### Chain Data Source (ds.chain) - Post-processing
```json
{
    "dataSources": {
        "chainedSearch": {
            "type": "ds.chain",
            "options": {
                "query": "| stats sum(count) as total",
                "extend": "mySearch"
            }
        }
    }
}
```

### Visualizations

Each visualization stanza specifies the type, options, and data source reference.

```json
{
    "visualizations": {
        "pieChart1": {
            "type": "splunk.pie",
            "options": {
                "showDonutHole": true
            },
            "dataSources": {
                "primary": "mySearch"
            }
        },
        "lineChart1": {
            "type": "splunk.line",
            "options": {
                "xAxisTitleVisibility": "show",
                "yAxisTitleVisibility": "show"
            },
            "dataSources": {
                "primary": "timeSearch"
            }
        },
        "singleVal1": {
            "type": "splunk.singlevalue",
            "options": {
                "majorColor": "#53a051",
                "sparklineDisplay": "below",
                "trendDisplay": "percent",
                "unit": "events",
                "unitPosition": "after"
            },
            "dataSources": {
                "primary": "countSearch"
            }
        },
        "table1": {
            "type": "splunk.table",
            "options": {
                "count": 20,
                "dataOverlayMode": "none",
                "drilldown": "cell",
                "showRowNumbers": false
            },
            "dataSources": {
                "primary": "mySearch"
            }
        },
        "barChart1": {
            "type": "splunk.bar",
            "options": {
                "stackMode": "stacked"
            },
            "dataSources": {
                "primary": "mySearch"
            }
        },
        "mapViz": {
            "type": "splunk.map",
            "options": {
                "center": [37.7749, -122.4194],
                "zoom": 10
            },
            "dataSources": {
                "primary": "geoSearch"
            }
        },
        "markdownViz": {
            "type": "splunk.markdown",
            "options": {
                "markdown": "# Section Title\n\nDescriptive text here."
            }
        }
    }
}
```

### Layout

#### Absolute Layout
Provides full control over panel positioning with x, y, width, and height values.

```json
{
    "layout": {
        "type": "absolute",
        "options": {
            "width": 1440,
            "height": 900,
            "display": "auto-scale",
            "backgroundColor": "#ffffff"
        },
        "structure": [
            {
                "item": "pieChart1",
                "position": {
                    "x": 20,
                    "y": 20,
                    "w": 600,
                    "h": 400
                }
            },
            {
                "item": "singleVal1",
                "position": {
                    "x": 640,
                    "y": 20,
                    "w": 300,
                    "h": 200
                }
            },
            {
                "item": "table1",
                "position": {
                    "x": 20,
                    "y": 440,
                    "w": 1400,
                    "h": 400
                }
            }
        ]
    }
}
```

#### Grid Layout
Arranges panels in a responsive grid.

```json
{
    "layout": {
        "type": "grid",
        "options": {},
        "structure": [
            {
                "item": "pieChart1",
                "position": {
                    "row": 1,
                    "column": 1,
                    "rowSpan": 2,
                    "columnSpan": 6
                }
            },
            {
                "item": "singleVal1",
                "position": {
                    "row": 1,
                    "column": 7,
                    "rowSpan": 1,
                    "columnSpan": 6
                }
            }
        ]
    }
}
```

### Inputs

Inputs provide interactive controls (dropdowns, time pickers, text inputs) that can feed tokens into data sources.

```json
{
    "inputs": {
        "timeRange1": {
            "type": "input.timerange",
            "options": {
                "defaultValue": "-24h@h,now",
                "token": "myTime"
            }
        },
        "dropdown1": {
            "type": "input.dropdown",
            "options": {
                "items": [
                    { "label": "All", "value": "*" },
                    { "label": "Errors", "value": "error" },
                    { "label": "Warnings", "value": "warning" }
                ],
                "defaultValue": "*",
                "token": "severity"
            }
        },
        "textInput1": {
            "type": "input.text",
            "options": {
                "defaultValue": "",
                "token": "searchTerm"
            }
        }
    }
}
```

### Defaults

Global default settings for all visualizations.

```json
{
    "defaults": {
        "dataSources": {
            "ds.search": {
                "options": {
                    "queryParameters": {
                        "earliest": "$myTime.earliest$",
                        "latest": "$myTime.latest$"
                    }
                }
            }
        }
    }
}
```

**Docs:** https://help.splunk.com/en/splunk-cloud-platform/create-dashboards-and-reports/dashboard-studio/10.2.2510/source-code-editor/what-is-a-dashboard-definition

---

## 12. Architecture Patterns and Best Practices

### Pattern 1: Splunk App with React Pages (Recommended for Splunk Enterprise)

```
my-splunk-app/
  packages/
    dashboard-page/
      src/
        index.jsx          # Entry point using @splunk/react-page
        DashboardPage.jsx  # Main React component
        components/        # Reusable components
    splunk-app/
      default/
        app.conf
        data/
          ui/
            views/
              dashboard.xml
      appserver/
        static/
```

Entry point:
```jsx
// index.jsx
import layout from '@splunk/react-page/18';
import SplunkThemeProvider from '@splunk/themes/SplunkThemeProvider';
import DashboardPage from './DashboardPage';

layout(
    <SplunkThemeProvider family="prisma" colorScheme="light" density="comfortable">
        <DashboardPage />
    </SplunkThemeProvider>,
    {
        pageTitle: 'My Dashboard',
        hideFooter: false,
        layout: 'fixed',
    }
);
```

### Pattern 2: Standalone React App with Splunk Backend

```
my-app/
  client/           # React app (CRA, Vite, Next.js, etc.)
    src/
      components/
      hooks/
        useSplunkSearch.js
      services/
        splunkApi.js
  server/           # Node.js proxy server
    routes/
      search.js
    middleware/
      splunkAuth.js
```

### Pattern 3: Splunk Cloud Services (SCS) React App

```jsx
import React from 'react';
import DashboardCore from '@splunk/dashboard-core';
import CloudViewOnlyPreset from '@splunk/dashboard-presets/CloudViewOnlyPreset';

function SCSDashboard({ tenantId, authClient }) {
    return (
        <DashboardCore
            width="100%"
            height="calc(100vh - 78px)"
            definition={dashboardDefinition}
            preset={CloudViewOnlyPreset}
            dataSourceContext={{ tenantId, authClient }}
        />
    );
}
```

### Best Practices

#### 1. Single Instance of @splunk/react-ui
Always ensure only ONE instance of `@splunk/react-ui` is included in your bundle. Multiple instances will cause styling and behavior conflicts.

#### 2. Theme Provider at Root
Wrap your entire application with `SplunkThemeProvider` at the root level:
```jsx
<SplunkThemeProvider family="prisma" colorScheme="light" density="comfortable">
    <App />
</SplunkThemeProvider>
```

#### 3. Component Import Pattern (Tree-Shaking)
Import components from their individual subpaths to minimize bundle size:
```jsx
// GOOD - tree-shakeable
import Button from '@splunk/react-ui/Button';
import Table from '@splunk/react-ui/Table';

// BAD - imports entire library
import { Button, Table } from '@splunk/react-ui';
```

#### 4. Do Not Override Splunk Styles
- Do not use `className` on Splunk UI components
- Do not override Splunk CSS stylesheets
- Use the `style` prop for layout adjustments (margins, positioning)
- Use the `inline` prop for display mode changes

#### 5. Search Job Cleanup
Always unsubscribe from search job observables to prevent memory leaks:
```jsx
useEffect(() => {
    const subscription = searchJob.getResults().subscribe(/* ... */);
    return () => subscription.unsubscribe();
}, []);
```

#### 6. CORS Handling for Standalone Apps
When building a React app outside Splunk Web, use a Node.js proxy server to communicate with splunkd. Direct browser-to-splunkd communication is blocked by CORS.

#### 7. Dashboard Definition as State
Treat the dashboard JSON definition as React state for dynamic dashboards:
```jsx
const [definition, setDefinition] = useState(initialDefinition);

// Update programmatically
const addVisualization = (vizId, vizConfig) => {
    setDefinition(prev => ({
        ...prev,
        visualizations: {
            ...prev.visualizations,
            [vizId]: vizConfig,
        },
    }));
};
```

#### 8. Use Presets for Consistency
Always use a preset (`EnterprisePreset` or `CloudViewOnlyPreset`) with `DashboardCore` to ensure all standard visualization types are registered.

---

## 13. Community Resources and Tutorials

### Official Splunk GitHub Repositories

| Repository | Description |
|-----------|-------------|
| [splunk/dashboardTutorial1](https://github.com/splunk/dashboardTutorial1) | Simple Table Component tutorial |
| [splunk/dashboard-react-google-maps](https://github.com/splunk/dashboard-react-google-maps) | 3rd-party React component (Google Maps) in Dashboard |
| [splunk/dashboard-interactivity-modal](https://github.com/splunk/dashboard-interactivity-modal) | Modal interactivity and event handlers |
| [splunk/dashboard-conf19-examples](https://github.com/splunk/dashboard-conf19-examples) | Dashboard Framework examples from .conf 2019 |
| [splunk/scs-getting-started-app](https://github.com/splunk/scs-getting-started-app) | Getting started with Splunk Cloud Services React app |
| [splunk/splunk-sdk-javascript](https://github.com/splunk/splunk-sdk-javascript) | Official JavaScript SDK |
| [splunk/react_search_example](https://github.com/splunk/react_search_example) | React search integration example |
| [splunk/conf2019-dashboard-scs](https://github.com/splunk/conf2019-dashboard-scs) | .conf 2019 Dashboard SCS examples |

### Community Projects

| Repository | Description |
|-----------|-------------|
| [robertsobolczyk/splunk-react-app](https://github.com/robertsobolczyk/splunk-react-app) | Boilerplate for React.js dashboard in Splunk Web |
| [chrisrabe/how-to-guides (react-splunk-integration)](https://github.com/chrisrabe/how-to-guides/blob/master/splunk/react-splunk-integration.md) | Step-by-step React + Splunk integration guide |
| [chrisrabe/how-to-guides (improved)](https://github.com/chrisrabe/how-to-guides/blob/master/splunk/improved-react-splunk-integration.md) | Improved React + Splunk integration guide |
| [JoseMiralles/splunk-react-typescript](https://gist.github.com/JoseMiralles/c2e9c0d2007e18fcc21776dd7f8239cc) | How to create a React App in Splunk with TypeScript |

### Blog Posts and Articles

| Title | URL |
|-------|-----|
| Kickstart your Splunk App with @Splunk/Create | https://www.splunk.com/en_us/blog/platform/kickstart-your-splunk-app-with-splunk-create.html |
| A New Way to Look Like Splunk | https://www.splunk.com/en_us/blog/platform/a-new-way-to-look-like-splunk.html |
| Splunk UI and the Dashboard Framework | https://www.splunk.com/en_us/blog/platform/splunk-ui-and-the-dashboard-framework-more-visual-control-than-ever.html |
| Getting Started With SplunkUI | https://blog.scrt.ch/2023/01/03/getting-started-with-splunkui/ |
| Creating Your First App Using Splunk UI Toolkit (React) | https://blog.avotrix.com/creating-your-first-app-using-splunk-ui-toolkit-react/ |
| Next-Level Splunk Visualizations Via Splunk UI | https://www.deepwatch.com/blog/next-level-splunk-visualizations-via-splunk-ui/ |
| Designing a Seamless User Experience with Splunk React UI | https://www.dhiwise.com/post/Maximizing%20Performance:%20Best%20Practices%20for%20Splunk%20React%20UI%20Development |

### Conference Presentations

| Title | URL |
|-------|-----|
| DEV1141: Applications with Splunk UI and React (2019) | https://conf.splunk.com/files/2019/slides/DEV1141.pdf |

### Official Documentation

| Resource | URL |
|----------|-----|
| Splunk Design System (all packages) | https://splunkui.splunk.com/Packages |
| Splunk UI React Components | https://splunkui.splunk.com/Packages/react-ui/ |
| Splunk Developer Portal - Build Apps | https://dev.splunk.com/enterprise/docs/developapps/createapps/buildapps |
| Add a Splunk UI Toolkit Component | https://dev.splunk.com/enterprise/docs/developapps/createapps/buildapps/adduicomponent |
| Add UI Theme Support | https://dev.splunk.com/enterprise/docs/developapps/createapps/buildapps/adduithemes |
| Dashboard Definition Reference | https://help.splunk.com/en/splunk-cloud-platform/create-dashboards-and-reports/dashboard-studio/10.2.2510/source-code-editor/what-is-a-dashboard-definition |
| Visualization Configuration Options | https://help.splunk.com/en/splunk-enterprise/create-dashboards-and-reports/dashboard-studio/9.4/configuration-options-reference/visualization-configuration-options |
| JavaScript SDK Docs | https://dev.splunk.com/view/javascript-sdk/SP-CAAAECM |
| JavaScript SDK Examples | https://dev.splunk.com/view/SP-CAAAEDD |
| Custom Visualizations | https://docs.splunk.com/Documentation/SplunkCloud/latest/AdvancedDev/CustomVizTutorial |

---

## 14. Complete Package Reference Table

| Package | Latest Version (approx.) | Weekly Downloads (approx.) | npm URL |
|---------|-------------------------|---------------------------|---------|
| `@splunk/react-ui` | 5.6.0 | ~6,400 | https://www.npmjs.com/package/@splunk/react-ui |
| `@splunk/themes` | (active) | - | https://www.npmjs.com/package/@splunk/themes |
| `@splunk/react-page` | (active) | - | https://www.npmjs.com/package/@splunk/react-page |
| `@splunk/react-toast-notifications` | (active) | ~430 | https://www.npmjs.com/package/@splunk/react-toast-notifications |
| `@splunk/create` | (active) | - | https://www.npmjs.com/package/@splunk/create |
| `@splunk/visualizations` | 28.4.0 | - | https://www.npmjs.com/package/@splunk/visualizations |
| `@splunk/dashboard-core` | (active) | - | https://www.npmjs.com/package/@splunk/dashboard-core |
| `@splunk/dashboard-presets` | (active) | - | https://www.npmjs.com/package/@splunk/dashboard-presets |
| `@splunk/dashboard-context` | (active) | - | https://www.npmjs.com/package/@splunk/dashboard-context |
| `@splunk/dashboard-ui` | (active) | - | https://www.npmjs.com/package/@splunk/dashboard-ui |
| `@splunk/visualization-context` | (active) | - | https://www.npmjs.com/package/@splunk/visualization-context |
| `@splunk/search-job` | (active) | - | https://www.npmjs.com/package/@splunk/search-job |
| `@splunk/splunk-utils` | (active) | - | https://www.npmjs.com/package/@splunk/splunk-utils |
| `@splunk/react-search` | (active) | - | https://www.npmjs.com/package/@splunk/react-search |
| `splunk-sdk` | 2.x | - | https://www.npmjs.com/package/splunk-sdk |
| `@splunk/dashboard-visualizations` | (deprecated) | - | https://www.npmjs.com/package/@splunk/dashboard-visualizations |
| `@splunk/react-visualizations` | (deprecated) | - | https://www.npmjs.com/package/@splunk/react-visualizations |

### Peer Dependency Requirements (Common Across Packages)

| Peer Dependency | Required Version |
|-----------------|-----------------|
| `react` | `^18` |
| `react-dom` | `^18` |
| `styled-components` | `^5` |
| `@splunk/themes` | Required by `@splunk/react-ui` |
| `@splunk/visualization-context` | Required by `@splunk/visualizations` |

---

*Document generated from web research. For the most current versions and API details, consult the official Splunk Design System at https://splunkui.splunk.com/Packages and npm package pages.*
