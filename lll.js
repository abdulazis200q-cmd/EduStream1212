import {
  addAttendance,
  addGrade,
  fetchAttendance,
  fetchGrades,
  fetchProfile,
  fetchSchedule,
  fetchStudentsByGroup,
  getSession,
  isSupabaseConfigured,
  login,
  logout,
} from "./js/supabaseClient.js";

const authSection = document.getElementById("auth-section");
const studentLayout = document.getElementById("student-layout");
const teacherLayout = document.getElementById("teacher-layout");
const userActions = document.getElementById("user-actions");
const userBadge = document.getElementById("user-badge");
const authMessage = document.getElementById("auth-message");
const teacherMessage = document.getElementById("teacher-message");

const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logout-btn");
const subjectFilter = document.getElementById("subject-filter");

const gradesTableBody = document.getElementById("grades-table-body");
const avgScore = document.getElementById("avg-score");
const absencesCount = document.getElementById("absences-count");
const nextLesson = document.getElementById("next-lesson");
const scheduleGrid = document.getElementById("schedule-grid");

const gradeForm = document.getElementById("grade-form");
const attendanceForm = document.getElementById("attendance-form");
const studentSelect = document.getElementById("student-select");
const attendanceStudentSelect = document.getElementById("attendance-student-select");

let currentProfile = null;

function setMessage(element, message = "") {
  element.textContent = message;
}

function toggleAuthenticatedUI(isAuthenticated) {
  authSection.classList.toggle("hidden", isAuthenticated);
  userActions.classList.toggle("hidden", !isAuthenticated);
}

function setRoleUI(role) {
  const isStudent = role === "student";
  const isTeacher = role === "teacher";

  studentLayout.classList.toggle("hidden", !isStudent);
  teacherLayout.classList.toggle("hidden", !isTeacher);
}

