const $ = s => document.querySelector(s),
  $$ = s => [...document.querySelectorAll(s)];
const state = {
  user: null,
  courses: [],
  assignedCourses: [],
  lessons: [],
  users: []
};
const esc = s =>
  String(s ?? "").replace(
    /[&<>"']/g,
    c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
const formatDate = value =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      }).format(new Date(value))
    : "";
const formatDateTime = value =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }).format(new Date(value))
    : "Not completed";
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}
function dialog(html, modalClass = "") {
  $("#dialog").innerHTML = html;
  $("#dialogOverlay .modal").className = `modal ${modalClass}`.trim();
  $("#dialogOverlay").hidden = false;
}
function closeDialog() {
  $("#dialogOverlay").hidden = true;
  $("#dialog").innerHTML = "";
  $("#dialogOverlay .modal").className = "modal";
}
function bindUserModalTabs() {
  const buttons = $$(".user-modal-tabs button"),
    panels = $$(".user-tab-panel"),
    courseTab = $('[data-user-tab="courses"]'),
    courseBoxes = $$(
      '.user-tab-panel[data-user-panel="courses"] .course-check input'
    ),
    isExistingUser = !!$("#userAssignmentForm");
  const activeTab =
    buttons.find(button => button.classList.contains("active"))?.dataset
      .userTab || "details";
  panels.forEach(panel => {
    panel.hidden = false;
    panel.style.visibility = "hidden";
  });
  const panelHeight = Math.max(...panels.map(panel => panel.scrollHeight));
  panels.forEach(panel => {
    panel.style.minHeight = `${panelHeight}px`;
    panel.style.visibility = "";
    panel.hidden = panel.dataset.userPanel !== activeTab;
  });
  const updateCount = () => {
    const assigned = courseBoxes.filter(box => box.checked),
      completed = assigned.filter(
        box => box.closest(".course-check").dataset.completed === "true"
      );
    courseTab.textContent = isExistingUser
      ? `Courses (${completed.length} of ${assigned.length} complete)`
      : `Course Assignments (${assigned.length} of ${courseBoxes.length})`;
    courseBoxes.forEach(box => {
      const row = box.closest(".course-check"),
        isCompleted = row.dataset.completed === "true";
      row.classList.toggle("course-not-needed", !box.checked);
      row.classList.toggle("course-required", box.checked && !isCompleted);
      row.classList.toggle("course-finished", box.checked && isCompleted);
      row
        .querySelectorAll(".completed-tag,.incomplete-tag")
        .forEach(tag => (tag.hidden = !box.checked));
    });
  };
  buttons.forEach(
    button =>
      (button.onclick = () => {
        buttons.forEach(item =>
          item.classList.toggle("active", item === button)
        );
        panels.forEach(
          panel =>
            (panel.hidden = panel.dataset.userPanel !== button.dataset.userTab)
        );
      })
  );
  courseBoxes.forEach(box => (box.onchange = updateCount));
  $$("[data-course-expand]").forEach(
    button =>
      (button.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        const details = $(`#course-lessons-${button.dataset.courseExpand}`),
          expanded = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", String(!expanded));
        button.textContent = expanded ? "›" : "⌄";
        details.hidden = expanded;
      })
  );
  updateCount();
}
function confirmCourseRemoval(user, course) {
  return new Promise(resolve => {
    const overlay = $("#confirmOverlay"),
      message = $("#confirmMessage");
    message.textContent =
      course.completed_lessons > 0
        ? `${user.name} has completed ${course.completed_lessons} of ${course.total_lessons} lessons in “${course.course_title}.” Removing the course will permanently delete this completion information.`
        : `Remove “${course.course_title}” from ${user.name}? Any completion information associated with this assignment will be permanently lost.`;
    overlay.hidden = false;
    const finish = result => {
      overlay.hidden = true;
      $("#confirmCancel").onclick = null;
      $("#confirmRemove").onclick = null;
      resolve(result);
    };
    $("#confirmCancel").onclick = () => finish(false);
    $("#confirmRemove").onclick = () => finish(true);
  });
}
function confirmAction(title, message, actionLabel = "Delete") {
  return new Promise(resolve => {
    const overlay = $("#confirmOverlay");
    $("#confirmTitle").textContent = title;
    $("#confirmMessage").textContent = message;
    $("#confirmRemove").textContent = actionLabel;
    $("#confirmCancel").textContent = "Cancel";
    overlay.hidden = false;
    const finish = result => {
      overlay.hidden = true;
      $("#confirmCancel").onclick = null;
      $("#confirmRemove").onclick = null;
      resolve(result);
    };
    $("#confirmCancel").onclick = () => finish(false);
    $("#confirmRemove").onclick = () => finish(true);
  });
}
function showAuth(error = "") {
  $("#authOverlay").hidden = false;
  $("#authError").textContent = error;
}
function hideAuth() {
  $("#authOverlay").hidden = true;
}
async function loadCourses() {
  if (state.user.role === "Admin") {
    [state.courses, state.assignedCourses] = await Promise.all([
      api.courses(),
      api.userCourses(state.user.id)
    ]);
  } else {
    state.assignedCourses = await api.userCourses(state.user.id);
    state.courses = state.assignedCourses;
  }
  renderCourses();
  if (state.user.role === "Admin") renderAdminCourses();
}
function renderCourses() {
  const courses = state.assignedCourses;
  $("#empty").hidden = !!courses.length;
  $("#courseGrid").innerHTML = courses
    .map(
      c =>
        `<article class="course-card" data-course="${
          c.id
        }"><p class="eyebrow">${c.total_lessons} lesson${
          c.total_lessons === 1 ? "" : "s"
        }</p><h3>${esc(c.course_title)}</h3><p>${esc(
          c.description || "No description"
        )}</p><div class="progress"><span style="width:${
          c.total_lessons ? (100 * c.completed_lessons) / c.total_lessons : 0
        }%"></span></div><span class="progress-label">${
          c.completed_lessons
        } of ${c.total_lessons} complete</span></article>`
    )
    .join("");
  $$("[data-course]").forEach(
    el => (el.onclick = () => openCourse(Number(el.dataset.course)))
  );
}
function openCourse(id) {
  const c = state.assignedCourses.find(x => x.id === id);
  dialog(
    `<h2>${esc(c.course_title)}</h2><p>${esc(
      c.description || ""
    )}</p><form id="courseProgressForm"><div class="course-progress-lessons">${
      c.lessons.length
        ? c.lessons
            .map(
              l =>
                `<div class="lesson-row progress-lesson"><div><a href="${esc(
                  l.url
                )}" target="_blank" rel="noopener noreferrer">${
                  l.sequence
                }. ${esc(l.lesson_title)} ↗</a><p>${esc(
                  l.description || ""
                )}</p></div><label class="completion-check"><input type="checkbox" data-progress-lesson="${
                  l.id
                }" ${
                  l.completed ? "checked" : ""
                }><span>Watched and completed</span></label></div>`
            )
            .join("")
        : '<p class="empty">No lessons have been added yet.</p>'
    }</div>${
      c.lessons.length
        ? '<div class="course-progress-footer"><p id="progressError" class="error"></p><button class="primary progress-save">Save progress</button></div>'
        : ""
    }</form>`,
    "course-progress-modal"
  );
  if (c.lessons.length) {
    $("#courseProgressForm").onsubmit = async e => {
      e.preventDefault();
      const original = new Map(c.lessons.map(l => [l.id, l.completed])),
        selected = new Set(
          $$("[data-progress-lesson]:checked").map(x =>
            Number(x.dataset.progressLesson)
          )
        ),
        button = $(".progress-save"),
        error = $("#progressError");
      button.disabled = true;
      button.textContent = "Saving…";
      error.textContent = "";
      try {
        if (selected.size && !c.assigned) await api.assign(state.user.id, c.id);
        for (const lesson of c.lessons) {
          if (selected.has(lesson.id) && !original.get(lesson.id))
            await api.complete(state.user.id, c.id, lesson.id);
          if (!selected.has(lesson.id) && original.get(lesson.id))
            await api.uncomplete(state.user.id, c.id, lesson.id);
        }
        await loadCourses();
        closeDialog();
        toast("Course progress saved");
      } catch (x) {
        error.textContent = x.message;
        button.disabled = false;
        button.textContent = "Save progress";
      }
    };
  }
}

