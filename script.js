const API_BASE = (() => {
	const configuredBase = document
		.querySelector('meta[name="api-base"]')
		?.getAttribute("content");

	if (configuredBase) {
		return configuredBase.replace(/\/$/, "");
	}

	const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
	return isLocalhost ? "http://localhost:3000/api" : "/api";
})();

const studentForm = document.getElementById("studentForm");
const studentsTableBody = document.getElementById("studentsTableBody");
const submitBtn = document.getElementById("submitBtn");
const modalTitle = document.getElementById("modalTitle");
const studentModal = document.getElementById("studentModal");
const openModalBtn = document.getElementById("openModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const searchInput = document.getElementById("searchInput");
const exportBtn = document.getElementById("exportBtn");
const rowCountText = document.getElementById("rowCountText");
const selectAllRows = document.getElementById("selectAllRows");

let editingStudentId = null;
let cachedStudents = [];
let filteredStudents = [];

document.addEventListener("DOMContentLoaded", () => {
	wireEvents();
	fetchStudents();
});

function wireEvents() {
	studentForm.addEventListener("submit", handleSubmit);
	studentsTableBody.addEventListener("click", handleTableActions);
	openModalBtn.addEventListener("click", () => openModal());
	closeModalBtn.addEventListener("click", closeModal);
	studentModal.addEventListener("click", (event) => {
		if (event.target.dataset.close === "modal") {
			closeModal();
		}
	});
	searchInput.addEventListener("input", applySearch);
	exportBtn.addEventListener("click", exportData);
	selectAllRows.addEventListener("change", toggleAllRows);
}

async function fetchStudents() {
	try {
		const response = await fetch(`${API_BASE}/users`);
		if (!response.ok) {
			throw new Error("Unable to fetch students");
		}

		const data = await response.json();
		cachedStudents = Array.isArray(data) ? data : [];
		filteredStudents = [...cachedStudents];
		renderStudents(filteredStudents);
	} catch (error) {
		alert(error.message || "Failed to load students");
	}
}

function applySearch() {
	const query = searchInput.value.trim().toLowerCase();

	if (!query) {
		filteredStudents = [...cachedStudents];
		renderStudents(filteredStudents);
		return;
	}

	filteredStudents = cachedStudents.filter((student) => {
		const hobbies = normalizeHobbies(student.hobbies).join(" ");
		const haystack = [
			student.name,
			student.email,
			student.userId,
			student.bio,
			String(student.age ?? ""),
			hobbies
		]
			.join(" ")
			.toLowerCase();

		return haystack.includes(query);
	});

	renderStudents(filteredStudents);
}

async function handleSubmit(event) {
	event.preventDefault();
	if (editingStudentId) {
		await updateStudent(editingStudentId);
		return;
	}
	await addStudent();
}

async function addStudent() {
	const payload = buildPayloadFromForm();

	try {
		const response = await fetch(`${API_BASE}/addUser`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		});

		const body = await parseJsonSafe(response);
		if (!response.ok) {
			throw new Error(readErrorMessage(body, "Unable to add student."));
		}

		resetForm();
		closeModal();
		await fetchStudents();
	} catch (error) {
		alert(error.message || "Add student failed");
	}
}

function editStudent(id) {
	const student = cachedStudents.find((item) => getStudentId(item) === id);
	if (!student) {
		alert("Student not found");
		return;
	}

	document.getElementById("name").value = student.name || "";
	document.getElementById("email").value = student.email || "";
	document.getElementById("age").value = student.age ?? "";
	document.getElementById("hobbies").value = normalizeHobbies(student.hobbies).join(", ");
	document.getElementById("bio").value = student.bio || "";
	document.getElementById("userId").value = student.userId || "";

	editingStudentId = id;
	submitBtn.textContent = "Update Student";
	modalTitle.textContent = "Edit Student";
	openModal();
}

