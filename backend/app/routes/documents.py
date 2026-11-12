
from pathlib import Path
from uuid import uuid4
import mimetypes

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import SessionLocal
from app.models import Document, Project


# ========================================
# CONFIGURATION
# ========================================

router = APIRouter(
    prefix="/api/documents",
    tags=["Documents"]
)

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".xls"}

MAX_FILE_SIZE = 20 * 1024 * 1024

# ========================================
# MODÈLE DE MODIFICATION
# ========================================

class DocumentUpdate(BaseModel):
    title: str
    project_id: int | None = None


# ========================================
# IMPORTER UN DOCUMENT
# ========================================

@router.post("/")
async def upload_document(
    title: str = Form(...),
    project_id: int | None = Form(None),
    file: UploadFile = File(...)
):
    db: Session = SessionLocal()

    try:
        extension = Path(file.filename or "").suffix.lower()

        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="Format non autorisé. Utilisez PDF, DOCX ou Excel."
            )

        if project_id is not None:
            project = db.query(Project).filter(
                Project.id == project_id
            ).first()

            if not project:
                raise HTTPException(
                    status_code=404,
                    detail="Projet introuvable."
                )

        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail="Le fichier est vide."
            )

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="Le fichier dépasse la limite de 20 Mo."
            )

        original_filename = Path(file.filename or "document").name

        stored_filename = f"{uuid4().hex}{extension}"

        file_path = UPLOAD_DIR / stored_filename

        file_path.write_bytes(content)

        document = Document(
            title=title,
            filename=original_filename,
            file_path=str(file_path),
            file_type=extension.lstrip("."),
            project_id=project_id
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        return {
            "message": "Document importé avec succès.",
            "id": document.id,
            "title": document.title,
            "filename": document.filename,
            "file_type": document.file_type,
            "project_id": document.project_id
        }

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


# ========================================
# AFFICHER TOUS LES DOCUMENTS
# ========================================

@router.get("/")
def get_documents():

    db: Session = SessionLocal()

    try:
        documents = (
            db.query(Document)
            .order_by(Document.id.desc())
            .all()
        )

        return [
            {
                "id": document.id,
                "title": document.title,
                "filename": document.filename,
                "file_type": document.file_type,
                "project_id": document.project_id,
                "project_name": (
                    document.project.name
                    if document.project else None
                ),
                "uploaded_at": (
                    document.uploaded_at.isoformat()
                    if document.uploaded_at else None
                )
            }
            for document in documents
        ]

    finally:
        db.close()


# ========================================
# OUVRIR UN DOCUMENT
# ========================================

@router.get("/{document_id}/open")
def open_document(document_id: int):

    db: Session = SessionLocal()

    try:
        document = db.query(Document).filter(
            Document.id == document_id
        ).first()

        if not document:
            raise HTTPException(
                status_code=404,
                detail="Document introuvable."
            )

        file_path = Path(document.file_path).resolve()

        if file_path.parent != UPLOAD_DIR.resolve():
            raise HTTPException(
                status_code=403,
                detail="Accès au fichier refusé."
            )

        if not file_path.is_file():
            raise HTTPException(
                status_code=404,
                detail="Fichier introuvable sur le serveur."
            )

        mime_type, _ = mimetypes.guess_type(document.filename)

        return FileResponse(
            path=file_path,
            filename=document.filename,
            media_type=mime_type or "application/octet-stream",
            content_disposition_type="inline"
        )

    finally:
        db.close()

# ========================================
# TELECHARGER UN DOCUMENT
# ========================================

@router.get("/{document_id}/download")
def download_document(document_id: int):

    db: Session = SessionLocal()

    try:
        document = db.query(Document).filter(
            Document.id == document_id
        ).first()

        if not document:
            raise HTTPException(
                status_code=404,
                detail="Document introuvable."
            )

        file_path = Path(document.file_path).resolve()

        if file_path.parent != UPLOAD_DIR.resolve():
            raise HTTPException(
                status_code=403,
                detail="Accès au fichier refusé."
            )

        if not file_path.is_file():
            raise HTTPException(
                status_code=404,
                detail="Fichier introuvable sur le serveur."
            )

        mime_type, _ = mimetypes.guess_type(document.filename)

        return FileResponse(
            path=file_path,
            filename=document.filename,
            media_type=mime_type or "application/octet-stream",
            content_disposition_type="attachment"
        )

    finally:
        db.close()


# ========================================
# SUPPRIMER UN DOCUMENT
# ========================================

@router.delete("/{document_id}")
def delete_document(document_id: int):

    db: Session = SessionLocal()

    try:
        document = db.query(Document).filter(
            Document.id == document_id
        ).first()

        if not document:
            raise HTTPException(
                status_code=404,
                detail="Document introuvable."
            )

        file_path = Path(document.file_path).resolve()

        if file_path.parent != UPLOAD_DIR.resolve():
            raise HTTPException(
                status_code=403,
                detail="Accès au fichier refusé."
            )

        # Supprimer le fichier physique
        if file_path.is_file():
            file_path.unlink()

        # Supprimer l'enregistrement PostgreSQL
        db.delete(document)
        db.commit()

        return {
            "message": "Document supprimé avec succès."
        }

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()

        # ========================================
# MODIFIER UN DOCUMENT
# ========================================

@router.put("/{document_id}")
def update_document(
    document_id: int,
    data: DocumentUpdate
):
    db: Session = SessionLocal()

    try:
        document = db.query(Document).filter(
            Document.id == document_id
        ).first()

        if not document:
            raise HTTPException(
                status_code=404,
                detail="Document introuvable."
            )

        # Vérifier le titre
        new_title = data.title.strip()

        if not new_title:
            raise HTTPException(
                status_code=400,
                detail="Le titre du document est obligatoire."
            )

        # Vérifier le projet associé
        if data.project_id is not None:
            project = db.query(Project).filter(
                Project.id == data.project_id
            ).first()

            if not project:
                raise HTTPException(
                    status_code=404,
                    detail="Projet introuvable."
                )

        # Mettre à jour les informations
        document.title = new_title
        document.project_id = data.project_id

        db.commit()
        db.refresh(document)

        return {
            "message": "Document modifié avec succès.",
            "id": document.id,
            "title": document.title,
            "project_id": document.project_id
        }

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()

