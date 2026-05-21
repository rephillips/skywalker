export interface BtoolRow {
  file: string;
  content: string;   // "[stanza]" or "key = value"
  isStanza: boolean;
  stanza: string;
  rawObj: any;
}

function splitRaw(rawStr: string, escapedBase: string): Array<{ file: string; content: string }> {
  // Case 1: real newlines present — each line is unambiguously one btool entry
  const byNewline = rawStr.split(/\r?\n/).map(l => l.trim()).filter(l => /^\S+\.conf\s/.test(l));
  if (byNewline.length > 1) {
    return byNewline.flatMap(line => {
      const m = line.match(/^(\S+\.conf)\s{2,}(.*)/);
      return m ? [{ file: m[1], content: m[2].trim() }] : [];
    });
  }
  // Case 2: concatenated — anchor on detected base path to avoid false splits
  // inside path-valued attributes (S3 URLs, conf paths, etc.)
  const lineRe = new RegExp(`(\\S+\\.conf)\\s{2,}(.*?)(?=${escapedBase}\\/|$)`, "gs");
  return [...rawStr.matchAll(lineRe)].map(m => ({ file: m[1], content: m[2].trim() }));
}

export function parseBtoolRows(results: any[], targetStanza: string): BtoolRow[] {
  if (!results.length) return [];

  // Format A: _raw contains full btool lines — try this first.
  // Each line: "/path/to/file.conf    key = value" (2+ spaces as separator).
  const hasRawPaths = results.some(r => /^\//.test(String(r._raw ?? "").trim()));
  if (hasRawPaths) {
    const firstPath = String(results.find(r => /^\//.test(String(r._raw ?? "").trim()))?._raw ?? "").trim();
    const baseMatch = firstPath.match(/^(\/[^/]+\/[^/]+)\//);
    const splunkBase = baseMatch ? baseMatch[1] : "/opt/splunk";
    const escapedBase = splunkBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const out: BtoolRow[] = [];
    let currentStanza = "";
    let addedStanzaHeader = false;
    for (const row of results) {
      const rawStr = String(row._raw ?? "").trim();
      if (!rawStr.startsWith("/")) continue;
      for (const { file, content } of splitRaw(rawStr, escapedBase)) {
        const isStanza = /^\[.+\]$/.test(content);
        if (isStanza) {
          currentStanza = content.slice(1, -1);
          if (currentStanza === targetStanza && !addedStanzaHeader) {
            out.push({ file, content, isStanza: true, stanza: currentStanza, rawObj: row });
            addedStanzaHeader = true;
          }
        } else if (currentStanza === targetStanza) {
          out.push({ file, content, isStanza: false, stanza: currentStanza, rawObj: row });
        }
      }
    }
    if (out.length > 0) return out;
  }

  const allFields = Object.keys(results[0]).filter(k => !k.startsWith("_"));

  // Format B: Admin's Little Helper BTOOL.* named fields.
  // _raw = just the source file path; data lives in BTOOL.KEYS, BTOOL.STANZA, etc.
  const isBtoolFormat = allFields.some(k => /^btool\./i.test(k));
  if (isBtoolFormat) {
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

    const out: BtoolRow[] = [];
    let addedStanza = false;

    for (const row of results) {
      const rowStanza = prefixField ? String(row[prefixField] ?? "").trim() : "";
      if (rowStanza && rowStanza !== targetStanza) continue;

      const file = fileField
        ? String(row[fileField] ?? "")
        : confField ? String(row[confField] ?? "") : "";

      if (!addedStanza) {
        out.push({ file, content: `[${targetStanza}]`, isStanza: true, stanza: targetStanza, rawObj: row });
        addedStanza = true;
      }

      const btoolKeysRaw = keysField ? String(row[keysField] ?? "").trim() : "";
      const keys = btoolKeysRaw
        ? btoolKeysRaw.split(",").map(k => k.trim()).filter(Boolean)
        : [];

      const normalise = (s: string) => s.toUpperCase().replace(/[._]/g, "");

      if (keys.length > 0) {
        for (const key of keys) {
          const matchCol = settingCols.find(c => normalise(c) === normalise(key));
          const val = matchCol ? String(row[matchCol] ?? "").trim() : "";
          if (!val) continue;
          out.push({ file, content: `${key} = ${val}`, isStanza: false, stanza: targetStanza, rawObj: row });
        }
      } else {
        for (const col of settingCols) {
          const val = String(row[col] ?? "").trim();
          if (!val) continue;
          out.push({ file, content: `${col} = ${val}`, isStanza: false, stanza: targetStanza, rawObj: row });
        }
      }
    }

    // Deduplicate by key — keep first occurrence (highest precedence in merge chain)
    const seenKeys = new Set<string>();
    return out.filter(row => {
      if (row.isStanza) return true;
      const key = row.content.split(" = ")[0].trim();
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });
  }

  // Format C: classic — one field is the file path, others are key/value columns
  const fileField = allFields.find(k => String(results[0][k]).startsWith("/")) ?? allFields[0];
  const otherFields = allFields.filter(k => k !== fileField);

  const getContent = (row: any): string => {
    if (otherFields.length === 0) return "";
    if (otherFields.length === 1) return String(row[otherFields[0]] ?? "");
    const attrField = otherFields.find(k => k === "attribute" || k === "key") ?? otherFields[0];
    const valField  = otherFields.find(k => k === "value") ?? otherFields[1];
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
    if (isStanza) currentStanza = content.replace(/^\[/, "").replace(/\]$/, "");
    if (currentStanza !== targetStanza) continue;
    out.push({ file, content, isStanza, stanza: currentStanza, rawObj: row });
  }
  return out.length > 0 ? out : results.map(row => ({
    file: String(row[fileField] ?? ""),
    content: getContent(row),
    isStanza: false,
    stanza: "",
    rawObj: row,
  }));
}