async function updateStudent(id) {
	const payload = buildPayloadFromForm();

	try {
		const response = await fetch(`${API_BASE}/updateUser/${id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		});

		const body = await parseJsonSafe(response);
		if (!response.ok) {
			throw new Error(readErrorMessage(body, "Unable to update student."));
		}

		resetForm();
		closeModal();
		await fetchStudents();
	} catch (error) {
		alert(error.message || "Update student failed");
	}
}

async function deleteStudent(id) {
	try {
		const response = await fetch(`${API_BASE}/deleteUser/${id}`, { method: "DELETE" });
		const body = await parseJsonSafe(response);

		if (!response.ok) {
			throw new Error(readErrorMessage(body, "Unable to delete student."));
		}

		if (editingStudentId === id) {
			resetForm();
		}

		await fetchStudents();
	} catch (error) {
		alert(error.message || "Delete student failed");
	}
}

function buildPayloadFromForm() {
	return {
		name: document.getElementById("name").value.trim(),
		email: document.getElementById("email").value.trim(),
		age: Number(document.getElementById("age").value),
		hobbies: document.getElementById("hobbies").value.trim(),
		bio: document.getElementById("bio").value.trim(),
		userId: document.getElementById("userId").value.trim()
	};
}

function renderStudents(students) {
	if (!students.length) {
		studentsTableBody.innerHTML = '<tr><td colspan="8" class="empty-state">No records in node registry.</td></tr>';
		updateRowCount(0);
		return;
	}

	const rows = students
		.map((student) => {
			const id = getStudentId(student);
			const hobbies = normalizeHobbies(student.hobbies);
			const initials = getInitials(student.name);

			return `
				<tr>
					<td><input type="checkbox" class="row-check" data-id="${escapeHtml(id)}" aria-label="Select ${escapeHtml(student.name || "student")}"></td>
					<td>
						<div class="name-wrap">
							<span class="avatar">${escapeHtml(initials)}</span>
							<span>${escapeHtml(student.name)}</span>
							<span class="active-pill">Active</span>
						</div>
					</td>
					<td>${escapeHtml(student.email)}</td>
					<td>${escapeHtml(student.age)}</td>
					<td>
						<div class="hobby-pills">
							${hobbies.map((hobby) => `<span class="hobby-pill">${escapeHtml(hobby)}</span>`).join("")}
						</div>
					</td>
					<td class="bio-cell" title="${escapeHtml(student.bio)}">${escapeHtml(student.bio)}</td>
					<td>${escapeHtml(student.userId)}</td>
					<td>
						<div class="actions">
							<button class="icon-btn edit-icon" data-action="edit" data-id="${escapeHtml(id)}" title="Edit">
								<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>
							</button>
							<button class="icon-btn delete-icon" data-action="delete" data-id="${escapeHtml(id)}" title="Delete">
								<i class="fa-solid fa-trash-can" aria-hidden="true"></i>
							</button>
						</div>
					</td>
				</tr>
			`;
		})
		.join("");

	studentsTableBody.innerHTML = rows;
	updateRowCount(students.length);
}

function handleTableActions(event) {
	const actionBtn = event.target.closest("button[data-action]");
	if (!actionBtn) {
		return;
	}

	const id = actionBtn.dataset.id;
	if (!id) {
		return;
	}

	if (actionBtn.dataset.action === "edit") {
		editStudent(id);
		return;
	}

	if (confirm("Delete this student record?")) {
		deleteStudent(id);
	}
}

function updateRowCount(currentCount) {
	rowCountText.textContent = `Rows per page: 10 of ${currentCount} records`;
}

function exportData() {
	const source = filteredStudents.length ? filteredStudents : cachedStudents;
	if (!source.length) {
		alert("No records to export");
		return;
	}

	const csvRows = ["name,email,age,hobbies,bio,userId"];
	source.forEach((student) => {
		const hobbies = normalizeHobbies(student.hobbies).join("|");
		const fields = [student.name, student.email, student.age, hobbies, student.bio, student.userId]
			.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
			.join(",");
		csvRows.push(fields);
	});

	const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "students-export.csv";
	a.click();
	URL.revokeObjectURL(url);
}

function toggleAllRows() {
	const checks = document.querySelectorAll(".row-check");
	checks.forEach((check) => {
		check.checked = selectAllRows.checked;
	});
}

function openModal() {
	studentModal.classList.remove("hidden");
}

function closeModal() {
	studentModal.classList.add("hidden");
}

function resetForm() {
	studentForm.reset();
	editingStudentId = null;
	submitBtn.textContent = "Add New Student";
	modalTitle.textContent = "Add New Student";
}

function getStudentId(student) {
	return String(student?._id || student?.id || "");
}

function getInitials(name) {
	const text = String(name || "U").trim();
	const parts = text.split(/\s+/).filter(Boolean);
	if (!parts.length) {
		return "U";
	}
	return parts
		.slice(0, 2)
		.map((part) => part[0].toUpperCase())
		.join("");
}

function normalizeHobbies(hobbies) {
	if (Array.isArray(hobbies)) {
		return hobbies;
	}
	if (typeof hobbies === "string") {
		return hobbies.split(",").map((item) => item.trim()).filter(Boolean);
	}
	return [];
}

function escapeHtml(value) {
	const text = String(value ?? "");
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

async function parseJsonSafe(response) {
	try {
		return await response.json();
	} catch (_error) {
		return null;
	}
}

function readErrorMessage(body, fallback) {
	if (!body) {
		return fallback;
	}
	if (typeof body === "string") {
		return body;
	}
	if (body.message) {
		return body.message;
	}
	if (Array.isArray(body.errors)) {
		return body.errors.map((item) => item.msg || item.message || "Validation error").join("\n");
	}
	return fallback;
}
