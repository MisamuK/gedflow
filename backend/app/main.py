
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import projects, documents
from app.database import Base, engine, SessionLocal
from app.models import User, Project, Document


app = FastAPI(
    title="GEDFLOW DATA HUB",
    description="Plateforme de gestion et de valorisation documentaire",
    version="1.0.0"
)

@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)


# CONFIGURATION CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "https://gedflow.onrender.com"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ROUTES
app.include_router(projects.router)
app.include_router(documents.router)


@app.get("/")
def accueil():
    return {
        "message": "Bienvenue sur GEDFLOW DATA HUB",
        "status": "API opérationnelle",
        "version": "1.0.0"
    }


@app.get("/api/dashboard")
def get_dashboard():

    db = SessionLocal()

    try:
        total_documents = db.query(Document).count()
        total_projects = db.query(Project).count()
        total_users = db.query(User).count()

        return {
            "total_documents": total_documents,
            "total_projects": total_projects,
            "total_users": total_users,
            "storage_used": "À calculer"
        }

    finally:
        db.close()
