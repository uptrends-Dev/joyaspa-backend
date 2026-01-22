import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function checkTables() {
  const tables = [
    "service_categories",
    "services",
    "branches",
    "branch_service_pricing",
    "customers",
    "admins",
    "bookings",
    "booking_items",
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .limit(1);

    if (error) {
      console.log(`❌ ${table}:`, error.message);
    } else {
      console.log(`✅ ${table}: OK`);
    }
  }
}

checkTables();
