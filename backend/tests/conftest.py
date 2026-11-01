import os
import tempfile
from pathlib import Path

# Isolated database and no Meta credentials for every test run. Must be set
# before app modules are imported (the engine is created at import time).
_tmp = Path(tempfile.mkdtemp(prefix="hydrosentinel-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp / 'test.db'}"
os.environ["META_MODEL_API_KEY"] = ""
