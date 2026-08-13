# Med Options Training Frontend

Static HTML, CSS, and JavaScript frontend for employee training. It uses the
FastAPI service through cookie authentication and has no build step.

## Local development

```bash
python3 -m http.server 5173
```

Open `http://localhost:5173`. If that port is occupied, use 5174 and add that
exact origin to the backend's local `FRONTEND_ORIGINS` value.

Public deployment configuration is in `js/config.js`. Secrets never belong in
this repository. GitHub Pages publishes the repository root and `CNAME`
contains `medoptionstraining.overturegroup.com`.
