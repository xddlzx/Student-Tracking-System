import os, sys, pytest
from fastapi.testclient import TestClient

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.main import app

@pytest.fixture(scope="session")
def client():
    return TestClient(app)
