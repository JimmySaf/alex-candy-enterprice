
import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402


username = os.environ.get("DJANGO_SUPERUSER_USERNAME", "").strip()
password = os.environ.get("DJANGO_SUPERUSER_PASSWORD", "")
email = os.environ.get("DJANGO_SUPERUSER_EMAIL", "").strip()

if not username or not password:
    print("Production admin setup skipped: credentials are not configured.")
    raise SystemExit(0)

User = get_user_model()

user = User.objects.filter(username=username).first()

if user is None:
    user = User.objects.create_superuser(
        username=username,
        email=email,
        password=password,
    )
    print(f"Production administrator '{username}' created.")
elif user.is_superuser:
    print(f"Production administrator '{username}' already exists.")
else:
    raise RuntimeError(
        f"Username '{username}' already exists but is not a superuser. "
        "Choose a different DJANGO_SUPERUSER_USERNAME."
    )
