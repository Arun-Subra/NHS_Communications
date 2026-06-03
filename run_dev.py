import sys
sys.path.insert(0, 'backend')
from app import app
app.run(port=8000, debug=False, use_reloader=False)
