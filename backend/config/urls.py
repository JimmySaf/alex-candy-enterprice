
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import FileResponse, HttpResponseNotFound
from django.urls import include, path, re_path


def frontend_index(request):
    index_file = settings.FRONTEND_DIST_DIR / "index.html"

    if not index_file.is_file():
        return HttpResponseNotFound(
            "Frontend build not found. Build the React frontend first."
        )

    return FileResponse(
        index_file.open("rb"),
        content_type="text/html",
    )


def frontend_logo(request):
    logo_file = settings.FRONTEND_DIST_DIR / "logo.jpeg"

    if not logo_file.is_file():
        return HttpResponseNotFound("Logo image not found.")

    return FileResponse(
        logo_file.open("rb"),
        content_type="image/jpeg",
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("products.urls")),
    path("api/", include("orders.urls")),
    path("logo.jpeg", frontend_logo, name="frontend-logo"),
    path("", frontend_index, name="frontend"),
    re_path(
        r"^(?!api/|admin/|static/|media/).+",
        frontend_index,
        name="frontend-spa-fallback",
    ),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )
