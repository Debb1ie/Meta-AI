import os
import tempfile
from pathlib import Path

# Isolated database and no Meta credentials for every test run. Must be set
# before app modules are imported (the engine is created at import time).
_tmp = Path(tempfile.mkdtemp(prefix="hydrosentinel-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp / 'test.db'}"
os.environ["META_MODEL_API_KEY"] = ""
# Deterministic demo data, no live network sync during tests.
os.environ["LIVE_DATA_ENABLED"] = "false"
os.environ["SEED_DEMO_DATA"] = "true"
# Admin key for data-changing endpoints; rate limits are exercised in test_security.py.
os.environ["ADMIN_TOKEN"] = "test-admin"
os.environ["RATE_LIMITS_ENABLED"] = "false"
