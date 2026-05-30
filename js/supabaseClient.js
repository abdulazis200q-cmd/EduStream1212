function normalizeSupabaseUrl(url) {
  if (!url) return "";
  return url.replace(/\/+$/, "").replace(/\/rest\/v1\/?$/, "");
}

// Вставляем ключи напрямую текстом (для GitHub Pages это нормально)
const SUPABASE_URL = normalizeSupabaseUrl("https://your-project-id.supabase.co"); 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...".trim(); 

// Берем функцию из глобального окна, куда её загрузит CDN (интернет)
const createClient = window.supabase.createClient;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const CONFIG_ERROR = "[Edustream] Supabase не настроен.";

let supabase = null;

function ensureClient() {
  if (!isSupabaseConfigured) return null;
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabase;
}

function requireClient() {
  const client = ensureClient();
  if (!client) throw new Error("Supabase не настроен.");
  return client;
}

function formatError(error) {
  if (!error) return "Неизвестная ошибка";
  if (typeof error === "string") return error;
  return error.message || "Ошибка запроса к Supabase";
}

export async function login(email, password) {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(formatError(error));
  return data;
}

export async function logout() {
  const client = requireClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(formatError(error));
}

export async function getSession() {
  const client = ensureClient();
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(formatError(error));
  return data.session;
}

// ... (остальные ваши функции fetchGrades, fetchSchedule оставляем ниже без изменений, главное убрать верхний import)