function renderGrades(grades) {
  gradesTableBody.innerHTML = "";
  if (!grades.length) {
    gradesTableBody.innerHTML =
      '<tr><td colspan="3">Нет данных по оценкам для выбранного фильтра.</td></tr>';
    avgScore.textContent = "-";
    return;
  }

  grades.forEach((grade) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${grade.date}</td>
      <td>${grade.subject}</td>
      <td>${grade.score}</td>
    `;
    gradesTableBody.appendChild(row);
  });

  const average = grades.reduce((sum, g) => sum + Number(g.score || 0), 0) / grades.length;
  avgScore.textContent = average.toFixed(2);
}

function renderSchedule(scheduleRows) {
  scheduleGrid.innerHTML = "";
  if (!scheduleRows.length) {
    scheduleGrid.innerHTML = "<p>Расписание пока не заполнено.</p>";
    nextLesson.textContent = "-";
    return;
  }

  scheduleRows.forEach((item) => {
    const dayCard = document.createElement("article");
    dayCard.className = "schedule-day";
    dayCard.innerHTML = `
      <h4>${item.day_of_week}</h4>
      <p>${item.time}</p>
      <p>${item.subject}</p>
    `;
    scheduleGrid.appendChild(dayCard);
  });

  const next = scheduleRows[0];
  nextLesson.textContent = `${next.day_of_week}, ${next.time} - ${next.subject}`;
}

function renderStudentOptions(students) {
  if (!students.length) {
    const emptyOption = '<option value="">Нет студентов в группе</option>';
    studentSelect.innerHTML = emptyOption;
    attendanceStudentSelect.innerHTML = emptyOption;
    return;
  }

  const options = students
    .map((student) => `<option value="${student.id}">${student.full_name}</option>`)
    .join("");
  studentSelect.innerHTML = options;
  attendanceStudentSelect.innerHTML = options;
}

async function loadStudentDashboard(subject = "") {
  if (!currentProfile?.group_number) {
    renderSchedule([]);
    setMessage(authMessage, "В профиле не указан номер группы (group_number).");
    return;
  }

  const [grades, attendance, schedule] = await Promise.all([
    fetchGrades(subject),
    fetchAttendance(),
    fetchSchedule(currentProfile.group_number),
  ]);

  renderGrades(grades);
  renderSchedule(schedule);
  absencesCount.textContent = attendance.filter((record) => record.status === "absent").length;
}

async function loadTeacherPanel() {
  if (!currentProfile?.group_number) {
    renderStudentOptions([]);
    setMessage(
      teacherMessage,
      "В профиле преподавателя не указан номер группы (group_number)."
    );
    return;
  }

  const students = await fetchStudentsByGroup(currentProfile.group_number);
  renderStudentOptions(students);
}

function showConfigError() {
  toggleAuthenticatedUI(false);
  setMessage(
    authMessage,
    "Supabase не настроен. Укажите VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env.local (локально) или в Netlify Environment variables, затем выполните npm run build."
  );
}

async function bootstrap() {
  if (!isSupabaseConfigured) {
    showConfigError();
    return;
  }

  try {
    const session = await getSession();
    if (!session?.user) {
      toggleAuthenticatedUI(false);
      return;
    }

    currentProfile = await fetchProfile();
    if (!currentProfile) {
      throw new Error(
        "Профиль пользователя не найден. Добавьте строку в таблицу profiles с id, совпадающим с id из Authentication."
      );
    }

    toggleAuthenticatedUI(true);
    userBadge.textContent = `${currentProfile.full_name} (${currentProfile.role})`;
    setRoleUI(currentProfile.role);

    if (currentProfile.role === "student") {
      await loadStudentDashboard();
    }

    if (currentProfile.role === "teacher") {
      await loadTeacherPanel();
    }
  } catch (error) {
    toggleAuthenticatedUI(false);
    setMessage(authMessage, error.message || "Ошибка инициализации.");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(authMessage);

  if (!isSupabaseConfigured) {
    showConfigError();
    return;
  }

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  try {
    await login(email, password);
    await bootstrap();
    loginForm.reset();
  } catch (error) {
    setMessage(authMessage, error.message || "Не удалось войти.");
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await logout();
    currentProfile = null;
    setRoleUI("");
    toggleAuthenticatedUI(false);
  } catch (error) {
    setMessage(authMessage, error.message || "Ошибка выхода.");
  }
});

subjectFilter.addEventListener("change", async () => {
  if (!currentProfile || currentProfile.role !== "student") return;

  try {
    await loadStudentDashboard(subjectFilter.value);
  } catch (error) {
    setMessage(authMessage, error.message || "Не удалось обновить журнал.");
  }
});

gradeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(teacherMessage);

  if (!studentSelect.value) {
    setMessage(teacherMessage, "Выберите студента из списка.");
    return;
  }

  const payload = {
    studentId: studentSelect.value,
    subject: document.getElementById("subject-input").value.trim(),
    score: Number(document.getElementById("score-input").value),
  };

  try {
    await addGrade(payload);
    setMessage(teacherMessage, "Оценка успешно добавлена.");
    gradeForm.reset();
  } catch (error) {
    setMessage(teacherMessage, error.message || "Не удалось добавить оценку.");
  }
});

attendanceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(teacherMessage);

  if (!attendanceStudentSelect.value) {
    setMessage(teacherMessage, "Выберите студента из списка.");
    return;
  }

  const status = document.getElementById("attendance-status").value;
  const reason = document.getElementById("attendance-reason").value.trim();
  const payload = {
    studentId: attendanceStudentSelect.value,
    status,
    reason: status === "absent" ? reason : "",
  };

  try {
    await addAttendance(payload);
    setMessage(teacherMessage, "Посещаемость обновлена.");
    attendanceForm.reset();
  } catch (error) {
    setMessage(teacherMessage, error.message || "Не удалось обновить посещаемость.");
  }
});

bootstrap();