function renderAdminCourses() {
  $("#adminCourseList").innerHTML = state.courses
    .map(
      c =>
        `<button class="list-item user-row" type="button" data-admin-course="${
          c.id
        }"><div><h3>${esc(c.course_title)}</h3><p>${c.lessons.length} lesson${
          c.lessons.length === 1 ? "" : "s"
        }, ${c.completed_employees}/${c.assigned_employees} assigned employee${
          c.assigned_employees === 1 ? "" : "s"
        }</p></div></button>`
    )
    .join("");
  $$("[data-admin-course]").forEach(
    row => (row.onclick = () => courseEditor(Number(row.dataset.adminCourse)))
  );
}
function courseForm(course = {}) {
  if (course.id) {
    courseEditor(course.id);
    return;
  }
  dialog(
    `<h2>New course</h2><form id="courseForm"><label>Title<input id="courseTitle" maxlength="200" required></label><label>Description<textarea id="courseDescription" maxlength="4000"></textarea></label><button class="primary">Create course</button></form>`
  );
  $("#courseForm").onsubmit = async e => {
    e.preventDefault();
    try {
      await api.createCourse({
        course_title: $("#courseTitle").value.trim(),
        description: $("#courseDescription").value.trim() || null
      });
      closeDialog();
      await loadCourses();
      toast("Course created");
    } catch (x) {
      toast(x.message);
    }
  };
}
function bindCourseTabs() {
  const buttons = $$(".course-modal-tabs button"),
    panels = $$(".course-tab-panel");
  buttons.forEach(
    button =>
      (button.onclick = () => {
        buttons.forEach(x => x.classList.toggle("active", x === button));
        panels.forEach(
          panel =>
            (panel.hidden =
              panel.dataset.coursePanel !== button.dataset.courseTab)
        );
      })
  );
}
function bindLessonDrag(courseId) {
  let dragged = null;
  $$(".sortable-lesson").forEach(row => {
    row.ondragstart = () => {
      dragged = row;
      row.classList.add("dragging");
    };
    row.ondragend = () => {
      row.classList.remove("dragging");
      dragged = null;
    };
    row.ondragover = e => {
      e.preventDefault();
      if (!dragged || dragged === row) return;
      const rect = row.getBoundingClientRect();
      row.parentElement.insertBefore(
        dragged,
        e.clientY < rect.top + rect.height / 2 ? row : row.nextSibling
      );
    };
    row.ondrop = async e => {
      e.preventDefault();
      const ids = $$(".sortable-lesson").map(x => Number(x.dataset.lesson));
      await api.reorderLessons(courseId, ids);
      await loadCourses();
      courseEditor(courseId, "lessons");
      toast("Lesson order updated");
    };
  });
}
function courseEditor(id, activeTab = "details") {
  const c = state.courses.find(x => x.id === id),
    available = state.lessons.filter(l => !c.lessons.some(x => x.id === l.id));
  dialog(
    `<h2>${esc(
      c.course_title
    )}</h2><form id="courseEditorForm"><div class="tabs course-modal-tabs"><button type="button" data-course-tab="details" class="${
      activeTab === "details" ? "active" : ""
    }">Details</button><button type="button" data-course-tab="lessons" class="${
      activeTab === "lessons" ? "active" : ""
    }">Lessons (${
      c.lessons.length
    })</button></div><section class="course-tab-panel" data-course-panel="details" ${
      activeTab !== "details" ? "hidden" : ""
    }><label>Title<input id="courseTitle" value="${esc(
      c.course_title
    )}" maxlength="200" required></label><label>Description<textarea id="courseDescription" maxlength="4000">${esc(
      c.description || ""
    )}</textarea></label></section><section class="course-tab-panel" data-course-panel="lessons" ${
      activeTab !== "lessons" ? "hidden" : ""
    }><div id="courseLessonList" class="sortable-list">${c.lessons
      .map(
        l =>
          `<div class="sortable-lesson" draggable="true" data-lesson="${
            l.id
          }"><span class="drag-handle" title="Drag to reorder" aria-label="Drag to reorder">☰</span><div><strong>${esc(
            l.lesson_title
          )}</strong><small>${esc(
            l.url
          )}</small></div><button class="danger" type="button" data-remove-lesson="${
            l.id
          }">Remove</button></div>`
      )
      .join("") ||
      '<p class="empty compact-empty">No lessons assigned.</p>'}</div><div class="add-lesson-row"><select id="unassignedLesson"><option value="">Select an unassigned lesson…</option>${available
      .map(l => `<option value="${l.id}">${esc(l.lesson_title)}</option>`)
      .join(
        ""
      )}</select><button id="addCourseLesson" class="secondary" type="button" ${
      available.length ? "" : "disabled"
    }>Add lesson</button></div></section><p id="courseEditorError" class="error"></p><div class="modal-actions course-form-actions"><button id="deleteCourse" class="danger" type="button">Delete course</button><button class="primary">Save changes</button></div></form>`
  );
  bindCourseTabs();
  bindLessonDrag(id);
  $("#courseEditorForm").onsubmit = async e => {
    e.preventDefault();
    try {
      await api.updateCourse(id, {
        course_title: $("#courseTitle").value.trim(),
        description: $("#courseDescription").value.trim() || null
      });
      closeDialog();
      await loadCourses();
      toast("Course saved");
    } catch (x) {
      $("#courseEditorError").textContent = x.message;
    }
  };
  $("#deleteCourse").onclick = async () => {
    if (
      await confirmAction(
        "Delete course?",
        `Delete “${c.course_title}”? Its assignments and completion information will be permanently lost.`,
        "Delete course"
      )
    ) {
      await api.deleteCourse(id);
      closeDialog();
      await loadCourses();
      toast("Course deleted");
    }
  };
  $$("[data-remove-lesson]").forEach(
    button =>
      (button.onclick = async () => {
        await api.removeLesson(id, Number(button.dataset.removeLesson));
        await loadCourses();
        courseEditor(id, "lessons");
      })
  );
  $("#addCourseLesson").onclick = async () => {
    const lessonId = Number($("#unassignedLesson").value);
    if (!lessonId) return;
    await api.addLesson(id, lessonId, c.lessons.length + 1);
    await loadCourses();
    courseEditor(id, "lessons");
  };
}

async function loadLessons() {
  state.lessons = await api.lessons();
  $("#lessonList").innerHTML = state.lessons
    .map(
      l =>
        `<button class="list-item lesson-admin-row" type="button" data-lesson-row="${
          l.id
        }"><span class="compact-primary">${esc(
          l.lesson_title
        )}</span><span class="compact-separator">—</span><span class="compact-secondary">${esc(
          l.url
        )}</span></button>`
    )
    .join("");
  $$("[data-lesson-row]").forEach(
    row =>
      (row.onclick = () =>
        lessonForm(
          state.lessons.find(x => x.id === Number(row.dataset.lessonRow))
        ))
  );
}
function lessonForm(l = {}) {
  const courseNames = l.id
    ? state.courses
        .filter(course => course.lessons.some(lesson => lesson.id === l.id))
        .map(course => course.course_title)
        .join(", ")
    : "";
  dialog(
    `<h2>${
      l.id ? `[${l.id}] Edit lesson` : "New lesson"
    }</h2><form id="lessonForm"><label>Title<input id="lessonTitle" value="${esc(
      l.lesson_title || ""
    )}" required></label><label>Video URL<input id="lessonUrl" type="url" value="${esc(
      l.url || ""
    )}" required></label><label>Description<textarea id="lessonDescription">${esc(
      l.description || ""
    )}</textarea></label>${
      l.id
        ? `<label>Courses<input class="readonly-field" value="${esc(
            courseNames || "Not assigned to a course"
          )}" readonly></label>`
        : ""
    }<div class="modal-actions lesson-form-actions">${
      l.id
        ? '<button id="deleteLessonModal" class="danger" type="button">Delete lesson</button>'
        : ""
    }<button class="primary">${
      l.id ? "Save lesson" : "Create lesson"
    }</button></div></form>`
  );
  if (l.id)
    $("#deleteLessonModal").onclick = async () => {
      if (
        await confirmAction(
          "Delete lesson?",
          `Delete “${l.lesson_title}”? It will be removed from every course, and associated completion information will be permanently lost.`,
          "Delete lesson"
        )
      ) {
        await api.deleteLesson(l.id);
        closeDialog();
        await loadLessons();
        await loadCourses();
        toast("Lesson deleted");
      }
    };
  $("#lessonForm").onsubmit = async e => {
    e.preventDefault();
    const data = {
      lesson_title: $("#lessonTitle").value.trim(),
      url: $("#lessonUrl").value.trim(),
      description: $("#lessonDescription").value.trim() || null
    };
    l.id ? await api.updateLesson(l.id, data) : await api.createLesson(data);
    closeDialog();
    await loadLessons();
    await loadCourses();
    toast("Lesson saved");
  };
}

async function loadUsers() {
  state.users = await api.users();
  const courseProgress = new Map(
    await Promise.all(
      state.users.map(async user => {
        const assigned = await api.userCourses(user.id);
        return [
          user.id,
          {
            assigned: assigned.length,
            completed: assigned.filter(
              course =>
                course.total_lessons > 0 &&
                course.completed_lessons === course.total_lessons
            ).length
          }
        ];
      })
    )
  );
  $("#userList").innerHTML = state.users
    .map(u => {
      const progress = courseProgress.get(u.id),
        progressClass =
          progress.assigned === 0
            ? "user-progress-none"
            : progress.completed === progress.assigned
            ? "user-progress-complete"
            : "user-progress-incomplete";
      return `<button class="list-item user-row" type="button" data-user="${
        u.id
      }"><span class="compact-primary">${esc(
        u.name
      )}</span><span class="compact-separator">·</span><span class="compact-secondary">${esc(
        u.email
      )} · ${
        u.role
      }</span><span class="user-course-progress ${progressClass}">${
        progress.completed
      } of ${progress.assigned} completed</span></button>`;
    })
    .join("");
  $$("[data-user]").forEach(
    row =>
      (row.onclick = () =>
        editUserAssignmentsWithLessons(Number(row.dataset.user)))
  );
}
async function editUserAssignmentsWithLessons(userId) {
  await editUserAssignments(userId);
  const assigned = await api.userCourses(userId),
    byId = new Map(assigned.map(course => [course.id, course]));
  $$(".assignment-course").forEach(row => {
    const checkbox = row.querySelector('input[type="checkbox"]'),
      course = byId.get(Number(checkbox.value));
    if (!course) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "course-expand";
    button.textContent = "›";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Show lesson completion details");
    const details = document.createElement("div");
    details.className = "assignment-lessons";
    details.hidden = true;
    details.innerHTML = course.lessons.length
      ? course.lessons
          .map(
            lesson =>
              `<div class="assignment-lesson ${
                lesson.completed ? "lesson-done" : "lesson-pending"
              }"><span>${lesson.sequence}. ${esc(
                lesson.lesson_title
              )}</span><time>${esc(
                formatDateTime(lesson.completion_time)
              )}</time></div>`
          )
          .join("")
      : "<p>No lessons in this course.</p>";
    row.appendChild(button);
    row.parentNode.insertBefore(details, row.nextSibling);
    button.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      button.textContent = expanded ? "›" : "⌄";
      details.hidden = expanded;
    };
  });
}
function newUserForm() {
  dialog(
    `<h2>New user</h2><form id="newUserForm" autocomplete="off"><div class="tabs user-modal-tabs"><button type="button" class="active" data-user-tab="details">User Details</button><button type="button" data-user-tab="courses">Course Assignments</button></div><section class="user-tab-panel" data-user-panel="details"><label>Name<input id="newUserName" autocomplete="off" required maxlength="120"></label><label>Email<input id="newUserEmail" type="email" autocomplete="off" required></label><label>Role<select id="newUserRole"><option value="Basic">Basic</option><option value="Admin">Admin</option></select></label><label>Password<input id="newUserPassword" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></label><label>Confirm password<input id="newUserConfirmPassword" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></label></section><section class="user-tab-panel" data-user-panel="courses" hidden><div class="course-checklist"><h3>Assign courses</h3>${
      state.courses.length
        ? state.courses
            .map(
              c =>
                `<label class="course-check"><input type="checkbox" value="${
                  c.id
                }"><span><strong>${esc(c.course_title)}</strong><small>${
                  c.total_lessons
                } lesson${
                  c.total_lessons === 1 ? "" : "s"
                }</small></span></label>`
            )
            .join("")
        : "<p>No courses are available.</p>"
    }</div></section><p id="newUserError" class="error"></p><button id="createUserButton" class="primary">Create user</button></form>`
  );
  bindUserModalTabs();
  $("#newUserForm").onsubmit = async e => {
    e.preventDefault();
    const error = $("#newUserError"),
      password = $("#newUserPassword").value,
      confirmation = $("#newUserConfirmPassword").value,
      courseIds = $$(".course-check input:checked").map(x => Number(x.value));
    error.textContent = "";
    if (password !== confirmation) {
      error.textContent = "Passwords do not match.";
      return;
    }
    const button = $("#createUserButton");
    button.disabled = true;
    button.textContent = "Creating…";
    let createdUser = null;
    try {
      createdUser = await api.createUser({
        name: $("#newUserName").value.trim(),
        email: $("#newUserEmail").value.trim(),
        password,
        role: $("#newUserRole").value
      });
      for (const courseId of courseIds)
        await api.assign(createdUser.id, courseId);
      closeDialog();
      await loadUsers();
      toast("User created and courses assigned");
    } catch (x) {
      if (createdUser) {
        error.textContent = `${createdUser.name} was created, but one or more courses could not be assigned. Open the user to review assignments. ${x.message}`;
      } else {
        error.textContent = x.message;
      }
      button.disabled = false;
      button.textContent = "Create user";
    }
  };
}
async function editUserAssignments(userId) {
  const assigned = await api.userCourses(userId),
    u = state.users.find(x => x.id === userId),
    assignedById = new Map(assigned.map(c => [c.id, c]));
  dialog(
    `<h2>${esc(
      u.name
    )}</h2><form id="userAssignmentForm"><div class="tabs user-modal-tabs"><button type="button" class="active" data-user-tab="details">User Details</button><button type="button" data-user-tab="courses">Courses</button></div><section class="user-tab-panel user-details-grid" data-user-panel="details"><label>Name<input id="editUserName" value="${esc(
      u.name
    )}" required maxlength="120"></label><label>Role<select id="editUserRole"><option value="Basic" ${
      u.role === "Basic" ? "selected" : ""
    }>Basic</option><option value="Admin" ${
      u.role === "Admin" ? "selected" : ""
    }>Admin</option><option value="Pending" ${
      u.role === "Pending" ? "selected" : ""
    }>Pending</option></select></label><label class="user-detail-wide">Email<input id="editUserEmail" type="email" value="${esc(
      u.email
    )}" required></label><label class="user-detail-wide">New password<input id="editUserPassword" type="password" minlength="8" maxlength="72" autocomplete="new-password"></label><label class="user-detail-wide">Confirm new password<input id="editUserConfirmPassword" type="password" minlength="8" maxlength="72" autocomplete="new-password"></label></section><section class="user-tab-panel" data-user-panel="courses" hidden><div class="course-checklist"><h3>Assigned courses</h3>${
      state.courses.length
        ? state.courses
            .map(c => {
              const a = assignedById.get(c.id),
                completed =
                  !!a &&
                  a.total_lessons > 0 &&
                  a.completed_lessons === a.total_lessons;
              return `<label class="course-check assignment-course" data-completed="${completed}"><input type="checkbox" value="${
                c.id
              }" ${
                a ? "checked" : ""
              }><span class="assignment-course-copy"><strong>${esc(
                c.course_title
              )}</strong>${
                a
                  ? `<small>${a.completed_lessons} of ${a.total_lessons} lessons complete</small>`
                  : "<small>Not needed</small>"
              }</span><span class="assignment-status">${
                completed
                  ? `<span class="completed-tag">Completed</span><small class="completion-date">${esc(
                      formatDate(a.completion_time)
                    )}</small>`
                  : '<span class="incomplete-tag">Not completed</span>'
              }</span></label>`;
            })
            .join("")
        : "<p>No courses are available.</p>"
    }</div></section><p id="userEditError" class="error"></p><div class="modal-actions user-form-actions"><button id="deleteUser" class="danger" type="button">Delete user</button><button class="primary">Save changes</button></div></form>`
  );
  bindUserModalTabs();
  $("#deleteUser").onclick = async () => {
    if (
      await confirmAction(
        "Permanently delete this user?",
        `Are you sure you want to delete ${u.name} (${u.email})? This will permanently remove their account, course assignments, lesson-completion history, and ALL records associated with this user from the database. This action cannot be undone.`,
        "Permanently delete user"
      )
    ) {
      try {
        await api.deleteUser(userId);
        closeDialog();
        await loadUsers();
        toast("User deleted");
      } catch (x) {
        $("#userEditError").textContent = x.message;
      }
    }
  };
  $("#userAssignmentForm").onsubmit = async e => {
    e.preventDefault();
    const password = $("#editUserPassword").value,
      confirmation = $("#editUserConfirmPassword").value,
      error = $("#userEditError");
    error.textContent = "";
    if ((password || confirmation) && password !== confirmation) {
      error.textContent = "Passwords do not match.";
      return;
    }
    const selected = new Set(
        $$(".course-check input:checked").map(x => Number(x.value))
      ),
      toAdd = state.courses.filter(
        c => selected.has(c.id) && !assignedById.has(c.id)
      ),
      toRemove = assigned.filter(c => !selected.has(c.id));
    for (const course of toRemove) {
      if (!(await confirmCourseRemoval(u, course))) {
        await editUserAssignments(userId);
        return;
      }
    }
    try {
      await api.updateUser(userId, {
        name: $("#editUserName").value.trim(),
        email: $("#editUserEmail").value.trim(),
        role: $("#editUserRole").value
      });
      if (password) await api.resetPassword(userId, password);
      for (const course of toAdd) await api.assign(userId, course.id);
      for (const course of toRemove) await api.unassign(userId, course.id);
      closeDialog();
      await loadUsers();
      toast("User details and course assignments saved");
    } catch (x) {
      error.textContent = x.message;
    }
  };
}
function openUserSettings() {
  const u = state.user;
  dialog(
    `<h2 class="settings-email-title">${esc(
      u.email
    )}</h2><form id="userSettingsForm"><label>Name<input id="settingsName" value="${esc(
      u.name
    )}" required maxlength="120"></label><label>New password<input id="settingsPassword" type="password" minlength="8" maxlength="72" autocomplete="new-password"></label><label>Confirm new password<input id="settingsConfirmPassword" type="password" minlength="8" maxlength="72" autocomplete="new-password"></label><p id="settingsError" class="error"></p><button class="primary">Save settings</button></form>`
  );
  $("#userSettingsForm").onsubmit = async e => {
    e.preventDefault();
    const name = $("#settingsName").value.trim(),
      password = $("#settingsPassword").value,
      confirmation = $("#settingsConfirmPassword").value,
      error = $("#settingsError");
    error.textContent = "";
    if ((password || confirmation) && password !== confirmation) {
      error.textContent = "Passwords do not match.";
      return;
    }
    if (password && password.length < 8) {
      error.textContent = "Password must be at least 8 characters.";
      return;
    }
    try {
      state.user = await api.updateMe({ name, email: u.email });
      if (password) await api.resetPassword(u.id, password);
      $("#welcome").textContent = "My Training Courses";
      closeDialog();
      toast(password ? "Name and password updated" : "Name updated");
    } catch (x) {
      error.textContent = x.message;
    }
  };
}

