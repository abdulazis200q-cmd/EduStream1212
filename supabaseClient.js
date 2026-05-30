import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(url) {
  if (!url) return "";
  return url.replace(/\/+$/, "").replace(/\/rest\/v1\/?$/, "");
}

const SUPABASE_URL = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL ?? "");
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const CONFIG_ERROR =
  "[Edustream] Supabase не настроен. Задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY " +
  "(локально в .env.local, на Netlify — в Environment variables и пересоберите сайт: npm run build).";

if (!isSupabaseConfigured) {
  console.error(CONFIG_ERROR, {
    VITE_SUPABASE_URL: SUPABASE_URL ? "задан" : "пусто",
    VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? "задан" : "пусто",
  });
}

let supabase = null;
let configErrorLogged = false;

function logConfigError() {
  if (!configErrorLogged) {
    console.error(CONFIG_ERROR);
    configErrorLogged = true;
  }
}

function ensureClient() {
  if (!isSupabaseConfigured) {
    logConfigError();
    return null;
  }

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
  if (!client) {
    throw new Error(
      "Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY, затем выполните сборку (npm run build)."
    );
  }
  return client;
}

function formatError(error) {
  if (!error) return "Неизвестная ошибка";
  if (typeof error === "string") return error;
  return error.message || "Ошибка запроса к Supabase";
}

async function getAuthorizedUser() {
  const client = requireClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) throw new Error(formatError(error));
  if (!user) throw new Error("Пользователь не авторизован.");
  return user;
}

async function getCurrentProfile() {
  const user = await getAuthorizedUser();
  const client = requireClient();

  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, role, group_number")
    .eq("id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(formatError(error));
  if (!data) {
    throw new Error(
      "Профиль не найден в таблице profiles. Добавьте запись с id пользователя из Authentication."
    );
  }
  return data;
}

async function requireTeacher() {
  const profile = await getCurrentProfile();
  if (profile.role !== "teacher") {
    throw new Error("Доступно только преподавателям.");
  }
  if (!profile.group_number) {
    throw new Error("У преподавателя не указан номер группы (group_number).");
  }
  return profile;
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

export async function fetchProfile() {
  return getCurrentProfile();
}

export async function fetchGrades(subject = "") {
  const user = await getAuthorizedUser();
  const client = requireClient();

  let query = client
    .from("grades")
    .select("id, student_id, subject, score, date")
    .eq("student_id", user.id)
    .order("date", { ascending: false });

  if (subject) {
    query = query.eq("subject", subject);
  }

  const { data, error } = await query;
  if (error) throw new Error(formatError(error));
  return data || [];
}

export async function addGrade({ studentId, subject, score }) {
  await requireTeacher();
  const client = requireClient();

  const { data, error } = await client
    .from("grades")
    .insert([
      {
        student_id: studentId,
        subject,
        score,
        date: new Date().toISOString().slice(0, 10),
      },
    ])
    .select("id, student_id, subject, score, date")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(formatError(error));
  if (!data) throw new Error("Не удалось сохранить оценку.");
  return data;
}

export async function fetchAttendance() {
  const user = await getAuthorizedUser();
  const client = requireClient();

  const { data, error } = await client
    .from("attendance")
    .select("id, student_id, date, status, reason")
    .eq("student_id", user.id)
    .order("date", { ascending: false });

  if (error) throw new Error(formatError(error));
  return data || [];
}

export async function fetchSchedule(groupNumber) {
  await getAuthorizedUser();
  const client = requireClient();

  if (!groupNumber) return [];

  const { data, error } = await client
    .from("schedule")
    .select("id, group_number, subject, day_of_week, time")
    .eq("group_number", groupNumber)
    .order("day_of_week")
    .order("time");

  if (error) throw new Error(formatError(error));
  return data || [];
}

export async function fetchStudentsByGroup(groupNumber) {
  await requireTeacher();
  const client = requireClient();

  if (!groupNumber) return [];

  const { data, error } = await client
    .from("profiles")
    .select("id, full_name, group_number")
    .eq("role", "student")
    .eq("group_number", groupNumber)
    .order("full_name");

  if (error) throw new Error(formatError(error));
  return data || [];
}

export async function addAttendance({ studentId, status, reason }) {
  await requireTeacher();
  const client = requireClient();

  const { data, error } = await client
    .from("attendance")
    .insert([
      {
        student_id: studentId,
        date: new Date().toISOString().slice(0, 10),
        status,
        reason: reason || null,
      },
    ])
    .select("id, student_id, date, status, reason")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(formatError(error));
  if (!data) throw new Error("Не удалось сохранить посещаемость.");
  return data;
}

export function onAuthStateChange(callback) {
  const client = ensureClient();
  if (!client) return () => {};

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => subscription.unsubscribe();
}
