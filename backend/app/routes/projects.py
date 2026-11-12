
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict

from app.database import SessionLocal
from app.models import Project

router = APIRouter(prefix="/api/projects", tags=["Projets"])


# Connexion à la base de données
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Schéma de création et modification
class ProjectCreate(BaseModel):
    name: str
    reference: str
    description: str | None = None
    status: str = "En cours"


class ProjectResponse(ProjectCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


# 1. Afficher tous les projets
@router.get("/", response_model=list[ProjectResponse])
def get_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.id.desc()).all()


# 2. Ajouter un projet
@router.post("/", response_model=ProjectResponse, status_code=201)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):

    existing = db.query(Project).filter(
        Project.reference == project.reference
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Cette référence de projet existe déjà."
        )

    new_project = Project(**project.model_dump())

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    return new_project


# 3. Modifier un projet
@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    project: ProjectCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not existing:
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    if project.reference != existing.reference:
        duplicate = db.query(Project).filter(
            Project.reference == project.reference
        ).first()

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="Cette référence existe déjà."
            )

    for key, value in project.model_dump().items():
        setattr(existing, key, value)

    db.commit()
    db.refresh(existing)

    return existing


# 4. Supprimer un projet
@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):

    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable.")

    db.delete(project)
    db.commit()

    return {"message": "Projet supprimé avec succès."}
