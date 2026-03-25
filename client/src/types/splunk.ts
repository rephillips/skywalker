export interface SplunkResult {
  [key: string]: string;
}

export interface SplunkSearchResponse {
  results: SplunkResult[];
  fields?: { name: string }[];
  init_offset?: number;
  messages?: { type: string; text: string }[];
}
