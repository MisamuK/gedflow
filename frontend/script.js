
/* ========================================
   CONFIGURATION
======================================== */

const API_URL = "http://127.0.0.1:8000";

let allDocuments = [];
let allProjects = [];


/* ========================================
   OUTILS
======================================== */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function formatDate(dateValue) {
    if (!dateValue) return "—";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("fr-FR");
}


/* ========================================
   DASHBOARD
======================================== */

async function loadDashboard() {
    try {
        const response = await fetch(`${API_URL}/api/dashboard`);

        if (!response.ok) {
            throw new Error("Impossible de charger le dashboard.");
        }

        const data = await response.json();

        document.getElementById("total-documents").textContent =
            data.total_documents ?? 0;

        document.getElementById("total-projects").textContent =
            data.total_projects ?? 0;

        document.getElementById("total-users").textContent =
            data.total_users ?? 0;

        document.getElementById("storage-used").textContent =
            data.storage_used ?? "0 Mo";

    } catch (error) {
        console.error("Erreur dashboard :", error);
    }
}


/* ========================================
   GESTION DES PROJETS
======================================== */

async function loadProjects() {
    try {
        const response = await fetch(`${API_URL}/api/projects/`);

        if (!response.ok) {
            throw new Error("Impossible de charger les projets.");
        }

        allProjects = await response.json();

        renderProjects();

    } catch (error) {
        console.error("Erreur projets :", error);

        document.getElementById("projects-list").innerHTML = `
            <tr>
                <td colspan="4">Erreur lors du chargement des projets.</td>
            </tr>
        `;
    }
}


