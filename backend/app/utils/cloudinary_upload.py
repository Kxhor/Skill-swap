import os
import cloudinary
import cloudinary.uploader

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}


def init_cloudinary():
    cloudinary.config(
        cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
        api_key=os.environ.get("CLOUDINARY_API_KEY"),
        api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    )


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def upload_photo(file, public_id=None):
    if not file or not allowed_file(file.filename):
        return None, "Invalid file type. Allowed: png, jpg, jpeg, gif, webp"

    try:
        upload_options = {
            "folder": "skill-swap/profiles",
            "transformation": [
                {"width": 400, "height": 400, "crop": "fill", "gravity": "face"}
            ],
            "resource_type": "image",
        }
        if public_id:
            upload_options["public_id"] = public_id

        result = cloudinary.uploader.upload(file, **upload_options)
        return result["secure_url"], None
    except Exception as e:
        print(f"[cloudinary_upload] Upload failed: {e}")
        return None, "Upload failed. Please try again."


def delete_photo(public_id):
    try:
        cloudinary.uploader.destroy(public_id)
        return True, None
    except Exception as e:
        return False, str(e)
