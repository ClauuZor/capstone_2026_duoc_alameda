from app.db.database import Base, engine
import app.models


def create_tables():
    print("Creando tablas de Cotiza+...")

    Base.metadata.create_all(bind=engine)

    print("Tablas creadas correctamente.")


if __name__ == "__main__":
    create_tables()