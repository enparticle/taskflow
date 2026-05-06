// @ts-nocheck
import { createClient as _create } from "@supabase/supabase-js";

const URL = "https://tvgygdyucadaoqmnsgmp.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Z3lnZHl1Y2FkYW9xbW5zZ21wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NjA2MzMsImV4cCI6MjA5MzQzNjYzM30.rbMmaPhtqxJv6GUNaUvvtE7C6Cih4VfldlDOsTLvygA";

let _client: any = null;

export function createClient(): any {
  if (_client) return _client;
  _client = _create(URL, KEY);
  return _client;
}
