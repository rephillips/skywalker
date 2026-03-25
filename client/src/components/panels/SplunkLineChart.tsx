import { useMemo } from "react";
import Line from "@splunk/visualizations/Line";
import { SplunkThemeProvider } from "@splunk/themes";
import type { PanelConfig } from "../../types/dashboard";
import type { SplunkResult } from "../../types/splunk";

interface Props {
  config: PanelConfig;
  data: SplunkResult[];
}

/**
 * Convert Splunk row-format results to columnar format
 * that @splunk/visualizations expects.
 */
function toColumnar(data: SplunkResult[]) {
  if (data.length === 0) return { fields: [], columns: [] };

  const allKeys = Object.keys(data[0]);
  // Put _time first, filter out _span/_spandays
  const fieldNames = allKeys.filter((k) => k !== "_span" && k !== "_spandays");

  const fields = fieldNames.map((name) => ({ name }));
  const columns = fieldNames.map((name) =>
    data.map((row) => row[name] ?? "")
  );

  return { fields, columns };
}

export function SplunkLineChart({ config, data }: Props) {
  const dataSource = useMemo(() => {
    const { fields, columns } = toColumnar(data);
    return {
      data: { fields, columns },
      meta: {},
    };
  }, [data]);

  if (dataSource.data.columns.length === 0) {
    return <p className="text-xs text-gray-500 py-4 text-center">No chart data</p>;
  }

  return (
    <SplunkThemeProvider family="prisma" colorScheme="dark" density="compact">
      <Line
        width="100%"
        height="100%"
        dataSources={{ primary: dataSource }}
      />
    </SplunkThemeProvider>
  );
}