async function enter(user) {
  state.user = user;
  $("#resendVerification").hidden = true;
  $("#resendVerification").dataset.email = "";
  hideAuth();
  $("#welcome").textContent = "My Training Courses";
  $("#adminNav").hidden = user.role !== "Admin";
  $("#userSettingsNav").hidden = false;
  await Promise.all([
    loadCourses(),
    user.role === "Admin" ? loadLessons() : Promise.resolve()
  ]);
}
$("#loginForm").onsubmit = async e => {
  e.preventDefault();
  try {
    await enter(
      await api.login($("#loginEmail").value, $("#loginPassword").value)
    );
  } catch (x) {
    showAuth(x.message);
    if (x.status === 403) {
      $("#resendVerification").dataset.email = $("#loginEmail").value.trim();
      $("#resendVerification").hidden = false;
    }
  }
};
function showLoginPanel() {
  $("#authTabs").hidden = false;
  $("#loginForm").hidden = false;
  $("#signupForm").hidden = true;
  $("#forgotPasswordForm").hidden = true;
  $("#resetPasswordForm").hidden = true;
  $("#forgotPasswordForm").reset();
  $("#forgotPasswordError").textContent = "";
  $("#loginTab").classList.add("active");
  $("#signupTab").classList.remove("active");
}
$("#forgotPasswordLink").onclick = () => {
  $("#authTabs").hidden = true;
  $("#loginForm").hidden = true;
  $("#signupForm").hidden = true;
  $("#forgotPasswordForm").hidden = false;
  $("#forgotPasswordEmail").value = $("#loginEmail").value.trim();
  $("#forgotPasswordEmail").focus();
};
$("#resendVerification").onclick = async e => {
  const button = e.currentTarget,
    email = button.dataset.email || $("#loginEmail").value.trim(),
    notice = $("#authNotice");
  if (!email) return;
  button.disabled = true;
  button.textContent = "Sending…";
  $("#authError").textContent = "";
  try {
    await api.resendVerification(email);
    notice.textContent =
      "A new verification email has been sent. Check your inbox and spam folder.";
    notice.hidden = false;
  } catch (x) {
    $("#authError").textContent = x.message;
  } finally {
    button.disabled = false;
    button.textContent = "Resend verification email";
  }
};
$$(".back-to-login").forEach(button => (button.onclick = showLoginPanel));
$("#forgotPasswordForm").onsubmit = async e => {
  e.preventDefault();
  const error = $("#forgotPasswordError"),
    button = e.target.querySelector(".primary");
  error.textContent = "";
  button.disabled = true;
  button.textContent = "Sending…";
  try {
    await api.forgotPassword($("#forgotPasswordEmail").value.trim());
    showLoginPanel();
    toast("If that account exists, a reset link has been sent");
  } catch (x) {
    error.textContent = x.message;
  } finally {
    button.disabled = false;
    button.textContent = "Send reset link";
  }
};
$("#resetPasswordForm").onsubmit = async e => {
  e.preventDefault();
  const password = $("#resetPassword").value,
    confirmation = $("#resetPasswordConfirm").value,
    error = $("#resetPasswordError"),
    token = new URLSearchParams(location.search).get("reset_token"),
    button = e.target.querySelector(".primary");
  error.textContent = "";
  if (password !== confirmation) {
    error.textContent = "Passwords do not match.";
    return;
  }
  if (!token) {
    error.textContent = "This password reset link is invalid.";
    return;
  }
  button.disabled = true;
  button.textContent = "Saving…";
  try {
    await api.completePasswordReset(token, password);
    history.replaceState({}, "", location.pathname);
    e.target.reset();
    showLoginPanel();
    toast("Password updated. You can now log in.");
  } catch (x) {
    error.textContent = x.message;
  } finally {
    button.disabled = false;
    button.textContent = "Save new password";
  }
};
$("#signupForm").onsubmit = async e => {
  e.preventDefault();
  const email = $("#signupEmail").value.trim(),
    confirmEmail = $("#signupConfirmEmail").value.trim(),
    password = $("#signupPassword").value,
    confirmPassword = $("#signupConfirmPassword").value,
    error = $("#signupError");
  error.textContent = "";
  if (email.toLowerCase() !== confirmEmail.toLowerCase()) {
    error.textContent = "Email addresses do not match.";
    return;
  }
  if (password !== confirmPassword) {
    error.textContent = "Passwords do not match.";
    return;
  }
  try {
    await api.register($("#signupName").value, email, password);
    e.target.reset();
    $("#loginTab").click();
    const notice = $("#authNotice");
    notice.textContent = "Check your email for a verification email before logging in.";
    notice.hidden = false;
    $("#resendVerification").dataset.email = email;
    $("#resendVerification").hidden = false;
  } catch (x) {
    error.textContent = x.message;
  }
};
$("#loginTab").onclick = () => {
  showLoginPanel();
  $("#signupForm").reset();
  $("#signupError").textContent = "";
};
$("#signupTab").onclick = () => {
  $("#authNotice").hidden = true;
  $("#authNotice").textContent = "";
  $("#resendVerification").hidden = true;
  $("#resendVerification").dataset.email = "";
  $("#authTabs").hidden = false;
  $("#loginForm").hidden = true;
  $("#signupForm").hidden = false;
  $("#forgotPasswordForm").hidden = true;
  $("#resetPasswordForm").hidden = true;
  $("#signupForm").reset();
  $("#signupError").textContent = "";
  $("#signupTab").classList.add("active");
  $("#loginTab").classList.remove("active");
};
$("#logoutBtn").onclick = async () => {
  await api.logout();
  state.user = null;
  $("#adminNav").hidden = true;
  $("#userSettingsNav").hidden = true;
  showAuth();
};
$("#userSettingsNav").onclick = openUserSettings;
$("#closeDialog").onclick = closeDialog;
$("#adminNewCourse").onclick = () => courseForm();
$("#newLesson").onclick = () => lessonForm();
$("#newUser").onclick = newUserForm;
$("#coursesNav").onclick = () => {
  $("#coursesView").hidden = false;
  $("#adminView").hidden = true;
};
$("#adminNav").onclick = async () => {
  $("#coursesView").hidden = true;
  $("#adminView").hidden = false;
  await Promise.all([loadUsers(), loadLessons()]);
};
$$("[data-tab]").forEach(
  b =>
    (b.onclick = () => {
      $$("[data-tab]").forEach(x => x.classList.toggle("active", x === b));
      $("#adminCourses").hidden = b.dataset.tab !== "courses";
      $("#adminLessons").hidden = b.dataset.tab !== "lessons";
      $("#adminUsers").hidden = b.dataset.tab !== "users";
    })
);
(async () => {
  const params = new URLSearchParams(location.search),
    token = params.get("verify_token"),
    resetToken = params.get("reset_token");
  if (resetToken) {
    showAuth();
    $("#authTabs").hidden = true;
    $("#loginForm").hidden = true;
    $("#signupForm").hidden = true;
    $("#forgotPasswordForm").hidden = true;
    $("#resetPasswordForm").hidden = false;
    $("#resetPassword").focus();
    return;
  }
  try {
    if (token) {
      await api.verify(token);
      history.replaceState({}, "", location.pathname);
      showLoginPanel();
      showAuth();
      const notice = $("#authNotice");
      notice.textContent = "Your email has been verified. Please log in.";
      notice.hidden = false;
      return;
    }
    await enter(await api.me());
  } catch {
    showAuth();
  }
})();
