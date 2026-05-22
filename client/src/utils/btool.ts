export interface BtoolRow {
  file: string;
  content: string;   // "[stanza]" or "key = value"
  isStanza: boolean;
  stanza: string;
  rawObj: any;
}

function splitRaw(rawStr: string, escapedBase: string): Array<{ file: string; content: string }> {
  const byNewline = rawStr.split(/\r?\n/).map(l => l.trim()).filter(l => /^\S+\.conf\s/.test(l));
  if (byNewline.length > 1) {
    return byNewline.flatMap(line => {
      const m = line.match(/^(\S+\.conf)\s{2,}(.*)/);
      return m ? [{ file: m[1], content: m[2].trim() }] : [];
    });
  }
  // Lookahead anchors on the next *line boundary* — a path ending in .conf followed by
  // 2+ whitespace chars. This avoids false splits when a value itself contains a path
  // that starts with the splunk base (e.g. path.2 = /opt/splunk/etc/auth).
  const lineRe = new RegExp(`(${escapedBase}\\S+\\.conf)[ \\t]{2,}(.*?)(?=${escapedBase}\\S+\\.conf[ \\t]{2,}|$)`, "gs");
  return [...rawStr.matchAll(lineRe)].map(m => ({ file: m[1], content: m[2].trim() }));
}

/**
 * Parse raw Splunk btool results into display rows.
 *
 * @param results  - Raw Splunk result objects
 * @param targetStanza - Stanza to filter to. Omit (or pass "*") to return all stanzas.
 */
export function parseBtoolRows(results: any[], targetStanza?: string): BtoolRow[] {
  if (!results.length) return [];
  const all = !targetStanza || targetStanza === "*";

  // ── Format B: _raw full btool lines ──────────────────────────────────────
  const hasRawPaths = results.some(r => /^\//.test(String(r._raw ?? "").trim()));
  if (hasRawPaths) {
    const firstPath = String(results.find(r => /^\//.test(String(r._raw ?? "").trim()))?._raw ?? "").trim();
    const baseMatch = firstPath.match(/^(\/[^/]+\/[^/]+)\//);
    const splunkBase = baseMatch ? baseMatch[1] : "/opt/splunk";
    const escapedBase = splunkBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const out: BtoolRow[] = [];
    let currentStanza = "";
    const seenHeaders = new Set<string>();

    for (const row of results) {
      const rawStr = String(row._raw ?? "").trim();
      if (!rawStr.startsWith("/")) continue;
      for (const { file, content } of splitRaw(rawStr, escapedBase)) {
        const isStanza = /^\[.+\]$/.test(content);
        if (isStanza) {
          currentStanza = content.slice(1, -1);
          if (all || currentStanza === targetStanza) {
            if (!seenHeaders.has(currentStanza)) {
              out.push({ file, content, isStanza: true, stanza: currentStanza, rawObj: row });
              seenHeaders.add(currentStanza);
            }
          }
        } else if (all ? currentStanza !== "" : currentStanza === targetStanza) {
          out.push({ file, content, isStanza: false, stanza: currentStanza, rawObj: row });
        }
      }
    }
    if (out.length > 0) return out;
  }

  // ── Format A: BTOOL.* named fields ───────────────────────────────────────
  const allFields = Object.keys(results[0]).filter(k => !k.startsWith("_"));
  const isBtoolFormat = allFields.some(k => /^btool\./i.test(k));

  if (isBtoolFormat) {
    const stanzaField = allFields.find(k => /^btool\.stanza$/i.test(k));
    const prefixField = allFields.find(k => /^btool\.cmd\.prefix$/i.test(k));
    const confField   = allFields.find(k => /^btool\.cmd\.conf$/i.test(k));
    const keysField   = allFields.find(k => /^btool\.keys$/i.test(k));
    const allFieldsIncRaw = Object.keys(results[0]);
    const fileField = allFieldsIncRaw.find(k =>
      results.some(r => /^\/opt\/splunk/.test(String(r[k] ?? "")))
    ) ?? allFieldsIncRaw.find(k =>
      results.some(r => /^\//.test(String(r[k] ?? "")))
    );
    const settingCols = allFields.filter(k => !/^btool\./i.test(k));
    const normalise = (s: string) => s.toUpperCase().replace(/[._]/g, "");

    const out: BtoolRow[] = [];
    const seenHeaders = new Set<string>();
    const seenKeys = new Map<string, Set<string>>(); // stanza → seen keys

    for (const row of results) {
      const rowStanza = (stanzaField ? String(row[stanzaField] ?? "") : prefixField ? String(row[prefixField] ?? "") : "").trim();
      if (!all && rowStanza && rowStanza !== targetStanza) continue;

      const stanzaName = rowStanza || targetStanza || "unknown";
      const file = fileField ? String(row[fileField] ?? "") : confField ? String(row[confField] ?? "") : "";

      if (!seenHeaders.has(stanzaName)) {
        out.push({ file, content: `[${stanzaName}]`, isStanza: true, stanza: stanzaName, rawObj: row });
        seenHeaders.add(stanzaName);
        seenKeys.set(stanzaName, new Set());
      }

      const btoolKeysRaw = keysField ? String(row[keysField] ?? "").trim() : "";
      const keys = btoolKeysRaw ? btoolKeysRaw.split(",").map(k => k.trim()).filter(Boolean) : [];
      const stanzaSeenKeys = seenKeys.get(stanzaName)!;

      if (keys.length > 0) {
        for (const key of keys) {
          if (stanzaSeenKeys.has(key)) continue;
          const matchCol = settingCols.find(c => normalise(c) === normalise(key));
          const val = matchCol ? String(row[matchCol] ?? "").trim() : "";
          if (!val) continue;
          out.push({ file, content: `${key} = ${val}`, isStanza: false, stanza: stanzaName, rawObj: row });
          stanzaSeenKeys.add(key);
        }
      } else {
        for (const col of settingCols) {
          if (stanzaSeenKeys.has(col)) continue;
          const val = String(row[col] ?? "").trim();
          if (!val) continue;
          out.push({ file, content: `${col} = ${val}`, isStanza: false, stanza: stanzaName, rawObj: row });
          stanzaSeenKeys.add(col);
        }
      }
    }
    return out;
  }

  // ── Format C: classic key/value columns ──────────────────────────────────
  const fileField = allFields.find(k => String(results[0][k]).startsWith("/")) ?? allFields[0];
  const otherFields = allFields.filter(k => k !== fileField);
  const attrField = otherFields.find(k => k === "attribute" || k === "key") ?? otherFields[0];
  const valField  = otherFields.find(k => k === "value") ?? otherFields[1];

  const getContent = (row: any): string => {
    if (!otherFields.length) return "";
    if (otherFields.length === 1) return String(row[otherFields[0]] ?? "");
    const attr = String(row[attrField] ?? "").trim();
    const val  = String(row[valField]  ?? "").trim();
    if (!attr) return val;
    if (!val || attr.startsWith("[")) return attr;
    return `${attr} = ${val}`;
  };

  const out: BtoolRow[] = [];
  let currentStanza = "";
  for (const row of results) {
    const file    = String(row[fileField] ?? "");
    const content = getContent(row).trim();
    const isStanza = /^\[.+\]$/.test(content);
    if (isStanza) currentStanza = content.slice(1, -1);
    if (!all && currentStanza !== targetStanza) continue;
    out.push({ file, content, isStanza, stanza: currentStanza, rawObj: row });
  }
  return out;
}
