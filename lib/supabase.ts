import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://bvvdsenorvyobeinlhni.supabase.co";
const supabaseAnonKey = "sb_publishable_Bp4C_whEItrvpj3BZrtVHw_b-bEAtVh";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);