function renderProjects() {
    const projectLists = [
        document.getElementById("projects-list"),
        document.getElementById("projects-page-list")
    ].filter(Boolean);

    projectLists.forEach(projectsList => {
        projectsList.innerHTML = "";

        if (allProjects.length === 0) {
            projectsList.innerHTML = `
                <tr>
                    <td colspan="4">Aucun projet enregistré.</td>
                </tr>
            `;
            return;
        }

        allProjects.forEach(project => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${escapeHTML(project.name)}</td>
                <td>${escapeHTML(project.reference)}</td>
                <td>${escapeHTML(project.status)}</td>
                <td>
                    <button class="edit-button" data-action="edit">
                        Modifier
                    </button>

                    <button class="delete-button" data-action="delete">
                        Supprimer
                    </button>
                </td>
            `;

            row.querySelector('[data-action="edit"]').addEventListener(
                "click",
                () => editProject(project)
            );

            row.querySelector('[data-action="delete"]').addEventListener(
                "click",
                () => deleteProject(project)
            );

            projectsList.appendChild(row);
        });
    });
}


/* ========================================
   MODALE PROJET
======================================== */

const projectModal = document.getElementById("project-modal");
const projectForm = document.getElementById("project-form");

const projectModalTitle = document.getElementById("project-modal-title");

const projectSubmitButton = projectForm.querySelector(
    'button[type="submit"]'
);


function openProjectModal() {
    projectForm.reset();
    delete projectForm.dataset.projectId;

    projectModalTitle.textContent = "Nouveau projet";
    projectSubmitButton.textContent = "Enregistrer le projet";

    projectModal.style.display = "flex";
}

document.getElementById("open-project-modal-page").addEventListener(
    "click",
    openProjectModal
);

function closeProjectModal() {
    projectModal.style.display = "none";
    projectForm.reset();
    delete projectForm.dataset.projectId;
}


document.getElementById("open-project-modal").addEventListener(
    "click",
    openProjectModal
);

document.getElementById("close-project-modal").addEventListener(
    "click",
    closeProjectModal
);

document.getElementById("cancel-project").addEventListener(
    "click",
    closeProjectModal
);


function editProject(project) {
    projectForm.dataset.projectId = project.id;

    document.getElementById("project-name").value = project.name;
    document.getElementById("project-reference").value = project.reference;
    document.getElementById("project-description").value =
        project.description || "";

    document.getElementById("project-status").value =
        project.status || "En cours";

    projectModalTitle.textContent = "Modifier le projet";
    projectSubmitButton.textContent = "Enregistrer les modifications";

    projectModal.style.display = "flex";
}


/* ========================================
   ENREGISTRER UN PROJET
======================================== */

projectForm.addEventListener("submit", async event => {
    event.preventDefault();

    const projectId = projectForm.dataset.projectId;

    const projectData = {
        name: document.getElementById("project-name").value.trim(),
        reference: document.getElementById("project-reference").value.trim(),
        description: document.getElementById("project-description").value.trim(),
        status: document.getElementById("project-status").value
    };

    if (!projectData.name || !projectData.reference) {
        alert("Veuillez remplir les champs obligatoires.");
        return;
    }

    const url = projectId
        ? `${API_URL}/api/projects/${projectId}`
        : `${API_URL}/api/projects/`;

    const method = projectId ? "PUT" : "POST";

    try {
        const response = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(projectData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.detail || "Impossible d'enregistrer le projet."
            );
        }

        alert(
            projectId
                ? "Projet modifié avec succès."
                : "Projet créé avec succès."
        );

        closeProjectModal();

        await loadProjects();
        await loadDashboard();
        await loadDocumentProjects();

    } catch (error) {
        console.error("Erreur enregistrement projet :", error);
        alert(error.message);
    }
});


/* ========================================
   SUPPRIMER UN PROJET
======================================== */

async function deleteProject(project) {
    const confirmed = confirm(
        `Voulez-vous vraiment supprimer le projet "${project.name}" ?`
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            `${API_URL}/api/projects/${project.id}`,
            {
                method: "DELETE"
            }
        );

        if (!response.ok) {
            const result = await response.json();
            throw new Error(
                result.detail || "Impossible de supprimer ce projet."
            );
        }

        alert("Projet supprimé avec succès.");

        await loadProjects();
        await loadDashboard();
        await loadDocuments();
        await loadDocumentProjects();

    } catch (error) {
        console.error("Erreur suppression projet :", error);
        alert(error.message);
    }
}


/* ========================================
   NAVIGATION
======================================== */

const navLinks = document.querySelectorAll(".nav-link");

const dashboardSection = document.getElementById("dashboard-section");
const projectsSection = document.getElementById("projects-section");
const documentsSection = document.getElementById("documents-section");

navLinks.forEach(link => {
    link.addEventListener("click", event => {
        event.preventDefault();

        const section = link.dataset.section;

        // Mettre à jour le menu actif
        navLinks.forEach(item => item.classList.remove("active"));
        link.classList.add("active");

        // Afficher la bonne section
        dashboardSection.style.display =
            section === "dashboard" ? "block" : "none";

        projectsSection.style.display =
            section === "projects" ? "block" : "none";

        documentsSection.style.display =
            section === "documents" ? "block" : "none";

        // Charger les données nécessaires
        if (section === "dashboard") {
            loadDashboard();
        }

        if (section === "projects") {
            loadProjects();
        }

        if (section === "documents") {
            loadDocuments();
            loadDocumentProjects();
        }
    });
});


/* ========================================
   GESTION DES DOCUMENTS
======================================== */

/* ========================================
   REMPLIR LES FILTRES
======================================== */
function getDocumentType(doc) {
    const filename = doc.filename || doc.title || "";
    const extension = filename.split(".").pop().toLowerCase();

    const mimeTypes = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
        "application/vnd.ms-excel": "xls"
    };

    const fileType = (doc.file_type || "").toLowerCase().trim();

    return mimeTypes[fileType] || fileType.replace(".", "") || extension;
}

function populateDocumentFilters() {

    const typeFilter = document.getElementById("filter-document-type");
    const projectFilter = document.getElementById("filter-document-project");

    const selectedType = typeFilter.value;
    const selectedProject = projectFilter.value;

    // FILTRE PAR TYPE
    const types = [...new Set(
    allDocuments
        .map(doc => getDocumentType(doc))
        .filter(Boolean)
)];

    typeFilter.innerHTML = '<option value="">Tous les types</option>';

    types.forEach(type => {
        const option = document.createElement("option");

        option.value = type;
        option.textContent = type.toUpperCase();

        typeFilter.appendChild(option);
    });

    // FILTRE PAR PROJET
    const projects = [...new Map(
        allDocuments
            .filter(doc => doc.project_id && doc.project_name)
            .map(doc => [
                String(doc.project_id),
                {
                    id: doc.project_id,
                    name: doc.project_name
                }
            ])
    ).values()];

    projectFilter.innerHTML = '<option value="">Tous les projets</option>';

    projects.forEach(project => {
        const option = document.createElement("option");

        option.value = project.id;
        option.textContent = project.name;

        projectFilter.appendChild(option);
    });

    // CONSERVER LES SÉLECTIONS SI ELLES EXISTENT ENCORE
    if (types.includes(selectedType)) {
        typeFilter.value = selectedType;
    }

    if (projects.some(project => String(project.id) === selectedProject)) {
        projectFilter.value = selectedProject;
    }
}

async function loadDocuments() {
    try {
        const response = await fetch(`${API_URL}/api/documents/`);

        if (!response.ok) {
            throw new Error("Impossible de charger les documents.");
        }

        allDocuments = await response.json();

// Remplir les filtres
populateDocumentFilters();

// Afficher les documents
applyDocumentFilters();

    } catch (error) {
        console.error("Erreur documents :", error);

        document.getElementById("documents-list").innerHTML = `
            <tr>
                <td colspan="5">Erreur lors du chargement des documents.</td>
            </tr>
        `;
    }
}


/* ========================================
   AFFICHER LES DOCUMENTS
======================================== */

function renderDocuments(documents) {
    const documentsList = document.getElementById("documents-list");

    documentsList.innerHTML = "";

    if (documents.length === 0) {
        documentsList.innerHTML = `
            <tr>
                <td colspan="5">Aucun document trouvé.</td>
            </tr>
        `;
        return;
    }

    documents.forEach(doc => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${escapeHTML(doc.title)}</td>
            <td>${escapeHTML(doc.file_type)}</td>
            <td>${escapeHTML(doc.project_name || "Aucun projet")}</td>
            <td>${formatDate(doc.uploaded_at)}</td>
            <td></td>
        `;

        const actionsCell = row.querySelector("td:last-child");
        
        // Bouton Modifier
const editButton = document.createElement("button");

editButton.textContent = "Modifier";
editButton.className = "edit-button";

editButton.addEventListener("click", () => {
    openEditDocumentModal(doc);
});
        // Bouton Ouvrir
        const openButton = document.createElement("button");
        openButton.textContent = "Ouvrir";
        openButton.className = "secondary-button";

        openButton.addEventListener("click", () => {
            window.open(
                `${API_URL}/api/documents/${doc.id}/open`,
                "_blank"
            );
        });


        // Bouton Télécharger
        const downloadButton = document.createElement("button");
        downloadButton.textContent = "Télécharger";
        downloadButton.className = "secondary-button";

        downloadButton.addEventListener("click", () => {
            const link = document.createElement("a");

            link.href =
                `${API_URL}/api/documents/${doc.id}/download`;

            link.download = doc.filename;

            document.body.appendChild(link);
            link.click();
            link.remove();
        });


        // Bouton Supprimer
        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Supprimer";
        deleteButton.className = "delete-button";

        deleteButton.addEventListener("click", async () => {
            const confirmed = confirm(
                `Voulez-vous vraiment supprimer le document "${doc.title}" ? Cette action est définitive.`
            );

            if (!confirmed) return;

            try {
                const response = await fetch(
                    `${API_URL}/api/documents/${doc.id}`,
                    {
                        method: "DELETE"
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.detail || "Erreur lors de la suppression."
                    );
                }

                alert(result.message || "Document supprimé avec succès.");

                await loadDocuments();
                await loadDashboard();

            } catch (error) {
                console.error("Erreur suppression document :", error);
                alert(error.message);
            }
        });


        actionsCell.append(
            editButton,
            openButton,
            downloadButton,
            deleteButton
        );

        documentsList.appendChild(row);
    });
}


/* ========================================
   RECHERCHE ET FILTRES
======================================== */

function applyDocumentFilters() {

    const searchValue = document.getElementById("document-search")
        .value.toLowerCase().trim();

    const selectedType = document.getElementById("filter-document-type")
        .value;

    const selectedProject = document.getElementById("filter-document-project")
        .value;

    const filteredDocuments = allDocuments.filter(doc => {

        const title = (doc.title || "").toLowerCase();
        const filename = (doc.filename || "").toLowerCase();

        const type = (doc.file_type || "")
            .toLowerCase()
            .replace(".", "");

        const project = (doc.project_name || "").toLowerCase();

        const matchesSearch =
            title.includes(searchValue) ||
            filename.includes(searchValue) ||
            type.includes(searchValue) ||
            project.includes(searchValue);

        const matchesType =
            !selectedType || getDocumentType(doc) === selectedType;

        const matchesProject =
            !selectedProject ||
            String(doc.project_id) === selectedProject;

        return matchesSearch && matchesType && matchesProject;
    });

    renderDocuments(filteredDocuments);
}


// Recherche par texte
document.getElementById("document-search").addEventListener(
    "input",
    applyDocumentFilters
);


// Filtre par type
document.getElementById("filter-document-type").addEventListener(
    "change",
    applyDocumentFilters
);


// Filtre par projet
document.getElementById("filter-document-project").addEventListener(
    "change",
    applyDocumentFilters
);


/* ========================================
   MODALE DOCUMENT
======================================== */

const documentModal = document.getElementById("document-modal");
const documentForm = document.getElementById("document-form");


function openDocumentModal() {
    documentForm.reset();
    documentModal.style.display = "flex";
    loadDocumentProjects();
}


function closeDocumentModal() {
    documentModal.style.display = "none";
    documentForm.reset();
}


document.getElementById("open-document-modal").addEventListener(
    "click",
    openDocumentModal
);

document.getElementById("close-document-modal").addEventListener(
    "click",
    closeDocumentModal
);

document.getElementById("cancel-document").addEventListener(
    "click",
    closeDocumentModal
);


/* ========================================
   CHARGER LES PROJETS DANS LE FORMULAIRE
======================================== */

async function loadDocumentProjects() {
    const select = document.getElementById("document-project");

    try {
        const response = await fetch(`${API_URL}/api/projects/`);

        if (!response.ok) {
            throw new Error("Impossible de charger les projets.");
        }

        const projects = await response.json();

        select.innerHTML = `
            <option value="">Aucun projet associé</option>
        `;

        projects.forEach(project => {
            const option = document.createElement("option");

            option.value = project.id;
            option.textContent =
                `${project.name} (${project.reference})`;

            select.appendChild(option);
        });

    } catch (error) {
        console.error("Erreur chargement projets :", error);
    }
}


/* ========================================
   IMPORTER UN DOCUMENT
======================================== */

documentForm.addEventListener("submit", async event => {
    event.preventDefault();

    const title = document.getElementById("document-title").value.trim();
    const projectId = document.getElementById("document-project").value;
    const file = document.getElementById("document-file").files[0];

    if (!title || !file) {
        alert("Veuillez renseigner le titre et sélectionner un fichier.");
        return;
    }

    const formData = new FormData();

    formData.append("title", title);
    formData.append("file", file);

    if (projectId) {
        formData.append("project_id", projectId);
    }

    try {
        const response = await fetch(
            `${API_URL}/api/documents/`,
            {
                method: "POST",
                body: formData
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.detail || "Erreur lors de l'importation."
            );
        }

        alert("Document importé avec succès !");

        closeDocumentModal();

        await loadDocuments();
        await loadDashboard();

    } catch (error) {
        console.error("Erreur importation :", error);
        alert(error.message);
    }
});


/* ========================================
   FERMETURE DES MODALES EN CLIQUANT DEHORS
======================================== */

projectModal.addEventListener("click", event => {
    if (event.target === projectModal) {
        closeProjectModal();
    }
});

documentModal.addEventListener("click", event => {
    if (event.target === documentModal) {
        closeDocumentModal();
    }
});

/* ========================================
   MODIFIER UN DOCUMENT
======================================== */

const editDocumentModal = document.getElementById("edit-document-modal");
const editDocumentForm = document.getElementById("edit-document-form");

const editDocumentTitle = document.getElementById("edit-document-title");
const editDocumentProject = document.getElementById("edit-document-project");

let currentDocumentId = null;


// Ouvrir la fenêtre de modification
async function openEditDocumentModal(doc) {

    currentDocumentId = doc.id;

    editDocumentTitle.value = doc.title || "";

    await loadEditDocumentProjects();

    editDocumentProject.value = doc.project_id
        ? String(doc.project_id)
        : "";

    editDocumentModal.style.display = "flex";
}


// Charger les projets dans la liste
async function loadEditDocumentProjects() {

    try {
        const response = await fetch(`${API_URL}/api/projects/`);

        if (!response.ok) {
            throw new Error("Impossible de charger les projets.");
        }

        const projects = await response.json();

        editDocumentProject.innerHTML = `
            <option value="">Aucun projet associé</option>
        `;

        projects.forEach(project => {
            const option = document.createElement("option");

            option.value = project.id;
            option.textContent = `${project.name} (${project.reference})`;

            editDocumentProject.appendChild(option);
        });

    } catch (error) {
        console.error("Erreur chargement projets :", error);
        alert(error.message);
    }
}


// Fermer la fenêtre
function closeEditDocumentModal() {
    editDocumentModal.style.display = "none";
    editDocumentForm.reset();
    currentDocumentId = null;
}


document.getElementById("close-edit-document-modal").addEventListener(
    "click",
    closeEditDocumentModal
);

document.getElementById("cancel-edit-document").addEventListener(
    "click",
    closeEditDocumentModal
);


// Enregistrer les modifications
editDocumentForm.addEventListener("submit", async event => {

    event.preventDefault();

    if (!currentDocumentId) return;

    const documentData = {
        title: editDocumentTitle.value.trim(),
        project_id: editDocumentProject.value
            ? Number(editDocumentProject.value)
            : null
    };

    try {
        const response = await fetch(
            `${API_URL}/api/documents/${currentDocumentId}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(documentData)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.detail || "Impossible de modifier le document."
            );
        }

        alert("Document modifié avec succès !");

        closeEditDocumentModal();

        await loadDocuments();
        await loadDashboard();

    } catch (error) {
        console.error("Erreur modification document :", error);
        alert(error.message);
    }
});


// Fermer en cliquant à l'extérieur
editDocumentModal.addEventListener("click", event => {
    if (event.target === editDocumentModal) {
        closeEditDocumentModal();
    }
});

/* ========================================
   INITIALISATION
======================================== */

loadDashboard();
loadProjects();
