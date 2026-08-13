(function () {
  const config = window.MedOptionsConfig;
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${config.API_BASE_URL}${path}`, {
        credentials: "include", signal: controller.signal,
        headers: {"Content-Type": "application/json", ...(options.headers || {})}, ...options,
      });
      const body = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) { const error = new Error(body?.detail || `Request failed (${response.status})`); error.status = response.status; throw error; }
      return body;
    } finally { clearTimeout(timer); }
  }
  const json = body => ({body: JSON.stringify(body)});
  window.api = {
    me: () => request("/auth/me"), updateMe: x => request("/users/me",{method:"PUT",...json(x)}), resetPassword: (id,new_password) => request(`/users/${id}/reset-password`,{method:"POST",...json({new_password})}), login: (email,password) => request("/auth/login", {method:"POST",...json({email,password})}),
    logout: () => request("/auth/logout", {method:"POST"}),
    register: (name,email,password) => request("/auth/register", {method:"POST",...json({name,email,password})}),
    verify: token => request("/auth/verify-email", {method:"POST",...json({token})}),
    courses: () => request("/courses"), createCourse: x => request("/courses",{method:"POST",...json(x)}),
    updateCourse: (id,x) => request(`/courses/${id}`,{method:"PUT",...json(x)}), deleteCourse: id => request(`/courses/${id}`,{method:"DELETE"}),
    lessons: () => request("/lessons"), createLesson: x => request("/lessons",{method:"POST",...json(x)}),
    updateLesson: (id,x) => request(`/lessons/${id}`,{method:"PUT",...json(x)}), deleteLesson: id => request(`/lessons/${id}`,{method:"DELETE"}),
    addLesson: (courseId,lesson_id,sequence) => request(`/courses/${courseId}/lessons`,{method:"POST",...json({lesson_id,sequence})}),
    removeLesson: (courseId,lessonId) => request(`/courses/${courseId}/lessons/${lessonId}`,{method:"DELETE"}), reorderLessons: (courseId,lesson_ids) => request(`/courses/${courseId}/lessons/order`,{method:"PUT",...json({lesson_ids})}),
    users: () => request("/users"), createUser: x => request("/users",{method:"POST",...json(x)}), updateUser: (id,x) => request(`/users/${id}`,{method:"PUT",...json(x)}), deleteUser: id => request(`/users/${id}`,{method:"DELETE"}),
    userCourses: id => request(`/users/${id}/courses`), assign: (u,c) => request(`/users/${u}/courses/${c}`,{method:"POST"}),
    unassign: (u,c) => request(`/users/${u}/courses/${c}`,{method:"DELETE"}),
    complete: (u,c,l) => request(`/users/${u}/courses/${c}/lessons/${l}/completion`,{method:"PUT"}),
  };
})();
